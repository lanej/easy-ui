import type {
  DependencyGraphEdge,
  DependencyGraphGroup,
  DependencyGraphNode,
} from "./types";

/** Synthetic source evidence: grouping is supplied explicitly, not parsed from IDs. */
export const subgraphGroups: readonly DependencyGraphGroup[] = [
  {
    id: "production",
    label: "Production",
    description: "Resources belonging to this deployment.",
  },
  { id: "runtime", label: "Runtime module", parentId: "production" },
  { id: "database", label: "Database module", parentId: "production" },
];
export const subgraphNodes: readonly DependencyGraphNode[] = [
  {
    id: "image",
    label: "var.image",
    kind: "unresolved",
    description: "Image input outside this source snapshot.",
  },
  {
    id: "module",
    label: "runtime",
    typeLabel: "module",
    groupId: "runtime",
    categories: [{ label: "Source unchanged" }],
  },
  {
    id: "api",
    label: "api",
    typeLabel: "google_cloud_run_v2_service",
    groupId: "runtime",
    categories: [{ label: "Source modified", variant: "primary" }],
    changes: [
      {
        path: "template.containers.image",
        type: "change",
        before: "app:v1",
        after: "app:v2",
      },
    ],
  },
  {
    id: "db",
    label: "primary",
    typeLabel: "google_sql_database_instance",
    groupId: "database",
    categories: [{ label: "Source unchanged" }],
  },
  {
    id: "user",
    label: "pipeline",
    typeLabel: "google_sql_user",
    groupId: "database",
    categories: [{ label: "Source unchanged" }],
  },
  { id: "output", label: "output.runtime_url", kind: "unresolved" },
  {
    id: "audit",
    label: "audit",
    typeLabel: "google_storage_bucket",
    categories: [{ label: "Source unchanged" }],
  },
];
export const subgraphEdges: readonly DependencyGraphEdge[] = [
  { id: "image-api", source: "image", target: "api", variant: "dashed" },
  { id: "module-api", source: "module", target: "api" },
  { id: "db-api", source: "db", target: "api" },
  { id: "db-user", source: "db", target: "user" },
  { id: "api-output", source: "api", target: "output", variant: "dashed" },
];
