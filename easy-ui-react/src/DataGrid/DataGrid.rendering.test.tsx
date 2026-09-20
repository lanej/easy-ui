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
  { key: "name", name: "Name" },
  { key: "value", name: "Value" },
];
const rows = [
  { key: "a", group: 42, name: "Alpha", value: 2 },
  { key: "b", group: 42, name: "Beta", value: 3 },
  { key: "c", group: 99, name: "Gamma", value: 5 },
];
type Props = DataGridProps<(typeof columns)[number], (typeof rows)[number]>;
const grouping: NonNullable<Props["grouping"]> = {
  getGroupKey: (row) => row.group,
  getGroupLabel: (group) =>
    group.key === 42 ? "Livraisons locales" : "International",
  aggregators: {
    value: (rows) => rows.reduce((total, row) => total + row.value, 0),
  },
  isCollapsible: true,
};
function grid(props: Partial<Props> = {}) {
  return (
    <DataGrid
      aria-label="Efficient grouped grid"
      columns={columns}
      rows={rows}
      grouping={grouping}
      renderColumnCell={(column) => column.name}
      renderRowCell={(value) => String(value)}
      {...props}
    />
  );
}

describe("DataGrid group labels and rendering", () => {
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

  it("uses human-readable labels with opaque keys, independently of custom subtotal contents", async () => {
    const onCollapsedChange = vi.fn();
    const renderSubtotalCell = vi.fn((value, key, group) =>
      key === "name" ? `Summary ${group.rows.length}` : String(value),
    );
    const { user } = render(
      grid({
        grouping: { ...grouping, onCollapsedChange, renderSubtotalCell },
      }),
    );
    const toggle = screen.getByRole("button", {
      name: "Collapse Livraisons locales group",
    });
    expect(screen.getByText("Summary 2")).toBeInTheDocument();
    expect(renderSubtotalCell).toHaveBeenCalledWith(
      "Livraisons locales subtotal",
      "name",
      { key: 42, rows: rows.slice(0, 2) },
    );
    await userClick(user, toggle);
    expect(toggle).toHaveAccessibleName("Expand Livraisons locales group");
    expect(onCollapsedChange).toHaveBeenLastCalledWith(new Set([42]));
  });

  it("skips hidden cell and action renderers while aggregating and selecting all selectable rows", async () => {
    const renderRowCell = vi.fn((value, _key, _row) => String(value));
    const rowActions = vi.fn((_key) => []);
    const aggregate = vi.fn(grouping.aggregators.value!);
    const onSelectionChange = vi.fn();
    const { user } = render(
      grid({
        selectionMode: "multiple",
        disabledKeys: ["b"],
        renderRowCell,
        rowActions,
        onSelectionChange,
        grouping: {
          ...grouping,
          defaultCollapsedKeys: [42, 99],
          aggregators: { value: aggregate },
        },
      }),
    );
    expect(renderRowCell).not.toHaveBeenCalled();
    expect(rowActions).not.toHaveBeenCalled();
    expect(aggregate).toHaveBeenCalledWith(rows.slice(0, 2));
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    await userClick(user, screen.getByRole("checkbox"));
    expect(onSelectionChange).toHaveBeenLastCalledWith("all");
    await userClick(
      user,
      screen.getByRole("button", { name: "Expand Livraisons locales group" }),
    );
    const alpha = screen.getByRole("row", { name: /Alpha/ });
    const beta = screen.getByRole("row", { name: /Beta/ });
    expect(within(alpha).getByRole("checkbox")).toBeChecked();
    expect(within(beta).getByRole("checkbox")).not.toBeChecked();
    expect(within(beta).getByRole("checkbox")).toBeDisabled();
    expect(
      renderRowCell.mock.calls.every(([, , row]) => row.group === 42),
    ).toBe(true);
    expect(rowActions.mock.calls.map(([key]) => key)).not.toContain("c");
    await userClick(user, within(alpha).getByRole("checkbox"));
    expect(new Set(onSelectionChange.mock.lastCall![0])).toEqual(
      new Set(["c"]),
    );
  });

  it("renders only visible cells on collapse, refresh, and reopen", async () => {
    const renderRowCell = vi.fn((value, _key, _row) => String(value));
    const base = {
      renderRowCell,
      grouping: { ...grouping, defaultCollapsedKeys: [42] },
    };
    const { user, rerender } = render(grid(base));
    expect(renderRowCell.mock.calls).toHaveLength(2);
    expect(renderRowCell.mock.calls.every(([, , row]) => row.key === "c")).toBe(
      true,
    );
    renderRowCell.mockClear();
    const updated = rows.map((row) => ({ ...row, value: row.value + 10 }));
    rerender(grid({ ...base, rows: updated }));
    expect(renderRowCell.mock.calls).toHaveLength(2);
    expect(
      screen.getByRole("row", { name: /Livraisons locales subtotal/ }),
    ).toHaveTextContent("25");
    await userClick(
      user,
      screen.getByRole("button", { name: "Expand Livraisons locales group" }),
    );
    expect(screen.getByRole("row", { name: /Alpha/ })).toHaveTextContent("12");
    expect(screen.getByRole("row", { name: /Beta/ })).toHaveTextContent("13");
    renderRowCell.mockClear();
    await userClick(
      user,
      screen.getByRole("button", { name: "Collapse Livraisons locales group" }),
    );
    expect(renderRowCell.mock.calls.every(([, , row]) => row.key === "c")).toBe(
      true,
    );
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });
});
