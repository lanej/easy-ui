import type { DependencyGraphEdge, DependencyGraphNode } from "./types";

/** Generic shallow plan with long, caller-formatted attribute values. */
export const wideDependencyNodes: DependencyGraphNode[] = [
  { id: "network", label: "Application network" },
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `service-${index + 1}`,
    label: `Application service ${index + 1}`,
  })),
].map((node) => ({
  ...node,
  change: "update",
  changes: [
    {
      path: "configuration.endpoint",
      type: "change",
      before:
        "https://internal-api.previous.example.test/production/services/health?region=west&includeDependencies=true",
      after:
        "https://internal-api.current.example.test/production/services/health?region=west&includeDependencies=true",
    },
    {
      path: "configuration.allowed_origins",
      type: "change",
      before:
        '["https://console.example.test", "https://operations.example.test", "https://support.example.test"]',
      after:
        '["https://console.example.test", "https://operations.example.test", "https://support.example.test", "https://reports.example.test"]',
    },
    {
      path: "metadata.description",
      type: "change",
      before:
        "Application service uses the shared production network and its existing regional configuration.",
      after:
        "Application service uses the updated production network with a dedicated regional health endpoint and additional reporting access.",
    },
  ],
}));

export const wideDependencyEdges: DependencyGraphEdge[] = wideDependencyNodes
  .slice(1)
  .map((node) => ({
    id: `network-${node.id}`,
    source: "network",
    target: node.id,
    sourceAttributePath: "configuration.endpoint",
    targetAttributePath: "configuration.endpoint",
  }));

export const deepDependencyEdges: DependencyGraphEdge[] = wideDependencyNodes
  .slice(1)
  .map((node, index) => ({
    id: `chain-${node.id}`,
    source: wideDependencyNodes[index].id,
    target: node.id,
  }));
