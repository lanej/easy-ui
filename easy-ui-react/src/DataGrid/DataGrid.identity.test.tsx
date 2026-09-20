import { fireEvent, screen, within } from "@testing-library/react";
import React, { useState } from "react";
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
  { key: "packages", name: "Packages" },
];
type Shipment = { key: string; carrier: string | number; packages: number };
const rows: Shipment[] = [
  { key: "a", carrier: "USPS", packages: 3 },
  { key: "b", carrier: "UPS", packages: 2 },
  { key: "c", carrier: "USPS", packages: 7 },
];
type Props = DataGridProps<(typeof columns)[number], Shipment>;

function StatefulSubtotalCell({ label }: { label: string }) {
  const [count, setCount] = useState(0);
  const [note, setNote] = useState("");
  return (
    <span>
      <button
        type="button"
        aria-label={`${label} count`}
        onClick={() => setCount((value) => value + 1)}
      >
        {count}
      </button>
      <input
        aria-label={`${label} note`}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
    </span>
  );
}

const grouping: NonNullable<Props["grouping"]> = {
  getGroupKey: (row) => row.carrier,
  aggregators: {},
  isCollapsible: true,
  renderSubtotalCell: (_value, columnKey, group) => (
    <StatefulSubtotalCell
      label={`${typeof group.key} ${group.key} ${columnKey}`}
    />
  ),
};

function grid(props: Partial<Props> = {}) {
  return (
    <DataGrid
      aria-label="Subtotal identity"
      columns={columns}
      rows={rows}
      grouping={grouping}
      renderColumnCell={(column) => column.name}
      renderRowCell={(value) => String(value)}
      {...props}
    />
  );
}

function note(group: string | number, column = "carrier") {
  return screen.getByRole("textbox", {
    name: `${typeof group} ${group} ${column} note`,
  });
}

function counter(group: string | number, column = "carrier") {
  return screen.getByRole("button", {
    name: `${typeof group} ${group} ${column} count`,
  });
}

function subtotal(group: string | number) {
  return note(group).closest("tr")!;
}

function dataRow(key: string) {
  return within(screen.getAllByRole("rowgroup")[1])
    .getAllByRole("row")
    .find((row) => row.getAttribute("data-key") === key)!;
}

describe("DataGrid subtotal identity", () => {
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

  it("preserves each subtotal cell's state as colliding rows appear, reorder, and disappear", async () => {
    const { user, rerender } = render(grid());
    const originalRow = subtotal("USPS");
    const originalNotes = [note("USPS"), note("USPS", "packages")];
    const originalCounters = [counter("USPS"), counter("USPS", "packages")];
    await user.type(originalNotes[0], "Carrier note");
    await user.type(originalNotes[1], "Package note");
    await userClick(user, originalCounters[0]);
    await userClick(user, originalCounters[1]);
    await userClick(user, originalCounters[1]);

    const assertState = () => {
      expect(subtotal("USPS")).toBe(originalRow);
      for (const [index, column] of ["carrier", "packages"].entries()) {
        expect(note("USPS", column)).toBe(originalNotes[index]);
        expect(counter("USPS", column)).toBe(originalCounters[index]);
        expect(originalCounters[index]).toHaveTextContent(String(index + 1));
      }
      expect(originalNotes[0]).toHaveValue("Carrier note");
      expect(originalNotes[1]).toHaveValue("Package note");
      expect(note("UPS")).toHaveValue("");
      expect(counter("UPS")).toHaveTextContent("0");
    };

    const firstCollision = {
      ...rows[0],
      key: originalRow.getAttribute("data-key")!,
    };
    rerender(grid({ rows: [...rows, firstCollision] }));
    expect(dataRow(firstCollision.key)).not.toHaveAttribute(
      "data-ezui-data-grid-subtotal",
    );
    assertState();

    const secondCollision = {
      ...rows[0],
      key: originalRow.getAttribute("data-key")!,
    };
    const collidingRows = [...rows, firstCollision, secondCollision];
    for (const nextRows of [
      collidingRows,
      [...collidingRows].reverse(),
      [...rows, secondCollision],
      rows,
    ]) {
      rerender(grid({ rows: nextRows }));
      assertState();
    }
  });

  it("keeps a subtotal input focused and navigates from its group after collision changes", async () => {
    const { user, rerender } = render(grid());
    const input = note("USPS", "packages");
    const collision = {
      ...rows[0],
      key: subtotal("USPS").getAttribute("data-key")!,
    };
    await userClick(user, input);
    fireEvent.change(input, { target: { value: "Keep focus here" } });
    expect(input).toHaveFocus();

    rerender(grid({ rows: [...rows, collision] }));
    expect(note("USPS", "packages")).toBe(input);
    expect(input).toHaveFocus();
    expect(input).toHaveValue("Keep focus here");
    await user.keyboard("{ArrowDown}");
    expect(dataRow("b")).toContainElement(
      document.activeElement as HTMLElement,
    );

    await userClick(user, input);
    rerender(grid());
    expect(input).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(dataRow("b")).toContainElement(
      document.activeElement as HTMLElement,
    );
  });

  it("does not take focus from an external control when subtotal keys change", async () => {
    const view = (nextRows: Shipment[]) => (
      <>
        <button type="button">Outside the grid</button>
        {grid({ rows: nextRows })}
      </>
    );
    const { user, rerender } = render(view(rows));
    const collision = {
      ...rows[0],
      key: subtotal("USPS").getAttribute("data-key")!,
    };
    await userClick(user, note("USPS", "packages"));
    const outside = screen.getByRole("button", { name: "Outside the grid" });
    await userClick(user, outside);

    rerender(view([...rows, collision]));
    expect(outside).toHaveFocus();
    rerender(view(rows));
    expect(outside).toHaveFocus();
  });

  it("keeps numeric and string group state distinct through reordering and collision changes", async () => {
    const typedRows: Shipment[] = [
      { key: "numeric", carrier: 1, packages: 3 },
      { key: "string", carrier: "1", packages: 2 },
    ];
    const { user, rerender } = render(grid({ rows: typedRows }));
    const numericRow = subtotal(1);
    const stringRow = subtotal("1");
    await user.type(note(1), "Numeric group");
    await user.type(note("1"), "String group");
    await userClick(user, counter(1, "packages"));
    const collision = {
      ...typedRows[0],
      key: numericRow.getAttribute("data-key")!,
    };

    for (const nextRows of [
      [...typedRows, collision].reverse(),
      [...typedRows].reverse(),
      typedRows,
    ]) {
      rerender(grid({ rows: nextRows }));
      expect(subtotal(1)).toBe(numericRow);
      expect(subtotal("1")).toBe(stringRow);
      expect(note(1)).toHaveValue("Numeric group");
      expect(note("1")).toHaveValue("String group");
      expect(counter(1, "packages")).toHaveTextContent("1");
      expect(counter("1", "packages")).toHaveTextContent("0");
    }
  });
});
