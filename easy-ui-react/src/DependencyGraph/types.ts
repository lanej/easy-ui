import type { ReactNode } from "react";

export type DependencyGraphChange =
  "create" | "update" | "replace" | "delete" | "unchanged" | "unknown";

export type DependencyGraphNode = {
  id: string;
  label: string;
  /** Resource type, address, or other caller-owned context. */
  description?: string;
  /** Omitted change information is unknown, not proof of no change. */
  change?: DependencyGraphChange;
  groupId?: string;
};

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
};

export type DependencyGraphGroup = {
  id: string;
  label: string;
  description?: string;
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

export type DependencyGraphProps = {
  title: string;
  description?: string;
  nodes: readonly DependencyGraphNode[];
  edges: readonly DependencyGraphEdge[];
  /** Flat visual groups; applications choose root/module boundaries and labels. */
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
  /** Caller-computed path or other relationships to emphasize. */
  highlightedEdgeIds?: readonly string[];
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
  /** Additional evidence/diff content below the standard selection details. */
  renderDetails?: (context: DependencyGraphDetailsContext) => ReactNode;
};
