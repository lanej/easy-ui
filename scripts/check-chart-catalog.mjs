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
        if (name === "WaterfallChart" && width === 720) {
          const color = await page
            .locator("#storybook-root")
            .evaluate((element) =>
              getComputedStyle(element)
                .getPropertyValue("--ezui-color-warning-700")
                .trim(),
            );
          await page
            .locator(`svg path[fill=${JSON.stringify(color)}]`)
            .first()
            .hover();
          await page.getByText("Delivery: $-9,000", { exact: true }).waitFor();
          await page.getByText("Balance: $15,000", { exact: true }).waitFor();
          await page.mouse.move(0, 0);
          await page.getByText("Delivery: $-9,000", { exact: true }).waitFor({
            state: "hidden",
          });
        }
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
        let violations;
        // Storybook's accessibility addon shares axe with the browser audit.
        // Wait for its pending run before starting our scoped checks.
        for (let attempt = 0; attempt < 40; attempt++) {
          try {
            violations = await page.evaluate(async () =>
              (
                await axe.run(document.querySelector("#storybook-root"), {
                  runOnly: {
                    type: "tag",
                    values: ["wcag2a", "wcag2aa", "wcag21aa"],
                  },
                })
              ).violations.map((item) => ({
                id: item.id,
                impact: item.impact,
              })),
            );
            break;
          } catch (error) {
            if (!String(error).includes("already running") || attempt === 39)
              throw error;
            await page.waitForTimeout(50);
          }
        }
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
    "components-linechart--minimal",
    "components-intervalchart--zoomed-span",
    "components-predictionbandchart--zoomed-span",
    "components-waterfallchart--styled-axis",
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
    const svg = page.locator("#storybook-root [role=img] svg").first();
    if (id === "components-intervalchart--zoomed-span") {
      assert.ok(
        (await svg
          .locator('g[clip-path] > path[fill]:not([fill="none"])')
          .count()) > 0,
      );
      await svg.getByText("Lane A", { exact: true }).waitFor();
    }
    if (id === "components-predictionbandchart--zoomed-span")
      assert.ok((await svg.locator('path[fill-opacity="0.18"]').count()) > 0);
    if (id === "components-waterfallchart--styled-axis")
      await svg.getByText("Net", { exact: true }).waitFor();
    if (
      id.includes("zoomed-span") ||
      id.endsWith("styled-axis") ||
      id.endsWith("minimal")
    )
      await svg.screenshot({ path: `${output}/${id}.png` });
    checks.push({ story: id });
  }
  for (const width of [390, 720]) {
    const story = "components-linechart--responsive-base-option";
    await page.setViewportSize({ width, height: 900 });
    await page.goto(
      `${baseUrl}/iframe.html?id=${story}&viewMode=story&globals=colorScheme:light`,
    );
    const svg = page.locator("#storybook-root [role=img] svg").first();
    await svg.waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.ok(
      (await svg.locator('path[stroke-width="2"][fill="none"]').count()) >= 3,
      "baseOption retains observed line geometry",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "responsive baseOption: page overflow",
    );
    await page
      .locator("#storybook-root")
      .screenshot({ path: `${output}/${story}-${width}.png` });
    checks.push({ story, width });
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
