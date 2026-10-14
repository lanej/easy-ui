from pathlib import Path

root = Path('easy-ui-react/src/DependencyGraph')


def replace(path, old, new):
    text = path.read_text()
    if text.count(old) != 1:
        raise RuntimeError(f'{path}: expected one matching section, got {text.count(old)}')
    path.write_text(text.replace(old, new))


css = root / 'DependencyGraph.module.scss'
replace(css, '''.cluster {
  position: absolute;
  border: 1px dashed design-token("color.neutral.300");
  border-radius: 8px;
  background: design-token("color.neutral.100");
}''', '''.cluster {
  --dependency-graph-group-surface: #{design-token("color.neutral.100")};
  position: absolute;
  border: round(up, max(1px, calc(1px / var(--dependency-graph-zoom, 1))), 1px) dashed design-token("color.neutral.600");
  border-radius: 8px;
  background: var(--dependency-graph-group-surface);
  &[data-graph-group-layer="1"] {
    --dependency-graph-group-surface: #{design-token("color.neutral.050")};
  }
}''')
replace(css, '''  font-size: 0.8125rem;
  background: design-token("color.neutral.100");
  > button:first-child''', '''  font-size: 0.8125rem;
  background: var(--dependency-graph-group-surface);
  > button:first-child''')
replace(css, '''.node {
  position: absolute;
  border: 1px solid design-token("color.neutral.300");''', '''// Round up before scaling: browsers snap fractional CSS borders down, which
// otherwise makes resource/group outlines thinner than one screen pixel.
.node {
  position: absolute;
  border: round(up, max(1px, calc(1px / var(--dependency-graph-zoom, 1))), 1px) solid design-token("color.neutral.600");''')
replace(css, '''    box-shadow: 0 0 0 2px design-token("color.primary.500");''', '''    box-shadow: 0 0 0 max(2px, calc(2px / var(--dependency-graph-zoom, 1))) design-token("color.primary.500");''')
replace(css, '''.node[data-node-kind="unresolved"] {
  border-style: dashed;
  background: design-token("color.neutral.050");
  box-shadow: none;
}''', '''.node[data-node-kind="unresolved"] {
  // Evidence boundaries use a dashed outline, not a canvas-colored card.
  border-style: dashed;
}''')
replace(css, '''  stroke: design-token("color.neutral.500");''', '''  stroke: design-token("color.neutral.600");''')
replace(css, '''.edges marker {
  fill: design-token("color.neutral.500");
}''', '''.edges marker {
  fill: design-token("color.neutral.600");
}''')
replace(css, '''@media (forced-colors: active) {
  .node[data-selected="true"]''', '''@media (forced-colors: active) {
  .node,
  .cluster {
    border-color: CanvasText;
    background: Canvas;
  }
  .clusterHeading {
    background: Canvas;
  }
  .node[data-selected="true"]''')
replace(root / 'DependencyGraph.tsx', '''                        data-graph-group={cluster.group.id}
                        className={styles.cluster}''', '''                        data-graph-group={cluster.group.id}
                        data-graph-group-layer={
                          (hierarchy.paths.get(cluster.group.id)!.length - 1) % 2
                        }
                        className={styles.cluster}''')
with (Path('scripts') / 'check-dependency-graph-groups.mjs').open('a') as f:
    f.write('\n// Contrast is checked against the actual containing subgraph, not the DOM parent.\nawait import("./check-dependency-graph-contrast.mjs");\n')
with (root / 'DependencyGraph.mdx').open('a') as f:
    f.write('''\n### Surface contrast\n\nEvery resource, including unresolved and unselected resources, has an opaque card\nsurface and a contrasting boundary. Unresolved references retain their dashed\noutline and label; they do not disappear into the canvas. Nested groups alternate\nneutral surfaces with matching header backgrounds. Resource and group outlines\nretain at least one screen pixel at overview zoom. Selection adds emphasis without\nfading other resources. Browser checks cover text, pills, resource/group boundaries,\nhover, focus, selection, and minimum zoom in both themes, including forced colors.\n''')
with Path('.changeset/readable-source-dependency-graphs.md').open('a') as f:
    f.write('\nKeep resource and subgraph boundaries visible in both themes and at overview zoom; preserve opaque unresolved cards and distinguish nested group surfaces.\n')
