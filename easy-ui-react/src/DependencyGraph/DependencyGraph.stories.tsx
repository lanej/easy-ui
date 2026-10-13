import React from "react";
import DatabaseIcon from "@easypost/easy-ui-icons/Database";
import StorageIcon from "@easypost/easy-ui-icons/Storage";
import HubIcon from "@easypost/easy-ui-icons/Hub";
import KeyIcon from "@easypost/easy-ui-icons/Key";
import ShieldIcon from "@easypost/easy-ui-icons/Shield";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DependencyGraph } from "./DependencyGraph";
import { DependencyGraphChanges } from "./DependencyGraphChanges";
import {
  DependencyGraphReviewExample,
  DependencyGraphLinkedInspectorExample,
} from "./DependencyGraph.examples";
import {
  relationshipChangeNodes,
  relationshipChangeEdges,
  dependencyNodes,
  dependencyEdges,
  dependencyGroups,
  largeDependencyFixture,
  subnetId,
} from "./DependencyGraph.fixtures";

const meta: Meta<typeof DependencyGraph> = {
  id: "components-dependencygraph",
  title: "Organisms/DependencyGraph",
  component: DependencyGraph,
  args: {
    title: "Resource dependencies",
    nodes: dependencyNodes,
    edges: dependencyEdges,
    groups: dependencyGroups,
  },
  argTypes: {
    nodes: { control: false },
    edges: { control: false },
    groups: { control: false },
    renderDetails: { control: false },
  },
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof DependencyGraph>;

export const ReplacementReview: Story = {
  render: (args) => <DependencyGraphReviewExample {...args} />,
};
export const ChangeSummary: Story = {
  args: { defaultChangePresentation: "summary" },
  render: (args) => <DependencyGraphReviewExample {...args} />,
};
export const SpecificChanges: Story = {
  args: {
    defaultSelection: { type: "node", id: "azurerm_container_app.api" },
    defaultChangePresentation: "diff",
    defaultView: { scope: "changes", depth: 0 },
  },
};
export const AllResources: Story = {};
export const CollapsibleBranches: Story = {
  args: {
    title: "Resource branches",
    description:
      "Use − to fold dependent branches and + to reopen them. Shared resources remain visible through open paths.",
    nodes: [
      {
        id: "network",
        label: "Private network",
        change: "unchanged",
        icon: HubIcon,
        iconLabel: "Network",
      },
      {
        id: "database",
        label: "Primary database",
        change: "update",
        icon: DatabaseIcon,
        iconLabel: "Database",
        changes: [
          { path: "version", type: "change", before: "16.3", after: "16.4" },
        ],
      },
      {
        id: "storage",
        label: "Database backups",
        change: "create",
        icon: StorageIcon,
        iconLabel: "Storage",
        changes: [{ path: "retention_days", type: "add", after: "30" }],
      },
      {
        id: "authentication",
        label: "Identity service",
        change: "unchanged",
        icon: KeyIcon,
        iconLabel: "Authentication",
      },
      {
        id: "authorization",
        label: "Access policy",
        change: "update",
        icon: ShieldIcon,
        iconLabel: "Authorization",
        changes: [
          { path: "role", type: "change", before: "reader", after: "writer" },
        ],
      },
    ],
    edges: [
      { id: "network-db", source: "network", target: "database" },
      { id: "db-storage", source: "database", target: "storage" },
      { id: "network-auth", source: "network", target: "authentication" },
      { id: "auth-policy", source: "authentication", target: "authorization" },
      {
        id: "db-policy",
        source: "database",
        target: "authorization",
        variant: "dashed",
      },
    ],
    groups: [],
    showDetails: false,
    height: 600,
  },
};
export const ExpandedAttributeDifferences: Story = {
  args: {
    height: 720,
    defaultExpandedChangeNodeIds: [subnetId, "azurerm_container_app.api"],
    defaultView: { scope: "dependents", nodeId: subnetId, depth: 1 },
    defaultCollapsedGroupIds: ["data", "observability"],
    showDetails: false,
    description: "Expand individual cards to inspect attribute differences.",
  },
};
export const CollapsedModules: Story = {
  args: {
    defaultCollapsedGroupIds: dependencyGroups.map((group) => group.id),
    defaultSelection: { type: "group", id: "network" },
  },
};
export const LinkedInspector: Story = {
  render: () => <DependencyGraphLinkedInspectorExample />,
};
export const HighlightedPath: Story = {
  args: {
    highlightedEdgeIds: ["network-subnet", "subnet-api", "api-alert"],
    defaultSelection: { type: "edge", id: "subnet-api" },
  },
};
export const PartialEvidence: Story = {
  args: {
    coverage: {
      status: "partial",
      description: "Only this root's configuration references were supplied.",
    },
    edges: [
      ...dependencyEdges,
      {
        id: "unresolved",
        source: subnetId,
        target: "module.external.service",
        label: "External root reference",
        description: "The referenced resource was not supplied.",
      },
    ],
    defaultSelection: { type: "edge", id: "unresolved" },
  },
};
const large = largeDependencyFixture();
export const ThousandResources: Story = {
  args: {
    ...large,
    defaultCollapsedGroupIds: large.groups.map((group) => group.id),
    defaultView: { scope: "neighbors", nodeId: "resource-501", depth: 1 },
    defaultSelection: { type: "node", id: "resource-501" },
    description:
      "1,000 supplied resources · bounded neighborhood · collapsed roots",
  },
};
export const CyclicRelationships: Story = {
  args: {
    nodes: [
      { id: "a", label: "Service A" },
      { id: "b", label: "Service B", change: "update" },
      { id: "c", label: "Service C" },
    ],
    groups: [],
    edges: [
      { id: "a-b", source: "a", target: "b" },
      { id: "b-c", source: "b", target: "c" },
      { id: "c-a", source: "c", target: "a", variant: "dashed" },
    ],
  },
};
export const Narrow: Story = {
  render: (args) => (
    <div style={{ width: 340, maxWidth: "100%" }}>
      <DependencyGraphReviewExample {...args} />
    </div>
  ),
};
export const Loading: Story = {
  args: { nodes: [], edges: [], status: "loading" },
};
export const Empty: Story = { args: { nodes: [], edges: [] } };
export const Error: Story = {
  args: {
    status: "error",
    message: "Relationship evidence is unavailable for this plan.",
  },
};

/** Resource operations and relationship deltas are independent. */
export const RelationshipChanges: Story = {
  args: {
    title: "Connection changes",
    description: "Review old and new links independently of resource changes.",
    nodes: relationshipChangeNodes,
    groups: [],
    edges: relationshipChangeEdges,
    defaultExpandedChangeNodeIds: ["azurerm_container_app.api"],
    defaultSelection: { type: "node", id: "azurerm_container_app.api" },
    height: 720,
  },
};

export const ResponsiveAttributeDifferences: Story = {
  render: () => (
    <div style={{ maxWidth: 960 }}>
      <h2>Shipping API changes</h2>
      <DependencyGraphChanges
        node={dependencyNodes[2]}
        compact
        defaultPresentation="diff"
        showPresentationControls={false}
      />
    </div>
  ),
};
