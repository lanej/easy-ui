import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = (process.env.STORYBOOK_URL ?? "http://127.0.0.1:9018").replace(
  /\/$/,
  "",
);
const output = resolve(
  process.env.STORYBOOK_DOCS_REPORT_DIR ?? "/tmp/easy-ui-docs-review",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.message));

async function open(id, scheme = "dark", width = 1440) {
  await page.setViewportSize({ width, height: 1000 });
  // Explicit docs globals must win even when the operating system disagrees.
  await page.emulateMedia({
    colorScheme: scheme === "light" ? "dark" : "light",
  });
  await page.goto(
    `${base}/iframe.html?id=${id}&viewMode=docs&globals=colorScheme:${scheme}`,
  );
  await page.locator(".sbdocs-content").waitFor();
  await page.locator(".sbdocs-content h1").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    await page.locator(".sb-errordisplay").isVisible(),
    false,
    `${id}: renders; ${errors.join("; ")}`,
  );
  const background = await page
    .locator(".sbdocs-wrapper")
    .evaluate((element) =>
      getComputedStyle(element)
        .backgroundColor.match(/\d+/g)
        .slice(0, 3)
        .map(Number),
    );
  const luminance = background.reduce((sum, value) => sum + value, 0) / 3;
  assert.ok(
    scheme === "dark" ? luminance < 80 : luminance > 200,
    `${id}: explicit ${scheme} docs theme`,
  );
}

