import { realWorldNodes, realWorldEdges } from "./DependencyGraph.realWorld";
import React, { useState } from "react";
import type { DependencyGraphCardLayouts, DependencyGraphProps } from "./types";
import {
  subgraphGroups,
  subgraphNodes,
  subgraphEdges,
} from "./DependencyGraph.groups.fixtures";
import DatabaseIcon from "@easypost/easy-ui-icons/Database";
import StorageIcon from "@easypost/easy-ui-icons/Storage";
import HubIcon from "@easypost/easy-ui-icons/Hub";
import KeyIcon from "@easypost/easy-ui-icons/Key";
import ShieldIcon from "@easypost/easy-ui-icons/Shield";
import CodeIcon from "@easypost/easy-ui-icons/Code";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DependencyGraph } from "./DependencyGraph";
import { DependencyGraphChanges } from "./DependencyGraphChanges";
import { Text } from "../Text";
import { VerticalStack } from "../VerticalStack";
import {
  wideDependencyNodes,
  wideDependencyEdges,
  deepDependencyEdges,
} from "./DependencyGraph.responsive.fixtures";
import {
  DependencyGraphReviewExample,
  DependencyGraphLinkedInspectorExample,
  DependencyGraphStableLayoutExample,
  DependencyGraphRiskExample,
} from "./DependencyGraph.examples";
import {
  relationshipChangeNodes,
  relationshipChangeEdges,
  attributeDependencyNodes,
  attributeDependencyEdges,
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
    renderNodeAnnotation: { control: false },
    renderAttributeAnnotation: { control: false },
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
export const NewlySetValues: Story = {
  args: {
    title: undefined,
    accessibilityLabel: "New resource attributes",
    nodes: [
      {
        id: "archive",
        label: "Audit archive",
        typeLabel: "Storage bucket",
        icon: StorageIcon,
        iconLabel: "Storage",
        change: "create",
        changes: [
          { path: "name", type: "add", after: "production-audit-archive" },
          { path: "region", type: "change", before: null, after: "us-west-2" },
          { path: "versioning.enabled", type: "add", after: "false" },
          { path: "retention_days", type: "add", after: "0" },
          {
            path: "encryption.key_id",
            type: "add",
            after: { status: "unknown" },
          },
        ],
      },
      {
        id: "worker",
        label: "Audit worker",
        typeLabel: "Container application",
        icon: CodeIcon,
        iconLabel: "Application",
        change: "update",
        changes: [
          {
            path: "archive_bucket",
            type: "change",
            before: null,
            after: "production-audit-archive",
          },
          { path: "replicas", type: "change", before: "1", after: "2" },
        ],
      },
    ],
    edges: [{ id: "archive-worker", source: "archive", target: "worker" }],
    groups: [],
    showDetails: false,
    defaultExpandedChangeNodeIds: ["archive", "worker"],
    height: 480,
  },
};
export const CompactTree: Story = {
  args: {
    title: undefined,
    accessibilityLabel: "Resource change review",
    nodes: subgraphNodes.map((node) => ({
      ...node,
      ...{
        api: { icon: CodeIcon, iconLabel: "Application" },
        db: { icon: DatabaseIcon, iconLabel: "Database" },
        user: { icon: KeyIcon, iconLabel: "Database user" },
        audit: { icon: StorageIcon, iconLabel: "Storage" },
        module: { icon: HubIcon, iconLabel: "Module" },
      }[node.id],
    })),
    edges: subgraphEdges,
    groups: subgraphGroups,
    defaultPresentation: "tree",
    defaultSelection: { type: "node", id: "api" },
    defaultChangePresentation: "diff",
    height: 760,
  },
};
export const TreeWithSupportingDetails: Story = {
  args: {
    title: undefined,
    accessibilityLabel: "Resources with supporting evidence",
    nodes: Array.from({ length: 40 }, (_, index) => ({
      id: `resource-${index}`,
      label: `Resource ${index + 1}`,
    })),
    edges: [],
    groups: [],
    defaultPresentation: "tree",
    defaultSelection: { type: "node", id: "resource-10" },
    renderDetails: () => (
      <div>
        <h4>Supporting evidence</h4>
        {Array.from({ length: 12 }, (_, index) => (
          <p key={index}>
            Verification step {index + 1}: compare the supplied runtime
            configuration with the planned resource changes before approving
            this dependency.
          </p>
        ))}
      </div>
    ),
    height: 360,
  },
};
export const TreeWithoutInspector: Story = {
  ...CompactTree,
  args: {
    ...CompactTree.args,
    showDetails: false,
    defaultExpandedChangeNodeIds: ["api"],
    defaultCollapsedGroupIds: ["database"],
  },
};
export const CustomTreeDetails: Story = {
  args: {
    ...CompactTree.args,
    accessibilityLabel: "Resources with custom review notes",
    renderDetailsMode: "replace",
    renderDetails: ({ node }) => (
      <VerticalStack gap="1">
        <Text as="h4" variant="heading4">
          Review notes
        </Text>
        <Text as="p">
          {node?.id === "api"
            ? "Staging verification passed for the proposed image. Production rollout is waiting for the database compatibility review."
            : "No review notes have been supplied for this selection."}
        </Text>
        <Text as="p" variant="body2">
          Illustrative application evidence, supplied independently of the
          resource changes.
        </Text>
      </VerticalStack>
    ),
  },
};
export const EmbeddedInspector: Story = {
  args: {
    title: undefined,
    description: undefined,
    accessibilityLabel: "Resource change review",
    defaultSelection: { type: "node", id: "azurerm_container_app.api" },
    defaultChangePresentation: "diff",
    defaultExpandedChangeNodeIds: [subnetId, "azurerm_container_app.api"],
    height: 650,
  },
};
export const RiskAnnotations: Story = {
  render: () => <DependencyGraphRiskExample />,
  parameters: {
    docs: {
      description: {
        story:
          "Illustrative application-supplied findings combine plan changes with service inventory and runtime dependency evidence. Findings and expandable evidence live on the relevant resource or attribute block. The graph displays the findings without calculating risk. An unchanged resource can still be affected; omitted annotations do not mean low risk.",
      },
    },
  },
};
export const StableResourceOrder: Story = {
  render: () => <DependencyGraphStableLayoutExample />,
};
export const ResponsiveResourceCard: Story = {
  args: {
    title: undefined,
    accessibilityLabel: "Application user changes",
    nodes: [
      {
        id: "application-user",
        label: "application_user",
        typeLabel: "SQL user",
        categories: [{ label: "Source modified", variant: "primary" }],
        changeSummary: "Captured attributes",
        changes: [
          {
            path: "configuration.name",
            type: "change",
            before: '"application-old"',
            after: "service_account.application.email",
          },
        ],
      },
    ],
    edges: [],
    groups: [],
    showDetails: false,
    defaultExpandedChangeNodeIds: ["application-user"],
    height: 320,
  },
};
export const FullscreenInspection: Story = {
  args: {
    ...ResponsiveResourceCard.args,
    title: "Resource dependencies",
    showDetails: true,
    defaultSelection: { type: "node", id: "application-user" },
  },
  render: (args) => (
    <div style={{ maxWidth: 900, margin: "auto" }}>
      <p>Inspect resources here or open the graph in full screen.</p>
      <DependencyGraph {...args} />
    </div>
  ),
};

function EditableCardsExample(args: DependencyGraphProps) {
  const [layouts, setLayouts] = useState<DependencyGraphCardLayouts>(
    args.defaultCardLayouts ?? {},
  );
  return (
    <DependencyGraph
      {...args}
      cardLayouts={layouts}
      onCardLayoutsChange={setLayouts}
    />
  );
}

export const EditableResourceCards: Story = {
  args: {
    title: "Arrange resource dependencies",
    nodes: [
      {
        id: "store",
        label: "Application database",
        typeLabel: "Database",
        groupId: "data",
        change: "update",
        changes: Array.from({ length: 12 }, (_, index) => ({
          path: `settings.field_${index + 1}`,
          type: "change" as const,
          before: "previous-value",
          after: "updated-value",
        })),
      },
      {
        id: "api",
        label: "API service",
        typeLabel: "Container",
        groupId: "apps",
        change: "update",
        changes: [
          {
            path: "database.host",
            type: "change",
            before: "database.previous.host",
            after: "database.current.host",
          },
        ],
      },
      {
        id: "worker",
        label: "Background worker",
        typeLabel: "Container",
        groupId: "apps",
        change: "unchanged",
      },
    ],
    edges: [
      {
        id: "store-api",
        source: "store",
        target: "api",
        sourceAttributePath: "settings.field_12",
        targetAttributePath: "database.host",
      },
      { id: "api-worker", source: "api", target: "worker" },
    ],
    groups: [
      { id: "system", label: "Application" },
      { id: "data", label: "Data", parentId: "system" },
      { id: "apps", label: "Services", parentId: "system" },
    ],
    defaultExpandedChangeNodeIds: ["store", "api"],
    defaultSelection: { type: "node", id: "store" },
    defaultCardLayouts: {
      store: { width: 400, height: 300 },
      api: { width: 320, height: 220 },
    },
    showDetails: false,
    height: 620,
  },
  render: (args) => <EditableCardsExample {...args} />,
};
export const WideAttributeInspection: Story = {
  args: {
    title: undefined,
    accessibilityLabel: "Application attribute changes",
    nodes: wideDependencyNodes,
    edges: wideDependencyEdges,
    groups: [],
    showDetails: false,
    defaultExpandedChangeNodeIds: wideDependencyNodes.map((node) => node.id),
    height: 1400,
  },
};
export const DeepAttributeInspection: Story = {
  ...WideAttributeInspection,
  args: { ...WideAttributeInspection.args, edges: deepDependencyEdges },
};
export const CyclicAttributeInspection: Story = {
  ...WideAttributeInspection,
  args: {
    ...WideAttributeInspection.args,
    edges: [
      ...wideDependencyEdges,
      { id: "feedback", source: "service-1", target: "network" },
      { id: "self", source: "service-2", target: "service-2" },
    ],
  },
};
export const GroupedAttributeInspection: Story = {
  ...WideAttributeInspection,
  args: {
    ...WideAttributeInspection.args,
    groups: [
      { id: "platform", label: "Platform root" },
      { id: "applications", label: "Applications root" },
      { id: "services", label: "Services module", parentId: "applications" },
    ],
    nodes: wideDependencyNodes.map((node) => ({
      ...node,
      groupId: node.id === "network" ? "platform" : "services",
    })),
  },
};
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
export const DependencyTree: Story = {
  args: {
    ...CollapsibleBranches.args,
    title: undefined,
    description: undefined,
    defaultPresentation: "tree",
    treeHierarchy: "dependencies",
    showDetails: true,
    defaultSelection: { type: "node", id: "database" },
    defaultChangePresentation: "diff",
    edges: [
      ...CollapsibleBranches.args!.edges!,
      {
        id: "storage-db",
        source: "storage",
        target: "database",
        variant: "dashed",
      },
    ],
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

export const AttributeDependencies: Story = {
  args: {
    title: "Attribute dependencies",
    description:
      "Attribute references connect fields; depends_on connects blocks. Yellow marks a modified reference.",
    nodes: attributeDependencyNodes,
    edges: attributeDependencyEdges,
    groups: [],
    defaultExpandedChangeNodeIds: ["database", "api"],
    defaultSelection: { type: "node", id: "api" },
    height: 780,
  },
};

export const SourceOnlyEvidence: Story = {
  args: {
    title: undefined,
    description: undefined,
    nodes: realWorldNodes,
    edges: realWorldEdges,
    groups: [],
    showDetails: false,
    height: 520,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Source-only evidence with long addresses, distinct unresolved inputs and outputs, one-dependent chains, and disconnected components. Source modified is not a plan action. Applications supply the display name, type, address, and unresolved classification.",
      },
    },
  },
};

export const SourceOnlyEvidenceInspector: Story = {
  ...SourceOnlyEvidence,
  args: {
    ...SourceOnlyEvidence.args,
    showDetails: true,
    defaultSelection: { type: "node", id: "external:backend_bucket" },
  },
};

export const ExplicitChangeEvidence: Story = {
  args: {
    title: undefined,
    groups: [],
    nodes: [
      {
        id: "absent",
        label: "No plan supplied",
        categories: [{ label: "Source modified" }],
      },
      {
        id: "unknown",
        label: "Explicitly unknown",
        change: "unknown",
        categories: [{ label: "Source unchanged" }],
      },
      { id: "unchanged", label: "Explicitly unchanged", change: "unchanged" },
      { id: "update", label: "Planned update", change: "update" },
    ],
    edges: [],
    showDetails: false,
    height: 400,
  },
};

/** The application chooses these colors; the graph does not interpret labels. */
export const CategoryColors: Story = {
  ...SourceOnlyEvidence,
  args: {
    ...SourceOnlyEvidence.args,
    nodes: realWorldNodes.map((node) => ({
      ...node,
      categories: node.categories?.map((category) =>
        category.label === "Source modified"
          ? { ...category, variant: "primary" as const }
          : category,
      ),
    })),
    showDetails: true,
    defaultSelection: { type: "node", id: "google_sql_user.pipeline" },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Caller-selected blue for Source modified; categories without a variant, such as Source unchanged, remain neutral. Colors are repeated in the inspector and do not imply plan actions or risk.",
      },
    },
  },
};

