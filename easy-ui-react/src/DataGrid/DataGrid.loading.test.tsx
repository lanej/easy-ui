import { fireEvent, screen } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import {
  mockGetComputedStyle,
  mockIntersectionObserver,
  render,
} from "../utilities/test";
import { DataGrid } from "./DataGrid";
import { DataGridProps } from "./types";

const columns = [{ key: "name", name: "Name" }];
const rows = [
  { key: "a", name: "Alpha" },
  { key: "b", name: "Beta" },
];
const contentSelector = '[data-ezui-data-grid-expanded-row-content="active"]';

function grid(props: Partial<DataGridProps>) {
  return (
    <DataGrid
      aria-label="Loading expansion"
      columns={columns}
      rows={rows}
      renderColumnCell={(column) => String(column.name)}
      renderRowCell={(value) => String(value)}
      {...props}
    />
  );
}

function container() {
  return screen.getByRole("grid").parentElement!;
}

function expectGeometry(height: string, position: string, opacity: string) {
  const style = container().parentElement!.style;
  expect(style.getPropertyValue("--ezui-c-data-grid-expanded-row-height")).toBe(
    height,
  );
  expect(
    style.getPropertyValue("--ezui-c-data-grid-expanded-row-position"),
  ).toBe(position);
  expect(
    style.getPropertyValue("--ezui-c-data-grid-expanded-row-opacity"),
  ).toBe(opacity);
}

describe("DataGrid expansion during loading", () => {
  let restoreStyle: () => void;
  let restoreObserver: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    restoreStyle = mockGetComputedStyle();
    restoreObserver = mockIntersectionObserver();
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
    restoreStyle();
    restoreObserver();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
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
