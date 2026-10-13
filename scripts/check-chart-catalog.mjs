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
      "without-data-table",
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
          // Leave the plot for a real DOM target. The viewport corner can be
          // outside Chromium's hit-tested content and miss the mouseout event.
          await page
            .locator("#storybook-root")
            .getByRole("heading")
            .first()
            .hover();
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
                await window.axe.run(
                  document.querySelector("#storybook-root"),
                  {
                    runOnly: {
                      type: "tag",
                      values: ["wcag2a", "wcag2aa", "wcag21aa"],
                    },
                  },
                )
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
    await page.goto(
      `${baseUrl}/iframe.html?id=${prefix}--without-data-table&viewMode=story&globals=colorScheme:dark`,
    );
    await page
      .locator('#storybook-root [data-chart-state="ready"] svg')
      .waitFor();
    assert.equal(
      await page.locator("#storybook-root summary").count(),
      0,
      `${name}: shared table opt-out`,
    );
    checks.push({ name, story: "without-data-table" });
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
  for (const name of [
    "GraphChart",
    "SankeyChart",
    "TreemapChart",
    "BoxPlotChart",
    "PredictionBandChart",
    "WaterfallChart",
  ]) {
    const pattern = ["PredictionBandChart", "WaterfallChart"].includes(name);
    const story = `components-${name.toLowerCase()}--${pattern ? "custom-palette" : "theme-defaults"}`;
    assert.ok(entries[story], `${name}: automatic color example`);
    for (const scheme of ["light", "dark"]) {
      for (const width of [720, 360]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(
          `${baseUrl}/iframe.html?id=${story}&viewMode=story&globals=colorScheme:${scheme}`,
        );
        const svg = page.locator("#storybook-root [role=img] svg").first();
        await svg.waitFor();
        const tokens = await page
          .locator("#storybook-root")
          .evaluate((element) => {
            const css = getComputedStyle(element);
            return Object.fromEntries(
              [
                "neutral-000",
                "neutral-800",
                "neutral-600",
                "primary-600",
                "secondary-600",
                "positive-700",
              ].map((name) => [
                name,
                css.getPropertyValue(`--ezui-color-${name}`).trim(),
              ]),
            );
          });
        const colored = (selector, color) =>
          svg.locator(`${selector}[${color}]`);
        const hasColor = async (selector, attribute, color) => {
          assert.ok(color, `${story}: resolved theme token`);
          assert.ok(
            (await colored(
              selector,
              `${attribute}=${JSON.stringify(color)}`,
            ).count()) > 0,
            `${story} ${scheme} ${width}: ${attribute} ${color}`,
          );
        };
        if (name === "GraphChart" || name === "SankeyChart")
          await hasColor("text", "fill", tokens["neutral-800"]);
        if (name === "GraphChart")
          await hasColor("path", "stroke", tokens["neutral-600"]);
        if (name === "TreemapChart") {
          await hasColor("text", "fill", tokens["neutral-000"]);
          assert.equal(
            await svg.getByText("East", { exact: true }).getAttribute("fill"),
            tokens["neutral-800"],
            `${story}: group headings contrast with their neutral background`,
          );
        }
        if (name === "BoxPlotChart") {
          await hasColor("path", "stroke", tokens["primary-600"]);
          assert.ok(
            await svg
              .locator(`path[stroke=${JSON.stringify(tokens["primary-600"])}]`)
              .evaluateAll((paths) =>
                paths.every((path) => path.getAttribute("fill") === "none"),
              ),
            `${story}: transparent interiors preserve the themed background`,
          );
        }
        if (name === "PredictionBandChart") {
          const predicted =
            tokens[width < 600 ? "secondary-600" : "primary-600"];
          await hasColor('path[fill-opacity="0.18"]', "fill", predicted);
          await hasColor("path", "stroke", predicted);
        }
        if (name === "WaterfallChart")
          for (const token of ["primary-600", "secondary-600", "positive-700"])
            await hasColor("path", "fill", tokens[token]);
        assert.equal(await page.locator(".sb-errordisplay").isVisible(), false);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${story} ${scheme} ${width}: page overflow`,
        );
        checks.push({ story, scheme, width });
      }
    }
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
  // The same docs theme provider hosts standalone MDX galleries. Exercise
  // system preferences as well as explicit overrides, rather than only charts.
  for (const { scheme, system, resolved } of [
    { scheme: "light", system: "dark", resolved: "light" },
    { scheme: "dark", system: "light", resolved: "dark" },
    { scheme: "system", system: "light", resolved: "light" },
    { scheme: "system", system: "dark", resolved: "dark" },
  ]) {
    const context = await browser.newContext({ colorScheme: system });
    await context.addInitScript((scheme) => {
      localStorage.setItem("easy-ui-storybook-color-scheme", scheme);
    }, scheme);
    const docsPage = await context.newPage();
    docsPage.on("pageerror", (error) => errors.push(error.message));
    try {
      for (const width of [1440, 390]) {
        await docsPage.setViewportSize({ width, height: 900 });
        for (const [name, searchLabel, buttonName, minimum] of [
          ["Colors", "Filter colors", /^Copy #/, 50],
          ["Icons", "Filter icons", /^Copy import/, 100],
        ]) {
          await docsPage.goto(
            `${baseUrl}/?path=/docs/foundations-${name.toLowerCase()}--docs&globals=colorScheme:${scheme}`,
          );
          const frame = docsPage.frameLocator("#storybook-preview-iframe");
          const search = frame.getByRole("searchbox", { name: searchLabel });
          await search.waitFor();
          assert.equal(
            await frame.locator(".sb-errordisplay").isVisible(),
            false,
          );
          assert.ok(
            (await frame.getByRole("button", { name: buttonName }).count()) >
              minimum,
            `${name}: the gallery renders inside the shared docs provider`,
          );
          const background = (scheme) =>
            scheme === "dark" ? "rgb(19, 27, 42)" : "rgb(255, 255, 255)";
          const iframe = await (
            await docsPage.locator("#storybook-preview-iframe").elementHandle()
          ).contentFrame();
          const checkTheme = async (expected) => {
            await iframe.waitForFunction(
              (expected) =>
                getComputedStyle(document.querySelector(".sbdocs-wrapper"))
                  .backgroundColor === expected,
              background(expected),
            );
            assert.equal(
              await search.evaluate((element) =>
                getComputedStyle(element)
                  .getPropertyValue("--ezui-color-neutral-000")
                  .trim()
                  .toLowerCase(),
              ),
              expected === "dark" ? "#131b2a" : "#ffffff",
              `${name}: gallery theme matches the docs theme`,
            );
          };
          await checkTheme(resolved);
          const overflow = await iframe.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          );
          assert.equal(
            overflow,
            false,
            `${name} ${scheme} ${width}: page overflow`,
          );
          await docsPage.screenshot({
            path: `${output}/${name}-${scheme}-${system}-${width}.png`,
          });
          checks.push({ docs: name, scheme, system, width });
          if (scheme === "system") {
            const changed = system === "dark" ? "light" : "dark";
            await docsPage.emulateMedia({ colorScheme: changed });
            await checkTheme(changed);
            checks.push({
              docs: name,
              scheme,
              system: changed,
              width,
              preferenceChange: true,
            });
            await docsPage.emulateMedia({ colorScheme: system });
          }
        }
      }
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log(`${checks.length} chart catalog browser checks passed.`);
} finally {
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}
