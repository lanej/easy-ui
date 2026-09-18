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
  { key: "service", name: "Service level" },
  { key: "packages", name: "Packages" },
  { key: "spend", name: "Spend" },
];
const rows = [
  { key: "a", carrier: "USPS", service: "Ground", packages: 3, spend: 12.5 },
  { key: "b", carrier: "UPS", service: "Ground", packages: 2, spend: 20 },
  { key: "c", carrier: "USPS", service: "Priority", packages: 7, spend: 37.5 },
];
type Props = DataGridProps<(typeof columns)[number], (typeof rows)[number]>;
const grouping: NonNullable<Props["grouping"]> = {
  getGroupKey: (row) => row.carrier,
  aggregators: {
    packages: (groupRows) =>
      groupRows.reduce((sum, row) => sum + row.packages, 0),
    spend: (groupRows) => groupRows.reduce((sum, row) => sum + row.spend, 0),
  },
};
function grid(props: Partial<Props> = {}) {
  return (
    <DataGrid
      aria-label="Grouped shipments"
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
function subtotalRows() {
  return bodyRows().filter((row) =>
    row.hasAttribute("data-ezui-data-grid-subtotal"),
  );
}
function cells(row: HTMLElement) {
  return [...row.children].map((cell) => cell.textContent);
}

describe("DataGrid grouping", () => {
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

  it("groups nonadjacent rows in first-seen order and inserts computed subtotals", () => {
    render(grid());
    expect(bodyRows().map(cells)).toEqual([
      ["USPS", "Ground", "3", "12.5"],
      ["USPS", "Priority", "7", "37.5"],
      ["USPS subtotal", "", "10", "50"],
      ["UPS", "Ground", "2", "20"],
      ["UPS subtotal", "", "2", "20"],
    ]);
    expect(subtotalRows()).toHaveLength(2);
    for (const subtotal of subtotalRows()) {
      expect(subtotal).toHaveAttribute(
        "class",
        expect.stringContaining("subtotal"),
      );
      expect(within(subtotal).getByRole("rowheader")).toBeInTheDocument();
    }
  });

  it("passes group rows to caller aggregators and keeps subtotal rendering separate", () => {
    const aggregate = vi.fn((groupRows: readonly (typeof rows)[number][]) =>
      Math.max(...groupRows.map((row) => row.packages)),
    );
    const renderRowCell = vi.fn<Props["renderRowCell"]>((cell) => String(cell));
    const renderSubtotalCell = vi.fn<
      NonNullable<NonNullable<Props["grouping"]>["renderSubtotalCell"]>
    >((cell, columnKey, group) =>
      columnKey === "carrier"
        ? `${group.key}: ${group.rows.length} services`
        : String(cell ?? ""),
    );
    render(
      grid({
        renderRowCell,
        grouping: {
          ...grouping,
          aggregators: { packages: aggregate },
          renderSubtotalCell,
        },
      }),
    );
    expect(aggregate).toHaveBeenCalledWith([rows[0], rows[2]]);
    expect(aggregate).toHaveBeenCalledWith([rows[1]]);
    expect(subtotalRows().map(cells)).toEqual([
      ["USPS: 2 services", "", "7", ""],
      ["UPS: 1 services", "", "2", ""],
    ]);
    expect(
      renderRowCell.mock.calls.every((call) => rows.includes(call[2])),
    ).toBe(true);
    expect(renderSubtotalCell).toHaveBeenCalledWith(7, "packages", {
      key: "USPS",
      rows: [rows[0], rows[2]],
    });
  });

  it("preserves ungrouped row order and rendering when grouping is omitted or removed", () => {
    const { rerender } = render(grid({ grouping: undefined }));
    expect(bodyRows().map((row) => row.getAttribute("data-key"))).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(subtotalRows()).toHaveLength(0);
    rerender(grid());
    expect(subtotalRows()).toHaveLength(2);
    rerender(grid({ grouping: undefined }));
    expect(subtotalRows()).toHaveLength(0);
    expect(bodyRows()).toHaveLength(3);
  });

  it("recomputes on new rows or aggregators and handles empty input", () => {
    const { rerender } = render(grid());
    rerender(grid({ rows: [{ ...rows[0], spend: 99, packages: 0 }] }));
    expect(subtotalRows().map(cells)).toEqual([
      ["USPS subtotal", "", "0", "99"],
    ]);
    rerender(
      grid({ grouping: { ...grouping, aggregators: { packages: () => 42 } } }),
    );
    expect(subtotalRows()[0]).toHaveTextContent("42");
    rerender(grid({ rows: [] }));
    expect(screen.getByText("No Data")).toBeInTheDocument();
    expect(subtotalRows()).toHaveLength(0);
  });

  it("distinguishes numeric and string group keys and avoids consumer key collisions", () => {
    render(
      grid({
        rows: [{ ...rows[0], key: "__ezui_subtotal_string:1" }, rows[1]],
        grouping: {
          ...grouping,
          getGroupKey: (row) => (row.carrier === "USPS" ? "1" : 1),
        },
      }),
    );
    expect(bodyRows()).toHaveLength(4);
    expect(subtotalRows()).toHaveLength(2);
    expect(
      new Set(bodyRows().map((row) => row.getAttribute("data-key"))).size,
    ).toBe(4);
    expect(subtotalRows().map(cells)).toEqual([
      ["1 subtotal", "", "3", "12.5"],
      ["1 subtotal", "", "2", "20"],
    ]);
  });

  it("keeps subtotals after their groups when the consumer sorts rows", async () => {
    const onSortChange = vi.fn();
    const props = { onSortChange, columnKeysAllowingSort: ["packages"] };
    const { user, rerender } = render(grid(props));
    const originalKeys = subtotalRows().map((row) =>
      row.getAttribute("data-key"),
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
      grid({
        ...props,
        rows: [rows[1], rows[0], rows[2]],
        sortDescriptor: { column: "packages", direction: "ascending" },
      }),
    );
    expect(bodyRows().map(cells)).toEqual([
      ["UPS", "Ground", "2", "20"],
      ["UPS subtotal", "", "2", "20"],
      ["USPS", "Ground", "3", "12.5"],
      ["USPS", "Priority", "7", "37.5"],
      ["USPS subtotal", "", "10", "50"],
    ]);
    expect(subtotalRows().map((row) => row.getAttribute("data-key"))).toEqual(
      originalKeys.reverse(),
    );
    expect(
      screen.getByRole("columnheader", { name: "Packages" }),
    ).toHaveAttribute("aria-sort", "ascending");
  });

  it.each(["single", "multiple"] as const)(
    "excludes subtotals from %s selection and retains disabled rows",
    async (selectionMode) => {
      const onSelectionChange = vi.fn();
      const { user } = render(
        grid({ selectionMode, disabledKeys: ["b"], onSelectionChange }),
      );
      for (const subtotal of subtotalRows()) {
        expect(
          within(subtotal).queryByRole("checkbox"),
        ).not.toBeInTheDocument();
        await userClick(user, within(subtotal).getByRole("rowheader"));
      }
      expect(onSelectionChange).not.toHaveBeenCalled();
      const checkboxes = bodyRows().flatMap((row) =>
        within(row).queryAllByRole("checkbox"),
      );
      expect(checkboxes).toHaveLength(3);
      expect(checkboxes[2]).toBeDisabled();
      await userClick(user, checkboxes[0]);
      expect([...onSelectionChange.mock.lastCall![0]]).toEqual(["a"]);
      if (selectionMode === "multiple") {
        await userClick(
          user,
          screen.getByRole("checkbox", { name: "Select All" }),
        );
        expect(onSelectionChange.mock.lastCall![0]).toBe("all");
        expect(checkboxes[0]).toBeChecked();
        expect(checkboxes[1]).toBeChecked();
        expect(checkboxes[2]).not.toBeChecked();
        await userClick(user, checkboxes[0]);
        expect([...onSelectionChange.mock.lastCall![0]]).toEqual(["c"]);
      }
    },
  );

  it.each(["selectedKeys", "defaultSelectedKeys"] as const)(
    "supports %s all without selecting subtotal rows",
    (prop) => {
      render(grid({ selectionMode: "multiple", [prop]: "all" }));
      expect(
        bodyRows().filter(
          (row) => row.getAttribute("aria-selected") === "true",
        ),
      ).toHaveLength(3);
      for (const subtotal of subtotalRows()) {
        expect(subtotal).not.toHaveAttribute("aria-selected", "true");
      }
    },
  );

  it("only expands data rows, including rows after a subtotal, and retains controlled expansion", async () => {
    const onExpandedChange = vi.fn();
    const renderExpandedRow = vi.fn((key) => <div>Details {key}</div>);
    const props = { renderExpandedRow, onExpandedChange };
    const { user, rerender } = render(grid(props));
    expect(screen.getAllByRole("button", { name: "Expand" })).toHaveLength(3);
    for (const subtotal of subtotalRows()) {
      expect(within(subtotal).queryByRole("button")).not.toBeInTheDocument();
    }
    await userClick(
      user,
      within(bodyRows()[3]).getByRole("button", { name: "Expand" }),
    );
    expect(onExpandedChange).toHaveBeenCalledWith("b");
    expect(screen.getByText("Details b")).toBeInTheDocument();
    rerender(grid({ ...props, expandedKey: "c" }));
    expect(screen.getByText("Details c")).toBeInTheDocument();
    expect(screen.queryByText("Details b")).not.toBeInTheDocument();
  });

  it("never invokes row, cell, or menu actions for subtotals", async () => {
    const onRowAction = vi.fn();
    const onCellAction = vi.fn();
    const rowActions = vi.fn<NonNullable<Props["rowActions"]>>(() => []);
    const { user, rerender } = render(
      grid({ onRowAction, onCellAction, rowActions }),
    );
    expect(
      rowActions.mock.calls.every((call) => ["a", "b", "c"].includes(call[0])),
    ).toBe(true);
    for (const subtotal of subtotalRows()) {
      expect(within(subtotal).queryByRole("button")).not.toBeInTheDocument();
      await userClick(user, within(subtotal).getByRole("rowheader"));
      await user.keyboard("{Enter}");
    }
    expect(onRowAction).not.toHaveBeenCalled();
    expect(onCellAction).not.toHaveBeenCalled();
    await userClick(user, within(bodyRows()[0]).getByRole("rowheader"));
    expect(onCellAction).toHaveBeenCalled();
    rerender(grid({ onRowAction, rowActions }));
    await userClick(user, within(bodyRows()[0]).getByRole("rowheader"));
    expect(onRowAction).toHaveBeenCalledWith("a");
  });
});
