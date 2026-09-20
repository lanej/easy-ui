import { screen, within } from "@testing-library/react";
import React, { StrictMode, useState } from "react";
import { vi } from "vitest";
import {
  mockGetComputedStyle,
  mockIntersectionObserver,
  render,
  userClick,
} from "../utilities/test";
import { DataGrid } from "./DataGrid";
import { DataGridProps } from "./types";

const columns = [{ key: "name", name: "Name" }];
const rows = [
  { key: "a", name: "Alpha" },
  { key: "b", name: "Beta" },
];
const grouping = {
  getGroupKey: () => "group",
  aggregators: {},
  isCollapsible: true,
};
function grid(props: Partial<DataGridProps> = {}) {
  return (
    <DataGrid
      aria-label="Stateful grid"
      columns={columns}
      rows={rows}
      renderColumnCell={(column) => String(column.name)}
      renderRowCell={(value) => String(value)}
      renderExpandedRow={(key) => <input aria-label={`Details ${key}`} />}
      {...props}
    />
  );
}
function expandButton(name: string) {
  return within(screen.getByRole("row", { name: new RegExp(name) })).getByRole(
    "button",
    { name: "Expand" },
  );
}

describe("DataGrid expansion state and focus", () => {
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

  it("treats null as controlled closed, including a default expanded key", async () => {
    const onExpandedChange = vi.fn();
    const { user } = render(
      grid({ expandedKey: null, defaultExpandedKey: "a", onExpandedChange }),
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await userClick(user, expandButton("Alpha"));
    expect(onExpandedChange).toHaveBeenLastCalledWith("a");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("closes controlled expansion externally without emitting a change", () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(grid({ expandedKey: "a", onExpandedChange }));
    expect(
      screen.getByRole("textbox", { name: "Details a" }),
    ).toBeInTheDocument();
    rerender(grid({ expandedKey: null, onExpandedChange }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    rerender(grid({ expandedKey: "b", onExpandedChange }));
    expect(
      screen.getByRole("textbox", { name: "Details b" }),
    ).toBeInTheDocument();
    expect(onExpandedChange).not.toHaveBeenCalled();
  });

  it("emits next-state keys and null for uncontrolled open, switch, and close", async () => {
    const onExpandedChange = vi.fn();
    const { user } = render(grid({ onExpandedChange }));
    await userClick(user, expandButton("Alpha"));
    await userClick(user, expandButton("Beta"));
    await userClick(user, expandButton("Beta"));
    expect(onExpandedChange.mock.calls).toEqual([["a"], ["b"], [null]]);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("can pass the controlled state setter directly as onExpandedChange", async () => {
    function Controlled() {
      const [expandedKey, setExpandedKey] = useState<string | number | null>(
        null,
      );
      return grid({ expandedKey, onExpandedChange: setExpandedKey });
    }
    const { user } = render(<Controlled />);
    await userClick(user, expandButton("Alpha"));
    expect(
      screen.getByRole("textbox", { name: "Details a" }),
    ).toBeInTheDocument();
    await userClick(user, expandButton("Alpha"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("does not mutate controlled expansion when a close request is ignored", async () => {
    const onExpandedChange = vi.fn();
    const { user } = render(grid({ expandedKey: "a", onExpandedChange }));
    await userClick(user, expandButton("Alpha"));
    expect(onExpandedChange).toHaveBeenLastCalledWith(null);
    expect(
      screen.getByRole("textbox", { name: "Details a" }),
    ).toBeInTheDocument();
  });

  it.each(["input", "button"] as const)(
    "returns focus from a removed detail %s to its group disclosure",
    async (kind) => {
      const onExpandedChange = vi.fn();
      const renderExpandedRow = () =>
        kind === "input" ? (
          <input aria-label="Detail editor" />
        ) : (
          <button>Detail action</button>
        );
      const base = {
        defaultExpandedKey: "a",
        renderExpandedRow,
        onExpandedChange,
      };
      const { user, rerender } = render(
        <StrictMode>
          {grid({ ...base, grouping: { ...grouping, collapsedKeys: [] } })}
        </StrictMode>,
      );
      await userClick(
        user,
        screen.getByRole(kind === "input" ? "textbox" : "button", {
          name: kind === "input" ? "Detail editor" : "Detail action",
        }),
      );
      rerender(
        <StrictMode>
          {grid({
            ...base,
            grouping: { ...grouping, collapsedKeys: ["group"] },
          })}
        </StrictMode>,
      );
      const toggle = screen.getByRole("button", { name: "Expand group group" });
      expect(toggle).toHaveFocus();
      expect(onExpandedChange).not.toHaveBeenCalled();
      rerender(
        <StrictMode>
          {grid({ ...base, grouping: { ...grouping, collapsedKeys: [] } })}
        </StrictMode>,
      );
      expect(toggle).toHaveFocus();
      expect(
        screen.getByRole(kind === "input" ? "textbox" : "button", {
          name: kind === "input" ? "Detail editor" : "Detail action",
        }),
      ).toBeInTheDocument();
    },
  );

  it("does not steal focus elsewhere when a group containing open details collapses", async () => {
    const base = { defaultExpandedKey: "a" };
    const view = (collapsedKeys: string[]) => (
      <>
        <button>Outside</button>
        {grid({ ...base, grouping: { ...grouping, collapsedKeys } })}
      </>
    );
    const { user, rerender } = render(view([]));
    await userClick(user, screen.getByRole("textbox"));
    const outside = screen.getByRole("button", { name: "Outside" });
    await userClick(user, outside);
    rerender(view(["group"]));
    expect(outside).toHaveFocus();
  });

  it("does not restore stale detail focus after loading removes the content", async () => {
    const view = (isLoading: boolean, collapsedKeys: string[]) => (
      <>
        <button>Outside</button>
        {grid({
          defaultExpandedKey: "a",
          isLoading,
          grouping: { ...grouping, collapsedKeys },
        })}
      </>
    );
    const { user, rerender } = render(view(false, []));
    await userClick(user, screen.getByRole("textbox"));
    rerender(view(true, []));
    const outside = screen.getByRole("button", { name: "Outside" });
    await userClick(user, outside);
    rerender(view(false, ["group"]));
    expect(outside).toHaveFocus();
  });
});
