import type { ReactNode } from "react";
import type { BadgeVariant } from "../Badge/Badge";
import type { IconSymbol } from "../types";

export type DependencyGraphChange =
  "create" | "update" | "replace" | "delete" | "unchanged" | "unknown";

/** Formatted display text, or an explicit unavailable value. Never supply secrets. */
export type DependencyGraphChangeValue =
  string | { status: "unknown" | "redacted" };

/** Absence is explicit: an addition has no before value, a removal has no after. */
export type DependencyGraphPropertyChange = { path: string } & (
  | { type: "add"; after: DependencyGraphChangeValue }
  | { type: "remove"; before: DependencyGraphChangeValue }
  | {
      type: "change";
      before: DependencyGraphChangeValue;
      after: DependencyGraphChangeValue;
    }
);

export type DependencyGraphChangePresentation = "summary" | "diff";

/** A caller-owned label with an optional theme variant. Omitted variants are neutral. */
export type DependencyGraphCategory = {
  readonly label: string;
  readonly variant?: "neutral" | BadgeVariant;
};

export type DependencyGraphNode = {
  id: string;
  label: string;
  /** Optional secondary type/context. Supply the display name in label; no identifier parsing is performed. */
  typeLabel?: string;
  /** Full caller-owned address for inspection and search; id remains the stable graph identity. */
  address?: string;
  /** Explicit evidence boundary. Unresolved references remain distinct nodes with their original edges. */
  kind?: "resource" | "unresolved";
  /** Resource type, address, or other caller-owned context. */
  description?: string;
  /** Caller-owned category labels and optional theme variants. Never interpreted as plan actions or risk. */
  categories?: readonly DependencyGraphCategory[];
  /** Caller-supplied resource type symbol, using Easy UI's normal Icon contract. */
  icon?: IconSymbol;
  /** Accessible resource type label, such as Database or Authentication. */
  iconLabel?: string;
  /** Omitted means not supplied and renders no card badge. Explicit unknown remains distinct from unchanged. */
  change?: DependencyGraphChange;
  /** Caller-owned explanation of this resource's proposed changes. */
  changeSummary?: string;
  /** Exact supplied field changes. Easy UI does not compute a diff from snapshots. */
  changes?: readonly DependencyGraphPropertyChange[];
  /** Explicit containing group. Nodes without a supplied group definition remain ungrouped. */
  groupId?: string;
};

/** Caller-supplied relationship delta, independent of resource operations. */
export type DependencyGraphEdgeChange =
  "add" | "remove" | "update" | "unchanged" | "unknown";

export type DependencyGraphEdge = {
  id: string;
  /** Prerequisite. Arrows run from this dependency to its dependent. */
  source: string;
  /** Dependent. Normalize reversed upstream formats in the application. */
  target: string;
  label?: string;
  /** Caller-supplied explanation or evidence summary; never inferred by Easy UI. */
  description?: string;
  /** Presentation only. For example, use dashed for an inferred relationship. */
  variant?: "solid" | "dashed";
  /** Omitted status is unknown. Use update for a caller-matched modified relationship, rendered once. */
  change?: DependencyGraphEdgeChange;
  /** Reference attribute path; omit both paths for block-level depends_on. Hidden fields fall back to the card. */
  sourceAttributePath?: string;
  /** Exact path of a visible dependent attribute; falls back to the card when hidden. */
  targetAttributePath?: string;
};

/** A labeled subgraph. Containment does not imply dependency or execution order. */
export type DependencyGraphGroup = {
  id: string;
  label: string;
  description?: string;
  /** Optional containing group. Parents must exist and containment must be acyclic. */
  parentId?: string;
};

export type DependencyGraphSelection =
  | { type: "node" | "edge" | "group"; id: string }
  /** A collapsed connection retains all original edge IDs. */
  | { type: "edges"; ids: readonly string[] }
  | null;

export type DependencyGraphView =
  | { scope: "all" }
  | { scope: "changes"; depth?: number }
  | {
      scope: "dependencies" | "dependents" | "neighbors";
      nodeId: string;
      depth?: number;
    };

export type DependencyGraphDetailsContext = {
  selection: DependencyGraphSelection;
  node?: DependencyGraphNode;
  group?: DependencyGraphGroup;
  edges: readonly DependencyGraphEdge[];
};

