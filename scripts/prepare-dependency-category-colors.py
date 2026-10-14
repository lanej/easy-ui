from pathlib import Path
import subprocess

root = Path('easy-ui-react/src/DependencyGraph')

def replace(path, old, new, count=1):
    text = path.read_text()
    assert text.count(old) == count, f'{path}: expected {count} copies of {old!r}'
    path.write_text(text.replace(old, new))

for name, sha in {
    'types.ts': '6de741cd0f3f9093fcd887ff4d0435603ceeebcb',
    'DependencyGraphCategories.tsx': '2bd3a15c2bb0deb1c102c3e2e19fbec45f59d526',
    'DependencyGraphIdentity.tsx': '88bd1fdcd7ddbe2e52bdd17bee659c53012aee83',
    'DependencyGraph.tsx': 'bc1163ab4ac5c746fac78dae63bd29f8fb1ed91a',
}.items():
    actual = subprocess.check_output(['git', 'hash-object', str(root / name)], text=True).strip()
    assert actual == sha, f'Concurrent source change: {name}'

replace(root / 'types.ts', 'import type { ReactNode } from "react";', 'import type { ReactNode } from "react";\nimport type { BadgeVariant } from "../Badge/Badge";')
replace(root / 'types.ts', 'export type DependencyGraphNode = {', '''/** A label with an optional caller-selected theme variant. Strings remain neutral. */
export type DependencyGraphCategory =
  | string
  | {
      readonly label: string;
      readonly variant?: "neutral" | BadgeVariant;
    };

export type DependencyGraphNode = {''')
replace(root / 'types.ts', '/** Caller-owned categorical metadata, rendered as neutral pills. Never interpreted as plan actions or risk. */\n  categories?: readonly string[];', '/** Caller-owned category labels and optional theme variants. Never interpreted as plan actions or risk. */\n  categories?: readonly DependencyGraphCategory[];')

(root / 'DependencyGraphCategories.tsx').write_text('''import React from "react";
import type { DependencyGraphNode } from "./types";
import styles from "./DependencyGraph.module.scss";
import categoryStyles from "./DependencyGraphCategories.module.scss";

/** Only labels participate in search and accessible names, never presentation. */
export function dependencyGraphCategoryLabels(
  categories: DependencyGraphNode["categories"],
): string[] {
  return (categories ?? [])
    .map((category) =>
      typeof category === "string" ? category : category.label,
    )
    .filter((label) => label.trim().length > 0);
}

/** Caller-owned labels and colors; neither implies a plan action or risk. */
export function DependencyGraphCategories({
  categories,
}: Pick<DependencyGraphNode, "categories">) {
  return (
    <>
      {categories?.map((category, index) => {
        const label =
          typeof category === "string" ? category : category.label;
        if (!label.trim()) return null;
        const variant =
          typeof category === "string"
            ? "neutral"
            : (category.variant ?? "neutral");
        return (
          <span
            key={`${index}:${label}`}
            className={`${styles.category} ${categoryStyles.root}`}
            data-graph-category
            data-category-variant={variant}
            title={label}
          >
            {label}
          </span>
        );
      })}
    </>
  );
}
''')
(root / 'DependencyGraphCategories.module.scss').write_text('''@use "../styles/common" as *;

// Keep the graph's compact pill geometry and neutral default. Use the shared
// theme palette for caller-selected variants, not arbitrary CSS colors.
.root {
  &[data-category-variant="primary"] {
    background: design-token("color.primary.100");
    color: design-token("color.primary.800");
  }
  &[data-category-variant="secondary"] {
    background: design-token("color.secondary.100");
    color: design-token("color.primary.800");
  }
  &[data-category-variant="success"] {
    background: design-token("color.positive.100");
    color: design-token("color.positive.800");
  }
  &[data-category-variant="warning"] {
    background: design-token("color.warning.100");
    color: design-token("color.warning.800");
  }
  &[data-category-variant="danger"] {
    background: design-token("color.negative.100");
    color: design-token("color.negative.800");
  }
  &[data-category-variant="gray"] {
    background: design-token("color.neutral.200");
    color: design-token("color.neutral.800");
  }
  &[data-category-variant="black"] {
    background: design-token("color.neutral.800");
    color: design-token("color.neutral.000");
  }
  &[data-category-variant="inverse"] {
    background: design-token("color.neutral.100");
    color: design-token("color.neutral.900");
  }
}
''')
replace(root / 'DependencyGraphIdentity.tsx', 'import { DependencyGraphCategories } from "./DependencyGraphCategories";', 'import {\n  DependencyGraphCategories,\n  dependencyGraphCategoryLabels,\n} from "./DependencyGraphCategories";')
replace(root / 'DependencyGraphIdentity.tsx', 'node.categories?.some((label) => label.trim())', 'dependencyGraphCategoryLabels(node.categories).length > 0')
replace(root / 'DependencyGraph.tsx', 'import { DependencyGraphIdentity } from "./DependencyGraphIdentity";', 'import { DependencyGraphIdentity } from "./DependencyGraphIdentity";\nimport { dependencyGraphCategoryLabels } from "./DependencyGraphCategories";')
replace(root / 'DependencyGraph.tsx', '(node.categories ?? []).join(" ")', 'dependencyGraphCategoryLabels(node.categories).join(" ")')
replace(root / 'DependencyGraph.tsx', '...(node.categories ?? []),', '...dependencyGraphCategoryLabels(node.categories),')

