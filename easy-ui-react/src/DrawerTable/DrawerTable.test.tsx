import React, { useEffect, useState } from "react";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../utilities/test";
import { Button } from "../Button";
import { DrawerRow } from "./DrawerRow";
import { DrawerTable, DrawerTableProps } from "./DrawerTable";

const rows = [
  { key: "a", label: "Parcel A" },
  { key: "b", label: "Parcel B" },
];
type Parcel = (typeof rows)[number];
const fixture: DrawerTableProps<Parcel> = {
  "aria-label": "Parcels",
  rows,
  renderRow: (row) => row.label,
  renderExpandedRow: (row) => (
    <label>
      Note for {row.label} <input defaultValue="" />
    </label>
  ),
};
const panel = (name: string) => {
  const button = screen.getByRole("button", { name });
  return document.getElementById(button.getAttribute("aria-controls")!)!;
};

it("opens full-width details without replacing or duplicating the row summary", async () => {
  const user = userEvent.setup();
  render(<DrawerTable {...fixture} />);
  expect(screen.getByRole("list", { name: "Parcels" })).toBeInTheDocument();
  expect(screen.getByRole("list", { name: "Parcels" })).toHaveAttribute(
    "role",
    "list",
  );
  expect(screen.queryByRole("textbox")).toBeNull();
  const trigger = screen.getByRole("button", { name: "Parcel A" });
  expect(panel("Parcel A")).not.toBeVisible();
  await user.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(screen.getAllByText("Parcel A")).toHaveLength(1);
  expect(panel("Parcel A")).toBeVisible();
  expect(
    screen.getByRole("textbox", { name: "Note for Parcel A" }),
  ).toBeVisible();
  await user.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("textbox")).toBeNull();
});

