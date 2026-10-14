from pathlib import Path

root = Path('easy-ui-react/src/DependencyGraph')

def replace(path, old, new):
    text = path.read_text()
    if text.count(old) != 1:
        raise RuntimeError(f'{path}: expected one matching section, got {text.count(old)}')
    path.write_text(text.replace(old, new))

component = root / 'DependencyGraph.tsx'
replace(component, 'import { DependencyGraphIdentity } from "./DependencyGraphIdentity";', 'import { DependencyGraphIdentity } from "./DependencyGraphIdentity";\nimport { useDependencyGraphHeadings } from "./useDependencyGraphHeadings";')
replace(component, '  const rawConnections = useMemo(', '  const headingObstacles = useDependencyGraphHeadings(viewport, clusters, zoom, status);\n  const rawConnections = useMemo(')
replace(component, '''        clusters.map((cluster) => ({
          x: cluster.x,
          y: cluster.y,
          width: cluster.width,
          height: Math.max(36, 25 / zoom + 4),
        })),''', '''        headingObstacles,''')
replace(component, '[items, rawConnections, attributePorts, clusters, zoom]', '[items, rawConnections, attributePorts, headingObstacles, zoom]')
replace(component, '                    className={styles.canvas}', '                    className={styles.canvas}\n                    data-graph-scene')
replace(component, '                        <div className={styles.clusterHeading}>', '                        <div className={styles.clusterHeading} data-graph-group-heading={cluster.group.id}>')

css = root / 'DependencyGraph.module.scss'
replace(css, '@use "../styles/common" as *;', '@use "../styles/common" as *;\n\n.clusterHeading > button {\n  pointer-events: auto;\n}')
text = css.read_text()
start = text.index('.clusterHeading {')
end = text.index('\n.edges {', start)
heading = text[start:end]
needle = '  background: var(--dependency-graph-group-surface);'
assert heading.count(needle) == 1, 'Expected matching group heading surface'
heading = heading.replace(needle, '''  // Empty heading space is a routing corridor, not an opaque input overlay.
  background: transparent;
  pointer-events: none;''')
css.write_text(text[:start] + heading + text[end:])

docs = root / 'DependencyGraph.mdx'
replace(docs, 'Connections use rounded orthogonal lanes around cards and group headings.', 'Connections use rounded orthogonal lanes around cards and the measured group labels and disclosure controls. Empty space between a group label and its control remains a visible, selectable routing corridor; it is not treated as a wall across the subgraph. Label, font, zoom, and group-disclosure changes refresh those obstacles without moving the resource layout.')
checks = Path('scripts/check-dependency-graph.mjs')
replace(checks, 'await import("./check-dependency-graph-source.mjs");', 'await import("./check-dependency-graph-source.mjs");\nawait import("./check-dependency-graph-heading-routing.mjs");')
browser = Path('scripts/check-dependency-graph-heading-routing.mjs')
replace(browser, '      const before = data.positions;', '''      // A fully revealed card can leave its approach just outside a 320px
      // viewport. Pan to the edge itself before exercising its real hit target.
      await page.locator("[data-graph-canvas]").evaluate((element, point) => {
        const rect = element.getBoundingClientRect();
        element.scrollLeft += point.x - (rect.left + rect.width / 2);
        element.scrollTop += point.y - (rect.top + rect.height / 2);
      }, data.crossing);
      data = await geometry();
      const before = data.positions;''')
replace(browser, '} finally {\n  await writeFile', '''} catch (error) {
  errors.push(error.stack ?? String(error));
  await page.screenshot({ path: resolve(output, "failure.png"), fullPage: true });
  throw error;
} finally {
  await writeFile''')
changes = Path('.changeset/readable-source-dependency-graphs.md')
changes.write_text(changes.read_text().rstrip() + '\n\nRoute cross-group relationships through empty heading space while avoiding measured labels and controls, instead of sending short dependencies around an entire subgraph.\n')
