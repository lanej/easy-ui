import type React from "react";
import type { ThemeColorAliases } from "../types";

export type WaffleChartItem<Metadata = unknown> = {
  /** Unique, stable identity. Reordering or moving a group does not change it. */
  id: string;
  label: string;
  categoryId: string;
  /** Optional caller-owned membership. Each item still occupies exactly one cell. */
  groupId?: string;
  metadata?: Metadata;
  draft?: boolean;
  muted?: boolean;
};

export type WaffleChartCategory = {
  id: string;
  label: string;
  /** Explicit theme-token mapping; never assigned from array order. */
  color: ThemeColorAliases;
};

export type WaffleChartGroup = {
  id: string;
  label: string;
  description?: string;
  metadata?: unknown;
};

export type WaffleChartSelection = {
  type: "item" | "group";
  id: string;
} | null;

export type WaffleChartHighlight = {
  itemIds?: readonly string[];
  groupIds?: readonly string[];
  categoryIds?: readonly string[];
};

export type WaffleChartInspection<Metadata = unknown> = {
  /** Valid pinned selection, otherwise the currently focused or hovered target. */
  target: Exclude<WaffleChartSelection, null>;
  item?: WaffleChartItem<Metadata>;
  group?: WaffleChartGroup;
  pinned: boolean;
  totalCount: number;
};

/** Viewport CSS pixels, suitable for a caller-owned connection layer. */
export type WaffleChartGroupAnchor = {
  groupId: string;
  /** Supported public anchor element; consumers never need private selectors. */
  element: HTMLElement;
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
};

/** Visual ordering only; caller-owned group membership never changes. */
export type WaffleChartItemOrder = "input" | "category";

export type WaffleChartProps<Metadata = unknown> = {
  accessibilityLabel: string;
  items: readonly WaffleChartItem<Metadata>[];
  categories: readonly WaffleChartCategory[];
  groups?: readonly WaffleChartGroup[];
  /** Compact is always passive and safe inside a link. No legend/details/controls. */
  variant?: "default" | "compact";
  /** Default is inspect. Use none for a passive full-size visualization. */
  interaction?: "inspect" | "none";
  /** Stable category-ID clustering within each group, or the supplied input order. */
  itemOrder?: WaffleChartItemOrder;
  maxColumns?: number;
  /** CSS pixels. Interactive cells retain a minimum 24px pointer target. */
  cellSize?: number;
  gap?: number;
  showCount?: boolean;
  showLegend?: boolean;
  /** Neutral label only; no capacity or availability is inferred. */
  ungroupedLabel?: string;
  emptyMessage?: string;
  /** Formats the exact supplied count, without normalization. */
  countLabel?: (count: number) => string;
  selection?: WaffleChartSelection;
  defaultSelection?: WaffleChartSelection;
  onSelectionChange?: (selection: WaffleChartSelection) => void;
  highlight?: WaffleChartHighlight;
  /** Controlled category emphasis; never filters cells or changes the total. */
  selectedCategoryId?: string | null;
  onCategorySelectionChange?: (categoryId: string | null) => void;
  onItemHoverChange?: (item: WaffleChartItem<Metadata> | null) => void;
  onItemFocusChange?: (item: WaffleChartItem<Metadata> | null) => void;
  onItemActivate?: (item: WaffleChartItem<Metadata>) => void;
  onGroupHoverChange?: (group: WaffleChartGroup | null) => void;
  onGroupFocusChange?: (group: WaffleChartGroup | null) => void;
  onGroupActivate?: (group: WaffleChartGroup) => void;
  renderDetails?: (
    inspection: WaffleChartInspection<Metadata>,
  ) => React.ReactNode;
  /** Called after mount, resize, wrapping, scroll, and data updates; [] on cleanup. */
  onGroupAnchorsChange?: (anchors: readonly WaffleChartGroupAnchor[]) => void;
  /** Remeasure after caller-owned layout changes that don't resize the chart. */
  layoutRevision?: unknown;
};
