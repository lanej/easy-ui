from pathlib import Path
import sys

root = Path('easy-ui-react/src/DependencyGraph')
source = (root / 'DependencyGraph.tsx').read_text()
if 'import { DependencyGraphIdentity }' in source:
    sys.exit(0)
updates = {}
def replace(text, old, new):
    assert text.count(old) == 1, f'Expected one match: {old[:100]!r}, got {text.count(old)}'
    return text.replace(old, new)

source = replace(source, 'import { Icon } from "../Icon";\n', 'import { DependencyGraphIdentity } from "./DependencyGraphIdentity";\n')
a = source.index('const overviewChanges = {')
b = source.index('const sameEdgeSelection', a)
source = source[:a] + source[b:]
source = replace(source, '`${node.label} ${node.id} ${node.description ?? ""}`', '`${node.label} ${node.id} ${node.typeLabel ?? ""} ${node.address ?? ""} ${node.description ?? ""}`')
source = replace(source, 'data-change={node?.change ?? "unknown"}', 'data-change={node?.change}\n                          data-node-kind={node?.kind}')
source = replace(source, '? `${label}, ${dependencyChangeLabels[node.change ?? "unknown"]}${node.description ? `, ${node.description}` : ""}${node.iconLabel ? `, ${node.iconLabel}` : ""}`', '? [label, node.kind === "unresolved" ? "Unresolved" : null, node.change ? dependencyChangeLabels[node.change] : null, node.typeLabel, node.description, node.iconLabel].filter(Boolean).join(", ")')
# Move branch disclosure beside selection, never inside the selection button.
a = source.index('                                {dependents > 0 && (')
b = source.index('                              </div>', a)
source = source[:a] + source[b:]
source = replace(source, '(hasDependencyGraphChanges(node) ||\n                              dependents > 0)', 'hasDependencyGraphChanges(node)')
source = replace(source, '<div className={styles.cardControls}>', '<div className={styles.cardControls} data-graph-attribute-controls>')
a = source.index('                          <button', source.index('data-graph-resource-card={node?.id}'))
source = source[:a] + '                          <div className={styles.cardHeading}>\n' + source[a:]
a = source.index('                            <span className={styles.nodeTop}>', a)
b = source.index('                          </button>', a)
source = source[:a] + '''                            {node ? (
                              <DependencyGraphIdentity node={node} overview={density === "overview"} />
                            ) : (
                              <>
                                <span className={styles.muted}>
                                  {shown === item.members.length ? shown : `${shown} of ${item.members.length}`} resources · {changed} changed
                                </span>
                                <strong className={styles.nodeLabel}>{label}</strong>
                                {cardDescription && <span className={styles.nodeDescription} title={cardDescription}>{cardDescription}</span>}
                              </>
                            )}
''' + source[b:]
a = source.index('                          </button>', a) + len('                          </button>')
source = source[:a] + '''
                          {node && dependents > 0 && (
                            <span className={styles.branchControls}>
                              <CollapseButton
                                accessibilityLabel={`${branchCollapsed ? "Expand" : "Collapse"} dependents of ${label}`}
                                expanded={!branchCollapsed}
                                aria-controls={`${instanceId}-canvas`}
                                onPress={() => changeCollapsedNodes(
                                  branchCollapsed
                                    ? collapsedNodes.filter(id => id !== node.id)
                                    : [...collapsedNodes, node.id],
                                )}
                              />
                              {branchCollapsed && (
                                <span className={styles.hiddenCount}>{branches.hiddenCounts.get(node.id) ?? 0} hidden</span>
                              )}
                            </span>
                          )}
                          </div>''' + source[a:]
updates[root / 'DependencyGraph.tsx'] = source

source = (root / 'types.ts').read_text()
source = replace(source, '  label: string;\n  /** Resource type, address, or other caller-owned context. */', '''  label: string;
  /** Optional secondary type/context. Supply the display name in label; no identifier parsing is performed. */
  typeLabel?: string;
  /** Full caller-owned address for inspection and search; id remains the stable graph identity. */
  address?: string;
  /** Explicit evidence boundary. Unresolved references remain distinct nodes with their original edges. */
  kind?: "resource" | "unresolved";
  /** Resource type, address, or other caller-owned context. */''')
