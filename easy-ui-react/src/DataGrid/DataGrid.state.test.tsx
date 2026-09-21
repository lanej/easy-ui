import { fireEvent, screen, within } from "@testing-library/react";
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

  describe("Expansion during loading", () => {
    const contentSelector =
      '[data-ezui-data-grid-expanded-row-content="active"]';

    function container() {
      return screen.getByRole("grid").parentElement!;
    }

    function expectGeometry(height: string, position: string, opacity: string) {
      // Expansion tokens live on the frame, outside the row scroll container.
      const style = container().parentElement!.parentElement!.style;
      expect(
        style.getPropertyValue("--ezui-c-data-grid-expanded-row-height"),
      ).toBe(height);
      expect(
        style.getPropertyValue("--ezui-c-data-grid-expanded-row-position"),
      ).toBe(position);
      expect(
        style.getPropertyValue("--ezui-c-data-grid-expanded-row-opacity"),
      ).toBe(opacity);
    }

    beforeEach(() => {
      // Loading recovery must measure without depending on a ResizeObserver notification.
      vi.stubGlobal("ResizeObserver", undefined);
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
        function (this: HTMLElement) {
          if (this.matches(contentSelector)) return 64;
          if (this.matches('[data-ezui-data-grid-column-header="true"]'))
            return 40;
          return 32;
        },
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it.each(["defaultExpandedKey", "expandedKey"] as const)(
      "suspends initial %s expansion until loading finishes",
      (keyProp) => {
        const renderExpandedRow = vi.fn((key) => <div>Details {key}</div>);
        const onExpandedChange = vi.fn();
        const props = { [keyProp]: "b", renderExpandedRow, onExpandedChange };
        const { rerender } = render(grid({ ...props, isLoading: true }));

        expect(screen.getByRole("status", { name: /loading/i })).toBeVisible();
        expect(renderExpandedRow).not.toHaveBeenCalled();
        expect(container().querySelector(contentSelector)).toBeNull();
        expectGeometry("auto", "0", "0.0");

        rerender(grid({ ...props, isLoading: false }));

        expect(screen.getByText("Details b")).toBeInTheDocument();
        expectGeometry("64px", "72px", "1.0");
        expect(onExpandedChange).not.toHaveBeenCalled();
      },
    );

    it.each(["defaultExpandedKey", "expandedKey"] as const)(
      "preserves %s through refresh and remeasures without a resize notification",
      (keyProp) => {
        const renderExpandedRow = vi.fn((key) => <div>Details {key}</div>);
        const onExpandedChange = vi.fn();
        const props = { [keyProp]: "b", renderExpandedRow, onExpandedChange };
        const { rerender } = render(grid(props));
        expectGeometry("64px", "72px", "1.0");

        renderExpandedRow.mockClear();
        rerender(grid({ ...props, isLoading: true }));
        expect(screen.queryByText("Details b")).not.toBeInTheDocument();
        expect(renderExpandedRow).not.toHaveBeenCalled();
        expectGeometry("auto", "0", "0.0");

        // The fallback resize callback also stays safe while loading has removed the row.
        const query = vi.spyOn(container(), "querySelector");
        fireEvent(window, new Event("resize"));
        expect(query).not.toHaveBeenCalled();
        query.mockRestore();

        rerender(grid({ ...props, isLoading: false }));
        expect(screen.getByText("Details b")).toBeInTheDocument();
        expectGeometry("64px", "72px", "1.0");
        expect(onExpandedChange).not.toHaveBeenCalled();
      },
    );

    it("honors a controlled key changed while loading through temporarily empty rows", () => {
      const renderExpandedRow = vi.fn((key) => <div>Details {key}</div>);
      const onExpandedChange = vi.fn();
      const props = { renderExpandedRow, onExpandedChange };
      const { rerender } = render(grid({ ...props, expandedKey: "a" }));
      expect(screen.getByText("Details a")).toBeInTheDocument();

      rerender(grid({ ...props, expandedKey: "b", isLoading: true, rows: [] }));
      expect(screen.queryByText(/Details/)).not.toBeInTheDocument();
      fireEvent(window, new Event("resize"));
      rerender(grid({ ...props, expandedKey: "b", rows: [] }));
      expect(screen.getByText("No Data")).toBeInTheDocument();
      expect(container().querySelector(contentSelector)).toBeNull();

      rerender(grid({ ...props, expandedKey: "b" }));
      expect(screen.getByText("Details b")).toBeInTheDocument();
      expect(screen.queryByText("Details a")).not.toBeInTheDocument();
      expectGeometry("64px", "72px", "1.0");
      expect(onExpandedChange).not.toHaveBeenCalled();
    });

    it.each([
      ["header", "thead"],
      ["expanded row", '[data-ezui-data-grid-expanded-row="true"]'],
      ["expanded content", contentSelector],
    ])("tolerates the %s being absent during resize", (_name, selector) => {
      render(
        grid({
          defaultExpandedKey: "b",
          renderExpandedRow: (key) => <div>Details {key}</div>,
        }),
      );
      const element = container().querySelector(selector)!;
      const parent = element.parentNode!;
      const next = element.nextSibling;
      element.remove();
      try {
        fireEvent(window, new Event("resize"));
        expectGeometry("auto", "0", "0.0");
      } finally {
        parent.insertBefore(element, next);
      }
      fireEvent(window, new Event("resize"));
      expectGeometry("64px", "72px", "1.0");
    });
  });
});
