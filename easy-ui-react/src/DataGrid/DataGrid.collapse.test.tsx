import { screen, within } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import {
  mockGetComputedStyle,
  mockIntersectionObserver,
  render,
  userClick,
} from "../utilities/test";
import { DataGrid } from "./DataGrid";
import { DataGridProps } from "./types";

const columns = [
  { key: "carrier", name: "Carrier" },
  { key: "service", name: "Service" },
  { key: "packages", name: "Packages" },
];
const rows = [
  { key: "a", carrier: "USPS", service: "Ground", packages: 3 },
  { key: "b", carrier: "UPS", service: "Express", packages: 2 },
  { key: "c", carrier: "USPS", service: "Priority", packages: 7 },
];
type Props = DataGridProps<(typeof columns)[number], (typeof rows)[number]>;
const grouping: NonNullable<Props["grouping"]> = {
  getGroupKey: (row) => row.carrier,
  aggregators: {
    packages: (group) => group.reduce((sum, row) => sum + row.packages, 0),
  },
  isCollapsible: true,
};
function grid(props: Partial<Props> = {}) {
  return (
    <DataGrid
      aria-label="Collapsible shipments"
      columns={columns}
      rows={rows}
      grouping={grouping}
      renderColumnCell={(column) => column.name}
      renderRowCell={(cell) => String(cell)}
      {...props}
    />
  );
}
function bodyRows() {
  return within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");
}
function dataRow(key: string) {
  return bodyRows().find((row) => row.getAttribute("data-key") === key)!;
}
function subtotal(carrier: string) {
  return screen.getByRole("row", { name: new RegExp(`${carrier} subtotal`) });
}