source = replace(source, '/** Omitted change information is unknown, not proof of no change. */', '/** Omitted means not supplied and renders no card badge. Explicit unknown remains distinct from unchanged. */')
updates[root / 'types.ts'] = source

source = (root / 'model.ts').read_text()
source = replace(source, '    NODE_WIDTH,\n    0.4,', '''    NODE_WIDTH,
    // Only group headings need minimum-zoom clearance. Ungrouped source graphs
    // start at detail density; preserving order must not preserve overview gaps.
    groups.some(group => nodes.some(node => node.groupId === group.id)) ? 0.4 : 1,''')
a = source.index('  const branchSources = new Set(')
b = source.index('  const nodeKey', a)
source = source[:a] + source[b:]
source = replace(source, '(hasDependencyGraphChanges(node) || branchSources.has(node.id)\n                ? 31\n                : 2)', '(hasDependencyGraphChanges(node) ? 31 : 2)')
updates[root / 'model.ts'] = source

source = (root / 'DependencyGraphDetails.tsx').read_text()
source = replace(source, '''                <span
                  className={styles.change}
                  data-change={context.node.change ?? "unknown"}
                >
                  {dependencyChangeLabels[context.node.change ?? "unknown"]}
                </span>''', '''                {context.node.kind === "unresolved" && <p className={styles.referenceLabel}>Unresolved reference</p>}
                {context.node.typeLabel && <p className={styles.detailDescription}>{context.node.typeLabel}</p>}
                <span
                  className={context.node.change ? styles.change : styles.muted}
                  data-change={context.node.change}
                >
                  {context.node.change ? dependencyChangeLabels[context.node.change] : "Change not supplied"}
                </span>''')
source = replace(source, '<code className={styles.identifier}>{context.node.id}</code>', '''<code className={styles.identifier}>{context.node.address ?? context.node.id}</code>
                {context.node.address && context.node.address !== context.node.id && (
                  <span className={styles.identifier}>Record ID: {context.node.id}</span>
                )}''')
source = replace(source, '{dependencyChangeLabels[node.change ?? "unknown"]}', '{node.change ? dependencyChangeLabels[node.change] : "Change not supplied"}')
updates[root / 'DependencyGraphDetails.tsx'] = source

source = (root / 'DependencyGraph.module.scss').read_text()
source = source.replace('.cardControls button,', '.branchControls button,\n.cardControls button,', 1)
source = source.replace('.cardControls button > span:last-child,', '.branchControls button > span:last-child,\n.cardControls button > span:last-child,', 1)
source = replace(source, '.node .cardControls button,', '.node .branchControls button,\n.node .cardControls button,')
source += '''

// Keep disclosure beside the header, not in a footer that repeats visible edges.
.cardHeading {
  display: flex;
  align-items: stretch;
  min-inline-size: 0;
  .nodeSelect {
    flex: 1;
    min-inline-size: 0;
  }
}
.node[data-group="true"] .cardHeading {
  block-size: 100%;
}
.branchControls {
  display: flex;
  flex-direction: column;
  align-items: center;
  align-self: flex-start;
  gap: 2px;
  flex-shrink: 0;
  padding: 4px 4px 4px 0;
}
.hiddenCount {
  font-size: max(0.625rem, calc(10px / var(--dependency-graph-zoom)));
  color: design-token("color.neutral.700");
  white-space: nowrap;
}
.node[data-graph-resource-card] .nodeLabel {
  display: block;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow-wrap: normal;
}
.middleLabel {
  display: flex;
  min-inline-size: 0;
  max-inline-size: 100%;
}
.labelPrefix {
  flex: 0 1 auto;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.labelSuffix {
  flex: 0 0 auto;
  max-inline-size: 65%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nodeMetadata {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px 6px;
  max-inline-size: 100%;
  min-inline-size: 0;
  font-size: 0.75rem;
  color: design-token("color.neutral.700");
}
.nodeType {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-inline-size: 0;
}
.referenceLabel {
  color: design-token("color.neutral.700");
  font-size: 0.75rem;
}
.node[data-node-kind="unresolved"] {
  border-style: dashed;
  background: design-token("color.neutral.050");
  box-shadow: none;
}
.root[data-graph-density="overview"] {
  .nodeType {
    display: none;
  }
  .referenceLabel {
    font-size: max(0.75rem, calc(10px / var(--dependency-graph-zoom)));
  }
}
'''
updates[root / 'DependencyGraph.module.scss'] = source

