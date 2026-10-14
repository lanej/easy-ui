import type { DependencyGraphEdge, DependencyGraphNode } from "./types";

/** Synthetic source-only evidence: these are not captured plan operations. */
export const realWorldNodes: readonly DependencyGraphNode[] = [
  {
    id: "external:backend_bucket",
    label: "var.backend_bucket",
    kind: "unresolved",
    description:
      "Evidence incomplete; this reference is outside the supplied source snapshot.",
  },
  {
    id: "data.terraform_remote_state.bootstrap",
    label: "bootstrap",
    typeLabel: "data.terraform_remote_state",
    address: "data.terraform_remote_state.bootstrap",
    categories: ["Source unchanged"],
  },
  {
    id: "external:runtime_image",
    label: "var.runtime_image",
    kind: "unresolved",
    description: "The image input is not resolved by this source snapshot.",
  },
  {
    id: "module.runtime",
    label: "runtime",
    typeLabel: "module",
    address: "module.runtime",
    categories: ["Source unchanged"],
  },
  {
    id: "google_cloud_run_v2_service.runtime",
    label: "runtime",
    typeLabel: "google_cloud_run_v2_service",
    address: "google_cloud_run_v2_service.runtime",
    categories: ["Source unchanged"],
  },
  {
    id: "external:runtime_url",
    label: "output.runtime_url",
    kind: "unresolved",
    description:
      "The consuming reference is outside the supplied source snapshot.",
  },
  {
    id: "external:pipeline_identity",
    label: "var.pipeline_identity",
    kind: "unresolved",
    description:
      "The service-account input is outside the supplied source snapshot.",
  },
  {
    id: "data.google_service_account.pipeline",
    label: "pipeline",
    typeLabel: "data.google_service_account",
    address: "data.google_service_account.pipeline",
    categories: ["Source unchanged"],
  },
  {
    id: "google_sql_user.pipeline",
    label: "pipeline",
    typeLabel: "google_sql_user",
    address: "google_sql_user.pipeline",
    categories: ["Source modified"],
    changes: [
      {
        path: "name",
        type: "change",
        before: "pipeline-legacy",
        after: "pipeline",
      },
    ],
  },
  {
    id: "module.observability.module.database.google_sql_user.audit_pipeline",
    label:
      "module.observability.module.database.google_sql_user.audit_pipeline",
    description:
      "Unsplit address; caller has not supplied a separate display name.",
  },
];

export const realWorldEdges: readonly DependencyGraphEdge[] = [
  {
    id: "backend-state",
    source: "external:backend_bucket",
    target: "data.terraform_remote_state.bootstrap",
  },
  {
    id: "image-runtime",
    source: "external:runtime_image",
    target: "google_cloud_run_v2_service.runtime",
    variant: "dashed",
  },
  {
    id: "module-runtime",
    source: "module.runtime",
    target: "google_cloud_run_v2_service.runtime",
  },
  {
    id: "runtime-output",
    source: "google_cloud_run_v2_service.runtime",
    target: "external:runtime_url",
    variant: "dashed",
  },
  {
    id: "identity-account",
    source: "external:pipeline_identity",
    target: "data.google_service_account.pipeline",
    variant: "dashed",
  },
  {
    id: "account-user",
    source: "data.google_service_account.pipeline",
    target: "google_sql_user.pipeline",
  },
];