describe("DataGrid group collapsing", () => {
  let restoreStyle: () => void;
  let restoreObserver: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    restoreStyle = mockGetComputedStyle();
    restoreObserver = mockIntersectionObserver();
  });
  afterEach(() => {
    restoreStyle();
    restoreObserver();
    vi.useRealTimers();
  });

  it("hides only a group's detail rows, retains its total, and restores the rows", async () => {
    const { user } = render(grid());
    const toggle = screen.getByRole("button", { name: "Collapse USPS group" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userClick(user, toggle);
    expect(bodyRows()).toHaveLength(3);
    expect(screen.queryByText("Priority")).not.toBeInTheDocument();
    expect(
      within(subtotal("USPS")).getByRole("gridcell", { name: "10" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Express")).toBeInTheDocument();
    expect(toggle).toHaveAccessibleName("Expand USPS group");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
    await userClick(user, toggle);
    expect(bodyRows()).toHaveLength(5);
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it.each(["{Enter}", " "])(
    "toggles with %s without dispatching row or cell actions",
    async (key) => {
      const onRowAction = vi.fn();
      const onCellAction = vi.fn();
      const { user } = render(grid({ onRowAction, onCellAction }));
      const toggle = screen.getByRole("button", {
        name: "Collapse USPS group",
      });
      await userClick(user, toggle);
      expect(toggle).toHaveFocus();
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      await user.keyboard(key);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(onRowAction).not.toHaveBeenCalled();
      expect(onCellAction).not.toHaveBeenCalled();
      await user.keyboard(key);
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    },
  );

  it("supports initial collapsed groups and controlled group state", async () => {
    const onCollapsedChange = vi.fn();
    const { user, rerender } = render(
      grid({
        grouping: {
          ...grouping,
          defaultCollapsedKeys: ["USPS"],
          onCollapsedChange,
        },
      }),
    );
    expect(bodyRows()).toHaveLength(3);
    await userClick(
      user,
      screen.getByRole("button", { name: "Expand USPS group" }),
    );
    expect(onCollapsedChange).toHaveBeenLastCalledWith(new Set());
    rerender(
      grid({
        grouping: {
          ...grouping,
          collapsedKeys: new Set(["UPS"]),
          onCollapsedChange,
        },
      }),
    );
    await userClick(
      user,
      screen.getByRole("button", { name: "Collapse USPS group" }),
    );
    expect(onCollapsedChange).toHaveBeenLastCalledWith(
      new Set(["UPS", "USPS"]),
    );
    expect(bodyRows()).toHaveLength(4);
    rerender(
      grid({
        grouping: {
          ...grouping,
          collapsedKeys: ["UPS", "USPS"],
          onCollapsedChange,
        },
      }),
    );
    expect(bodyRows()).toHaveLength(2);
    expect(screen.queryByText("No Data")).not.toBeInTheDocument();
  });

  it("is opt-in and restores all details when collapsing is disabled", async () => {
    const { user, rerender } = render(grid());
    await userClick(
      user,
      screen.getByRole("button", { name: "Collapse USPS group" }),
    );
    rerender(grid({ grouping: { ...grouping, isCollapsible: false } }));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(bodyRows()).toHaveLength(5);
    rerender(grid({ grouping: undefined }));
    expect(bodyRows()).toHaveLength(3);
  });

  it("preserves collapse state across sorting and recomputes totals from updated hidden rows", async () => {
    const onSortChange = vi.fn();
    const props = { onSortChange, columnKeysAllowingSort: ["packages"] };
    const { user, rerender } = render(grid(props));
    await userClick(
      user,
      screen.getByRole("button", { name: "Collapse USPS group" }),
    );
    await userClick(
      user,
      screen.getByRole("columnheader", { name: "Packages" }),
    );
    expect(onSortChange).toHaveBeenCalledWith({
      column: "packages",
      direction: "ascending",
    });
    rerender(
      grid({ ...props, rows: [rows[1], { ...rows[0], packages: 5 }, rows[2]] }),
    );
    expect(bodyRows()).toHaveLength(3);
    expect(bodyRows()[2]).toBe(subtotal("USPS"));
    expect(
      within(subtotal("USPS")).getByRole("gridcell", { name: "12" }),
    ).toBeInTheDocument();
  });

  it("keeps selected hidden rows and select-all includes all supplied selectable rows", async () => {
    const onSelectionChange = vi.fn();
    const { user } = render(
      grid({
        selectionMode: "multiple",
        disabledKeys: ["c"],
        onSelectionChange,
      }),
    );
    await userClick(user, within(dataRow("a")).getByRole("checkbox"));
    onSelectionChange.mockClear();
    await userClick(
      user,
      screen.getByRole("button", { name: "Collapse USPS group" }),
    );
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole("checkbox", { name: "Select All" }),
    ).toBePartiallyChecked();
    await userClick(user, screen.getByRole("checkbox", { name: "Select All" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith("all");
    await userClick(user, within(dataRow("b")).getByRole("checkbox"));
    expect([...onSelectionChange.mock.lastCall![0]]).toEqual(["a"]);
    await userClick(
      user,
      screen.getByRole("button", { name: "Expand USPS group" }),
    );
    expect(within(dataRow("a")).getByRole("checkbox")).toBeChecked();
    expect(within(dataRow("c")).getByRole("checkbox")).toBeDisabled();
    expect(within(dataRow("c")).getByRole("checkbox")).not.toBeChecked();
  });

  it("keeps select-all usable when every group is collapsed", async () => {
    const onSelectionChange = vi.fn();
    const { user } = render(
      grid({
        selectionMode: "multiple",
        defaultSelectedKeys: ["a"],
        onSelectionChange,
        grouping: { ...grouping, defaultCollapsedKeys: ["USPS", "UPS"] },
      }),
    );
    const selectAll = screen.getByRole("checkbox", { name: "Select All" });
    expect(selectAll).toBePartiallyChecked();
    await userClick(user, selectAll);
    expect(onSelectionChange).toHaveBeenLastCalledWith("all");
    expect(selectAll).toBeChecked();
    await userClick(user, selectAll);
    expect([...onSelectionChange.mock.lastCall![0]]).toEqual([]);
  });

  it("retains controlled selection without emitting a change on collapse", async () => {
    const onSelectionChange = vi.fn();
    const { user } = render(
      grid({
        selectionMode: "multiple",
        selectedKeys: "all",
        onSelectionChange,
      }),
    );
    await userClick(
      user,
      screen.getByRole("button", { name: "Collapse USPS group" }),
    );
    expect(onSelectionChange).not.toHaveBeenCalled();
    await userClick(user, within(dataRow("b")).getByRole("checkbox"));
    expect(new Set(onSelectionChange.mock.lastCall![0])).toEqual(
      new Set(["a", "c"]),
    );
    expect(within(dataRow("b")).getByRole("checkbox")).toBeChecked();
  });

  it("temporarily hides expanded row details and restores them when the group opens", async () => {
    const onExpandedChange = vi.fn();
    const { user } = render(
      grid({
        renderExpandedRow: (key) => <div>Details {key}</div>,
        defaultExpandedKey: "a",
        onExpandedChange,
      }),
    );
    expect(screen.getByText("Details a")).toBeInTheDocument();
    await userClick(
      user,
      screen.getByRole("button", { name: "Collapse USPS group" }),
    );
    expect(screen.queryByText("Details a")).not.toBeInTheDocument();
    expect(onExpandedChange).not.toHaveBeenCalled();
    await userClick(
      user,
      screen.getByRole("button", { name: "Expand USPS group" }),
    );
    expect(screen.getByText("Details a")).toBeInTheDocument();
  });

  it("skips collapsed details during keyboard navigation", async () => {
    const { user } = render(
      grid({ grouping: { ...grouping, defaultCollapsedKeys: ["USPS"] } }),
    );
    await userClick(user, within(subtotal("USPS")).getByRole("rowheader"));
    await user.keyboard("{ArrowDown}");
    expect(dataRow("b")).toContainElement(
      document.activeElement as HTMLElement,
    );
  });

  it("uses group key types rather than row keys when deciding which group to collapse", () => {
    render(
      grid({
        grouping: {
          ...grouping,
          getGroupKey: (row) => (row.carrier === "USPS" ? "1" : 1),
          defaultCollapsedKeys: [1],
        },
      }),
    );
    expect(screen.getByText("Ground")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.queryByText("Express")).not.toBeInTheDocument();
  });

  it("reaches group toggles from detail cells using only arrow navigation", async () => {
    const { user } = render(grid());
    await userClick(user, within(dataRow("c")).getByRole("rowheader"));
    await user.keyboard("{ArrowDown}");
    const toggle = screen.getByRole("button", { name: "Collapse USPS group" });
    expect(toggle).toHaveFocus();
    await user.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });

  it("moves focus to the subtotal if a controlled collapse hides the focused row", async () => {
    const { user, rerender } = render(grid());
    await userClick(user, within(dataRow("a")).getByRole("rowheader"));
    rerender(grid({ grouping: { ...grouping, collapsedKeys: ["USPS"] } }));
    expect(subtotal("USPS")).toContainElement(
      document.activeElement as HTMLElement,
    );
  });
});
