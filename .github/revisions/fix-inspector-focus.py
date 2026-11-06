from pathlib import Path

root = Path('easy-ui-react/src/InvestigationWorkspace')
p = root / 'InvestigationWorkbench.tsx'
s = p.read_text()
a = '<div className={styles.inspectorBody}>'
b = '''<div
            className={styles.inspectorBody}
            role="region"
            aria-label="Inspector content"
            tabIndex={0}
          >'''
assert s.count(a) == 1
p.write_text(s.replace(a, b))
p = root / 'InvestigationWorkbench.module.scss'
s = p.read_text()
a = '  :where(button:focus-visible, select:focus-visible, summary:focus-visible) {'
b = '''  :where(
    button:focus-visible,
    select:focus-visible,
    summary:focus-visible,
    [tabindex]:focus-visible
  ) {'''
assert s.count(a) == 1
p.write_text(s.replace(a, b))
p = root / 'InvestigationWorkbench.test.tsx'
s = p.read_text().rstrip()
s += '''

it("provides a named keyboard focus target for the scrollable inspector", () => {
  render(<InvestigationWorkbench {...props} />);
  const content = screen.getByRole("region", { name: "Inspector content" });
  expect(content).toHaveAttribute("tabindex", "0");
  content.focus();
  expect(content).toHaveFocus();
});
'''
p.write_text(s)
p = root / 'InvestigationWorkspace.mdx'
s = p.read_text()
assert '960 × 800' in s
p.write_text(s.replace('960 × 800', '960 × 820'))