(root / 'DependencyGraph.categoryColors.test.tsx').write_text('''import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { DependencyGraph } from "./DependencyGraph";
import { DependencyGraphIdentity } from "./DependencyGraphIdentity";
import { dependencyGraphCategoryLabels } from "./DependencyGraphCategories";
import type { DependencyGraphNode } from "./types";

const colored: DependencyGraphNode = {
  id: "source",
  label: "Source edit",
  categories: [
    "Source unchanged",
    { label: "Source modified", variant: "primary" },
    { label: "Review requested", variant: "warning" },
    { label: "No variant supplied" },
  ],
};

describe("caller-selected category colors", () => {
  it("keeps strings and omitted variants neutral without inferring a plan", () => {
    const { container } = render(
      <DependencyGraphIdentity node={colored} overview={false} />,
    );
    expect(screen.getByText("Source unchanged")).toHaveAttribute(
      "data-category-variant", "neutral",
    );
    expect(screen.getByText("No variant supplied")).toHaveAttribute(
      "data-category-variant", "neutral",
    );
    expect(screen.getByText("Source modified")).toHaveAttribute(
      "data-category-variant", "primary",
    );
    expect(screen.getByText("Review requested")).toHaveAttribute(
      "data-category-variant", "warning",
    );
    expect(container.querySelector("[data-change]")).toBeNull();
  });

  it("uses object labels for search and accessibility and preserves color in details", () => {
    render(<DependencyGraph nodes={[colored]} edges={[]} />);
    const select = screen.getByRole("button", {
      name: "Source edit, Source unchanged, Source modified, Review requested, No variant supplied",
    });
    const search = screen.getByRole("searchbox", { name: "Find resource" });
    fireEvent.change(search, { target: { value: "Source modified" } });
    const results = screen.getByRole("region", { name: "Resource search results" });
    expect(within(results).getByRole("status")).toHaveTextContent("1 matching resources");
    fireEvent.change(search, { target: { value: "primary" } });
    expect(within(results).getByRole("status")).toHaveTextContent("0 matching resources");
    fireEvent.change(search, { target: { value: "" } });
    fireEvent.click(select);
    const details = screen.getByRole("complementary");
    expect(within(details).getByText("Source modified")).toHaveAttribute(
      "data-category-variant", "primary",
    );
    expect(within(details).getByText("Change not supplied")).toBeVisible();
    expect(select).not.toHaveAccessibleName(/object Object|primary|warning/);
  });

  it("omits empty object labels and preserves the category label in the overview", () => {
    const categories = ["", { label: "  ", variant: "danger" }, { label: "Owner", variant: "secondary" }] as const;
    expect(dependencyGraphCategoryLabels(categories)).toEqual(["Owner"]);
    expect(dependencyGraphCategoryLabels(undefined)).toEqual([]);
    const { container } = render(
      <DependencyGraphIdentity node={{ id: "owner", label: "Service", categories }} overview />,
    );
    expect(container.querySelectorAll("[data-graph-category]")).toHaveLength(1);
    expect(screen.getByText("Owner")).toHaveAttribute("data-category-variant", "secondary");
    expect(screen.getByText("Owner")).toHaveAttribute("title", "Owner");
  });

  it("applies color updates without changing labels or the caller's plan state", () => {
    const { rerender } = render(
      <DependencyGraphIdentity node={{ id: "same", label: "Service", change: "unchanged", categories: ["Owner"] }} overview={false} />,
    );
    rerender(
      <DependencyGraphIdentity node={{ id: "same", label: "Service", change: "unchanged", categories: [{ label: "Owner", variant: "success" }] }} overview={false} />,
    );
    expect(screen.getByText("Owner")).toHaveAttribute("data-category-variant", "success");
    expect(screen.getByRole("img", { name: "Unchanged" })).toHaveTextContent("Unchanged");
  });
});
''')

