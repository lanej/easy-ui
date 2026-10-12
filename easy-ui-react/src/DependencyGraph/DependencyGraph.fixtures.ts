import type {
  DependencyGraphEdge,
  DependencyGraphGroup,
  DependencyGraphNode,
} from "./types";

export const dependencyGroups: DependencyGraphGroup[] = [
  {
    id: "network",
    label: "Production / network",
    description: "Shared network root",
  },
  {
    id: "services",
    label: "Production / services",
    description: "Application module",
  },
  {
    id: "data",
    label: "Production / data",
    description: "Persistent resources",
  },
  {
    id: "observability",
    label: "Shared / observability",
    description: "Monitoring root",
  },
];
export const dependencyNodes: DependencyGraphNode[] = [
  {
    id: "azurerm_virtual_network.production",
    label: "Production network",
    description: "azurerm_virtual_network",
    change: "unchanged",
    groupId: "network",
  },
  {
    id: "azurerm_subnet.application",
    label: "Application subnet",
    description: "azurerm_subnet · 10.20.4.0/24",
    change: "replace",
    changeSummary: "Address prefix changes; replacement required.",
    changes: [
      {
        path: "address_prefixes[0]",
        type: "change",
        before: "10.20.0.0/24",
        after: "10.20.4.0/24",
      },
    ],
    groupId: "network",
  },
  {
    id: "azurerm_container_app.api",
    label: "Shipping API",
    description: "azurerm_container_app",
    change: "update",
    changeSummary: "Container image and tags change; credentials rotate.",
    changes: [
      {
        path: "template.containers[0].image",
        type: "change",
        before: "registry.example.com/shipping:1.8",
        after: "registry.example.com/shipping:1.9",
      },
      { path: "tags.owner", type: "add", after: "shipping-platform" },
      { path: "tags.legacy", type: "remove", before: "true" },
      {
        path: "secrets.database_url",
        type: "change",
        before: { status: "redacted" },
        after: { status: "redacted" },
      },
      {
        path: "latest_revision_name",
        type: "change",
        before: "shipping-api--r18",
        after: { status: "unknown" },
      },
    ],
    groupId: "services",
  },
  {
    id: "azurerm_container_app.worker",
    label: "Label worker",
    description: "azurerm_container_app",
    change: "unchanged",
    groupId: "services",
  },
  {
    id: "azurerm_postgresql_flexible_server.primary",
    label: "Primary database",
    description: "azurerm_postgresql_flexible_server",
    change: "unchanged",
    groupId: "data",
  },
  {
    id: "azurerm_private_dns_zone.database",
    label: "Database DNS",
    description: "azurerm_private_dns_zone",
    change: "unchanged",
    groupId: "data",
  },
  {
    id: "azurerm_bastion_host.legacy",
    label: "Legacy bastion",
    description: "azurerm_bastion_host",
    change: "delete",
    changeSummary: "Legacy bastion is removed.",
    changes: [
      { path: "name", type: "remove", before: "legacy-bastion" },
      { path: "sku", type: "remove", before: "Basic" },
    ],
    groupId: "network",
  },
  {
    id: "azurerm_monitor_metric_alert.api",
    label: "API availability alert",
    description: "azurerm_monitor_metric_alert",
    change: "create",
    changeSummary: "Availability monitoring is added.",
    changes: [
      { path: "enabled", type: "add", after: "true" },
      { path: "scopes[0]", type: "add", after: { status: "unknown" } },
    ],
    groupId: "observability",
  },
];
export const subnetId = dependencyNodes[1].id;
export const dependencyEdges: DependencyGraphEdge[] = [
  {
    id: "network-subnet",
    source: dependencyNodes[0].id,
    target: subnetId,
    label: "Subnet membership",
    description:
      "Declared configuration reference: application.virtual_network_name → production.name.",
  },
  {
    id: "subnet-api",
    source: subnetId,
    target: dependencyNodes[2].id,
    label: "Network attachment",
    description:
      "Declared configuration reference: api.infrastructure_subnet_id → application.id.",
  },
  {
    id: "subnet-worker",
    source: subnetId,
    target: dependencyNodes[3].id,
    label: "Network attachment",
    description:
      "Declared configuration reference: worker.infrastructure_subnet_id → application.id.",
  },
  {
    id: "subnet-database",
    source: subnetId,
    target: dependencyNodes[4].id,
    label: "Delegated subnet",
    description:
      "Declared configuration reference: primary.delegated_subnet_id → application.id.",
  },
  {
    id: "dns-database",
    source: dependencyNodes[5].id,
    target: dependencyNodes[4].id,
    label: "Private DNS",
    description:
      "Declared configuration reference: primary.private_dns_zone_id → database.id.",
  },
  {
    id: "network-bastion",
    source: dependencyNodes[0].id,
    target: dependencyNodes[6].id,
    label: "Network attachment",
    description: "Declared configuration reference in the prior plan.",
  },
  {
    id: "api-alert",
    source: dependencyNodes[2].id,
    target: dependencyNodes[7].id,
    label: "Monitored resource",
    description:
      "Declared configuration reference: alert.scopes contains api.id.",
  },
  {
    id: "database-api",
    source: dependencyNodes[4].id,
    target: dependencyNodes[2].id,
    label: "Connection configuration",
    description:
      "Application-supplied relationship. Runtime reachability has not been verified.",
    variant: "dashed",
  },
];

/** Realistic grouped scale fixture; only the bounded neighborhood is rendered initially. */
export function largeDependencyFixture(size = 1000) {
  const groups = Array.from({ length: 25 }, (_, index) => ({
    id: `module-${index}`,
    label: `Root ${index + 1} / application`,
    description: "Supplied module grouping",
  }));
  const nodes = Array.from(
    { length: size },
    (_, index): DependencyGraphNode => ({
      id: `resource-${index}`,
      label: `Service resource ${index + 1}`,
      description: `module.application[${index}].resource`,
      groupId:
        groups[
          Math.min(
            groups.length - 1,
            Math.floor(index / (size / groups.length)),
          )
        ].id,
      change: index === 501 ? "replace" : "unchanged",
      ...(index === 501
        ? {
            changeSummary: "Service configuration requires replacement.",
            changes: [
              {
                path: "configuration_version",
                type: "change" as const,
                before: "v1",
                after: "v2",
              },
            ],
          }
        : {}),
    }),
  );
  const edges = nodes.slice(1).map((node, index): DependencyGraphEdge => ({
    id: `link-${index}`,
    source: nodes[Math.floor(index / 3)].id,
    target: node.id,
    label: "Declared dependency",
  }));
  return { nodes, edges, groups };
}
