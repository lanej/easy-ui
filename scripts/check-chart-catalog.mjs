import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const baseUrl = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9013";
const output = resolve(
  process.env.CHART_CATALOG_REPORT_DIR ?? "/tmp/easy-ui-chart-catalog",
);
const names = [
  "LineChart",
  "AreaChart",
  "BarChart",
  "StackedBarChart",
  "ScatterChart",
  "BubbleChart",
  "SankeyChart",
  "HeatmapChart",
  "DonutChart",
  "TreemapChart",
  "GraphChart",
  "BoxPlotChart",
  "HistogramChart",
  "CumulativeDistributionChart",
  "IntervalChart",
  "PredictionBandChart",
  "WaterfallChart",
];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const page = await browser.newPage({
  viewport: { width: 720, height: 900 },
  deviceScaleFactor: 1,
});
const errors = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  const response = await page.request.get(`${baseUrl}/index.json`);
  const { entries } = await response.json();
  for (const name of names) {
    const prefix = `components-${name.toLowerCase()}`;
    for (const story of [
      "docs",
      "default",
      "narrow-layout",
      "bare",
      "loading",
      "empty",
    ])
      assert.ok(
        entries[`${prefix}--${story}`],
        `${name}: independent ${story} entry`,
      );
    for (const scheme of ["light", "dark"]) {
      for (const width of [720, 360]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(
          `${baseUrl}/iframe.html?id=${prefix}--default&viewMode=story&globals=colorScheme:${scheme}`,
        );
        await page.locator("#storybook-root [role=img] svg").waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator(".sb-errordisplay").isVisible(), false);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${name} ${scheme} ${width}: page overflow`,
        );
        assert.equal(
          await page
            .locator("svg")
            .evaluateAll((svgs) =>
              svgs.some((svg) => /NaN|Infinity/.test(svg.innerHTML)),
            ),
          false,
          `${name}: finite geometry`,
        );
        const tableButton = page
          .locator("#storybook-root summary")
          .filter({ hasText: "View data table" });
        assert.equal(
          await tableButton.count(),
          1,
          `${name}: exact data disclosure`,
        );
        await tableButton.focus();
        await page.keyboard.press("Enter");
        await page.getByRole("table").waitFor({ state: "visible" });
        assert.ok(
          (await page.getByRole("table").getByRole("row").count()) > 1,
          `${name}: exact records`,
        );
        await page.keyboard.press("Enter");
        await page.getByRole("table").waitFor({ state: "hidden" });
        await tableButton.evaluate((element) => element.blur());
        if (width === 720) await page.waitForTimeout(250);
        if (width === 720)
          await page
            .locator("#storybook-root")
            .screenshot({ path: `${output}/${name}-${scheme}.png` });
        await page.addScriptTag({
          path: require.resolve("axe-core/axe.min.js"),
        });
        const violations = await page.evaluate(async () =>
          (
            await axe.run(document.querySelector("#storybook-root"), {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21aa"],
              },
            })
          ).violations.map((item) => ({ id: item.id, impact: item.impact })),
        );
        assert.deepEqual(
          violations,
          [],
          `${name} ${scheme} ${width}: accessibility`,
        );
        checks.push({ name, scheme, width });
      }
    }
  }
  for (const id of [
    "components-intervalchart--missing-endpoints",
    "components-predictionbandchart--negative-bounds",
    "components-predictionbandchart--missing-bounds",
    "components-waterfallchart--crossing-zero",
  ]) {
    await page.goto(`${baseUrl}/iframe.html?id=${id}&viewMode=story`);
    const empty = id.endsWith("missing-endpoints");
    await page
      .locator(
        empty ? "#storybook-root summary" : "#storybook-root [role=img] svg",
      )
      .first()
      .waitFor();
    assert.equal(await page.locator(".sb-errordisplay").isVisible(), false);
    checks.push({ story: id });
  }
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(`${baseUrl}/?path=/docs/components-linechart--docs`);
  const docs = page.frameLocator("#storybook-preview-iframe");
  await docs
    .locator("table")
    .filter({ has: docs.getByText("series", { exact: true }) })
    .first()
    .waitFor();
  checks.push({ docs: "LineChart API table" });
  assert.deepEqual(errors, []);
  console.log(`${checks.length} chart catalog browser checks passed.`);
} finally {
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}