with (root / 'DependencyGraph.stories.tsx').open('a') as f:
    f.write('''
/** The application chooses these colors; the graph does not interpret labels. */
export const CategoryColors: Story = {
  ...SourceOnlyEvidence,
  args: {
    ...SourceOnlyEvidence.args,
    nodes: realWorldNodes.map((node) => ({
      ...node,
      categories: node.categories?.map((category) =>
        category === "Source modified"
          ? { label: category, variant: "primary" as const }
          : category,
      ),
    })),
    showDetails: true,
    defaultSelection: { type: "node", id: "google_sql_user.pipeline" },
  },
  parameters: {
    docs: { description: { story: "Caller-selected blue for Source modified; strings such as Source unchanged remain neutral. Colors are repeated in the inspector and do not imply plan actions or risk." } },
  },
};

export const CategoryPalette: Story = {
  args: {
    title: undefined,
    nodes: [{
      id: "palette",
      label: "Caller-selected categories",
      categories: [
        "Neutral",
        { label: "Primary", variant: "primary" },
        { label: "Secondary", variant: "secondary" },
        { label: "Success", variant: "success" },
        { label: "Warning", variant: "warning" },
        { label: "Danger", variant: "danger" },
        { label: "Gray", variant: "gray" },
        { label: "Black", variant: "black" },
        { label: "Inverse", variant: "inverse" },
      ],
    }],
    edges: [],
    groups: [],
    defaultSelection: { type: "node", id: "palette" },
    height: 280,
  },
};
''')
replace(root / 'DependencyGraph.mdx', 'caller-owned categorical metadata. Categories use neutral pills below the resource\nidentity, remain searchable and accessible, and appear in selection details.', 'caller-owned categorical metadata. Strings remain neutral. Supply an object such as\n`{ label: "Source modified", variant: "primary" }` to choose a theme-aware color.\nCategories stay below the resource identity, remain searchable and accessible by\nlabel, and appear with the same color in selection details.')
with (root / 'DependencyGraph.mdx').open('a') as f:
    f.write('''
### Caller-selected category colors

```tsx
categories: [
  "Source unchanged", // Neutral; existing string categories remain supported.
  { label: "Source modified", variant: "primary" },
  { label: "Review requested", variant: "warning" },
]
```

Object categories accept `neutral` and the shared Badge variants: `primary`,
`secondary`, `success`, `warning`, `danger`, `gray`, `black`, and `inverse`.
Omitting `variant` remains neutral. Variants use the existing theme tokens;
arbitrary CSS colors are not accepted. The application chooses the meaning:
no label-to-color mapping, plan action, or risk assessment is inferred. Labels
remain visible at every zoom and are used for search and accessible names.

<Canvas of={Stories.CategoryColors} />
<Canvas of={Stories.CategoryPalette} />
''')

