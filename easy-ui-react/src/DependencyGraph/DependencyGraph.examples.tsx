import React, { useState } from "react";
import { DependencyGraph } from "./DependencyGraph";
import { DependencyGraphDetails } from "./DependencyGraphDetails";
import { Button } from "../Button";
import {
  dependencyNodes,
  dependencyEdges,
  dependencyGroups,
  subnetId,
  attributeDependencyNodes,
  attributeDependencyEdges,
} from "./DependencyGraph.fixtures";
import type {
  DependencyGraphDetailsContext,
  DependencyGraphProps,
  DependencyGraphSelection,
} from "./types";
import styles from "./DependencyGraph.examples.module.scss";

const stableNodes = attributeDependencyNodes.map((node) => ({
  ...node,
  groupId: node.id === "database" || node.id === "storage" ? "data" : undefined,
}));
const stableGroups = [{ id: "data", label: "Database resources" }];
const stableExpandedIds = ["database", "api"];

export function DependencyGraphStableLayoutExample() {
  const [hideEdges, setHideEdges] = useState(false);
  const [expandedIds, setExpandedIds] =
    useState<readonly string[]>(stableExpandedIds);
  const [collapseGroup, setCollapseGroup] = useState(false);
  return (
    <>
      <div
        className={styles.layoutControls}
        role="group"
        aria-label="Resource graph presentation"
      >
        <Button
          size="sm"
          variant="outlined"
          onPress={() => setHideEdges(!hideEdges)}
        >
          {hideEdges ? "Show all edges" : "Hide all edges"}
        </Button>
        <Button
          size="sm"
          variant="outlined"
          onPress={() =>
            setExpandedIds(expandedIds.length ? [] : stableExpandedIds)
          }
        >
          {expandedIds.length
            ? "Collapse attribute differences"
            : "Expand attribute differences"}
        </Button>
        <Button
          size="sm"
          variant="outlined"
          onPress={() => setCollapseGroup(!collapseGroup)}
        >
          {collapseGroup ? "Expand database group" : "Collapse database group"}
        </Button>
      </div>
      <DependencyGraph
        title="Stable resource order"
        description="Expand full differences, hide edges, or fold resource groups. Cards grow and spacing adjusts while resource ordering stays consistent."
        nodes={stableNodes}
        edges={attributeDependencyEdges}
        groups={stableGroups}
        hiddenEdgeIds={
          hideEdges ? attributeDependencyEdges.map((edge) => edge.id) : []
        }
        expandedChangeNodeIds={expandedIds}
        onExpandedChangeNodeIdsChange={setExpandedIds}
        collapsedGroupIds={collapseGroup ? ["data"] : []}
        onCollapsedGroupIdsChange={(ids) =>
          setCollapseGroup(ids.includes("data"))
        }
        showDetails={false}
        height={650}
      />
    </>
  );
}

function ReplacementEvidence({ node }: DependencyGraphDetailsContext) {
  if (node?.id !== subnetId) return null;
  return (
    <div className={styles.evidence}>
      <p>
        Replacement is supplied by the plan. Connected resources require review;
        the graph does not establish an outage.
      </p>
    </div>
  );
}

export function DependencyGraphReviewExample(
  props: Partial<DependencyGraphProps>,
) {
  const [selection, setSelection] = useState<DependencyGraphSelection>({
    type: "node",
    id: subnetId,
  });
  return (
    <DependencyGraph
      title="Resource dependencies"
      description="Production network · proposed change"
      nodes={dependencyNodes}
      edges={dependencyEdges}
      groups={dependencyGroups}
      defaultView={{ scope: "dependents", nodeId: subnetId, depth: 1 }}
      defaultCollapsedGroupIds={["data", "observability"]}
      defaultChangePresentation="summary"
      defaultExpandedChangeNodeIds={[subnetId]}
      coverage={{
        status: "partial",
        description:
          "Configuration references supplied. Runtime dependencies may be missing.",
      }}
      renderDetails={(context) => <ReplacementEvidence {...context} />}
      {...props}
      selection={selection}
      onSelectionChange={(next) => {
        setSelection(next);
        props.onSelectionChange?.(next);
      }}
    />
  );
}

export function DependencyGraphLinkedInspectorExample() {
  const [selection, setSelection] = useState<DependencyGraphSelection>(null);
  return (
    <div className={styles.linked}>
      <DependencyGraph
        title="Application relationships"
        nodes={dependencyNodes}
        edges={dependencyEdges}
        groups={dependencyGroups}
        selection={selection}
        onSelectionChange={setSelection}
        showDetails={false}
      />
      <DependencyGraphDetails
        nodes={dependencyNodes}
        edges={dependencyEdges}
        groups={dependencyGroups}
        selection={selection}
        onSelectionChange={setSelection}
        renderDetails={(context) => <ReplacementEvidence {...context} />}
      />
    </div>
  );
}
