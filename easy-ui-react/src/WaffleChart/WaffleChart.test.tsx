import React, { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  within,
} from "@testing-library/react";
import { vi } from "vitest";
import { Button } from "../Button";
import { Drawer } from "../Drawer";
import { Modal } from "../Modal";
import { Select } from "../Select";
import {
  disableReactTransitionGroup,
  enableReactTransitionGroup,
  mockGetComputedStyle,
  mockIntersectionObserver,
  render,
} from "../utilities/test";
import { WaffleChart } from "./WaffleChart";
import type {
  WaffleChartCategory,
  WaffleChartGroup,
  WaffleChartGroupAnchor,
  WaffleChartInspection,
  WaffleChartItem,
  WaffleChartProps,
} from "./types";

const categories: WaffleChartCategory[] = [
  { id: "ready", label: "Ready", color: "primary.500" },
  { id: "working", label: "Working", color: "neutral.600" },
];
const groups: WaffleChartGroup[] = [
  {
    id: "north",
    label: "North",
    description: "Caller supplied description",
    metadata: { connection: "n-1" },
  },
  { id: "south", label: "South" },
];
const items: WaffleChartItem<{ externalId: number }>[] = [
  {
    id: "parcel:a",
    label: "Parcel A",
    categoryId: "ready",
    groupId: "north",
    metadata: { externalId: 17 },
  },
  {
    id: "parcel:b",
    label: "Parcel B",
    categoryId: "working",
    groupId: "north",
    metadata: { externalId: 23 },
    draft: true,
  },
  {
    id: "parcel:c",
    label: "Parcel C",
    categoryId: "ready",
    groupId: "south",
    metadata: { externalId: 41 },
    muted: true,
  },
];

function itemCells(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("[data-waffle-item]")];
}