export const CategoryPalette: Story = {
  args: {
    title: undefined,
    nodes: [
      {
        id: "palette",
        label: "Caller-selected categories",
        categories: [
          { label: "Neutral" },
          { label: "Primary", variant: "primary" },
          { label: "Secondary", variant: "secondary" },
          { label: "Success", variant: "success" },
          { label: "Warning", variant: "warning" },
          { label: "Danger", variant: "danger" },
          { label: "Gray", variant: "gray" },
          { label: "Black", variant: "black" },
          { label: "Inverse", variant: "inverse" },
        ],
      },
    ],
    edges: [],
    groups: [],
    defaultSelection: { type: "node", id: "palette" },
    height: 280,
  },
};

export const GroupedSubgraphs: Story = {
  args: {
    title: undefined,
    accessibilityLabel: "Grouped source dependencies",
    nodes: subgraphNodes,
    edges: subgraphEdges,
    groups: subgraphGroups
      .filter((group) => group.id !== "production")
      .map(({ id, label, description }) => ({ id, label, description })),
    showDetails: false,
    height: 650,
  },
};
export const NestedSubgraphs: Story = {
  args: { ...GroupedSubgraphs.args, groups: subgraphGroups },
};
export const CollapsedSubgraphs: Story = {
  args: {
    ...NestedSubgraphs.args,
    defaultCollapsedGroupIds: ["production", "runtime"],
    showDetails: true,
    defaultSelection: { type: "group", id: "production" },
  },
};