source = (root / 'DependencyGraph.test.tsx').read_text()
source = replace(source, 'name: "Resource A, Change unknown"', 'name: "Resource A"')
updates[root / 'DependencyGraph.test.tsx'] = source

source = (root / 'DependencyGraph.stories.tsx').read_text()
source = 'import { realWorldNodes, realWorldEdges } from "./DependencyGraph.realWorld";\n' + source
source += '''

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
    docs: { description: { story: "Source-only evidence with long addresses, distinct unresolved inputs and outputs, one-dependent chains, and disconnected components. Source modified is not a plan action. Applications supply the display name, type, address, and unresolved classification." } },
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
      { id: "absent", label: "No plan supplied", description: "Source modified" },
      { id: "unknown", label: "Explicitly unknown", change: "unknown" },
      { id: "unchanged", label: "Explicitly unchanged", change: "unchanged" },
      { id: "update", label: "Planned update", change: "update" },
    ],
    edges: [],
    showDetails: false,
    height: 400,
  },
};
'''
updates[root / 'DependencyGraph.stories.tsx'] = source

source = (root / 'DependencyGraph.mdx').read_text()
source += '''

## Source-only evidence and resource identity

<Canvas of={DependencyGraphStories.SourceOnlyEvidence} />

Use `label` for the distinguishing display name, `typeLabel` for secondary type/context,
and `address` for the complete inspectable address. These are caller-owned strings:
Easy UI does not parse Terraform addresses or infer plan actions from source edits.
An unsplit long label uses middle truncation and retains its full accessible name.

Omitting `change` means **not supplied**: no card badge, and “Change not supplied” in
selection details. Explicit `unknown` and `unchanged` remain different states, with
compact `?` and `=` markers and full accessible labels. Supplied field differences
still expand even when no plan operation is supplied.

Set `kind: "unresolved"` only for an explicitly identified evidence boundary. Give
each reference its own stable `id` and meaningful `label`; identical display labels
never combine nodes or edges. The compact dashed card shows “Unresolved”; its
`description` remains available in the inspector. This is not a captured resource.

Branch disclosure stays beside the selection button. Counts are shown when a
branch is collapsed; attribute disclosure remains independent. Ungrouped graphs
start with detail-scale spacing. Subsequent visibility and expansion changes keep
the established resource order; expansion adds only the clearance it needs.
'''
# Reuse the actual stories import alias rather than assuming its spelling.
import re
alias = re.search(r'import \* as (\w+) from [\"\']\./DependencyGraph\.stories', source)
assert alias, 'Missing MDX stories import'
source = source.replace('<Canvas of={DependencyGraphStories.SourceOnlyEvidence} />', f'<Canvas of={{{alias.group(1)}.SourceOnlyEvidence}} />')
updates[root / 'DependencyGraph.mdx'] = source

source = Path('scripts/check-dependency-graph.mjs').read_text()
source = replace(source, '        "partial-evidence",', '        "source-only-evidence",\n        "source-only-evidence-inspector",\n        "explicit-change-evidence",\n        "partial-evidence",')
source = replace(source, '            "collapsible-branches",', '            "collapsible-branches",\n            "source-only-evidence",\n            "source-only-evidence-inspector",\n            "explicit-change-evidence",')
updates[Path('scripts/check-dependency-graph.mjs')] = source
for path, content in updates.items():
    path.write_text(content)