try {
  const response = await page.request.get(`${base}/index.json`);
  assert.equal(response.status(), 200);
  const { entries } = await response.json();
  for (const entry of Object.values(entries)) {
    assert.ok(
      !/^(Recipes|Patterns)\//.test(entry.title),
      `${entry.id}: component catalog boundary`,
    );
    assert.ok(
      !/Pricing Review|Encoding Comparisons|Data visualization/.test(
        entry.title,
      ),
      `${entry.id}: canonical navigation`,
    );
  }
  assert.ok(
    !Object.values(entries).some((entry) => /KpiTile/.test(entry.title)),
    "removed KpiTile stays out of the catalog",
  );
  for (const [id, title] of [
    [
      "molecules-data-visualization-durationdistribution--docs",
      "Molecules/Data Display/DurationDistribution",
    ],
    ["components-metriccard--docs", "Molecules/Data Display/MetricCard"],
    ["components-proportionbar--docs", "Molecules/Data Display/ProportionBar"],
  ])
    assert.equal(
      entries[id]?.title,
      title,
      `${id}: moved entry retains its URL`,
    );
  checks.push("workflow exclusions and stable navigation IDs");

  // All authored public component pages have the same discoverable sections.
  for (const entry of Object.values(entries)) {
    if (entry.type !== "docs" || !entry.importPath?.endsWith(".mdx")) continue;
    if (
      entry.title.startsWith("Foundations/") &&
      entry.title !== "Foundations/Theme"
    )
      continue;
    const source = await readFile(resolve(entry.importPath), "utf8");
    if (
      !/<Meta of=/.test(source) ||
      entry.importPath.endsWith("Chart.logistics.mdx")
    )
      continue;
    const headings = [...source.matchAll(/^## (Usage|Props|Examples)$/gm)].map(
      (m) => m[1],
    );
    assert.deepEqual(
      headings,
      ["Usage", "Props", "Examples"],
      `${entry.id}: documentation sections`,
    );
    assert.match(
      source,
      /import \{ \w+ \} from "@easypost\/easy-ui\/\w+";/,
      `${entry.id}: public import`,
    );
    const [, symbol, module] = source.match(
      /import \{ (\w+) \} from "(@easypost\/easy-ui\/\w+)";/,
    );
    assert.ok((await import(module))[symbol], `${entry.id}: import resolves`);
    assert.doesNotMatch(
      source,
      /\bArgsTable\b/,
      `${entry.id}: current docs blocks`,
    );
    checks.push(`${entry.id}: documentation contract`);
  }

  const tables = [
    "organisms-charts-choosing-a-chart--docs",
    "molecules-data-visualization-durationdistribution--docs",
    "organisms-facilities-facilitysummary--docs",
    "components-datagrid--docs",
    "organisms-feedback-healthassessment--docs",
    "components-productlayout-forgelayout--docs",
  ];
  for (const id of tables) {
    for (const scheme of ["light", "dark"]) {
      for (const width of [1440, 390]) {
        await open(id, scheme, width);
        const raw = await page
          .locator(".sbdocs-content p")
          .evaluateAll((els) =>
            els.some((el) => /^\|/.test(el.textContent.trim())),
          );
        assert.equal(raw, false, `${id}: semantic Markdown tables`);
        const table = page
          .locator(".easy-ui-docs-table:not(.easy-ui-docs-table--api)")
          .first();
        await table.waitFor();
        await table.locator("thead th").first().waitFor();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${id} ${width}: local overflow only`,
        );
        assert.ok(
          await table.locator("tbody tr").count(),
          `${id}: table records`,
        );
        if (width === 390) {
          await table.getByRole("table").evaluate((el) => el.scrollIntoView());
          assert.equal(
            await table.getAttribute("tabindex"),
            "0",
            `${id}: keyboard scroll target`,
          );
          await table.focus();
          await page.keyboard.press("ArrowRight");
          await page.waitForFunction(
            () => document.activeElement.scrollLeft > 0,
          );
        }
        if (id === tables[0]) {
          await page.addScriptTag({
            path: require.resolve("axe-core/axe.min.js"),
          });
          const violations = await table.evaluate(async (element) =>
            (
              await window.axe.run(element, {
                runOnly: { type: "rule", values: ["color-contrast"] },
              })
            ).violations.map((item) => item.id),
          );
          assert.deepEqual(violations, [], `${scheme} catalog link contrast`);
          const links = await table
            .locator("tbody a")
            .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
          assert.equal(links.length, 17);
          for (const href of links) {
            const id = new URL(href, `${base}/`).searchParams
              .get("path")
              .replace("/docs/", "");
            assert.ok(entries[id], `catalog link ${id}`);
          }
          await table.evaluate((el) => {
            el.scrollLeft = 0;
          });
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: `${output}/chart-catalog-${width}-${scheme}.webp`,
          });
        }
        checks.push(`${id}: ${scheme} ${width} table rendering and scrolling`);
      }
    }
  }

  for (const id of [
    "components-textfield--docs",
    "components-cards-checkablecard--docs",
    "components-networkmap--docs",
    "components-notification--docs",
    "components-pillgroup--docs",
    "components-drawerrow--docs",
    "atoms-feedback-pill--docs",
    "atoms-actions-pillbutton--docs",
    "organisms-navigation-workspaceheader--docs",
  ]) {
    await open(id);
    const headings = await page.locator(".sbdocs-content h2").allTextContents();
    for (const heading of ["Usage", "Props", "Examples"])
      assert.equal(
        headings.filter((text) => text.trim() === heading).length,
        1,
        `${id}: ${heading}`,
      );
    if (id === "components-networkmap--docs")
      await page
        .locator(".docblock-argstable td:first-child")
        .getByText("workerUrl", { exact: true })
        .waitFor();
    checks.push(`${id}: live component documentation`);
  }

  await open("getting-started--docs");
  const hrefs = await page
    .locator(".sbdocs-content a")
    .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
  assert.ok(
    hrefs.some((href) => href.includes("organisms-charts-choosing-a-chart")),
  );
  assert.ok(
    hrefs.includes(
      "https://github.com/lanej/easy-ui/blob/main/easy-ui-react/skills/easy-ui/SKILL.md",
    ),
  );
  assert.ok(
    hrefs.includes(
      "https://github.com/lanej/easy-ui/blob/main/easy-ui-react/skills/easy-ui/references/components.md",
    ),
  );
  assert.ok(
    !hrefs.some(
      (href) => href.includes("chromatic.com") || href.startsWith("skills/"),
    ),
  );
  checks.push(
    "Getting Started links use this catalog and real source documents",
  );
  assert.deepEqual(errors, [], "no docs browser errors");
  await writeFile(`${output}/report.json`, JSON.stringify({ checks }, null, 2));
  console.log(`${checks.length} Storybook documentation checks passed`);
} finally {
  await browser.close();
}