function itemButton(label: string) {
  return screen.getByRole("button", { name: new RegExp(`^${label},`) });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("WaffleChart supplied data", () => {
  it.each([0, 1, 7, 117, 143])(
    "renders exactly %i supplied items without normalizing to a percentage",
    (count) => {
      const supplied = Array.from({ length: count }, (_, index) => ({
        id: `item-${index}`,
        label: `Item ${index}`,
        categoryId: index % 2 ? "working" : "ready",
      }));
      const countLabel = vi.fn((value: number) => `${value} supplied parcels`);
      const { container } = render(
        <WaffleChart
          accessibilityLabel="Supplied parcels"
          items={supplied}
          categories={categories}
          countLabel={countLabel}
        />,
      );
      expect(itemCells(container)).toHaveLength(count);
      expect(
        itemCells(container).map((cell) => cell.dataset.waffleItem),
      ).toEqual(supplied.map((item) => item.id));
      expect(screen.getByText(`${count} supplied parcels`)).toBeVisible();
      expect(countLabel).toHaveBeenCalledWith(count);
      const legend = screen.getByRole("group", { name: "Categories" });
      expect(legend).toHaveTextContent(`Ready${Math.ceil(count / 2)}`);
      expect(legend).toHaveTextContent(`Working${Math.floor(count / 2)}`);
      if (!count) expect(screen.getByText("No items supplied")).toBeVisible();
    },
  );

  it("preserves cell identity, selection and explicit colors through reorder and removal", () => {
    const { container, rerender } = render(
      <WaffleChart
        accessibilityLabel="Parcels"
        items={items}
        categories={categories}
        defaultSelection={{ type: "item", id: items[1].id }}
      />,
    );
    const original = new Map(
      itemCells(container).map((cell) => [cell.dataset.waffleItem, cell]),
    );
    const firstColor = original.get(items[0].id)!.style.cssText;
    rerender(
      <WaffleChart
        accessibilityLabel="Parcels"
        items={[items[2], items[1], items[0]]}
        categories={[categories[1], categories[0]]}
      />,
    );
    expect(itemCells(container).map((cell) => cell.dataset.waffleItem)).toEqual(
      [items[2].id, items[1].id, items[0].id],
    );
    for (const cell of itemCells(container)) {
      expect(cell).toBe(original.get(cell.dataset.waffleItem));
    }
    expect(itemButton("Parcel A").style.cssText).toBe(firstColor);
    expect(itemButton("Parcel B")).toHaveAttribute("aria-pressed", "true");
    rerender(
      <WaffleChart
        accessibilityLabel="Parcels"
        items={[items[2], items[0]]}
        categories={categories}
      />,
    );
    expect(itemCells(container)).toHaveLength(2);
    expect(itemButton("Parcel A")).toBe(original.get(items[0].id));
    expect(itemButton("Parcel C")).toBe(original.get(items[2].id));
    expect(
      screen.queryByRole("button", { name: "Clear selection" }),
    ).toBeNull();
    expect(screen.getByText("2 items")).toBeVisible();
  });

  it("keeps unknown categories and unmatched groups visible with neutral labels", () => {
    const unknown = {
      id: "unexpected",
      label: "Unmapped parcel",
      categoryId: "unmapped",
      groupId: "missing-group",
    };
    const ungrouped = {
      id: "ungrouped",
      label: "Ungrouped parcel",
      categoryId: "ready",
    };
    const { container } = render(
      <WaffleChart
        accessibilityLabel="Parcels"
        items={[items[0], unknown, ungrouped]}
        categories={categories}
        groups={groups}
        ungroupedLabel="Other supplied parcels"
      />,
    );
    expect(itemCells(container)).toHaveLength(3);
    const neutral = screen.getByRole("group", {
      name: "Other supplied parcels",
    });
    const unknownCell = within(neutral).getByRole("button", {
      name: "Unmapped parcel, Unknown category: unmapped",
    });
    expect(unknownCell).toHaveAttribute("data-unknown", "true");
    expect(unknownCell.style.getPropertyValue("--ezui-c-waffle-color")).toBe(
      "",
    );
    expect(
      within(neutral).getByRole("button", { name: "Ungrouped parcel, Ready" }),
    ).toBeVisible();
    expect(within(neutral).getByText("2")).toBeVisible();
    expect(screen.getByRole("group", { name: "South" })).toHaveTextContent("0");
    expect(screen.getByRole("group", { name: "Categories" })).toHaveTextContent(
      "Unknown category: unmapped1",
    );
    expect(container).not.toHaveTextContent(/available|capacity|vacant/i);
  });
});

describe("item arrangement", () => {
  const arrangedCategories: readonly WaffleChartCategory[] = Object.freeze([
    { id: "review", label: "In review", color: "primary.500" },
    { id: "ready", label: "Ready", color: "primary.500" },
    { id: "queued", label: "Queued", color: "neutral.600" },
  ]);
  const readyFirstCategories = [
    arrangedCategories[1],
    arrangedCategories[0],
    arrangedCategories[2],
  ];
  const supplied: readonly WaffleChartItem[] = Object.freeze(
    (
      [
        ["south-ready", "ready", "south"],
        ["north-ready-1", "ready", "north"],
        ["other-unknown-a", "unknown-a", "missing"],
        ["north-unknown-z-1", "unknown-z", "north"],
        ["north-review-1", "review", "north"],
        ["south-unknown-z", "unknown-z", "south"],
        ["north-ready-2", "ready", "north"],
        ["north-unknown-a", "unknown-a", "north"],
        ["south-review", "review", "south"],
        ["other-ready", "ready"],
        ["north-review-2", "review", "north"],
        ["north-unknown-z-2", "unknown-z", "north"],
        ["other-unknown-z", "unknown-z"],
        ["other-review", "review", "missing"],
      ] as [string, string, string?][]
    ).map(([id, categoryId, groupId]) => ({
      id,
      label: id.replace(/-/g, " "),
      categoryId,
      groupId,
      draft: id === "north-review-1",
      muted: id === "south-ready",
    })),
  );
  const northInput = [
    "north-ready-1",
    "north-unknown-z-1",
    "north-review-1",
    "north-ready-2",
    "north-unknown-a",
    "north-review-2",
    "north-unknown-z-2",
  ];
  const northCategory = [
    "north-review-1",
    "north-review-2",
    "north-ready-1",
    "north-ready-2",
    "north-unknown-z-1",
    "north-unknown-z-2",
    "north-unknown-a",
  ];
  const flatCategory = [
    "north-review-1",
    "south-review",
    "north-review-2",
    "other-review",
    "south-ready",
    "north-ready-1",
    "north-ready-2",
    "other-ready",
    "other-unknown-a",
    "north-unknown-a",
    "north-unknown-z-1",
    "south-unknown-z",
    "north-unknown-z-2",
    "other-unknown-z",
  ];
  const props = {
    accessibilityLabel: "Arranged resources",
    items: supplied,
    categories: arrangedCategories,
    groups,
  };
  const itemIds = (container: HTMLElement) =>
    itemCells(container).map((cell) => cell.dataset.waffleItem);

  it.each([undefined, "input"] as const)(
    "preserves supplied order within existing groups with itemOrder=%s",
    (itemOrder) => {
      const { container, rerender } = render(
        <WaffleChart {...props} itemOrder={itemOrder} />,
      );
      const expected = [
        ...northInput,
        "south-ready",
        "south-unknown-z",
        "south-review",
        "other-unknown-a",
        "other-ready",
        "other-unknown-z",
        "other-review",
      ];
      expect(itemIds(container)).toEqual(expected);
      rerender(
        <WaffleChart
          {...props}
          itemOrder={itemOrder}
          categories={readyFirstCategories}
        />,
      );
      expect(itemIds(container)).toEqual(expected);
      expect(screen.getByText("14 items")).toBeVisible();
    },
  );

  it("clusters stable category IDs in supplied category order within each group and remainder", () => {
    const originals = supplied.map((item) => ({ ...item }));
    const { container } = render(
      <WaffleChart {...props} itemOrder="category" />,
    );
    expect(itemIds(screen.getByRole("group", { name: "North" }))).toEqual(
      northCategory,
    );
    expect(itemIds(screen.getByRole("group", { name: "South" }))).toEqual([
      "south-review",
      "south-ready",
      "south-unknown-z",
    ]);
    expect(itemIds(screen.getByRole("group", { name: "Other items" }))).toEqual(
      ["other-review", "other-ready", "other-unknown-a", "other-unknown-z"],
    );
    expect(itemCells(container)).toHaveLength(supplied.length);
    expect(new Set(itemIds(container)).size).toBe(supplied.length);
    expect(itemButton("north review 1").style.cssText).toBe(
      itemButton("north ready 1").style.cssText,
    );
    expect(itemButton("north unknown z 1")).toHaveAccessibleName(
      "north unknown z 1, Unknown category: unknown-z",
    );
    expect(screen.getByRole("button", { name: "North 7" })).toBeVisible();
    expect(screen.getByRole("button", { name: "South 3" })).toBeVisible();
    expect(screen.getByText("14 items")).toBeVisible();
    const legend = screen.getByRole("group", { name: "Categories" });
    expect(legend).toHaveTextContent("In review4Ready4Queued0");
    expect(legend).toHaveTextContent("Unknown category: unknown-a2");
    expect(legend).toHaveTextContent("Unknown category: unknown-z4");
    expect(supplied).toEqual(originals);
  });

  it("uses category array order rather than color and keeps unknown IDs first-seen per group", () => {
    const { container, rerender } = render(
      <WaffleChart {...props} itemOrder="category" />,
    );
    const original = new Map(
      itemCells(container).map((cell) => [cell.dataset.waffleItem, cell]),
    );
    rerender(
      <WaffleChart
        {...props}
        itemOrder="category"
        categories={readyFirstCategories}
      />,
    );
    expect(itemIds(screen.getByRole("group", { name: "North" }))).toEqual([
      "north-ready-1",
      "north-ready-2",
      "north-review-1",
      "north-review-2",
      "north-unknown-z-1",
      "north-unknown-z-2",
      "north-unknown-a",
    ]);
    expect(itemIds(screen.getByRole("group", { name: "Other items" }))).toEqual(
      ["other-ready", "other-review", "other-unknown-a", "other-unknown-z"],
    );
    for (const cell of itemCells(container)) {
      expect(cell).toBe(original.get(cell.dataset.waffleItem));
    }
  });

  it("keeps nodes, group membership, focus, selection, colors and counts while toggling order", () => {
    const onSelection = vi.fn();
    const onFocus = vi.fn();
    const renderDetails = vi.fn(
      (inspection: WaffleChartInspection) => inspection.item?.label,
    );
    const renderChart = (itemOrder: "input" | "category") => (
      <WaffleChart
        {...props}
        itemOrder={itemOrder}
        defaultSelection={{ type: "item", id: "north-review-2" }}
        onSelectionChange={onSelection}
        onItemFocusChange={onFocus}
        renderDetails={renderDetails}
      />
    );
    const { container, rerender } = render(renderChart("input"));
    const original = itemCells(container).map((element) => ({
      id: element.dataset.waffleItem,
      element,
      parent: element.parentElement,
      color: element.style.cssText,
    }));
    const north = screen.getByRole("group", { name: "North" });
    const south = screen.getByRole("group", { name: "South" });
    const focused = itemButton("north ready 2");
    act(() => focused.focus());
    for (const order of ["category", "input", "category"] as const) {
      rerender(renderChart(order));
      for (const { id, element, parent, color } of original) {
        expect(
          itemCells(container).find((cell) => cell.dataset.waffleItem === id),
        ).toBe(element);
        expect(element.parentElement).toBe(parent);
        expect(element.style.cssText).toBe(color);
      }
      expect(screen.getByRole("group", { name: "North" })).toBe(north);
      expect(screen.getByRole("group", { name: "South" })).toBe(south);
      expect(focused).toHaveFocus();
      expect(focused).toHaveAttribute("tabindex", "0");
      expect(
        itemCells(container).filter((cell) => cell.tabIndex === 0),
      ).toEqual([focused]);
      expect(itemButton("north review 2")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(
        itemCells(container).filter((cell) => cell.dataset.selected),
      ).toEqual([itemButton("north review 2")]);
      expect(screen.getByText("14 items")).toBeVisible();
      expect(renderDetails.mock.lastCall![0]).toMatchObject({
        target: { type: "item", id: "north-review-2" },
        pinned: true,
        totalCount: 14,
      });
      expect(renderDetails.mock.lastCall![0].item).toBe(supplied[10]);
    }
    expect(onSelection).not.toHaveBeenCalled();
    expect(onFocus).toHaveBeenCalledExactlyOnceWith(supplied[6]);
  });

  it("remeasures existing public group anchors after order and arrangement changes without remounting groups", () => {
    const onAnchors = vi.fn();
    const disconnect = vi.fn();
    let top = 10;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect = disconnect;
      },
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const left = this.dataset.waffleGroup === "south" ? 200 : 10;
        return {
          x: left,
          y: top,
          left,
          top,
          right: left + 120,
          bottom: top + 48,
          width: 120,
          height: 48,
          toJSON: () => ({}),
        };
      },
    );
    let chartProps: WaffleChartProps = {
      ...props,
      itemOrder: "input",
      maxColumns: 4,
      cellSize: 20,
      gap: 6,
      onGroupAnchorsChange: onAnchors,
    };
    const { rerender } = render(<WaffleChart {...chartProps} />);
    const north = screen.getByRole("group", { name: "North" });
    const south = screen.getByRole("group", { name: "South" });
    expect(onAnchors).toHaveBeenCalledOnce();
    const changes: Partial<WaffleChartProps>[] = [
      { itemOrder: "category" },
      { categories: readyFirstCategories },
      { maxColumns: 2 },
      { cellSize: 32 },
      { gap: 10 },
    ];
    changes.forEach((change, index) => {
      top += 10;
      chartProps = { ...chartProps, ...change };
      rerender(<WaffleChart {...chartProps} />);
      expect(onAnchors).toHaveBeenCalledTimes(index + 2);
      const anchors: readonly WaffleChartGroupAnchor[] =
        onAnchors.mock.lastCall![0];
      expect(
        anchors.map(({ groupId, element, bounds }) => ({
          groupId,
          element,
          top: bounds.top,
        })),
      ).toEqual([
        { groupId: "north", element: north, top },
        { groupId: "south", element: south, top },
      ]);
      expect(screen.getByRole("group", { name: "North" })).toBe(north);
      expect(screen.getByRole("group", { name: "South" })).toBe(south);
      expect(disconnect).not.toHaveBeenCalled();
    });
    expect(
      onAnchors.mock.calls.every(([anchors]) => anchors.length === 2),
    ).toBe(true);
  });

  it("navigates displayed category order and live row geometry after changing the arrangement", async () => {
    const keyboardItems = [
      supplied[1],
      supplied[3],
      supplied[4],
      supplied[6],
      supplied[10],
      supplied[7],
    ];
    const keyboardProps = {
      accessibilityLabel: "Keyboard resources",
      categories: arrangedCategories,
      items: keyboardItems,
    };
    const { container, rerender, user } = render(
      <WaffleChart
        {...keyboardProps}
        itemOrder="category"
        maxColumns={2}
        cellSize={32}
        gap={8}
      />,
    );
    expect(itemIds(container)).toEqual([
      "north-review-1",
      "north-review-2",
      "north-ready-1",
      "north-ready-2",
      "north-unknown-z-1",
      "north-unknown-a",
    ]);
    let columns = 2;
    itemCells(container).forEach((cell) => {
      vi.spyOn(cell, "getBoundingClientRect").mockImplementation(() => {
        const index = itemCells(container).indexOf(cell);
        const left = (index % columns) * 40;
        const top = Math.floor(index / columns) * 40;
        return {
          x: left,
          y: top,
          left,
          top,
          right: left + 32,
          bottom: top + 32,
          width: 32,
          height: 32,
          toJSON: () => ({}),
        };
      });
    });
    await user.tab();
    expect(itemButton("north review 1")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(itemButton("north review 2")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(itemButton("north ready 2")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(itemButton("north review 2")).toHaveFocus();
    await user.keyboard("{End}");
    expect(itemButton("north unknown a")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(itemButton("north unknown z 1")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(itemButton("north review 1")).toHaveFocus();
    columns = 3;
    rerender(
      <WaffleChart
        {...keyboardProps}
        itemOrder="category"
        maxColumns={3}
        cellSize={32}
        gap={8}
      />,
    );
    await user.keyboard("{ArrowDown}");
    expect(itemButton("north ready 2")).toHaveFocus();
    rerender(
      <WaffleChart
        {...keyboardProps}
        itemOrder="input"
        maxColumns={3}
        cellSize={32}
        gap={8}
      />,
    );
    await user.keyboard("{ArrowLeft}");
    expect(itemButton("north review 1")).toHaveFocus();
    expect(itemCells(container).filter((cell) => cell.tabIndex === 0)).toEqual([
      itemButton("north review 1"),
    ]);
  });

  it.each(["item", "group"] as const)(
    "keeps compact order, counts and %s selection semantics passive inside a link",
    (type) => {
      const onActivate = vi.fn();
      const onSelection = vi.fn();
      const onFocus = vi.fn();
      const onAnchors = vi.fn();
      const onLinkClick = vi.fn();
      const selection = {
        type,
        id: type === "item" ? "north-review-2" : "north",
      };
      const chart = (itemOrder?: "input" | "category") => (
        <a href="#resources" onClick={onLinkClick}>
          <WaffleChart
            {...props}
            accessibilityLabel="Arranged summary"
            variant="compact"
            itemOrder={itemOrder}
            selection={selection}
            onItemActivate={onActivate}
            onSelectionChange={onSelection}
            onItemFocusChange={onFocus}
            onGroupAnchorsChange={onAnchors}
          />
        </a>
      );
      const { container, rerender } = render(chart());
      const original = new Map(
        itemCells(container).map((cell) => [cell.dataset.waffleItem, cell]),
      );
      const suppliedIds = supplied.map((item) => item.id);
      const selectedIds = type === "item" ? ["north-review-2"] : northInput;
      for (const order of [undefined, "category", "input"] as const) {
        rerender(chart(order));
        const expected = order === "category" ? flatCategory : suppliedIds;
        expect(itemIds(container)).toEqual(expected);
        expect(itemCells(container)).toHaveLength(14);
        for (const cell of itemCells(container)) {
          expect(cell).toBe(original.get(cell.dataset.waffleItem));
          expect(cell).toHaveAttribute("aria-hidden", "true");
          expect(!!cell.dataset.selected).toBe(
            selectedIds.includes(cell.dataset.waffleItem!),
          );
        }
        const selectedLabel =
          type === "item"
            ? "Selected item: north review 2"
            : "Selected group: North";
        const expectedLabels = expected.map((id) => {
          const item = supplied.find((item) => item.id === id)!;
          const category = arrangedCategories.find(
            (category) => category.id === item.categoryId,
          );
          return `${item.label}, ${category?.label ?? `Unknown category: ${item.categoryId}`}${item.draft ? ", Draft" : ""}${item.muted ? ", Muted" : ""}`;
        });
        const image = screen.getByRole("img");
        expect(image).toHaveAccessibleName(
          `Arranged summary: 14 items. ${selectedLabel}. ${expectedLabels.join("; ")}`,
        );
        expect(screen.getByRole("link")).toContainElement(image);
        expect(screen.getByText("14")).toBeVisible();
        expect(screen.getByText("/ Draft 1")).toBeVisible();
        expect(
          container.querySelector(
            "button, input, select, textarea, [tabindex], [aria-live]",
          ),
        ).toBeNull();
        fireEvent.pointerEnter(itemCells(container)[0]);
        fireEvent.focus(itemCells(container)[0]);
      }
      fireEvent.click(screen.getByRole("img"));
      expect(onLinkClick).toHaveBeenCalledOnce();
      for (const callback of [onActivate, onSelection, onFocus, onAnchors])
        expect(callback).not.toHaveBeenCalled();
    },
  );
});

describe("passive variants", () => {
  describe.each([
    { mode: "passive", modeProps: { interaction: "none" as const } },
    { mode: "compact", modeProps: { variant: "compact" as const } },
  ])("$mode selection announcements", ({ mode, modeProps }) => {
    it.each(["item", "group"] as const)(
      "announces selected %s state without requiring color",
      (type) => {
        const id = type === "item" ? items[0].id : groups[0].id;
        render(
          <WaffleChart
            accessibilityLabel="Selected parcels"
            items={items}
            categories={categories}
            groups={groups}
            selection={{ type, id }}
            {...modeProps}
          />,
        );
        expect(screen.queryByRole("button")).toBeNull();
        if (mode === "compact") {
          expect(screen.getByRole("img")).toHaveAccessibleName(
            expect.stringContaining(
              type === "item"
                ? "Selected item: Parcel A"
                : "Selected group: North",
            ),
          );
        } else {
          expect(
            screen.getByRole("img", { name: /^Parcel A, Ready/ }),
          ).toHaveAccessibleName(/Selected/);
          expect(
            screen.getByRole("img", { name: /^Parcel C, Ready/ }),
          ).not.toHaveAccessibleName(/Selected/);
          if (type === "group") {
            expect(
              screen.getByRole("img", { name: /^Parcel B, Working, Draft/ }),
            ).toHaveAccessibleName(/Selected/);
            expect(
              screen.getByRole("group", { name: /North/ }),
            ).toHaveAccessibleName(/Selected/);
          } else {
            expect(
              screen.getByRole("img", { name: /^Parcel B, Working, Draft/ }),
            ).not.toHaveAccessibleName(/Selected/);
            expect(screen.getByRole("group", { name: "North" })).toBeVisible();
          }
        }
      },
    );
  });

  it.each(["item", "group"] as const)(
    "keeps interactive names unchanged when a %s is selected",
    (type) => {
      render(
        <WaffleChart
          accessibilityLabel="Selected interactive parcels"
          items={items}
          categories={categories}
          groups={groups}
          selection={{ type, id: type === "item" ? items[0].id : groups[0].id }}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Parcel A, Ready" }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        screen.getByRole("button", { name: "Parcel B, Working, Draft" }),
      ).toHaveAttribute("aria-pressed", String(type === "group"));
      expect(screen.getByRole("button", { name: "North 2" })).toHaveAttribute(
        "aria-pressed",
        String(type === "group"),
      );
    },
  );

  it("keeps compact charts passive inside a link and exposes exact counts and draft state", () => {
    const onActivate = vi.fn();
    const onHover = vi.fn();
    const onFocus = vi.fn();
    const onCategory = vi.fn();
    const onAnchors = vi.fn();
    const renderDetails = vi.fn(() => "Details must stay absent");
    const onLinkClick = vi.fn();
    const { container } = render(
      <a href="#parcels" onClick={onLinkClick}>
        <WaffleChart
          accessibilityLabel="Parcel summary"
          variant="compact"
          items={items}
          categories={categories}
          groups={groups}
          onItemActivate={onActivate}
          onItemHoverChange={onHover}
          onItemFocusChange={onFocus}
          onCategorySelectionChange={onCategory}
          onGroupAnchorsChange={onAnchors}
          renderDetails={renderDetails}
        />
      </a>,
    );
    const image = screen.getByRole("img", {
      name: /Parcel summary: 3 items\. Parcel A, Ready; Parcel B, Working, Draft; Parcel C, Ready, Muted/,
    });
    expect(screen.getByRole("link")).toContainElement(image);
    expect(screen.getByText("/ Draft 1")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
    expect(itemCells(container)).toHaveLength(3);
    expect(
      itemCells(container).every(
        (cell) => cell.getAttribute("aria-hidden") === "true",
      ),
    ).toBe(true);
    expect(
      container.querySelector(
        "button, input, select, textarea, [tabindex], [aria-live]",
      ),
    ).toBeNull();
    expect(screen.queryByRole("group", { name: "Categories" })).toBeNull();
    expect(screen.queryByText(groups[0].description!)).toBeNull();
    fireEvent.pointerEnter(itemCells(container)[0]);
    fireEvent.focus(itemCells(container)[0]);
    fireEvent.click(image);
    expect(onLinkClick).toHaveBeenCalledOnce();
    for (const callback of [
      onActivate,
      onHover,
      onFocus,
      onCategory,
      onAnchors,
      renderDetails,
    ]) {
      expect(callback).not.toHaveBeenCalled();
    }
  });

  it("supports full-sized passive charts and a named empty compact state", () => {
    const onActivate = vi.fn();
    const { container, rerender } = render(
      <WaffleChart
        accessibilityLabel="Passive parcels"
        interaction="none"
        items={items}
        categories={categories}
        groups={groups}
        onItemActivate={onActivate}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(
      screen.getByRole("img", { name: "Parcel B, Working, Draft" }),
    ).toBeVisible();
    fireEvent.click(itemCells(container)[0]);
    expect(onActivate).not.toHaveBeenCalled();
    expect(container.querySelector("[aria-live]")).toBeNull();
    rerender(
      <WaffleChart
        accessibilityLabel="Passive parcels"
        variant="compact"
        items={[]}
        categories={categories}
        showCount={false}
        emptyMessage="No supplied parcels"
      />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Passive parcels: 0 items. No supplied parcels",
    );
    expect(itemCells(container)).toHaveLength(0);
    expect(screen.queryByText("0")).toBeNull();
  });
});

describe("inspection and selection", () => {
  it("reports original item metadata for transient hover, focus and pinned activation", async () => {
    const onHover = vi.fn();
    const onFocus = vi.fn();
    const onActivate = vi.fn();
    const onSelection = vi.fn();
    const renderDetails = vi.fn(
      (inspection: WaffleChartInspection<{ externalId: number }>) => (
        <span>External ID {inspection.item?.metadata?.externalId}</span>
      ),
    );
    render(
      <WaffleChart
        accessibilityLabel="Parcels"
        items={items}
        categories={categories}
        groups={groups}
        onItemHoverChange={onHover}
        onItemFocusChange={onFocus}
        onItemActivate={onActivate}
        onSelectionChange={onSelection}
        renderDetails={renderDetails}
      />,
    );
    const first = itemButton("Parcel A");
    const second = itemButton("Parcel B");
    fireEvent.pointerEnter(first);
    expect(onHover).toHaveBeenLastCalledWith(items[0]);
    expect(renderDetails).toHaveBeenLastCalledWith({
      target: { type: "item", id: items[0].id },
      item: items[0],
      group: groups[0],
      pinned: false,
      totalCount: 3,
    });
    expect(renderDetails.mock.lastCall![0].item).toBe(items[0]);
    expect(screen.getByText("External ID 17")).toBeVisible();
    fireEvent.pointerLeave(first);
    expect(onHover).toHaveBeenLastCalledWith(null);
    expect(
      screen.getByText("Focus or select a cell or group to inspect it"),
    ).toBeVisible();
    act(() => second.focus());
    expect(onFocus).toHaveBeenLastCalledWith(items[1]);
    expect(renderDetails.mock.lastCall![0]).toMatchObject({
      item: items[1],
      pinned: false,
    });
    await act(async () => second.blur());
    expect(onFocus).toHaveBeenLastCalledWith(null);
    fireEvent.click(first);
    expect(onSelection).toHaveBeenLastCalledWith({
      type: "item",
      id: items[0].id,
    });
    expect(onActivate).toHaveBeenLastCalledWith(items[0]);
    expect(onActivate.mock.lastCall![0]).toBe(items[0]);
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(first).toHaveAttribute("data-selected", "true");
    expect(first).toHaveTextContent("✓");
    fireEvent.pointerEnter(second);
    expect(renderDetails.mock.lastCall![0]).toMatchObject({
      item: items[0],
      pinned: true,
    });
    fireEvent.pointerLeave(second);
    expect(screen.getByText("External ID 17")).toBeVisible();
    fireEvent.click(first);
    expect(onSelection).toHaveBeenLastCalledWith(null);
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByRole("button", { name: "Clear selection" }),
    ).toBeNull();
  });

  it.each(["item", "group"] as const)(
    "inspects the latest hovered %s after unpinning a focused cell without moving focus",
    (type) => {
      const onFocus = vi.fn();
      const renderDetails = vi.fn(
        (inspection: WaffleChartInspection) =>
          inspection.item?.label ?? inspection.group?.label,
      );
      render(
        <WaffleChart
          accessibilityLabel="Parcels"
          items={items}
          categories={categories}
          groups={groups}
          onItemFocusChange={onFocus}
          renderDetails={renderDetails}
        />,
      );
      const first = itemButton("Parcel A");
      fireEvent.pointerEnter(first);
      act(() => first.focus());
      fireEvent.click(first);
      fireEvent.click(first);
      expect(first).toHaveAttribute("aria-pressed", "false");

      fireEvent.pointerLeave(first);
      fireEvent.pointerEnter(
        type === "item"
          ? itemButton("Parcel B")
          : screen.getByRole("group", { name: "South" }),
      );
      expect(renderDetails.mock.lastCall![0]).toMatchObject({
        target: { type, id: type === "item" ? items[1].id : groups[1].id },
        pinned: false,
      });
      expect(first).toHaveFocus();
      expect(onFocus).toHaveBeenCalledExactlyOnceWith(items[0]);
    },
  );

  it("lets later focus and pointer entry take turns inspecting their own targets", () => {
    const renderDetails = vi.fn(
      (inspection: WaffleChartInspection) =>
        inspection.item?.label ?? inspection.group?.label,
    );
    render(
      <WaffleChart
        accessibilityLabel="Parcels"
        items={items}
        categories={categories}
        renderDetails={renderDetails}
      />,
    );
    const first = itemButton("Parcel A");
    const second = itemButton("Parcel B");
    const third = itemButton("Parcel C");
    act(() => first.focus());
    fireEvent.pointerEnter(second);
    expect(renderDetails.mock.lastCall![0].item).toBe(items[1]);
    expect(first).toHaveFocus();

    act(() => third.focus());
    expect(renderDetails.mock.lastCall![0].item).toBe(items[2]);
    fireEvent.pointerLeave(second);
    fireEvent.pointerEnter(first);
    expect(renderDetails.mock.lastCall![0]).toMatchObject({
      item: items[0],
      pinned: false,
    });
    expect(third).toHaveFocus();
  });

  it("reclaims inspection on cell navigation even when an arrow cannot move focus", async () => {
    const renderDetails = vi.fn(
      (inspection: WaffleChartInspection) => inspection.item?.label,
    );
    const { user } = render(
      <WaffleChart
        accessibilityLabel="Parcels"
        items={items}
        categories={categories}
        renderDetails={renderDetails}
      />,
    );
    const first = itemButton("Parcel A");
    const second = itemButton("Parcel B");
    const third = itemButton("Parcel C");
    act(() => first.focus());
    fireEvent.pointerEnter(third);
    expect(renderDetails.mock.lastCall![0].item).toBe(items[2]);

    await user.keyboard("{ArrowLeft}");
    expect(first).toHaveFocus();
    expect(renderDetails.mock.lastCall![0].item).toBe(items[0]);
    await user.keyboard("{ArrowRight}");
    expect(second).toHaveFocus();
    expect(renderDetails.mock.lastCall![0].item).toBe(items[1]);
    fireEvent.pointerLeave(third);
    fireEvent.pointerEnter(first);
    expect(renderDetails.mock.lastCall![0].item).toBe(items[0]);
    expect(second).toHaveFocus();
  });

  it("lets a focused group reclaim inspection from hover on keyboard input", async () => {
    const renderDetails = vi.fn(
      (inspection: WaffleChartInspection) =>
        inspection.item?.label ?? inspection.group?.label,
    );
    const { user } = render(
      <WaffleChart
        accessibilityLabel="Parcels"
        items={items}
        categories={categories}
        groups={groups}
        renderDetails={renderDetails}
      />,
    );
    const north = screen.getByRole("button", { name: "North 2" });
    const south = screen.getByRole("group", { name: "South" });
    act(() => north.focus());
    fireEvent.pointerEnter(south);
    expect(renderDetails.mock.lastCall![0].target).toEqual({
      type: "group",
      id: "south",
    });
    await user.keyboard("{ArrowLeft}");
    expect(renderDetails.mock.lastCall![0].target).toEqual({
      type: "group",
      id: "north",
    });
    fireEvent.pointerLeave(south);
    fireEvent.pointerEnter(south);
    expect(renderDetails.mock.lastCall![0].target).toEqual({
      type: "group",
      id: "south",
    });
    expect(north).toHaveFocus();
  });

  it.each(["item", "group"] as const)(
    "keeps a pinned %s authoritative over later focus, keyboard input and hover",
    async (type) => {
      const selection = {
        type,
        id: type === "item" ? items[0].id : groups[0].id,
      };
      const renderDetails = vi.fn(
        (inspection: WaffleChartInspection) =>
          inspection.item?.label ?? inspection.group?.label,
      );
      const { user } = render(
        <WaffleChart
          accessibilityLabel="Parcels"
          items={items}
          categories={categories}
          groups={groups}
          defaultSelection={selection}
          renderDetails={renderDetails}
        />,
      );
      act(() => itemButton("Parcel C").focus());
      expect(renderDetails.mock.lastCall![0]).toMatchObject({
        target: selection,
        pinned: true,
      });
      fireEvent.pointerEnter(itemButton("Parcel B"));
      expect(renderDetails.mock.lastCall![0]).toMatchObject({
        target: selection,
        pinned: true,
      });
      await user.keyboard("{ArrowLeft}");
      expect(renderDetails.mock.lastCall![0]).toMatchObject({
        target: selection,
        pinned: true,
      });
    },
  );

  it.each(["{Enter}", " "])(
    "pins with %s and clears selection, inspection and category with Escape",
    async (key) => {
      const onSelection = vi.fn();
      const onCategory = vi.fn();
      const onFocus = vi.fn();
      const onHover = vi.fn();
      const { user } = render(
        <WaffleChart
          accessibilityLabel="Parcels"
          items={items}
          categories={categories}
          selectedCategoryId="ready"
          onSelectionChange={onSelection}
          onCategorySelectionChange={onCategory}
          onItemFocusChange={onFocus}
          onItemHoverChange={onHover}
        />,
      );
      const first = itemButton("Parcel A");
      act(() => first.focus());
      await user.keyboard(key);
      expect(first).toHaveAttribute("aria-pressed", "true");
      expect(
        screen.getByRole("button", { name: "Clear selection" }),
      ).toBeVisible();
      await user.keyboard("{Escape}");
      expect(onSelection).toHaveBeenLastCalledWith(null);
      expect(onCategory).toHaveBeenLastCalledWith(null);
      expect(onFocus).toHaveBeenLastCalledWith(null);
      expect(onHover).toHaveBeenLastCalledWith(null);
      expect(first).toHaveAttribute("aria-pressed", "false");
      expect(
        screen.getByText("Focus or select a cell or group to inspect it"),
      ).toBeVisible();
    },
  );

  it("retains controlled selection until the caller updates it and clears through the public control", () => {
    const onSelection = vi.fn();
    const props = {
      accessibilityLabel: "Parcels",
      items,
      categories,
      onSelectionChange: onSelection,
    };
    const { rerender } = render(
      <WaffleChart {...props} selection={{ type: "item", id: items[0].id }} />,
    );
    fireEvent.click(itemButton("Parcel B"));
    expect(onSelection).toHaveBeenLastCalledWith({
      type: "item",
      id: items[1].id,
    });
    expect(itemButton("Parcel A")).toHaveAttribute("aria-pressed", "true");
    expect(itemButton("Parcel B")).toHaveAttribute("aria-pressed", "false");
    rerender(
      <WaffleChart {...props} selection={{ type: "item", id: items[1].id }} />,
    );
    expect(itemButton("Parcel B")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onSelection).toHaveBeenLastCalledWith(null);
    expect(itemButton("Parcel B")).toHaveAttribute("aria-pressed", "true");
    rerender(<WaffleChart {...props} selection={null} />);
    expect(itemButton("Parcel B")).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByRole("button", { name: "Clear selection" }),
    ).toBeNull();
  });

  it.each(["item", "group"] as const)(
    "omits the clear control for readonly selected %s without changing category emphasis",
    (type) => {
      const onCategory = vi.fn();
      const onSelection = vi.fn();
      const props = {
        accessibilityLabel: "Readonly selected parcels",
        items,
        categories,
        groups,
        selection: {
          type,
          id: type === "item" ? items[0].id : groups[0].id,
        },
        selectedCategoryId: "ready",
        onCategorySelectionChange: onCategory,
      };
      const { rerender } = render(<WaffleChart {...props} />);
      const selectedTarget =
        type === "item"
          ? itemButton("Parcel A")
          : screen.getByRole("button", { name: "North 2" });
      expect(selectedTarget).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText("Selected")).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "Clear selection" }),
      ).toBeNull();
      expect(screen.getByRole("button", { name: "Ready 2" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      act(() => selectedTarget.focus());
      fireEvent.click(selectedTarget);
      expect(selectedTarget).toHaveAttribute("aria-pressed", "true");
      expect(onCategory).not.toHaveBeenCalled();

      // The clear control becomes available only when the parent accepts changes.
      rerender(<WaffleChart {...props} onSelectionChange={onSelection} />);
      fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
      expect(onSelection).toHaveBeenCalledExactlyOnceWith(null);
      expect(onCategory).toHaveBeenCalledExactlyOnceWith(null);
    },
  );

  it("updates category and explicit highlights without filtering items or changing totals", () => {
    const onCategory = vi.fn();
    const props = {
      accessibilityLabel: "Parcels",
      items,
      categories,
      groups,
      onCategorySelectionChange: onCategory,
    };
    const { container, rerender } = render(<WaffleChart {...props} />);
    const legend = screen.getByRole("group", { name: "Categories" });
    const ready = within(legend).getByRole("button", { name: "Ready 2" });
    fireEvent.click(ready);
    expect(onCategory).toHaveBeenLastCalledWith("ready");
    expect(ready).toHaveAttribute("aria-pressed", "false");
    rerender(<WaffleChart {...props} selectedCategoryId="ready" />);
    expect(ready).toHaveAttribute("aria-pressed", "true");
    expect(itemButton("Parcel A")).toHaveAttribute("data-highlighted", "true");
    expect(itemButton("Parcel B")).toHaveAttribute("data-muted", "true");
    fireEvent.click(ready);
    expect(onCategory).toHaveBeenLastCalledWith(null);
    rerender(
      <WaffleChart
        {...props}
        selectedCategoryId="working"
        highlight={{ itemIds: [items[0].id], groupIds: ["south"] }}
      />,
    );
    expect(itemCells(container)).toHaveLength(3);
    expect(screen.getByText("3 items")).toBeVisible();
    expect(
      itemCells(container).every((cell) => cell.dataset.highlighted === "true"),
    ).toBe(true);
    expect(itemButton("Parcel C")).toHaveAttribute("data-muted", "true");
    expect(screen.getByRole("group", { name: "South" })).toHaveAttribute(
      "data-highlighted",
      "true",
    );
    rerender(
      <WaffleChart {...props} highlight={{ categoryIds: ["working"] }} />,
    );
    expect(itemButton("Parcel B")).toHaveAttribute("data-highlighted", "true");
    expect(itemButton("Parcel A")).not.toHaveAttribute("data-highlighted");
    expect(itemButton("Parcel B")).toHaveAttribute("data-draft", "true");
    expect(itemButton("Parcel B")).toHaveAccessibleName(
      "Parcel B, Working, Draft",
    );
    expect(itemButton("Parcel B")).toHaveTextContent("/");
    expect(itemButton("Parcel C")).toHaveAccessibleName(
      "Parcel C, Ready, Muted",
    );
    expect(screen.getByText("/ Draft")).toBeVisible();
    rerender(<WaffleChart {...props} />);
    expect(itemButton("Parcel A")).not.toHaveAttribute("data-muted");
    expect(itemButton("Parcel B")).not.toHaveAttribute("data-muted");
    expect(itemButton("Parcel C")).toHaveAttribute("data-muted", "true");
  });

  it("reports group hover, focus and activation while marking exactly its members", async () => {
    const onHover = vi.fn();
    const onFocus = vi.fn();
    const onActivate = vi.fn();
    const onSelection = vi.fn();
    const renderDetails = vi.fn(
      (inspection: WaffleChartInspection) => inspection.group?.label,
    );
    render(
      <WaffleChart
        accessibilityLabel="Parcels"
        items={items}
        categories={categories}
        groups={groups}
        onGroupHoverChange={onHover}
        onGroupFocusChange={onFocus}
        onGroupActivate={onActivate}
        onSelectionChange={onSelection}
        renderDetails={renderDetails}
      />,
    );
    const group = screen.getByRole("group", { name: "North" });
    const button = within(group).getByRole("button", { name: "North 2" });
    fireEvent.pointerEnter(group);
    expect(onHover).toHaveBeenLastCalledWith(groups[0]);
    expect(renderDetails.mock.lastCall![0]).toEqual({
      target: { type: "group", id: "north" },
      item: undefined,
      group: groups[0],
      pinned: false,
      totalCount: 3,
    });
    fireEvent.pointerLeave(group);
    expect(onHover).toHaveBeenLastCalledWith(null);
    act(() => button.focus());
    expect(onFocus).toHaveBeenLastCalledWith(groups[0]);
    await act(async () => button.blur());
    expect(onFocus).toHaveBeenLastCalledWith(null);
    fireEvent.click(button);
    expect(onActivate).toHaveBeenLastCalledWith(groups[0]);
    expect(onActivate.mock.lastCall![0]).toBe(groups[0]);
    expect(onSelection).toHaveBeenLastCalledWith({
      type: "group",
      id: "north",
    });
    expect(group).toHaveAttribute("data-selected", "true");
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(itemButton("Parcel A")).toHaveAttribute("aria-pressed", "true");
    expect(itemButton("Parcel B")).toHaveAttribute("aria-pressed", "true");
    expect(itemButton("Parcel C")).toHaveAttribute("aria-pressed", "false");
    expect(renderDetails.mock.lastCall![0]).toMatchObject({
      group: groups[0],
      pinned: true,
    });
    fireEvent.keyDown(button, { key: "Escape" });
    expect(onFocus).toHaveBeenLastCalledWith(null);
    expect(onHover).toHaveBeenLastCalledWith(null);
    expect(group).not.toHaveAttribute("data-selected");
  });
});

describe("combined trigger and details focus", () => {
  beforeEach(() => {
    vi.stubGlobal("PointerEvent", MouseEvent);
  });

  it.each([false, true])(
    "clears the previous callback kind when Tab moves group to item to group (custom details=%s)",
    async (customDetails) => {
      const changes: (WaffleChartItem | WaffleChartGroup | null)[] = [];
      const onItemFocus = vi.fn((item: WaffleChartItem | null) =>
        changes.push(item),
      );
      const onGroupFocus = vi.fn((group: WaffleChartGroup | null) =>
        changes.push(group),
      );
      const renderDetails = vi.fn((inspection: WaffleChartInspection) => (
        <button type="button">
          Inspect cross-kind {inspection.item?.label ?? inspection.group?.label}
        </button>
      ));
      const { user } = render(
        <WaffleChart
          accessibilityLabel="Cross-kind keyboard focus"
          items={items}
          categories={categories}
          groups={groups}
          showLegend={false}
          onItemFocusChange={onItemFocus}
          onGroupFocusChange={onGroupFocus}
          renderDetails={customDetails ? renderDetails : undefined}
        />,
      );
      const north = screen.getByRole("button", { name: "North 2" });
      const first = itemButton("Parcel A");
      const south = screen.getByRole("button", { name: "South 1" });
      await user.tab();
      await act(async () => {});
      expect(north).toHaveFocus();
      expect(onGroupFocus).toHaveBeenCalledExactlyOnceWith(groups[0]);
      await user.tab();
      await act(async () => {});
      expect(first).toHaveFocus();
      expect(onGroupFocus.mock.calls).toEqual([[groups[0]], [null]]);
      expect(onItemFocus).toHaveBeenCalledExactlyOnceWith(items[0]);
      expect(onItemFocus.mock.lastCall![0]).toBe(items[0]);
      if (customDetails) {
        expect(renderDetails.mock.lastCall![0]).toEqual({
          target: { type: "item", id: items[0].id },
          item: items[0],
          group: groups[0],
          pinned: false,
          totalCount: items.length,
        });
      }
      await user.tab();
      await act(async () => {});
      expect(south).toHaveFocus();
      expect(onItemFocus.mock.calls).toEqual([[items[0]], [null]]);
      expect(onGroupFocus.mock.calls).toEqual([
        [groups[0]],
        [null],
        [groups[1]],
      ]);
      expect(onGroupFocus.mock.lastCall![0]).toBe(groups[1]);
      expect(changes).toEqual([groups[0], null, items[0], null, groups[1]]);
      if (customDetails) {
        expect(renderDetails.mock.lastCall![0]).toEqual({
          target: { type: "group", id: groups[1].id },
          item: undefined,
          group: groups[1],
          pinned: false,
          totalCount: items.length,
        });
      }
    },
  );

  it.each(["item", "group"] as const)(
    "clears the focused %s callback when ShiftTab leaves its details for a different origin kind",
    async (type) => {
      const onItemFocus = vi.fn();
      const onGroupFocus = vi.fn();
      const renderDetails = vi.fn((inspection: WaffleChartInspection) => (
        <button
          key={`${inspection.target.type}:${inspection.target.id}`}
          type="button"
        >
          Cross-kind detail {inspection.item?.label ?? inspection.group?.label}
        </button>
      ));
      const { user } = render(
        <WaffleChart
          accessibilityLabel="Cross-kind details exit"
          items={[items[0]]}
          categories={categories}
          groups={type === "item" ? groups : [groups[0]]}
          showLegend={false}
          onItemFocusChange={onItemFocus}
          onGroupFocusChange={onGroupFocus}
          renderDetails={renderDetails}
        />,
      );
      const origin =
        type === "item"
          ? itemButton("Parcel A")
          : screen.getByRole("button", { name: "North 1" });
      const original = type === "item" ? items[0] : groups[0];
      act(() => origin.focus());
      const action = screen.getByRole("button", {
        name: `Cross-kind detail ${original.label}`,
      });
      act(() => action.focus());
      expect(action).toHaveFocus();
      const oldFocus = type === "item" ? onItemFocus : onGroupFocus;
      expect(oldFocus).not.toHaveBeenCalledWith(null);
      await user.tab({ shift: true });
      await act(async () => {});
      const next =
        type === "item"
          ? screen.getByRole("button", { name: "South 0" })
          : itemButton("Parcel A");
      expect(next).toHaveFocus();
      expect(oldFocus.mock.calls).toEqual([[original], [null]]);
      const nextObject = type === "item" ? groups[1] : items[0];
      expect(
        type === "item" ? onGroupFocus : onItemFocus,
      ).toHaveBeenCalledExactlyOnceWith(nextObject);
      expect(renderDetails.mock.lastCall![0]).toEqual({
        target: { type: type === "item" ? "group" : "item", id: nextObject.id },
        item: type === "group" ? items[0] : undefined,
        group: type === "item" ? groups[1] : groups[0],
        pinned: false,
        totalCount: 1,
      });
      expect(action).not.toBeInTheDocument();
    },
  );

  it.each(["item", "group"] as const)(
    "tabs from an unpinned %s into multiple details controls and back without losing inspection",
    async (type) => {
      const suppliedItems = type === "item" ? [items[0]] : [];
      const suppliedGroups = type === "group" ? [groups[0]] : undefined;
      const onItemFocus = vi.fn();
      const onGroupFocus = vi.fn();
      const onHover = vi.fn();
      const onActivate = vi.fn();
      const onSelection = vi.fn();
      const renderDetails = vi.fn((inspection: WaffleChartInspection) => (
        <>
          <button type="button">First inspection action</button>
          <button type="button">Second inspection action</button>
          <span>
            Metadata:{" "}
            {inspection.item?.metadata
              ? (inspection.item.metadata as { externalId: number }).externalId
              : (inspection.group?.metadata as { connection: string })
                  .connection}
          </span>
        </>
      ));
      const { user } = render(
        <>
          <button type="button">Before chart</button>
          <WaffleChart
            accessibilityLabel="Keyboard-only inspection"
            items={suppliedItems}
            categories={categories}
            groups={suppliedGroups}
            showLegend={false}
            onItemFocusChange={onItemFocus}
            onGroupFocusChange={onGroupFocus}
            onItemHoverChange={onHover}
            onGroupHoverChange={onHover}
            onItemActivate={onActivate}
            onGroupActivate={onActivate}
            onSelectionChange={onSelection}
            renderDetails={renderDetails}
          />
          <button type="button">After chart</button>
        </>,
      );
      await user.tab();
      await act(async () => {});
      expect(
        screen.getByRole("button", { name: "Before chart" }),
      ).toHaveFocus();
      await user.tab();
      await act(async () => {});
      const origin =
        type === "item"
          ? itemButton("Parcel A")
          : screen.getByRole("button", { name: "North 0" });
      const onFocus = type === "item" ? onItemFocus : onGroupFocus;
      const original = type === "item" ? items[0] : groups[0];
      expect(origin).toHaveFocus();
      expect(onFocus).toHaveBeenLastCalledWith(original);
      expect(renderDetails.mock.lastCall![0]).toEqual({
        target: { type, id: original.id },
        item: type === "item" ? items[0] : undefined,
        group: type === "group" ? groups[0] : undefined,
        pinned: false,
        totalCount: suppliedItems.length,
      });
      expect(
        type === "item"
          ? renderDetails.mock.lastCall![0].item
          : renderDetails.mock.lastCall![0].group,
      ).toBe(original);
      expect(
        screen.getByText(`Metadata: ${type === "item" ? "17" : "n-1"}`),
      ).toBeVisible();
      const first = screen.getByRole("button", {
        name: "First inspection action",
      });
      const second = screen.getByRole("button", {
        name: "Second inspection action",
      });
      await user.tab();
      await act(async () => {});
      expect(first).toHaveFocus();
      expect(first).toBeInTheDocument();
      expect(onFocus).not.toHaveBeenCalledWith(null);
      await user.tab();
      await act(async () => {});
      expect(second).toHaveFocus();
      await user.tab({ shift: true });
      await act(async () => {});
      expect(first).toHaveFocus();
      await user.tab({ shift: true });
      await act(async () => {});
      expect(origin).toHaveFocus();
      expect(onFocus).not.toHaveBeenCalledWith(null);
      expect(screen.getByText("Inspecting")).toBeVisible();
      expect(origin).toHaveAttribute("aria-pressed", "false");
      await user.tab();
      await act(async () => {});
      expect(first).toHaveFocus();
      await user.tab();
      await act(async () => {});
      expect(second).toHaveFocus();
      await user.tab();
      await act(async () => {});
      expect(screen.getByRole("button", { name: "After chart" })).toHaveFocus();
      expect(onFocus).toHaveBeenLastCalledWith(null);
      expect(
        onFocus.mock.calls.filter(([value]) => value === null),
      ).toHaveLength(1);
      expect(first).not.toBeInTheDocument();
      expect(second).not.toBeInTheDocument();
      expect(
        screen.getByText("Focus or select a cell or group to inspect it"),
      ).toBeVisible();
      expect(onHover).not.toHaveBeenCalled();
      expect(onActivate).not.toHaveBeenCalled();
      expect(onSelection).not.toHaveBeenCalled();
      expect(
        type === "item" ? onGroupFocus : onItemFocus,
      ).not.toHaveBeenCalled();
    },
  );

  it.each(["item", "group"] as const)(
    "restores the unpinned keyboard %s after Escape in details without reopening on the next Escape",
    async (type) => {
      const onOuterKeyDown = vi.fn();
      const onFocus = vi.fn();
      const { user } = render(
        <div onKeyDown={onOuterKeyDown}>
          <WaffleChart
            accessibilityLabel="Keyboard details Escape"
            items={type === "item" ? [items[0]] : []}
            categories={categories}
            groups={type === "group" ? [groups[0]] : undefined}
            showLegend={false}
            onItemFocusChange={type === "item" ? onFocus : undefined}
            onGroupFocusChange={type === "group" ? onFocus : undefined}
            renderDetails={() => (
              <button type="button">Keyboard detail action</button>
            )}
          />
        </div>,
      );
      await user.tab();
      await act(async () => {});
      const origin =
        type === "item"
          ? itemButton("Parcel A")
          : screen.getByRole("button", { name: "North 0" });
      expect(origin).toHaveFocus();
      await user.tab();
      await act(async () => {});
      const action = screen.getByRole("button", {
        name: "Keyboard detail action",
      });
      expect(action).toHaveFocus();
      onOuterKeyDown.mockClear();
      await user.keyboard("{Escape}");
      expect(origin).toHaveFocus();
      expect(action).not.toBeInTheDocument();
      expect(onFocus).toHaveBeenLastCalledWith(null);
      expect(onOuterKeyDown).not.toHaveBeenCalled();
      expect(screen.queryByText("Inspecting")).toBeNull();
      await user.keyboard("{Escape}");
      expect(origin).toHaveFocus();
      expect(onOuterKeyDown).toHaveBeenCalledOnce();
      expect(
        screen.queryByRole("button", { name: "Keyboard detail action" }),
      ).toBeNull();
    },
  );

  it.each([
    { originType: "item", hoverType: "item" },
    { originType: "item", hoverType: "group" },
    { originType: "group", hoverType: "item" },
    { originType: "group", hoverType: "group" },
  ] as const)(
    "keeps focused $originType details authoritative until Tab leaves, then reports the waiting $hoverType hover",
    async ({ originType, hoverType }) => {
      const onItemFocus = vi.fn();
      const onGroupFocus = vi.fn();
      const onItemHover = vi.fn();
      const onGroupHover = vi.fn();
      const renderDetails = vi.fn((inspection: WaffleChartInspection) => (
        <div key={`${inspection.target.type}:${inspection.target.id}`}>
          <button type="button">
            Inspect {inspection.item?.label ?? inspection.group?.label}
          </button>
          <button type="button">Next detail action</button>
        </div>
      ));
      const { user } = render(
        <>
          <WaffleChart
            accessibilityLabel="Details focus authority"
            items={items}
            categories={categories}
            groups={groups}
            showLegend={false}
            onItemFocusChange={onItemFocus}
            onGroupFocusChange={onGroupFocus}
            onItemHoverChange={onItemHover}
            onGroupHoverChange={onGroupHover}
            renderDetails={renderDetails}
          />
          <button type="button">Outside details</button>
        </>,
      );
      const origin =
        originType === "item"
          ? itemButton("Parcel A")
          : screen.getByRole("button", { name: "North 2" });
      const original = originType === "item" ? items[0] : groups[0];
      const onFocus = originType === "item" ? onItemFocus : onGroupFocus;
      act(() => origin.focus());
      const action = screen.getByRole("button", {
        name: `Inspect ${original.label}`,
      });
      act(() => action.focus());
      expect(action).toHaveFocus();
      const next =
        hoverType === "item"
          ? itemButton("Parcel C")
          : screen.getByRole("group", { name: "South" });
      fireEvent.pointerLeave(action, { relatedTarget: next });
      fireEvent.pointerEnter(next, { relatedTarget: action });
      expect(action).toHaveFocus();
      expect(action).toBeInTheDocument();
      expect(renderDetails.mock.lastCall![0]).toMatchObject({
        target: { type: originType, id: original.id },
        pinned: false,
      });
      expect(onFocus).toHaveBeenLastCalledWith(original);
      expect(onFocus).not.toHaveBeenCalledWith(null);
      expect(onItemHover).not.toHaveBeenCalledWith(items[2]);
      expect(onGroupHover).not.toHaveBeenCalledWith(groups[1]);
      await user.tab();
      await act(async () => {});
      expect(
        screen.getByRole("button", { name: "Next detail action" }),
      ).toHaveFocus();
      expect(renderDetails.mock.lastCall![0].target).toEqual({
        type: originType,
        id: original.id,
      });
      await user.tab();
      await act(async () => {});
      expect(
        screen.getByRole("button", { name: "Outside details" }),
      ).toHaveFocus();
      expect(onFocus).toHaveBeenLastCalledWith(null);
      expect(renderDetails.mock.lastCall![0]).toMatchObject({
        target: {
          type: hoverType,
          id: hoverType === "item" ? items[2].id : groups[1].id,
        },
        pinned: false,
      });
      expect(
        hoverType === "item"
          ? renderDetails.mock.lastCall![0].item
          : renderDetails.mock.lastCall![0].group,
      ).toBe(hoverType === "item" ? items[2] : groups[1]);
      expect(onGroupHover).toHaveBeenLastCalledWith(groups[1]);
      if (hoverType === "item")
        expect(onItemHover).toHaveBeenLastCalledWith(items[2]);
    },
  );

  it.each([
    { focusType: "item", hoverType: "item" },
    { focusType: "item", hoverType: "group" },
    { focusType: "group", hoverType: "item" },
    { focusType: "group", hoverType: "group" },
  ] as const)(
    "captures the displayed hovered $hoverType when details take focus from a different $focusType",
    ({ focusType, hoverType }) => {
      const onItemFocus = vi.fn();
      const onGroupFocus = vi.fn();
      const renderDetails = vi.fn((inspection: WaffleChartInspection) => (
        <button
          key={`${inspection.target.type}:${inspection.target.id}`}
          type="button"
        >
          Capture {inspection.item?.label ?? inspection.group?.label}
        </button>
      ));
      render(
        <WaffleChart
          accessibilityLabel="Displayed inspection focus"
          items={items}
          categories={categories}
          groups={groups}
          onItemFocusChange={onItemFocus}
          onGroupFocusChange={onGroupFocus}
          renderDetails={renderDetails}
        />,
      );
      const initial =
        focusType === "item"
          ? itemButton("Parcel A")
          : screen.getByRole("button", { name: "North 2" });
      act(() => initial.focus());
      const hovered =
        hoverType === "item"
          ? itemButton("Parcel C")
          : screen.getByRole("group", { name: "South" });
      const inspected = hoverType === "item" ? items[2] : groups[1];
      fireEvent.pointerEnter(hovered);
      expect(initial).toHaveFocus();
      const action = screen.getByRole("button", {
        name: `Capture ${inspected.label}`,
      });
      act(() => action.focus());
      expect(action).toHaveFocus();
      expect(
        hoverType === "item" ? onItemFocus : onGroupFocus,
      ).toHaveBeenLastCalledWith(inspected);
      fireEvent.pointerLeave(hovered, { relatedTarget: document.body });
      expect(action).toHaveFocus();
      expect(renderDetails.mock.lastCall![0]).toMatchObject({
        target: { type: hoverType, id: inspected.id },
        pinned: false,
      });
      expect(
        hoverType === "item"
          ? renderDetails.mock.lastCall![0].item
          : renderDetails.mock.lastCall![0].group,
      ).toBe(inspected);
      expect(fireEvent.keyDown(action, { key: "Escape" })).toBe(false);
      expect(
        hoverType === "item"
          ? hovered
          : screen.getByRole("button", { name: "South 1" }),
      ).toHaveFocus();
      expect(action).not.toBeInTheDocument();
      expect(screen.queryByText("Inspecting")).toBeNull();
    },
  );

  it.each(["item", "group"] as const)(
    "keeps a pinned %s authoritative when a custom details control captures another trigger's focus",
    async (type) => {
      const selected = type === "item" ? items[0] : groups[0];
      const onSelection = vi.fn();
      const renderDetails = vi.fn((inspection: WaffleChartInspection) => (
        <button
          key={`${inspection.target.type}:${inspection.target.id}`}
          type="button"
        >
          Pinned {inspection.item?.label ?? inspection.group?.label}
        </button>
      ));
      const { user } = render(
        <>
          <WaffleChart
            accessibilityLabel="Pinned combined focus"
            items={items}
            categories={categories}
            groups={groups}
            defaultSelection={{ type, id: selected.id }}
            showLegend={false}
            onSelectionChange={onSelection}
            renderDetails={renderDetails}
          />
          <button type="button">After pinned details</button>
        </>,
      );
      act(() => itemButton("Parcel C").focus());
      const action = screen.getByRole("button", {
        name: `Pinned ${selected.label}`,
      });
      act(() => action.focus());
      expect(action).toHaveFocus();
      fireEvent.pointerEnter(itemButton("Parcel B"));
      expect(action).toHaveFocus();
      expect(renderDetails.mock.lastCall![0]).toMatchObject({
        target: { type, id: selected.id },
        pinned: true,
      });
      await user.tab();
      await act(async () => {});
      expect(
        screen.getByRole("button", { name: "After pinned details" }),
      ).toHaveFocus();
      expect(action).toBeVisible();
      expect(renderDetails.mock.lastCall![0]).toMatchObject({
        target: { type, id: selected.id },
        pinned: true,
      });
      expect(onSelection).not.toHaveBeenCalled();
    },
  );

  it("preserves focused details through item membership and metadata updates while its origin remounts", () => {
    const onFocus = vi.fn();
    const renderDetails = vi.fn((inspection: WaffleChartInspection) => (
      <button type="button">Updated inspection {inspection.item?.label}</button>
    ));
    const props = {
      accessibilityLabel: "Updated focused details",
      categories,
      groups,
      showLegend: false,
      onItemFocusChange: onFocus,
      renderDetails,
    };
    const { rerender } = render(<WaffleChart {...props} items={items} />);
    const origin = itemButton("Parcel A");
    act(() => origin.focus());
    const action = screen.getByRole("button", {
      name: "Updated inspection Parcel A",
    });
    act(() => action.focus());
    expect(action).toHaveFocus();
    const updated = {
      ...items[0],
      groupId: "south",
      metadata: { externalId: 71 },
    };
    rerender(<WaffleChart {...props} items={[updated, items[1], items[2]]} />);
    expect(origin).not.toBeInTheDocument();
    expect(action).toHaveFocus();
    expect(onFocus).not.toHaveBeenCalledWith(null);
    expect(renderDetails.mock.lastCall![0]).toMatchObject({
      target: { type: "item", id: updated.id },
      item: updated,
      group: groups[1],
      pinned: false,
    });
    expect(renderDetails.mock.lastCall![0].item).toBe(updated);
    expect(fireEvent.keyDown(action, { key: "Escape" })).toBe(false);
    expect(itemButton("Parcel A")).toHaveFocus();
    expect(action).not.toBeInTheDocument();
    expect(onFocus).toHaveBeenLastCalledWith(null);
  });

  it.each([
    { type: "item", change: "removal" },
    { type: "group", change: "removal" },
    { type: "item", change: "passive" },
    { type: "group", change: "passive" },
    { type: "item", change: "compact" },
    { type: "group", change: "compact" },
  ] as const)(
    "releases focused $type details after $change and does not revive them when restored",
    ({ type, change }) => {
      const onItemFocus = vi.fn();
      const onGroupFocus = vi.fn();
      const props = {
        accessibilityLabel: "Focused details lifecycle",
        items,
        categories,
        groups,
        showLegend: false,
        onItemFocusChange: onItemFocus,
        onGroupFocusChange: onGroupFocus,
        renderDetails: () => (
          <button type="button">Lifecycle detail action</button>
        ),
      };
      const { rerender } = render(<WaffleChart {...props} />);
      const origin =
        type === "item"
          ? itemButton("Parcel A")
          : screen.getByRole("button", { name: "North 2" });
      const onFocus = type === "item" ? onItemFocus : onGroupFocus;
      act(() => origin.focus());
      const action = screen.getByRole("button", {
        name: "Lifecycle detail action",
      });
      act(() => action.focus());
      expect(action).toHaveFocus();
      expect(onFocus).not.toHaveBeenCalledWith(null);
      const changedProps =
        change === "removal"
          ? type === "item"
            ? { items: items.slice(1) }
            : { groups: groups.slice(1) }
          : change === "passive"
            ? { interaction: "none" as const }
            : { variant: "compact" as const };
      rerender(<WaffleChart {...props} {...changedProps} />);
      expect(action).not.toBeInTheDocument();
      expect(onFocus).toHaveBeenLastCalledWith(null);
      expect(screen.queryByText("Inspecting")).toBeNull();
      rerender(<WaffleChart {...props} />);
      expect(
        screen.queryByRole("button", { name: "Lifecycle detail action" }),
      ).toBeNull();
      expect(screen.queryByText("Inspecting")).toBeNull();
      expect(
        screen.getByText("Focus or select a cell or group to inspect it"),
      ).toBeVisible();
      expect(onFocus.mock.calls).toEqual([
        [type === "item" ? items[0] : groups[0]],
        [null],
      ]);
    },
  );

  describe("with caller-rendered library portals", () => {
    let restoreStyle: () => void;
    let restoreIntersection: () => void;

    beforeEach(() => {
      restoreStyle = mockGetComputedStyle();
      restoreIntersection = mockIntersectionObserver();
      disableReactTransitionGroup();
    });

    afterEach(() => {
      cleanup();
      restoreIntersection();
      restoreStyle();
      enableReactTransitionGroup();
    });

    describe.each(["Select", "Modal"] as const)("with owned %s", (kind) => {
      it.each([
        { type: "item", pinned: false },
        { type: "group", pinned: false },
        { type: "item", pinned: true },
        { type: "group", pinned: true },
      ] as const)(
        "keeps $type details and callbacks through portal focus, close and restoration (pinned=$pinned)",
        async ({ type, pinned }) => {
          const original = type === "item" ? items[0] : groups[0];
          const onItemFocus = vi.fn();
          const onGroupFocus = vi.fn();
          const onItemHover = vi.fn();
          const onGroupHover = vi.fn();
          const onSelection = vi.fn();
          const renderDetails = vi.fn((inspection: WaffleChartInspection) => (
            <div key={`${inspection.target.type}:${inspection.target.id}`}>
              <span>
                Portal inspection:{" "}
                {inspection.item?.label ?? inspection.group?.label}
              </span>
              {kind === "Select" ? (
                <Select label="Inspection view" defaultSelectedKey="daily">
                  <Select.Option key="daily">Daily</Select.Option>
                  <Select.Option key="weekly">Weekly</Select.Option>
                </Select>
              ) : (
                <Modal.Trigger>
                  <Button>Open inspection modal</Button>
                  <Modal>
                    <Modal.Header>Inspection modal</Modal.Header>
                    <Modal.Body>
                      <button type="button">First modal detail action</button>
                      <button type="button">Second modal detail action</button>
                    </Modal.Body>
                  </Modal>
                </Modal.Trigger>
              )}
            </div>
          ));
          const { user } = render(
            <>
              <WaffleChart
                accessibilityLabel="Owned inspection portal"
                items={items}
                categories={categories}
                groups={groups}
                showLegend={false}
                defaultSelection={pinned ? { type, id: original.id } : null}
                onItemFocusChange={onItemFocus}
                onGroupFocusChange={onGroupFocus}
                onItemHoverChange={onItemHover}
                onGroupHoverChange={onGroupHover}
                onSelectionChange={onSelection}
                renderDetails={renderDetails}
              />
              <button type="button">After owned portal details</button>
            </>,
          );
          const root = screen.getByRole("group", {
            name: "Owned inspection portal",
          });
          const origin =
            type === "item"
              ? itemButton("Parcel A")
              : screen.getByRole("button", { name: "North 2" });
          const waitingHover =
            type === "item"
              ? itemButton("Parcel C")
              : screen.getByRole("group", { name: "South" });
          const outside = screen.getByRole("button", {
            name: "After owned portal details",
          });
          const onFocus = type === "item" ? onItemFocus : onGroupFocus;
          act(() => origin.focus());
          const trigger = screen.getByRole("button", {
            name:
              kind === "Select"
                ? "Daily Inspection view"
                : "Open inspection modal",
          });
          act(() => trigger.focus());
          expect(trigger).toHaveFocus();
          await user.keyboard("{Enter}");
          await act(async () => vi.advanceTimersByTime(100));
          const portal = screen.getByRole(
            kind === "Select" ? "listbox" : "dialog",
          );
          expect(root.contains(portal)).toBe(false);
          expect(portal.contains(document.activeElement)).toBe(true);
          expect(document.body).not.toHaveFocus();
          expect(trigger).toBeInTheDocument();
          expect(onFocus).not.toHaveBeenCalledWith(null);
          expect(renderDetails.mock.lastCall![0]).toMatchObject({
            target: { type, id: original.id },
            pinned,
          });
          expect(
            type === "item"
              ? renderDetails.mock.lastCall![0].item
              : renderDetails.mock.lastCall![0].group,
          ).toBe(original);
          fireEvent.pointerEnter(waitingHover);
          expect(onItemHover).not.toHaveBeenCalledWith(items[2]);
          expect(onGroupHover).not.toHaveBeenCalledWith(groups[1]);
          expect(renderDetails.mock.lastCall![0].target).toEqual({
            type,
            id: original.id,
          });
          expect(portal.contains(document.activeElement)).toBe(true);
          if (kind === "Select") {
            await user.keyboard("{ArrowDown}");
            expect(portal.contains(document.activeElement)).toBe(true);
          } else {
            const first = within(portal).getByRole("button", {
              name: "First modal detail action",
            });
            act(() => first.focus());
            expect(first).toHaveFocus();
            await user.tab();
            await act(async () => {});
            expect(
              within(portal).getByRole("button", {
                name: "Second modal detail action",
              }),
            ).toHaveFocus();
          }
          await act(async () => vi.advanceTimersByTime(100));
          expect(onFocus).not.toHaveBeenCalledWith(null);
          expect(renderDetails.mock.lastCall![0].target).toEqual({
            type,
            id: original.id,
          });
          await user.keyboard("{Escape}");
          expect(
            screen.queryByRole(kind === "Select" ? "listbox" : "dialog"),
          ).toBeNull();
          await act(async () => vi.advanceTimersByTime(100));
          expect(trigger).toHaveFocus();
          expect(onFocus).not.toHaveBeenCalledWith(null);
          expect(renderDetails.mock.lastCall![0]).toMatchObject({
            target: { type, id: original.id },
            pinned,
          });
          expect(onSelection).not.toHaveBeenCalled();
          fireEvent.pointerLeave(waitingHover, {
            relatedTarget: document.body,
          });
          expect(trigger).toHaveFocus();
          expect(onFocus).not.toHaveBeenCalledWith(null);
          await user.tab();
          await act(async () => {});
          await act(async () => vi.advanceTimersByTime(100));
          expect(outside).toHaveFocus();
          expect(onFocus).toHaveBeenLastCalledWith(null);
          if (pinned) {
            expect(trigger).toBeVisible();
            expect(renderDetails.mock.lastCall![0]).toMatchObject({
              target: { type, id: original.id },
              pinned: true,
            });
          } else {
            expect(trigger).not.toBeInTheDocument();
            expect(
              screen.getByText("Focus or select a cell or group to inspect it"),
            ).toBeVisible();
          }
          expect(onSelection).not.toHaveBeenCalled();
        },
      );
    });
  });
});

describe("hoverable inspection", () => {
  beforeEach(() => {
    // jsdom needs MouseEvent's relatedTarget for React's pointer enter/leave path.
    vi.stubGlobal("PointerEvent", MouseEvent);
  });

  function movePointer(from: HTMLElement, to: HTMLElement) {
    fireEvent.pointerLeave(from, { relatedTarget: to });
    fireEvent.pointerEnter(to, { relatedTarget: from });
  }

  it.each(["item", "group"] as const)(
    "retains pure %s hover across details, legend and gaps until the pointer leaves the root",
    (type) => {
      const onItemHover = vi.fn();
      const onGroupHover = vi.fn();
      const onFocus = vi.fn();
      const onSelection = vi.fn();
      const renderDetails = vi.fn((inspection: WaffleChartInspection) => (
        <span>
          Inspection: {inspection.item?.label ?? inspection.group?.label}
        </span>
      ));
      render(
        <WaffleChart
          accessibilityLabel="Hoverable parcels"
          items={items}
          categories={categories}
          groups={groups}
          onItemHoverChange={onItemHover}
          onGroupHoverChange={onGroupHover}
          onItemFocusChange={onFocus}
          onGroupFocusChange={onFocus}
          onSelectionChange={onSelection}
          renderDetails={renderDetails}
        />,
      );
      const root = screen.getByRole("group", { name: "Hoverable parcels" });
      const target =
        type === "item"
          ? itemButton("Parcel A")
          : screen.getByRole("group", { name: "North" });
      const text = `Inspection: ${type === "item" ? items[0].label : groups[0].label}`;
      fireEvent.pointerEnter(target);
      const details = screen
        .getByText(text)
        .closest<HTMLElement>('[aria-live="polite"]')!;
      const legend = screen.getByRole("group", { name: "Categories" });
      const itemCalls = onItemHover.mock.calls.length;
      const groupCalls = onGroupHover.mock.calls.length;
      expect(onGroupHover).toHaveBeenLastCalledWith(groups[0]);
      if (type === "item")
        expect(onItemHover).toHaveBeenLastCalledWith(items[0]);

      movePointer(target, details);
      expect(screen.getByText(text)).toBeVisible();
      movePointer(details, legend);
      expect(screen.getByText(text)).toBeVisible();
      movePointer(legend, root);
      expect(screen.getByText(text)).toBeVisible();
      movePointer(root, details);
      expect(screen.getByText(text)).toBeVisible();
      expect(renderDetails.mock.lastCall![0]).toMatchObject({
        target: { type, id: type === "item" ? items[0].id : groups[0].id },
        pinned: false,
      });
      expect(onItemHover).toHaveBeenCalledTimes(itemCalls);
      expect(onGroupHover).toHaveBeenCalledTimes(groupCalls);
      expect(onFocus).not.toHaveBeenCalled();
      expect(onSelection).not.toHaveBeenCalled();
      expect(document.body).toHaveFocus();

      movePointer(details, document.body);
      expect(screen.queryByText(text)).toBeNull();
      expect(
        screen.getByText("Focus or select a cell or group to inspect it"),
      ).toBeVisible();
      expect(onGroupHover).toHaveBeenLastCalledWith(null);
      expect(onGroupHover).toHaveBeenCalledTimes(groupCalls + 1);
      if (type === "item") {
        expect(onItemHover).toHaveBeenLastCalledWith(null);
        expect(onItemHover).toHaveBeenCalledTimes(itemCalls + 1);
      } else expect(onItemHover).not.toHaveBeenCalled();
    },
  );

  it.each(["item", "group"] as const)(
    "dismisses retained %s hover with Escape in details and lets the next Escape propagate",
    (type) => {
      const onOuterKeyDown = vi.fn();
      const onItemHover = vi.fn();
      const onGroupHover = vi.fn();
      const onFocus = vi.fn();
      render(
        <div onKeyDown={onOuterKeyDown}>
          <WaffleChart
            accessibilityLabel="Hover Escape"
            items={items}
            categories={categories}
            groups={groups}
            onItemHoverChange={onItemHover}
            onGroupHoverChange={onGroupHover}
            onItemFocusChange={onFocus}
            onGroupFocusChange={onFocus}
            renderDetails={({ item, group }) => (
              <span>Inspection: {item?.label ?? group?.label}</span>
            )}
          />
        </div>,
      );
      const target =
        type === "item"
          ? itemButton("Parcel A")
          : screen.getByRole("group", { name: "North" });
      const text = `Inspection: ${type === "item" ? items[0].label : groups[0].label}`;
      fireEvent.pointerEnter(target);
      const details = screen
        .getByText(text)
        .closest<HTMLElement>('[aria-live="polite"]')!;
      movePointer(target, details);
      expect(screen.getByText(text)).toBeVisible();
      expect(onFocus).not.toHaveBeenCalled();
      expect(document.body).toHaveFocus();

      expect(fireEvent.keyDown(details, { key: "Escape" })).toBe(false);
      expect(onItemHover).toHaveBeenLastCalledWith(null);
      expect(onGroupHover).toHaveBeenLastCalledWith(null);
      expect(screen.queryByText(text)).toBeNull();
      expect(
        screen.getByText("Focus or select a cell or group to inspect it"),
      ).toBeVisible();
      expect(onOuterKeyDown).not.toHaveBeenCalled();
      expect(fireEvent.keyDown(details, { key: "Escape" })).toBe(true);
      expect(onOuterKeyDown).toHaveBeenCalledOnce();
      expect(screen.queryByText(text)).toBeNull();
    },
  );

  it.each(["item", "group"] as const)(
    "returns focus to an unpinned hovered %s when Escape dismisses a custom details control",
    (type) => {
      const onOuterKeyDown = vi.fn();
      const onFocus = vi.fn();
      const renderDetails = vi.fn((inspection: WaffleChartInspection) => (
        <button type="button">
          Details: {inspection.item?.label ?? inspection.group?.label}
        </button>
      ));
      render(
        <div onKeyDown={onOuterKeyDown}>
          <WaffleChart
            accessibilityLabel="Unpinned details focus"
            items={items}
            categories={categories}
            groups={groups}
            onItemFocusChange={type === "item" ? onFocus : undefined}
            onGroupFocusChange={type === "group" ? onFocus : undefined}
            renderDetails={renderDetails}
          />
        </div>,
      );
      const target =
        type === "item"
          ? itemButton("Parcel A")
          : screen.getByRole("group", { name: "North" });
      const returnControl =
        type === "item"
          ? target
          : screen.getByRole("button", { name: "North 2" });
      fireEvent.pointerEnter(target);
      const action = screen.getByRole("button", {
        name: `Details: ${type === "item" ? "Parcel A" : "North"}`,
      });
      movePointer(target, action);
      act(() => action.focus());
      expect(action).toHaveFocus();
      expect(renderDetails.mock.lastCall![0]).toMatchObject({
        target: { type, id: type === "item" ? items[0].id : groups[0].id },
        pinned: false,
      });
      expect(onFocus).toHaveBeenCalledExactlyOnceWith(
        type === "item" ? items[0] : groups[0],
      );

      expect(fireEvent.keyDown(action, { key: "Escape" })).toBe(false);
      expect(returnControl).toHaveFocus();
      expect(action).not.toBeInTheDocument();
      expect(
        screen.getByText("Focus or select a cell or group to inspect it"),
      ).toBeVisible();
      expect(onFocus.mock.calls).toEqual([
        [type === "item" ? items[0] : groups[0]],
        [null],
      ]);
      expect(onOuterKeyDown).not.toHaveBeenCalled();
      expect(fireEvent.keyDown(returnControl, { key: "Escape" })).toBe(true);
      expect(onOuterKeyDown).toHaveBeenCalledOnce();
      expect(screen.queryByText("Inspecting")).toBeNull();
    },
  );

  it.each(["item", "group"] as const)(
    "keeps an unpinned %s details control focused across root pointer exit until focus leaves",
    async (type) => {
      const onItemHover = vi.fn();
      const onGroupHover = vi.fn();
      const onFocus = vi.fn();
      const onCategory = vi.fn();
      const onSelection = vi.fn();
      const renderDetails = vi.fn(({ item, group }: WaffleChartInspection) => (
        <button type="button">Details: {item?.label ?? group?.label}</button>
      ));
      const { user } = render(
        <>
          <WaffleChart
            accessibilityLabel="Pointer exit details focus"
            items={items}
            categories={categories}
            groups={groups}
            selectedCategoryId="ready"
            onItemHoverChange={onItemHover}
            onGroupHoverChange={onGroupHover}
            onItemFocusChange={type === "item" ? onFocus : undefined}
            onGroupFocusChange={type === "group" ? onFocus : undefined}
            onCategorySelectionChange={onCategory}
            onSelectionChange={onSelection}
            renderDetails={renderDetails}
          />
          <button type="button">After focused details</button>
        </>,
      );
      const target =
        type === "item"
          ? itemButton("Parcel A")
          : screen.getByRole("group", { name: "North" });
      fireEvent.pointerEnter(target);
      const action = screen.getByRole("button", {
        name: `Details: ${type === "item" ? "Parcel A" : "North"}`,
      });
      movePointer(target, action);
      act(() => action.focus());
      expect(action).toHaveFocus();
      expect(onFocus).toHaveBeenCalledExactlyOnceWith(
        type === "item" ? items[0] : groups[0],
      );

      movePointer(action, document.body);
      expect(action).toHaveFocus();
      expect(action).toBeInTheDocument();
      expect(screen.getByText("Inspecting")).toBeVisible();
      expect(renderDetails.mock.lastCall![0]).toMatchObject({
        target: { type, id: type === "item" ? items[0].id : groups[0].id },
        pinned: false,
      });
      if (type === "item") expect(onItemHover).toHaveBeenLastCalledWith(null);
      expect(onGroupHover).toHaveBeenLastCalledWith(null);
      expect(onFocus).not.toHaveBeenCalledWith(null);
      expect(onCategory).not.toHaveBeenCalled();
      expect(onSelection).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Ready 2" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      await user.tab();
      await act(async () => {});
      expect(
        screen.getByRole("button", { name: "After focused details" }),
      ).toHaveFocus();
      expect(action).not.toBeInTheDocument();
      expect(onFocus).toHaveBeenLastCalledWith(null);
      expect(
        screen.getByText("Focus or select a cell or group to inspect it"),
      ).toBeVisible();
      expect(onCategory).not.toHaveBeenCalled();
      expect(onSelection).not.toHaveBeenCalled();
    },
  );

  it.each(["item", "group"] as const)(
    "keeps a pinned %s details control focused when the pointer leaves the root",
    (type) => {
      const onItemHover = vi.fn();
      const onGroupHover = vi.fn();
      const onCategory = vi.fn();
      const onSelection = vi.fn();
      render(
        <WaffleChart
          accessibilityLabel="Pinned pointer exit"
          items={items}
          categories={categories}
          groups={groups}
          defaultSelection={{
            type,
            id: type === "item" ? items[0].id : groups[0].id,
          }}
          selectedCategoryId="ready"
          onItemHoverChange={onItemHover}
          onGroupHoverChange={onGroupHover}
          onCategorySelectionChange={onCategory}
          onSelectionChange={onSelection}
          renderDetails={() => (
            <button type="button">Pinned detail action</button>
          )}
        />,
      );
      const second = itemButton("Parcel B");
      const action = screen.getByRole("button", {
        name: "Pinned detail action",
      });
      fireEvent.pointerEnter(second);
      movePointer(second, action);
      act(() => action.focus());
      expect(action).toHaveFocus();

      movePointer(action, document.body);
      expect(action).toHaveFocus();
      expect(action).toBeVisible();
      expect(screen.getByText("Selected")).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Clear selection" }),
      ).toBeVisible();
      expect(onItemHover).toHaveBeenLastCalledWith(null);
      expect(onGroupHover).toHaveBeenLastCalledWith(null);
      expect(onSelection).not.toHaveBeenCalled();
      expect(onCategory).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Ready 2" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    },
  );

  it.each(["item", "group"] as const)(
    "dismisses retained %s hover once when Escape targets the unfocused document body",
    (type) => {
      const onOuterKeyDown = vi.fn(
        (event: KeyboardEvent) => event.defaultPrevented,
      );
      const onItemHover = vi.fn();
      const onGroupHover = vi.fn();
      render(
        <WaffleChart
          accessibilityLabel="Unfocused hover Escape"
          items={items}
          categories={categories}
          groups={groups}
          onItemHoverChange={onItemHover}
          onGroupHoverChange={onGroupHover}
          renderDetails={({ item, group }) => (
            <span>Inspection: {item?.label ?? group?.label}</span>
          )}
        />,
      );
      const target =
        type === "item"
          ? itemButton("Parcel A")
          : screen.getByRole("group", { name: "North" });
      const text = `Inspection: ${type === "item" ? items[0].label : groups[0].label}`;
      fireEvent.pointerEnter(target);
      const details = screen
        .getByText(text)
        .closest<HTMLElement>('[aria-live="polite"]')!;
      movePointer(target, details);
      expect(screen.getByText(text)).toBeVisible();
      expect(document.body).toHaveFocus();
      window.addEventListener("keydown", onOuterKeyDown);
      try {
        expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(false);
        expect(screen.queryByText(text)).toBeNull();
        expect(
          screen.getByText("Focus or select a cell or group to inspect it"),
        ).toBeVisible();
        if (type === "item") expect(onItemHover).toHaveBeenLastCalledWith(null);
        expect(onGroupHover).toHaveBeenLastCalledWith(null);
        expect(onOuterKeyDown).toHaveBeenCalledOnce();
        expect(onOuterKeyDown).toHaveLastReturnedWith(true);
        const itemCalls = onItemHover.mock.calls.length;
        const groupCalls = onGroupHover.mock.calls.length;

        expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(true);
        expect(onOuterKeyDown).toHaveBeenCalledTimes(2);
        expect(onOuterKeyDown).toHaveLastReturnedWith(false);
        expect(onItemHover).toHaveBeenCalledTimes(itemCalls);
        expect(onGroupHover).toHaveBeenCalledTimes(groupCalls);
        expect(screen.queryByText(text)).toBeNull();
      } finally {
        window.removeEventListener("keydown", onOuterKeyDown);
      }
    },
  );

  it("lets a sibling chart handle Escape before clearing retained hover", () => {
    const onHover = vi.fn();
    render(
      <>
        <WaffleChart
          accessibilityLabel="Hovered sibling"
          items={items}
          categories={categories}
          onItemHoverChange={onHover}
          renderDetails={() => <span>Retained sibling details</span>}
        />
        <WaffleChart
          accessibilityLabel="Focused sibling"
          items={items}
          categories={categories}
        />
      </>,
    );
    const hovered = screen.getByRole("group", { name: "Hovered sibling" });
    const focused = screen.getByRole("group", { name: "Focused sibling" });
    const first = within(hovered).getByRole("button", {
      name: "Parcel A, Ready",
    });
    const second = within(focused).getByRole("button", {
      name: "Parcel B, Working, Draft",
    });
    fireEvent.pointerEnter(first);
    const details = screen
      .getByText("Retained sibling details")
      .closest<HTMLElement>('[aria-live="polite"]')!;
    movePointer(first, details);
    act(() => second.focus());
    expect(within(focused).getByText("Inspecting")).toBeVisible();

    expect(fireEvent.keyDown(second, { key: "Escape" })).toBe(false);
    expect(within(focused).queryByText("Inspecting")).toBeNull();
    expect(screen.getByText("Retained sibling details")).toBeVisible();
    expect(onHover).toHaveBeenCalledExactlyOnceWith(items[0]);
  });

  it("respects Escape prevented by an outside control", () => {
    const onHover = vi.fn();
    render(
      <>
        <WaffleChart
          accessibilityLabel="Outside handled Escape"
          items={items}
          categories={categories}
          onItemHoverChange={onHover}
          renderDetails={() => <span>Outside-safe details</span>}
        />
        <button
          type="button"
          onKeyDown={(event) => {
            if (event.key === "Escape") event.preventDefault();
          }}
        >
          Handle outside Escape
        </button>
      </>,
    );
    const first = itemButton("Parcel A");
    fireEvent.pointerEnter(first);
    const details = screen
      .getByText("Outside-safe details")
      .closest<HTMLElement>('[aria-live="polite"]')!;
    movePointer(first, details);
    const outside = screen.getByRole("button", {
      name: "Handle outside Escape",
    });
    act(() => outside.focus());
    expect(fireEvent.keyDown(outside, { key: "Escape" })).toBe(false);
    expect(screen.getByText("Outside-safe details")).toBeVisible();
    expect(onHover).toHaveBeenCalledExactlyOnceWith(items[0]);
  });

  it.each(["item", "group"] as const)(
    "reports same-group caption hover again after keyboard focus on another %s",
    (type) => {
      const onHover = vi.fn();
      render(
        <WaffleChart
          accessibilityLabel="Alternating group modality"
          items={items}
          categories={categories}
          groups={groups}
          onGroupHoverChange={onHover}
          renderDetails={({ item, group }) => (
            <span>Inspection: {item?.label ?? group?.label}</span>
          )}
        />,
      );
      const north = screen.getByRole("group", { name: "North" });
      const northCaption = screen.getByRole("button", { name: "North 2" });
      const keyboardTarget =
        type === "item"
          ? itemButton("Parcel C")
          : screen.getByRole("button", { name: "South 1" });
      fireEvent.pointerEnter(northCaption);
      expect(screen.getByText("Inspection: North")).toBeVisible();
      expect(onHover).toHaveBeenCalledExactlyOnceWith(groups[0]);
      movePointer(northCaption, north);
      act(() => keyboardTarget.focus());
      expect(
        screen.getByText(
          `Inspection: ${type === "item" ? "Parcel C" : "South"}`,
        ),
      ).toBeVisible();

      movePointer(north, northCaption);
      expect(screen.getByText("Inspection: North")).toBeVisible();
      expect(onHover.mock.calls.map(([value]) => value)).toEqual([
        groups[0],
        groups[0],
      ]);
      expect(keyboardTarget).toHaveFocus();
    },
  );

  it("immediately retargets retained hover to a new item, group and same-group caption", () => {
    const onItemHover = vi.fn();
    const onGroupHover = vi.fn();
    render(
      <WaffleChart
        accessibilityLabel="Retargeted hover"
        items={items}
        categories={categories}
        groups={groups}
        onItemHoverChange={onItemHover}
        onGroupHoverChange={onGroupHover}
        renderDetails={({ item, group }) => (
          <span>Inspection: {item?.label ?? group?.label}</span>
        )}
      />,
    );
    const first = itemButton("Parcel A");
    const second = itemButton("Parcel B");
    const south = screen.getByRole("group", { name: "South" });
    const northCaption = screen.getByRole("button", { name: "North 2" });
    fireEvent.pointerEnter(first);
    const details = screen
      .getByText("Inspection: Parcel A")
      .closest<HTMLElement>('[aria-live="polite"]')!;
    movePointer(first, details);
    movePointer(details, second);
    expect(screen.getByText("Inspection: Parcel B")).toBeVisible();
    expect(onItemHover).toHaveBeenLastCalledWith(items[1]);

    movePointer(second, details);
    expect(screen.getByText("Inspection: Parcel B")).toBeVisible();
    movePointer(details, south);
    expect(screen.getByText("Inspection: South")).toBeVisible();
    expect(onItemHover).toHaveBeenLastCalledWith(null);
    expect(onGroupHover).toHaveBeenLastCalledWith(groups[1]);

    movePointer(south, details);
    expect(screen.getByText("Inspection: South")).toBeVisible();
    movePointer(details, first);
    expect(screen.getByText("Inspection: Parcel A")).toBeVisible();
    expect(onItemHover).toHaveBeenLastCalledWith(items[0]);
    movePointer(first, northCaption);
    expect(screen.getByText("Inspection: North")).toBeVisible();
    expect(onItemHover).toHaveBeenLastCalledWith(null);
    expect(onGroupHover).toHaveBeenLastCalledWith(groups[0]);
    expect(document.body).toHaveFocus();
  });

  it.each(["item", "group"] as const)(
    "keeps a selected %s pinned across details, retargeted hover and root exit",
    (type) => {
      const selection = {
        type,
        id: type === "item" ? items[0].id : groups[0].id,
      };
      const onSelection = vi.fn();
      const onItemHover = vi.fn();
      const onGroupHover = vi.fn();
      const renderDetails = vi.fn((inspection: WaffleChartInspection) => (
        <span>
          Inspection: {inspection.item?.label ?? inspection.group?.label}
        </span>
      ));
      render(
        <WaffleChart
          accessibilityLabel="Pinned hover"
          items={items}
          categories={categories}
          groups={groups}
          defaultSelection={selection}
          onSelectionChange={onSelection}
          onItemHoverChange={onItemHover}
          onGroupHoverChange={onGroupHover}
          renderDetails={renderDetails}
        />,
      );
      const text = `Inspection: ${type === "item" ? items[0].label : groups[0].label}`;
      const details = screen
        .getByText(text)
        .closest<HTMLElement>('[aria-live="polite"]')!;
      const second = itemButton("Parcel B");
      const south = screen.getByRole("group", { name: "South" });
      fireEvent.pointerEnter(second);
      movePointer(second, details);
      expect(screen.getByText(text)).toBeVisible();
      expect(renderDetails.mock.lastCall![0]).toMatchObject({
        target: selection,
        pinned: true,
      });
      expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(true);
      expect(screen.getByText(text)).toBeVisible();
      expect(onItemHover).toHaveBeenLastCalledWith(items[1]);
      expect(onGroupHover).toHaveBeenLastCalledWith(groups[0]);
      movePointer(details, south);
      expect(screen.getByText(text)).toBeVisible();
      expect(renderDetails.mock.lastCall![0]).toMatchObject({
        target: selection,
        pinned: true,
      });
      expect(onItemHover).toHaveBeenLastCalledWith(null);
      expect(onGroupHover).toHaveBeenLastCalledWith(groups[1]);
      movePointer(south, document.body);
      expect(onGroupHover).toHaveBeenLastCalledWith(null);
      expect(screen.getByText(text)).toBeVisible();
      expect(renderDetails.mock.lastCall![0]).toMatchObject({
        target: selection,
        pinned: true,
      });
      expect(
        screen.getByRole("button", { name: "Clear selection" }),
      ).toBeVisible();
      expect(onSelection).not.toHaveBeenCalled();
    },
  );

  describe("beside nested library overlays", () => {
    let restoreStyle: () => void;
    let restoreIntersection: () => void;

    beforeEach(() => {
      restoreStyle = mockGetComputedStyle();
      restoreIntersection = mockIntersectionObserver();
      disableReactTransitionGroup();
    });

    afterEach(() => {
      cleanup();
      restoreIntersection();
      restoreStyle();
      enableReactTransitionGroup();
    });

    it("lets a portalled Select and separate Modal handle Escape before retained chart hover", async () => {
      const onHover = vi.fn();
      const { user } = render(
        <>
          <WaffleChart
            accessibilityLabel="Hover beside overlays"
            items={items}
            categories={categories}
            onItemHoverChange={onHover}
            renderDetails={() => <span>Overlay-safe hover details</span>}
          />
          <Modal.Trigger>
            <Button>Open separate modal</Button>
            <Modal>
              <Modal.Header>Separate view</Modal.Header>
              <Modal.Body>
                <Select label="View" defaultSelectedKey="daily">
                  <Select.Option key="daily">Daily</Select.Option>
                  <Select.Option key="weekly">Weekly</Select.Option>
                </Select>
              </Modal.Body>
            </Modal>
          </Modal.Trigger>
        </>,
      );
      const opener = screen.getByRole("button", {
        name: "Open separate modal",
      });
      act(() => opener.focus());
      const first = itemButton("Parcel A");
      fireEvent.pointerEnter(first);
      const content = screen.getByText("Overlay-safe hover details");
      const details = content.closest<HTMLElement>('[aria-live="polite"]')!;
      movePointer(first, details);
      await user.keyboard("{Enter}");
      const dialog = screen.getByRole("dialog");
      const select = screen.getByRole("button", { name: "Daily View" });
      act(() => select.focus());
      await user.keyboard("{Enter}");
      const listbox = screen.getByRole("listbox");
      expect(dialog.contains(listbox)).toBe(false);

      await user.keyboard("{Escape}");
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(screen.getByRole("dialog")).toBe(dialog);
      expect(content).toBeInTheDocument();
      expect(onHover).toHaveBeenCalledExactlyOnceWith(items[0]);
      act(() => vi.advanceTimersByTime(32));
      expect(select).toHaveFocus();

      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(content).toBeVisible();
      expect(onHover).toHaveBeenCalledExactlyOnceWith(items[0]);
      act(() => vi.advanceTimersByTime(32));
      expect(opener).toHaveFocus();

      await user.keyboard("{Escape}");
      expect(content).not.toBeInTheDocument();
      expect(onHover).toHaveBeenLastCalledWith(null);
    });
  });
});

describe("Escape propagation", () => {
  it.each(["item", "group"] as const)(
    "restarts dismissed %s inspection on a boundary key without trapping later Escape",
    (type) => {
      const onOuterKeyDown = vi.fn();
      const onFocus = vi.fn();
      render(
        <div onKeyDown={onOuterKeyDown}>
          <WaffleChart
            accessibilityLabel="Parcels"
            items={items}
            categories={categories}
            groups={groups}
            onItemFocusChange={type === "item" ? onFocus : undefined}
            onGroupFocusChange={type === "group" ? onFocus : undefined}
            renderDetails={({ item, group }) => (
              <span>Inspection: {item?.label ?? group?.label}</span>
            )}
          />
        </div>,
      );
      const target =
        type === "item"
          ? itemButton("Parcel A")
          : screen.getByRole("button", { name: "North 2" });
      const hovered =
        type === "item"
          ? itemButton("Parcel B")
          : screen.getByRole("group", { name: "South" });
      const record = type === "item" ? items[0] : groups[0];
      const detail = `Inspection: ${record.label}`;
      act(() => target.focus());
      expect(screen.getByText(detail)).toBeVisible();
      expect(fireEvent.keyDown(target, { key: "Escape" })).toBe(false);
      expect(screen.queryByText(detail)).toBeNull();
      expect(
        screen.getByText("Focus or select a cell or group to inspect it"),
      ).toBeVisible();
      expect(target).toHaveFocus();
      expect(onFocus).toHaveBeenLastCalledWith(null);
      expect(onOuterKeyDown).not.toHaveBeenCalled();
      expect(fireEvent.keyDown(target, { key: "Escape" })).toBe(true);
      expect(onOuterKeyDown).toHaveBeenCalledOnce();
      expect(screen.queryByText(detail)).toBeNull();

      fireEvent.pointerEnter(hovered);
      expect(
        screen.getByText(
          `Inspection: ${type === "item" ? items[1].label : groups[1].label}`,
        ),
      ).toBeVisible();
      fireEvent.keyDown(target, { key: "ArrowLeft" });
      expect(screen.getByText(detail)).toBeVisible();
      expect(target).toHaveFocus();
      expect(onFocus.mock.calls.map(([value]) => value)).toEqual([
        record,
        null,
        record,
      ]);

      onOuterKeyDown.mockClear();
      expect(fireEvent.keyDown(target, { key: "Escape" })).toBe(false);
      expect(screen.queryByText(detail)).toBeNull();
      expect(onOuterKeyDown).not.toHaveBeenCalled();
      expect(fireEvent.keyDown(target, { key: "Escape" })).toBe(true);
      expect(onOuterKeyDown).toHaveBeenCalledOnce();
      expect(screen.queryByText(detail)).toBeNull();
      expect(onFocus).toHaveBeenLastCalledWith(null);
    },
  );

  it.each([{ supplied: [] }, { supplied: items }])(
    "lets Escape bubble with no dismissible state, including empty data",
    ({ supplied }) => {
      const onOuterKeyDown = vi.fn();
      const onSelection = vi.fn();
      render(
        <div onKeyDown={onOuterKeyDown}>
          <WaffleChart
            accessibilityLabel="Uninspected parcels"
            items={supplied}
            categories={categories}
            onSelectionChange={onSelection}
          />
        </div>,
      );
      const root = screen.getByRole("group", { name: "Uninspected parcels" });
      const escape = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      fireEvent(root, escape);
      expect(onOuterKeyDown).toHaveBeenCalledOnce();
      expect(escape.defaultPrevented).toBe(false);
      expect(onSelection).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      name: "item selection",
      props: { selection: { type: "item" as const, id: items[0].id } },
    },
    {
      name: "group selection",
      props: { selection: { type: "group" as const, id: groups[0].id } },
    },
    { name: "category selection", props: { selectedCategoryId: "ready" } },
    {
      name: "item and category selection",
      props: {
        selection: { type: "item" as const, id: items[0].id },
        selectedCategoryId: "ready",
      },
    },
  ])(
    "does not trap Escape for static controlled $name without change callbacks",
    ({ props }) => {
      const onOuterKeyDown = vi.fn();
      render(
        <div onKeyDown={onOuterKeyDown}>
          <WaffleChart
            accessibilityLabel="Static parcels"
            items={items}
            categories={categories}
            groups={groups}
            {...props}
          />
        </div>,
      );
      const root = screen.getByRole("group", { name: "Static parcels" });
      expect(fireEvent.keyDown(root, { key: "Escape" })).toBe(true);
      expect(onOuterKeyDown).toHaveBeenCalledOnce();
    },
  );

  it.each(["selection", "category"] as const)(
    "consumes Escape for controlled %s with a callback until the caller clears it",
    (kind) => {
      const onOuterKeyDown = vi.fn();
      const onChange = vi.fn();
      function Controlled() {
        const [selection, setSelection] = useState<
          WaffleChartProps["selection"]
        >(kind === "selection" ? { type: "item", id: items[0].id } : null);
        const [category, setCategory] = useState<string | null>(
          kind === "category" ? "ready" : null,
        );
        return (
          <div onKeyDown={onOuterKeyDown}>
            <WaffleChart
              accessibilityLabel="Controlled parcels"
              items={items}
              categories={categories}
              selection={selection}
              onSelectionChange={
                kind === "selection"
                  ? (next) => {
                      onChange(next);
                      setSelection(next);
                    }
                  : undefined
              }
              selectedCategoryId={category}
              onCategorySelectionChange={
                kind === "category"
                  ? (next) => {
                      onChange(next);
                      setCategory(next);
                    }
                  : undefined
              }
            />
          </div>
        );
      }
      render(<Controlled />);
      const root = screen.getByRole("group", { name: "Controlled parcels" });
      expect(fireEvent.keyDown(root, { key: "Escape" })).toBe(false);
      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenLastCalledWith(null);
      expect(onOuterKeyDown).not.toHaveBeenCalled();
      expect(fireEvent.keyDown(root, { key: "Escape" })).toBe(true);
      expect(onOuterKeyDown).toHaveBeenCalledOnce();
    },
  );

  it.each(["item", "group"] as const)(
    "lets Escape bubble when a readonly selected %s also owns focus",
    (type) => {
      const onOuterKeyDown = vi.fn();
      render(
        <div onKeyDown={onOuterKeyDown}>
          <WaffleChart
            accessibilityLabel="Readonly selected parcels"
            items={items}
            categories={categories}
            groups={groups}
            selection={{
              type,
              id: type === "item" ? items[0].id : groups[0].id,
            }}
          />
        </div>,
      );
      const target =
        type === "item"
          ? itemButton("Parcel A")
          : screen.getByRole("button", { name: "North 2" });
      act(() => target.focus());
      expect(fireEvent.keyDown(target, { key: "Escape" })).toBe(true);
      expect(onOuterKeyDown).toHaveBeenCalledOnce();
      expect(target).toHaveAttribute("aria-pressed", "true");
    },
  );

  it("respects Escape already handled by a control in caller-rendered details", () => {
    const onSelection = vi.fn();
    const onOuterKeyDown = vi.fn();
    render(
      <div onKeyDown={onOuterKeyDown}>
        <WaffleChart
          accessibilityLabel="Caller handled Escape"
          items={items}
          categories={categories}
          defaultSelection={{ type: "item", id: items[0].id }}
          onSelectionChange={onSelection}
          renderDetails={() => (
            <button
              type="button"
              onKeyDown={(event) => {
                if (event.key === "Escape") event.preventDefault();
              }}
            >
              Handle own Escape
            </button>
          )}
        />
      </div>,
    );
    const action = screen.getByRole("button", { name: "Handle own Escape" });
    act(() => action.focus());
    expect(fireEvent.keyDown(action, { key: "Escape" })).toBe(false);
    expect(onOuterKeyDown).toHaveBeenCalledOnce();
    expect(onSelection).not.toHaveBeenCalled();
    expect(itemButton("Parcel A")).toHaveAttribute("aria-pressed", "true");
    expect(action).toHaveFocus();
  });

  it.each(["item", "group"] as const)(
    "clears transient %s hover once while a static category does not trap later Escape",
    (type) => {
      const onOuterKeyDown = vi.fn();
      render(
        <div onKeyDown={onOuterKeyDown}>
          <WaffleChart
            accessibilityLabel="Hovered static category"
            items={items}
            categories={categories}
            groups={groups}
            selectedCategoryId="ready"
          />
        </div>,
      );
      const target =
        type === "item"
          ? itemButton("Parcel A")
          : screen.getByRole("group", { name: "North" });
      fireEvent.pointerEnter(target);
      expect(screen.getByText("Inspecting")).toBeVisible();
      expect(fireEvent.keyDown(target, { key: "Escape" })).toBe(false);
      expect(onOuterKeyDown).not.toHaveBeenCalled();
      expect(screen.queryByText("Inspecting")).toBeNull();
      expect(itemButton("Parcel A")).toHaveAttribute(
        "data-highlighted",
        "true",
      );
      expect(fireEvent.keyDown(target, { key: "Escape" })).toBe(true);
      expect(onOuterKeyDown).toHaveBeenCalledOnce();
    },
  );

  describe("inside actual library overlays", () => {
    let restoreStyle: () => void;
    let restoreIntersection: () => void;

    beforeEach(() => {
      restoreStyle = mockGetComputedStyle();
      restoreIntersection = mockIntersectionObserver();
      disableReactTransitionGroup();
    });

    afterEach(() => {
      cleanup();
      restoreIntersection();
      restoreStyle();
      enableReactTransitionGroup();
    });

    function overlay(kind: "Modal" | "Drawer", chart: React.ReactElement) {
      return kind === "Modal" ? (
        <Modal.Trigger>
          <Button>Open chart modal</Button>
          <Modal>
            <Modal.Header>Chart modal</Modal.Header>
            <Modal.Body>{chart}</Modal.Body>
          </Modal>
        </Modal.Trigger>
      ) : (
        <Drawer.Trigger>
          <Button>Open chart drawer</Button>
          <Drawer>
            <Drawer.Body>
              <Drawer.StandaloneContentArea>
                <Drawer.Title>Chart drawer</Drawer.Title>
                {chart}
              </Drawer.StandaloneContentArea>
            </Drawer.Body>
          </Drawer>
        </Drawer.Trigger>
      );
    }

    describe.each(["Modal", "Drawer"] as const)("inside %s", (kind) => {
      it.each(["focus", "selection", "details"] as const)(
        "clears %s on first Escape and dismisses the overlay on the second",
        async (origin) => {
          const { user } = render(
            overlay(
              kind,
              <WaffleChart
                accessibilityLabel="Overlay parcels"
                items={items}
                categories={categories}
                renderDetails={() => (
                  <button type="button">Caller detail action</button>
                )}
              />,
            ),
          );
          await user.click(
            screen.getByRole("button", {
              name: `Open chart ${kind.toLowerCase()}`,
            }),
          );
          const dialog = screen.getByRole("dialog");
          const first = within(dialog).getByRole("button", {
            name: "Parcel A, Ready",
          });
          act(() => first.focus());
          expect(first).toHaveFocus();
          if (origin !== "focus") {
            await user.keyboard("{Enter}");
            expect(first).toHaveAttribute("aria-pressed", "true");
          }
          if (origin === "details") {
            const action = screen.getByRole("button", {
              name: "Caller detail action",
            });
            act(() => action.focus());
            expect(action).toHaveFocus();
          }
          await user.keyboard("{Escape}");
          expect(screen.getByRole("dialog")).toBe(dialog);
          expect(first).toHaveAttribute("aria-pressed", "false");
          expect(first).toHaveFocus();
          expect(
            screen.queryByRole("button", { name: "Clear selection" }),
          ).toBeNull();
          expect(
            screen.queryByRole("button", { name: "Caller detail action" }),
          ).toBeNull();
          expect(
            screen.getByText("Focus or select a cell or group to inspect it"),
          ).toBeVisible();
          await user.keyboard("{Escape}");
          expect(screen.queryByRole("dialog")).toBeNull();
          act(() => vi.advanceTimersByTime(32));
          expect(
            screen.getByRole("button", {
              name: `Open chart ${kind.toLowerCase()}`,
            }),
          ).toHaveFocus();
        },
      );
    });
  });
});

describe("roving keyboard focus", () => {
  it("uses one cell tab stop, arrows, Home and End across the displayed item order", async () => {
    const { container, user } = render(
      <WaffleChart
        accessibilityLabel="Parcels"
        items={items}
        categories={categories}
      />,
    );
    const cells = itemCells(container);
    expect(cells.map((cell) => cell.tabIndex)).toEqual([0, -1, -1]);
    await user.tab();
    expect(cells[0]).toHaveFocus();
    expect(cells[0]).toHaveAccessibleDescription(
      /Arrow keys move between items/,
    );
    await user.keyboard("{ArrowLeft}");
    expect(cells[0]).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(cells[1]).toHaveFocus();
    expect(cells.map((cell) => cell.tabIndex)).toEqual([-1, 0, -1]);
    await user.keyboard("{End}");
    expect(cells[2]).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(cells[2]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(cells[0]).toHaveFocus();
    expect(
      cells.every((cell) => cell.getAttribute("aria-pressed") === "false"),
    ).toBe(true);
    await user.tab();
    expect(cells).not.toContain(document.activeElement);
  });

  it("follows live wrapping geometry for vertical arrows and repairs removed tab targets", async () => {
    const supplied = Array.from({ length: 5 }, (_, index) => ({
      id: `item-${index}`,
      label: `Item ${index}`,
      categoryId: "ready",
    }));
    const props = {
      accessibilityLabel: "Wrapped items",
      categories,
      maxColumns: 2,
    };
    const { container, rerender, user } = render(
      <WaffleChart {...props} items={supplied} />,
    );
    const cells = itemCells(container);
    cells.forEach((cell, index) => {
      const left = (index % 3) * 30;
      const top = Math.floor(index / 3) * 50;
      vi.spyOn(cell, "getBoundingClientRect").mockReturnValue({
        x: left,
        y: top,
        top,
        left,
        right: left + 24,
        bottom: top + 24,
        width: 24,
        height: 24,
        toJSON: () => ({}),
      });
    });
    act(() => cells[1].focus());
    await user.keyboard("{ArrowDown}");
    expect(cells[4]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(cells[1]).toHaveFocus();
    rerender(
      <WaffleChart
        {...props}
        items={[supplied[4], supplied[1], supplied[0]]}
      />,
    );
    expect(itemCells(container).map((cell) => cell.tabIndex)).toEqual([
      -1, 0, -1,
    ]);
    await user.keyboard("{ArrowLeft}");
    expect(cells[4]).toHaveFocus();
    rerender(<WaffleChart {...props} items={[supplied[1], supplied[0]]} />);
    expect(itemCells(container).map((cell) => cell.tabIndex)).toEqual([0, -1]);
  });
});

describe("vertical navigation between partial group rows", () => {
  it.each(["down", "up"])(
    "prioritizes the nearest visual row when moving %s",
    async (direction) => {
      const supplied = Array.from({ length: 25 }, (_, index) => ({
        id: `row-item-${index}`,
        label: `Row item ${index}`,
        categoryId: "ready",
        groupId: index < 13 ? "north" : "south",
      }));
      const { container, user } = render(
        <WaffleChart
          accessibilityLabel="Partial group rows"
          categories={categories}
          groups={groups}
          items={supplied}
          maxColumns={12}
        />,
      );
      const cells = itemCells(container);
      cells.forEach((cell, index) => {
        const top = index < 12 ? 0 : index === 12 ? 30 : 100;
        const left = (index < 13 ? index % 12 : index - 13) * 30;
        vi.spyOn(cell, "getBoundingClientRect").mockReturnValue({
          x: left,
          y: top,
          left,
          top,
          right: left + 24,
          bottom: top + 24,
          width: 24,
          height: 24,
          toJSON: () => ({}),
        });
      });
      act(() => cells[direction === "down" ? 11 : 24].focus());
      await user.keyboard(direction === "down" ? "{ArrowDown}" : "{ArrowUp}");
      expect(cells[12]).toHaveFocus();
    },
  );
});

describe("inspection reconciliation after data changes", () => {
  it.each(["item", "group"])(
    "returns keyboard focus to the selected %s after clearing without reopening details",
    async (targetType) => {
      const onSelection = vi.fn();
      const { user } = render(
        <WaffleChart
          accessibilityLabel="Dismissed inspection"
          items={items}
          categories={categories}
          groups={groups}
          onSelectionChange={onSelection}
        />,
      );
      const target =
        targetType === "item"
          ? itemButton("Parcel A")
          : screen.getByRole("button", { name: "North 2" });
      act(() => target.focus());
      await user.keyboard("{Enter}");
      expect(target).toHaveAttribute("aria-pressed", "true");
      const clear = screen.getByRole("button", { name: "Clear selection" });
      act(() => clear.focus());
      expect(clear).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(onSelection).toHaveBeenLastCalledWith(null);
      expect(target).toHaveFocus();
      expect(target).toHaveAttribute("aria-pressed", "false");
      expect(
        screen.queryByRole("button", { name: "Clear selection" }),
      ).toBeNull();
      expect(screen.queryByText("Inspecting")).toBeNull();
      expect(
        screen.getByText("Focus or select a cell or group to inspect it"),
      ).toBeVisible();
      await user.keyboard("{Enter}");
      expect(target).toHaveAttribute("aria-pressed", "true");
      expect(
        screen.getByRole("button", { name: "Clear selection" }),
      ).toBeVisible();
    },
  );

  it.each([
    { targetType: "item", control: "clear" },
    { targetType: "item", control: "custom" },
    { targetType: "group", control: "clear" },
    { targetType: "group", control: "custom" },
  ])(
    "returns focus to the selected $targetType when Escape dismisses a $control details control",
    async ({ targetType, control }) => {
      const onSelection = vi.fn();
      const { user } = render(
        <WaffleChart
          accessibilityLabel="Escape from details"
          items={items}
          categories={categories}
          groups={groups}
          onSelectionChange={onSelection}
          renderDetails={() => (
            <button type="button">Caller details action</button>
          )}
        />,
      );
      const target =
        targetType === "item"
          ? itemButton("Parcel A")
          : screen.getByRole("button", { name: "North 2" });
      act(() => target.focus());
      await user.keyboard("{Enter}");
      const detailsControl = screen.getByRole("button", {
        name: control === "clear" ? "Clear selection" : "Caller details action",
      });
      act(() => detailsControl.focus());
      expect(detailsControl).toHaveFocus();
      await user.keyboard("{Escape}");
      expect(onSelection).toHaveBeenLastCalledWith(null);
      expect(target).toHaveFocus();
      expect(target).toHaveAttribute("aria-pressed", "false");
      expect(detailsControl).not.toBeInTheDocument();
      expect(screen.queryByText("Inspecting")).toBeNull();
      expect(
        screen.getByText("Focus or select a cell or group to inspect it"),
      ).toBeVisible();
    },
  );

  it("clears actual item focus when moving membership remounts its public element", () => {
    const onFocus = vi.fn();
    const props = {
      accessibilityLabel: "Moving parcels",
      categories,
      groups,
      onItemFocusChange: onFocus,
    };
    const { rerender } = render(<WaffleChart {...props} items={items} />);
    const original = itemButton("Parcel A");
    act(() => original.focus());
    expect(original).toHaveFocus();
    expect(onFocus).toHaveBeenLastCalledWith(items[0]);
    expect(screen.getByText("Inspecting")).toBeVisible();
    const moved = { ...items[0], groupId: "south" };
    rerender(<WaffleChart {...props} items={[moved, items[1], items[2]]} />);
    const replacement = itemButton("Parcel A");
    expect(original).not.toBeInTheDocument();
    expect(replacement).not.toBe(original);
    expect(replacement).not.toHaveFocus();
    expect(onFocus).toHaveBeenLastCalledWith(null);
    expect(screen.queryByText("Inspecting")).toBeNull();
    expect(
      screen.getByText("Focus or select a cell or group to inspect it"),
    ).toBeVisible();
    act(() => replacement.focus());
    expect(onFocus).toHaveBeenLastCalledWith(moved);
    expect(screen.getByText("Inspecting")).toBeVisible();
  });

  it("does not revive focused inspection when a removed item ID is supplied again", () => {
    const onFocus = vi.fn();
    const props = {
      accessibilityLabel: "Changing parcels",
      categories,
      onItemFocusChange: onFocus,
    };
    const { rerender } = render(<WaffleChart {...props} items={items} />);
    const original = itemButton("Parcel A");
    act(() => original.focus());
    rerender(<WaffleChart {...props} items={items.slice(1)} />);
    expect(original).not.toBeInTheDocument();
    expect(onFocus).toHaveBeenLastCalledWith(null);
    expect(screen.queryByText("Inspecting")).toBeNull();
    rerender(<WaffleChart {...props} items={items} />);
    expect(itemButton("Parcel A")).not.toHaveFocus();
    expect(screen.queryByText("Inspecting")).toBeNull();
    expect(
      screen.getByText("Focus or select a cell or group to inspect it"),
    ).toBeVisible();
    expect(onFocus.mock.calls).toEqual([[items[0]], [null]]);
  });

  it("clears item hover after membership replacement and removal without reviving re-added IDs", () => {
    const onHover = vi.fn();
    const props = {
      accessibilityLabel: "Moving hovered parcels",
      categories,
      groups,
      onItemHoverChange: onHover,
      renderDetails: (inspection: WaffleChartInspection) => (
        <output aria-label="Inspection target">
          {inspection.target.type}:{inspection.target.id}
        </output>
      ),
    };
    const { rerender } = render(<WaffleChart {...props} items={items} />);
    const original = itemButton("Parcel A");
    fireEvent.pointerEnter(original);
    expect(
      screen.getByRole("status", { name: "Inspection target" }),
    ).toHaveTextContent("item:parcel:a");
    const moved = { ...items[0], groupId: "south" };
    const movedItems = [moved, items[1], items[2]];
    rerender(<WaffleChart {...props} items={movedItems} />);
    expect(original).not.toBeInTheDocument();
    expect(onHover).toHaveBeenLastCalledWith(null);
    expect(
      screen.queryByRole("status", { name: "Inspection target" })?.textContent,
    ).not.toBe("item:parcel:a");
    fireEvent.pointerEnter(itemButton("Parcel A"));
    expect(onHover).toHaveBeenLastCalledWith(moved);
    rerender(<WaffleChart {...props} items={items.slice(1)} />);
    expect(onHover).toHaveBeenLastCalledWith(null);
    rerender(<WaffleChart {...props} items={movedItems} />);
    expect(
      screen.queryByRole("status", { name: "Inspection target" })?.textContent,
    ).not.toBe("item:parcel:a");
    expect(onHover.mock.calls).toEqual([[items[0]], [null], [moved], [null]]);
  });

  it("clears removed group focus and hover without restoring inspection when the group returns", () => {
    const onFocus = vi.fn();
    const onHover = vi.fn();
    const props = {
      accessibilityLabel: "Changing groups",
      categories,
      items,
      onGroupFocusChange: onFocus,
      onGroupHoverChange: onHover,
    };
    const { rerender } = render(<WaffleChart {...props} groups={groups} />);
    const original = screen.getByRole("button", { name: "North 2" });
    act(() => original.focus());
    expect(onFocus).toHaveBeenLastCalledWith(groups[0]);
    rerender(<WaffleChart {...props} groups={[groups[1]]} />);
    expect(original).not.toBeInTheDocument();
    expect(onFocus).toHaveBeenLastCalledWith(null);
    rerender(<WaffleChart {...props} groups={groups} />);
    expect(screen.getByRole("button", { name: "North 2" })).not.toHaveFocus();
    expect(screen.queryByText("Inspecting")).toBeNull();
    fireEvent.pointerEnter(screen.getByRole("group", { name: "North" }));
    expect(onHover).toHaveBeenLastCalledWith(groups[0]);
    expect(screen.getByText("Inspecting")).toBeVisible();
    rerender(<WaffleChart {...props} groups={[groups[1]]} />);
    expect(onHover).toHaveBeenLastCalledWith(null);
    rerender(<WaffleChart {...props} groups={groups} />);
    expect(screen.queryByText("Inspecting")).toBeNull();
    expect(
      screen.getByText("Focus or select a cell or group to inspect it"),
    ).toBeVisible();
    expect(onFocus.mock.calls).toEqual([[groups[0]], [null]]);
    expect(onHover.mock.calls).toEqual([[groups[0]], [null]]);
  });
});

describe.each([
  { mode: "passive", disabledProps: { interaction: "none" as const } },
  { mode: "compact", disabledProps: { variant: "compact" as const } },
])("switching to $mode mode", ({ disabledProps }) => {
  it.each([
    { targetType: "item", method: "focus" },
    { targetType: "item", method: "hover" },
    { targetType: "group", method: "focus" },
    { targetType: "group", method: "hover" },
  ])(
    "clears $targetType $method with stable data and does not revive inspection",
    ({ targetType, method }) => {
      const onItemFocus = vi.fn();
      const onItemHover = vi.fn();
      const onGroupFocus = vi.fn();
      const onGroupHover = vi.fn();
      const props = {
        accessibilityLabel: "Mode switching parcels",
        items,
        categories,
        groups,
        onItemFocusChange: onItemFocus,
        onItemHoverChange: onItemHover,
        onGroupFocusChange: onGroupFocus,
        onGroupHoverChange: onGroupHover,
      };
      const { rerender } = render(<WaffleChart {...props} />);
      const target =
        targetType === "item"
          ? itemButton("Parcel A")
          : method === "focus"
            ? screen.getByRole("button", { name: "North 2" })
            : screen.getByRole("group", { name: "North" });
      const callback =
        targetType === "item"
          ? method === "focus"
            ? onItemFocus
            : onItemHover
          : method === "focus"
            ? onGroupFocus
            : onGroupHover;
      if (method === "focus") act(() => target.focus());
      else fireEvent.pointerEnter(target);
      expect(callback).toHaveBeenLastCalledWith(
        targetType === "item" ? items[0] : groups[0],
      );
      expect(screen.getByText("Inspecting")).toBeVisible();
      rerender(<WaffleChart {...props} {...disabledProps} />);
      expect(callback).toHaveBeenLastCalledWith(null);
      expect(screen.queryByText("Inspecting")).toBeNull();
      rerender(<WaffleChart {...props} />);
      expect(callback).toHaveBeenLastCalledWith(null);
      expect(screen.queryByText("Inspecting")).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Clear selection" }),
      ).toBeNull();
      expect(
        screen.getByText("Focus or select a cell or group to inspect it"),
      ).toBeVisible();
      expect(itemButton("Parcel A")).not.toHaveFocus();
      expect(screen.getByRole("button", { name: "North 2" })).not.toHaveFocus();
    },
  );
});

it("connects public group anchors to actual group elements and updates after supplied data changes", () => {
  const onAnchors = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect = disconnect;
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const left = this.dataset.waffleGroup === "south" ? 200 : 10;
      const height = this.querySelectorAll("[data-waffle-item]").length * 24;
      return {
        x: left,
        y: 20,
        left,
        top: 20,
        right: left + 120,
        bottom: 20 + height,
        width: 120,
        height,
        toJSON: () => ({}),
      };
    },
  );
  const props = {
    accessibilityLabel: "Anchored parcels",
    categories,
    groups,
    onGroupAnchorsChange: onAnchors,
  };
  const { rerender, unmount } = render(
    <WaffleChart {...props} items={items} />,
  );
  expect(onAnchors.mock.lastCall![0]).toEqual([
    {
      groupId: "north",
      element: screen.getByRole("group", { name: "North" }),
      bounds: {
        left: 10,
        top: 20,
        right: 130,
        bottom: 68,
        width: 120,
        height: 48,
      },
    },
    {
      groupId: "south",
      element: screen.getByRole("group", { name: "South" }),
      bounds: {
        left: 200,
        top: 20,
        right: 320,
        bottom: 44,
        width: 120,
        height: 24,
      },
    },
  ]);
  rerender(<WaffleChart {...props} items={[items[0], items[2]]} />);
  expect(onAnchors.mock.lastCall![0][0].bounds.height).toBe(24);
  rerender(<WaffleChart {...props} items={items} groups={[groups[0]]} />);
  expect(onAnchors.mock.lastCall![0]).toHaveLength(1);
  expect(onAnchors.mock.lastCall![0][0].groupId).toBe("north");
  expect(screen.getByRole("group", { name: "Other items" })).toContainElement(
    itemButton("Parcel C"),
  );
  unmount();
  expect(onAnchors).toHaveBeenLastCalledWith([]);
  expect(disconnect).toHaveBeenCalled();
});

it("settles when a parent stores anchors through an inline callback and recreates its data arrays", () => {
  const onAnchors = vi.fn();
  let renders = 0;
  let top = 30;
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = observe;
      unobserve() {}
      disconnect = disconnect;
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const left = this.dataset.waffleGroup === "south" ? 200 : 10;
      return {
        x: left,
        y: top,
        left,
        top,
        right: left + 120,
        bottom: top + 24,
        width: 120,
        height: 24,
        toJSON: () => ({}),
      };
    },
  );
  function Parent() {
    renders++;
    if (renders > 10) throw new Error("Anchor publication did not settle");
    const [anchors, setAnchors] = useState<readonly WaffleChartGroupAnchor[]>(
      [],
    );
    const [revision, setRevision] = useState(0);
    return (
      <>
        <button type="button" onClick={() => setRevision((value) => value + 1)}>
          Refresh parent
        </button>
        <output aria-label="Anchor positions">
          {anchors
            .map((anchor) => `${anchor.groupId}:${anchor.bounds.top}`)
            .join(",")}
        </output>
        <WaffleChart
          accessibilityLabel="Parent controlled anchors"
          items={items.map((item) => ({ ...item }))}
          categories={categories}
          groups={groups.map((group) => ({ ...group }))}
          layoutRevision={revision}
          onGroupAnchorsChange={(next) => {
            onAnchors(next);
            setAnchors(next);
          }}
        />
      </>
    );
  }
  render(<Parent />);
  expect(
    screen.getByRole("status", { name: "Anchor positions" }),
  ).toHaveTextContent("north:30,south:30");
  expect(onAnchors).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Refresh parent" }));
  expect(onAnchors).toHaveBeenCalledOnce();
  expect(disconnect).not.toHaveBeenCalled();
  top = 80;
  fireEvent(window, new Event("resize"));
  act(() => vi.advanceTimersByTime(32));
  expect(onAnchors).toHaveBeenCalledTimes(2);
  expect(
    screen.getByRole("status", { name: "Anchor positions" }),
  ).toHaveTextContent("north:80,south:80");
  expect(renders).toBeLessThan(10);
  expect(observe).toHaveBeenCalledTimes(3);
});
