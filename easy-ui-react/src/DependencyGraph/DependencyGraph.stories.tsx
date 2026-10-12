import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DependencyGraph } from "./DependencyGraph";
import {
  DependencyGraphReviewExample,
  DependencyGraphLinkedInspectorExample,
} from "./DependencyGraph.examples";
import {
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
export const ExpandedAttributeDifferences: Story = {
  args: {
    height: 720,
    defaultExpandedChangeNodeIds: [subnetId, "azurerm_container_app.api"],
    defaultView: { scope: "dependents", nodeId: subnetId, depth: 1 },
    defaultCollapsedGroupIds: ["data", "observability"],
    showDetails: false,
    description:
      "Expand individual cards to inspect attribute differences inline.",
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
