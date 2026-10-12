import React, { useState } from "react";
import { DependencyGraph } from "./DependencyGraph";
import { DependencyGraphDetails } from "./DependencyGraphDetails";
import {
  dependencyNodes,
  dependencyEdges,
  dependencyGroups,
  subnetId,
} from "./DependencyGraph.fixtures";
import type {
  DependencyGraphDetailsContext,
  DependencyGraphProps,
  DependencyGraphSelection,
} from "./types";
import styles from "./DependencyGraph.examples.module.scss";

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
      defaultChangePresentation="diff"
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