browser_checks = '''  for (const theme of ["light", "dark"])
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.goto(`${base}/iframe.html?id=components-dependencygraph--category-palette&viewMode=story&globals=colorScheme:${theme}`);
      await page.locator("[data-dependency-graph]").waitFor();
      await page.evaluate(() => document.fonts.ready);
      await settled();
      const card = page.locator('[data-graph-resource-card="palette"]');
      assert.equal(await card.locator("[data-graph-category]").count(), 9);
      assert.equal(await card.locator("[data-change]").count(), 0);
      await card.locator("[data-graph-node]").press("Enter");
      const palette = await card.locator("[data-graph-category]").evaluateAll((pills) => {
        const luminance = (css) => {
          const rgb = css.match(/[\\d.]+/g).slice(0, 3).map(Number).map((v) => {
            const s = v / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
          return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
        };
        return pills.map((pill) => {
          const style = getComputedStyle(pill);
          const fg = luminance(style.color);
          const bg = luminance(style.backgroundColor);
          const box = pill.getBoundingClientRect();
          const owner = pill.closest("[data-graph-resource-card]").getBoundingClientRect();
          return {
            label: pill.textContent,
            variant: pill.dataset.categoryVariant,
            foreground: style.color,
            background: style.backgroundColor,
            contrast: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05),
            inside: box.left >= owner.left && box.right <= owner.right + 1,
          };
        });
      });
      for (const pill of palette) {
        assert.ok(pill.inside, `${theme}/${width}/${pill.label}: card containment`);
        assert.ok(pill.contrast >= 4.5, `${theme}/${width}/${pill.label}: text contrast ${pill.contrast}`);
        const detail = page.locator(`[data-graph-details] [data-category-variant="${pill.variant}"]`);
        assert.equal(await detail.textContent(), pill.label);
        const colors = await detail.evaluate((element) => {
          const style = getComputedStyle(element);
          return [style.color, style.backgroundColor];
        });
        assert.deepEqual(colors, [pill.foreground, pill.background]);
      }
      const neutral = palette.find((pill) => pill.variant === "neutral");
      for (const variant of ["primary", "secondary", "success", "warning", "danger"])
        assert.notEqual(palette.find((pill) => pill.variant === variant).background, neutral.background, `${theme}: ${variant} must actually be colored`);
      checks.push({ name: `category-palette-${theme}-${width}`, palette });
      await page.goto(`${base}/iframe.html?id=components-dependencygraph--category-colors&viewMode=story&globals=colorScheme:${theme}`);
      await page.locator("[data-dependency-graph]").waitFor();
      await page.evaluate(() => document.fonts.ready);
      await settled();
      const modified = page.locator('[data-graph-resource-card="google_sql_user.pipeline"] [data-graph-category]');
      assert.equal(await modified.textContent(), "Source modified");
      assert.equal(await modified.getAttribute("data-category-variant"), "primary");
      assert.equal(await page.locator('[data-graph-resource-card] [data-change]').count(), 0);
      if (width !== 320)
        await page.locator("[data-dependency-graph]").screenshot({ path: resolve(output, `category-colors-${theme}-${width}.png`) });
      await page.getByRole("searchbox", { name: "Find resource" }).fill("Source modified");
      assert.equal(await page.getByRole("region", { name: "Resource search results" }).getByRole("status").textContent(), "1 matching resources");
      checks.push({ name: `category-colors-${theme}-${width}` });
    }
'''
replace(Path('scripts/check-dependency-graph-source.mjs'), '  assert.deepEqual(errors, []);', browser_checks + '  assert.deepEqual(errors, []);')
with Path('.changeset/readable-source-dependency-graphs.md').open('a') as f:
    f.write('\nCategory pills also accept caller-selected, theme-aware variants while preserving neutral string categories, search labels, and plan/risk separation.\n')
# These preparation files are not part of the final candidate tree.
Path('.github/workflows/dependency-category-preparation.yml').unlink()
Path(__file__).unlink()