/** Card geometry in graph units (CSS pixels at 100% zoom and a 16px root font). */
export type DependencyGraphCardLayout = {
  /** Omit coordinates to retain automatic placement. Group headings reserve space at the canvas edges. */
  x?: number;
  y?: number;
  /** Omit width for responsive sizing. Minimum 192. */
  width?: number;
  /** Omit height to grow with content. Minimum 96; fixed-height cards scroll internally. */
  height?: number;
};

/** Original resource IDs map to geometry; collapsed group proxies are not editable. */
export type DependencyGraphCardLayouts = Readonly<
  Record<string, DependencyGraphCardLayout>
>;

export type DependencyGraphProps = {
  /** Optional visible heading. Omit it when the surrounding application supplies context. */
  title?: string;
  description?: string;
  /** Region name when no visible title is supplied. Defaults to Resource dependencies. */
  accessibilityLabel?: string;
  nodes: readonly DependencyGraphNode[];
  edges: readonly DependencyGraphEdge[];
  /** Explicit, optionally nested subgraphs; applications choose boundaries and membership. */
  groups?: readonly DependencyGraphGroup[];
  selection?: DependencyGraphSelection;
  defaultSelection?: DependencyGraphSelection;
  onSelectionChange?: (selection: DependencyGraphSelection) => void;
  view?: DependencyGraphView;
  defaultView?: DependencyGraphView;
  /** Also usable to request a larger neighborhood from the application's API. */
  onViewChange?: (view: DependencyGraphView) => void;
  collapsedGroupIds?: readonly string[];
  defaultCollapsedGroupIds?: readonly string[];
  onCollapsedGroupIdsChange?: (ids: readonly string[]) => void;
  /** Stop following dependent branches at these resources. Shared paths stay visible. */
  collapsedNodeIds?: readonly string[];
  defaultCollapsedNodeIds?: readonly string[];
  onCollapsedNodeIdsChange?: (ids: readonly string[]) => void;
  /** Resources whose cards show responsive attribute differences. */
  expandedChangeNodeIds?: readonly string[];
  defaultExpandedChangeNodeIds?: readonly string[];
  onExpandedChangeNodeIdsChange?: (ids: readonly string[]) => void;
  /** Caller-computed path or other relationships to emphasize. */
  highlightedEdgeIds?: readonly string[];
  /** Hide relationship lines without changing resource order or traversal evidence. */
  hiddenEdgeIds?: readonly string[];
  /** Recompute the directed resource order for changed topology with the same resource IDs. */
  layoutRevision?: string | number;
  /** Show the Edit layout toolbar control. Defaults to true. Geometry still applies when false. */
  allowLayoutEditing?: boolean;
  cardLayouts?: DependencyGraphCardLayouts;
  defaultCardLayouts?: DependencyGraphCardLayouts;
  /** Committed pointer/keyboard/size/reset changes; applications can persist this map. */
  onCardLayoutsChange?: (layouts: DependencyGraphCardLayouts) => void;
  /** Coverage of the supplied relationship evidence, not operational impact. */
  coverage?: {
    status: "complete" | "partial" | "unknown";
    description?: string;
  };
  status?: "ready" | "loading" | "error";
  message?: string;
  onRetry?: () => void;
  /** Viewport height in CSS pixels. The graph scrolls within this viewport. */
  height?: number;
  showDetails?: boolean;
  /** Widen the built-in inspector and show its full height. */
  detailsExpanded?: boolean;
  defaultDetailsExpanded?: boolean;
  onDetailsExpandedChange?: (expanded: boolean) => void;
  /** Initial change presentation for each newly selected resource. */
  defaultChangePresentation?: DependencyGraphChangePresentation;
  /** Application-owned annotation on the resource block, such as a risk finding. Does not infer risk. */
  renderNodeAnnotation?: (node: DependencyGraphNode) => ReactNode;
  /** Annotation on an exact attribute block in expanded cards and inspector diffs. */
  renderAttributeAnnotation?: (
    node: DependencyGraphNode,
    change: DependencyGraphPropertyChange,
  ) => ReactNode;
  /** Additional evidence/diff content below the standard selection details. */
  renderDetails?: (context: DependencyGraphDetailsContext) => ReactNode;
};
