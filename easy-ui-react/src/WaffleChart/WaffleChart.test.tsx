import React, { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  within,
} from "@testing-library/react";
import { vi } from "vitest";
import { render } from "../utilities/test";
import { WaffleChart } from "./WaffleChart";
import type {
  WaffleChartCategory,
  WaffleChartGroup,
  WaffleChartGroupAnchor,
  WaffleChartInspection,
  WaffleChartItem,
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

describe("passive variants", () => {
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
  it("reports original item metadata for transient hover, focus and pinned activation", () => {
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
    act(() => second.blur());
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

  it("reports group hover, focus and activation while marking exactly its members", () => {
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
    act(() => button.blur());
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