it("opens one row at a time and reports the requested next key", async () => {
  const onExpandedChange = vi.fn();
  const user = userEvent.setup();
  render(<DrawerTable {...fixture} onExpandedChange={onExpandedChange} />);
  await user.click(screen.getByRole("button", { name: "Parcel A" }));
  await user.click(screen.getByRole("button", { name: "Parcel B" }));
  expect(panel("Parcel A")).not.toBeVisible();
  expect(panel("Parcel B")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Parcel B" }));
  expect(onExpandedChange.mock.calls).toEqual([["a"], ["b"], [null]]);
});

it("honors controlled null until the caller accepts expansion", async () => {
  const onExpandedChange = vi.fn();
  const user = userEvent.setup();
  const { rerender } = render(
    <DrawerTable
      {...fixture}
      expandedKey={null}
      onExpandedChange={onExpandedChange}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Parcel A" }));
  expect(onExpandedChange).toHaveBeenLastCalledWith("a");
  expect(panel("Parcel A")).not.toBeVisible();
  rerender(
    <DrawerTable
      {...fixture}
      expandedKey="a"
      onExpandedChange={onExpandedChange}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Parcel A" }));
  expect(onExpandedChange).toHaveBeenLastCalledWith(null);
  expect(panel("Parcel A")).toBeVisible();
});

it("supports keyboard activation, disabled rows, and independent action buttons", async () => {
  const action = vi.fn();
  const changed = vi.fn();
  const user = userEvent.setup();
  render(
    <DrawerTable
      {...fixture}
      onExpandedChange={changed}
      isRowDisabled={(row) => row.key === "b"}
      renderRowActions={(row) => (
        <Button onPress={action}>Track {row.label}</Button>
      )}
    />,
  );
  await user.tab();
  expect(screen.getByRole("button", { name: "Parcel A" })).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(changed).toHaveBeenCalledExactlyOnceWith("a");
  await user.keyboard(" ");
  expect(changed).toHaveBeenLastCalledWith(null);
  await user.click(screen.getByRole("button", { name: "Track Parcel A" }));
  expect(action).toHaveBeenCalledOnce();
  expect(changed).toHaveBeenCalledTimes(2);
  const disabled = screen.getByRole("button", { name: "Parcel B" });
  expect(disabled).toBeDisabled();
  await user.click(disabled);
  expect(changed).toHaveBeenCalledTimes(2);
  expect(
    screen.getByRole("button", { name: "Track Parcel B" }),
  ).not.toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Parcel A" }).querySelector("button"),
  ).toBeNull();
});

it("keeps preserved forms with the same key when rows reorder", async () => {
  const user = userEvent.setup();
  const { rerender } = render(
    <DrawerTable {...fixture} defaultExpandedKey="a" mountPolicy="preserve" />,
  );
  const input = screen.getByRole("textbox", { name: "Note for Parcel A" });
  await user.type(input, "Keep this note");
  rerender(
    <DrawerTable
      {...fixture}
      rows={[{ ...rows[1] }, { ...rows[0] }]}
      defaultExpandedKey="a"
      mountPolicy="preserve"
    />,
  );
  expect(screen.getByRole("textbox", { name: "Note for Parcel A" })).toBe(
    input,
  );
  expect(input).toHaveValue("Keep this note");
  await user.click(screen.getByRole("button", { name: "Parcel A" }));
  await user.click(screen.getByRole("button", { name: "Parcel A" }));
  expect(
    screen.getByRole("textbox", { name: "Note for Parcel A" }),
  ).toHaveValue("Keep this note");
});

it("returns focus to the trigger when externally closing focused details", () => {
  const { rerender } = render(<DrawerTable {...fixture} expandedKey="a" />);
  screen.getByRole("textbox", { name: "Note for Parcel A" }).focus();
  rerender(<DrawerTable {...fixture} expandedKey={null} />);
  expect(screen.getByRole("button", { name: "Parcel A" })).toHaveFocus();
});

it("does not steal focus when it moves to a different row's details", () => {
  const { rerender } = render(
    <DrawerTable {...fixture} expandedKey="a" mountPolicy="preserve" />,
  );
  screen.getByRole("textbox", { name: "Note for Parcel A" }).focus();
  fireEvent.focus(screen.getByRole("button", { name: "Parcel B" }));
  screen.getByRole("button", { name: "Parcel B" }).focus();
  rerender(<DrawerTable {...fixture} expandedKey="b" mountPolicy="preserve" />);
  expect(screen.getByRole("button", { name: "Parcel B" })).toHaveFocus();
});

it("keeps numeric zero as a valid expanded key", () => {
  render(
    <DrawerTable
      rows={[{ key: 0 }, { key: 1 }]}
      defaultExpandedKey={0}
      renderRow={(row) => `Row ${row.key}`}
      renderExpandedRow={(row) => `Details ${row.key}`}
    />,
  );
  expect(panel("Row 0")).toBeVisible();
  expect(panel("Row 1")).not.toBeVisible();
});

it("keeps numeric and string keys distinct through reordering", () => {
  const typedRows = [
    { key: 0, label: "Numeric" },
    { key: "0", label: "String" },
  ];
  const typedFixture: DrawerTableProps<(typeof typedRows)[number]> = {
    rows: typedRows,
    renderRow: (row) => row.label,
    renderExpandedRow: (row) => (
      <label>
        Note for {row.label} <input defaultValue="" />
      </label>
    ),
  };
  const { rerender } = render(
    <DrawerTable {...typedFixture} expandedKey={0} mountPolicy="preserve" />,
  );
  const input = screen.getByRole("textbox", { name: "Note for Numeric" });
  fireEvent.change(input, { target: { value: "Numeric note" } });
  rerender(
    <DrawerTable
      {...typedFixture}
      rows={[{ ...typedRows[1] }, { ...typedRows[0] }]}
      expandedKey={0}
      mountPolicy="preserve"
    />,
  );
  expect(screen.getByRole("textbox", { name: "Note for Numeric" })).toBe(input);
  expect(input).toHaveValue("Numeric note");
  expect(panel("Numeric")).toBeVisible();
  expect(panel("String")).not.toBeVisible();
});

it("only renders details for active rows under the default unmount policy", async () => {
  const details = vi.fn((row: Parcel) => <span>Details for {row.label}</span>);
  const user = userEvent.setup();
  render(<DrawerTable {...fixture} renderExpandedRow={details} />);
  expect(details).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Parcel B" }));
  expect(details.mock.calls.every(([row]) => row.key === "b")).toBe(true);
  expect(screen.queryByText("Details for Parcel A")).toBeNull();
});

it("renders caller-owned empty content", () => {
  render(
    <DrawerTable {...fixture} rows={[]} emptyContent={<p>No parcels</p>} />,
  );
  expect(screen.getByText("No parcels")).toBeInTheDocument();
  expect(screen.queryByRole("list")).toBeNull();
});

it("supports an independently controlled or uncontrolled DrawerRow", async () => {
  const user = userEvent.setup();
  const { unmount } = render(<DrawerRow summary="Evidence">Details</DrawerRow>);
  await user.click(screen.getByRole("button", { name: "Evidence" }));
  expect(panel("Evidence")).toBeVisible();
  unmount();
  const changed = vi.fn();
  render(
    <DrawerRow summary="Evidence" isExpanded={false} onExpandedChange={changed}>
      Details
    </DrawerRow>,
  );
  await user.click(screen.getByRole("button", { name: "Evidence" }));
  expect(changed).toHaveBeenCalledExactlyOnceWith(true);
  expect(panel("Evidence")).not.toBeVisible();
});

it("does not mount closed details' effects unless preservation is requested", () => {
  const mounted = vi.fn();
  function Content() {
    useEffect(() => {
      mounted();
    }, []);
    const [value, setValue] = useState("");
    return (
      <input
        aria-label="Local note"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    );
  }
  const { rerender } = render(
    <DrawerRow summary="Evidence">
      <Content />
    </DrawerRow>,
  );
  expect(mounted).not.toHaveBeenCalled();
  rerender(
    <DrawerRow summary="Evidence" mountPolicy="preserve">
      <Content />
    </DrawerRow>,
  );
  expect(mounted).toHaveBeenCalledOnce();
  expect(screen.getByRole("textbox", { hidden: true })).not.toBeVisible();
});
