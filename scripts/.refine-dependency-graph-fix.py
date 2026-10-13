from pathlib import Path
root=Path('easy-ui-react/src/DependencyGraph')
p=root/'DependencyGraph.module.scss'
s=p.read_text()
marker='// Keep disclosure beside the header, not in a footer that repeats visible edges.'
if marker in s and s.index(marker)>s.index('.root[data-graph-density="overview"]'):
    a=s.index('.cardHeading {',s.index(marker)); b=s.index('.node[data-group="true"] .cardHeading',a)
    heading=s[a:b]; s=s[:a]+s[b:]
    pos=s.index('.node[data-graph-resource-card] .nodeSelect'); s=s[:pos]+heading+s[pos:]
    a=s.index('.node[data-graph-resource-card] .nodeLabel {',s.index(marker)); b=s.index('.middleLabel',a)
    label=s[a:b]; s=s[:a]+s[b:]
    pos=s.index('.nodeDescription {'); s=s[:pos]+label+s[pos:]
    a=s.index('.root[data-graph-density="overview"]',s.index(marker)); extra=s[a:]
    assert extra.rstrip().endswith('}')
    body=extra[extra.index('{')+1:extra.rfind('}')]; s=s[:a]
    pos=s.index('.root[data-graph-density="overview"] {')+len('.root[data-graph-density="overview"] {')
    s=s[:pos]+body+s[pos:]
    a=s.index(marker); added=s[a:]; s=s[:a]
    pos=s.index('.root[data-graph-density="overview"]'); s=s[:pos]+added+'\n'+s[pos:]
    s=s.replace('.branchControls {\n  display: flex;\n  flex-direction: column;', '.branchControls {\n  display: flex;\n  flex-direction: row;')
    s=s.replace('  max-inline-size: 65%;\n  overflow: hidden;\n  text-overflow: ellipsis;', '  max-inline-size: 65%;\n  overflow: hidden;\n  display: flex;\n  justify-content: flex-end;\n  > span {\n    flex-shrink: 0;\n  }')
    p.write_text(s)
p=root/'DependencyGraphIdentity.tsx'; s=p.read_text()
s=s.replace('className={styles.middleLabel} aria-label={label}', 'className={styles.middleLabel}')
s=s.replace('className={styles.labelPrefix} aria-hidden="true"', 'className={styles.labelPrefix}')
s=s.replace('className={styles.labelSuffix} aria-hidden="true"', 'className={styles.labelSuffix}')
if '<span>{characters.slice(-18)' not in s: s=s.replace('{characters.slice(-18).join("")}', '<span>{characters.slice(-18).join("")}</span>')
if 'role="img"' not in s: s=s.replace('              aria-label={dependencyChangeLabels[node.change]}', '              role="img"\n              aria-label={dependencyChangeLabels[node.change]}')
p.write_text(s)
p=root/'DependencyGraphChanges.tsx'; s=p.read_text()
s=s.replace('node.changeSummary ?? summaries[node.change ?? "unknown"]', 'node.changeSummary ?? (node.change ? summaries[node.change] : "Resource change was not supplied.")')
p.write_text(s)
p=root/'DependencyGraph.test.tsx'; s=p.read_text()
s=s.replace('name: "B, Change unknown"', 'name: "B"').replace('name: "A, Change unknown, Storage"', 'name: "A, Storage"')
s=s.replace('screen.getByText("Resource change is unknown.")', 'screen.getByText("Resource change was not supplied.")')
p.write_text(s)
p=root/'DependencyGraph.realWorld.test.tsx'; s=p.read_text()
s=s.replace('screen.getByRole("status")', 'within(screen.getByRole("region", { name: "Resource search results" })).getByRole("status")')
p.write_text(s)
p=root/'DependencyGraph.mdx'; s=p.read_text()
s=s.replace('Missing change metadata is displayed as unknown.', 'Missing resource change metadata is not supplied and renders no card badge; explicitly unknown resource operations retain a labeled marker.')
p.write_text(s)
p=Path('scripts/check-dependency-graph.mjs'); s=p.read_text()
s=s.replace('sameRow: Math.abs((l.top + l.bottom - s.top - s.bottom) / 2) < 1,', 'identityFirst: s.top >= l.bottom - 1,')
s=s.replace('card.sameRow &&', 'card.identityFirst &&')
s=s.replace('Dense cards preserve single-row identity/status, readable values and usable targets', 'Dense cards prioritize identity above status while preserving readable values and usable targets')
if 'await import("./check-dependency-graph-source.mjs")' not in s: s+='\nawait import("./check-dependency-graph-source.mjs");\n'
p.write_text(s)
