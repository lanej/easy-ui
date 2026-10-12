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

function ResourceDiff({ node }: DependencyGraphDetailsContext) {
  if (node?.id !== subnetId) return null;
  return (
    <div className={styles.diff}>
      <h4>Proposed change</h4>
      <span>Address prefix</span>
      <dl>
        <div>
          <dt>Before</dt>
          <dd>
            <code>10.20.0.0/24</code>
          </dd>
        </div>
        <div>
          <dt>After</dt>
          <dd>
            <code>10.20.4.0/24</code>
          </dd>
        </div>
      </dl>
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
      coverage={{
        status: "partial",
        description:
          "Configuration references supplied. Runtime dependencies may be missing.",
      }}
      renderDetails={(context) => <ResourceDiff {...context} />}
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
        renderDetails={(context) => <ResourceDiff {...context} />}
      />
    </div>
  );
}
