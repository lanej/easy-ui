import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { preview } from "vite";
import { chromium } from "playwright";

// Run in GitHub Actions alongside the original gallery check.
const server = await preview({
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
});
const browser = await chromium.launch();
const errors = [],
  results = [],
  timing = [];
const origin = "http://127.0.0.1:4173";
const manifest = JSON.parse(await readFile("dist/.vite/manifest.json", "utf8"));
const entry = (suffix) =>
  Object.values(manifest).find((value) => value.src?.endsWith(suffix))?.file;
const ready = async (page, renderer, count = 18) => {
  if (renderer !== "recharts")
    await page.waitForFunction(
      (count) =>
        document.querySelectorAll(
          '[data-engine="echarts"] [data-chart-state="ready"] svg',
        ).length === count,
      count,
    );
  if (renderer !== "echarts")
    await page.waitForFunction((count) => {
      const plots = [
        ...document.querySelectorAll('[data-engine="recharts"] .recharts-plot'),
      ];
      return (
        plots.length === count &&
        plots.every((plot) =>
          plot.querySelector("svg path, svg rect, .matrix-grid button"),
        )
      );
    }, count);
};
try {
  await mkdir("screenshots/comparison", { recursive: true });
  for (const [name, width] of [
    ["desktop", 1440],
    ["mobile", 390],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/comparison.html`, { waitUntil: "networkidle" });
    await ready(page, "both");
    await page.evaluate(() => document.fonts.ready);
    const pairs = page.locator("[data-comparison]");
    assert.equal(await pairs.count(), 18);
    for (const pair of await pairs.all()) {
      const kind = await pair.getAttribute("data-comparison");
      assert.equal(
        await pair.locator('[data-engine="echarts"] table').textContent(),
        await pair.locator('[data-engine="recharts"] table').textContent(),
        `${kind}: exact tables differ`,
      );
      for (const svg of await pair.locator("svg").all())
        assert.doesNotMatch(await svg.innerHTML(), /(?:NaN|Infinity)/, kind);
      await pair.screenshot({
        path: `screenshots/comparison/${kind}-${name}.png`,
        animations: "disabled",
      });
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `${name}: horizontal overflow`,
    );

    // One behavior check per specialized port, in addition to shared table parity.
    const trend = page.locator(
      '[data-comparison="time-series"] [data-engine="recharts"]',
    );
    assert.equal(await trend.locator(".recharts-line-curve").count(), 3);
    const path = await trend
      .locator(".recharts-line-curve")
      .first()
      .getAttribute("d");
    assert.equal(
      (path.match(/M/g) ?? []).length,
      2,
      "Missing observations must break the line",
    );
    await trend.getByRole("button", { name: /Carrier A/ }).click();
    assert.equal(await trend.locator(".recharts-line-curve").count(), 2);
    await trend.getByRole("button", { name: /Carrier A/ }).click();
    const zoomBefore = await trend
      .locator(".recharts-line-curve")
      .first()
      .getAttribute("d");
    await trend.getByRole("button", { name: "Zoom in", exact: true }).focus();
    await page.keyboard.press("Enter");
    assert.notEqual(
      await trend.locator(".recharts-line-curve").first().getAttribute("d"),
      zoomBefore,
    );
    await trend
      .getByRole("button", { name: "Reset zoom", exact: true })
      .click();
    const matrix = page.locator(
      '[data-comparison="periodic-heatmap"] [data-engine="recharts"]',
    );
    await matrix
      .getByRole("button", { name: "Sun, 00–04: Unavailable", exact: true })
      .focus();
    await matrix
      .getByRole("status")
      .getByText(/Parcels: 18/)
      .waitFor();
    const box = page.locator('[data-engine="recharts"] [data-box-summaries]');
    assert.equal(await box.locator("rect").count(), 3);
    const band = page.locator(
      '[data-comparison="prediction-band"] [data-engine="recharts"] .recharts-area-area',
    );
    assert.ok((await band.getAttribute("d")).length > 20);
    const waterfall = page.locator(
      '[data-comparison="waterfall"] [data-engine="recharts"]',
    );
    await waterfall.locator(".recharts-bar-rectangle").nth(1).hover();
    await waterfall.getByText("Delivery: $-9,000", { exact: true }).waitFor();
    await waterfall.getByText("Balance: $15,000", { exact: true }).waitFor();
    const scatter = page.locator(
      '[data-comparison="scatter"] [data-engine="recharts"]',
    );
    await scatter.locator(".recharts-scatter-symbol").first().click();
    await scatter
      .getByText("Selected cohort: a-ground", { exact: true })
      .waitFor();
    await scatter.getByText("View data table", { exact: true }).click();
    await scatter
      .getByRole("button", { name: "Select row: A · Two-day", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await scatter
      .getByText("Selected cohort: a-two", { exact: true })
      .waitFor();
    await page
      .getByLabel("Example", { exact: true })
      .selectOption("annotations");
    await ready(page, "both", 1);
    await page.getByLabel("Theme", { exact: true }).selectOption("dark");
    await ready(page, "both", 1);
    await page.locator('[data-comparison="annotations"]').screenshot({
      path: `screenshots/comparison/annotations-dark-${name}.png`,
      animations: "disabled",
    });
    for (const status of ["loading", "empty", "error"]) {
      await page.getByLabel("State", { exact: true }).selectOption(status);
      assert.equal(await page.locator(".recharts-plot").count(), 0);
      assert.equal(await page.locator("[data-chart-state]").count(), 0);
    }
    await page
      .locator('[data-engine="recharts"]')
      .getByRole("button", { name: "Retry" })
      .click();
    await ready(page, "both", 1);
    results.push({
      viewport: name,
      width,
      examples: 18,
      identicalTables: true,
      finiteMarks: true,
      overflow: false,
      missingGap: true,
      keyboardZoom: true,
      seriesFilter: true,
      suppressedCell: true,
      suppliedBoxes: true,
      predictionBand: true,
      signedWaterfallTooltip: true,
      scatterSelection: true,
      sharedStates: true,
    });
    await page.close();
  }

  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/comparison.html?chart=refresh`, {
    waitUntil: "networkidle",
  });
  const e = page.locator('[data-engine="echarts"]'),
    r = page.locator('[data-engine="recharts"]');
  const refreshCases = [];
  for (const responsive of [true, false]) {
    await page
      .getByLabel("Case", { exact: true })
      .selectOption(String(responsive));
    await e.locator('[data-chart-state="ready"]').waitFor();
    for (const plot of [e, r])
      await plot.getByRole("button", { name: "Zoom in", exact: true }).click();
    await e.getByRole("button", { name: "Read current window" }).click();
    await e
      .locator('output[data-echarts-window]:not([data-echarts-window=""])')
      .waitFor();
    const beforeSnapshot = await e
      .locator("output")
      .getAttribute("data-echarts-window");
    const before = JSON.parse(
      await e.locator("output").getAttribute("data-echarts-window"),
    );
    await page
      .getByRole("button", { name: "Append data", exact: true })
      .click();
    await e.getByRole("button", { name: "Read current window" }).click();
    await page.waitForFunction((before) => {
      const value = document
        .querySelector('[data-engine="echarts"] output')
        ?.getAttribute("data-echarts-window");
      return value && value !== before;
    }, beforeSnapshot);
    const after = JSON.parse(
      await e.locator("output").getAttribute("data-echarts-window"),
    );
    const expected = responsive ? "60,140" : "25,35";
    assert.equal(
      await r.locator("output").getAttribute("data-visible-domain"),
      expected,
    );
    assert.notDeepEqual(
      [after.start, after.end],
      [before.start, before.end],
      "Current ECharts regression should remain visible in this experiment",
    );
    refreshCases.push({
      responsive,
      echartsBefore: [before.start, before.end],
      echartsAfter: [after.start, after.end],
      rechartsDomain: expected,
    });
    await page.locator('[data-comparison="refresh"]').screenshot({
      path: `screenshots/comparison/refresh-${responsive ? "responsive" : "value"}.png`,
      animations: "disabled",
    });
  }
  await page.close();

  // Five fresh contexts per engine: descriptive CI timings, no pass/fail speed target.
  for (const engine of ["echarts", "recharts"]) {
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      const requests = [];
      page.on("request", (request) => requests.push(request.url()));
      page.on("pageerror", (error) => errors.push(error.message));
      const started = performance.now();
      await page.goto(`${origin}/comparison.html?engine=${engine}`, {
        waitUntil: "domcontentloaded",
      });
      await ready(page, engine);
      samples.push(Math.round(performance.now() - started));
      const excluded =
        engine === "recharts"
          ? [
              entry("node_modules/echarts/index.js"),
              entry("comparison/EChartsExample.tsx"),
            ]
          : [entry("comparison/RechartsExample.tsx")];
      for (const asset of excluded) {
        assert.ok(asset);
        assert.equal(
          requests.some((url) => url.endsWith(asset)),
          false,
          `Unexpected renderer request: ${asset}`,
        );
      }
      await page.close();
    }
    timing.push({
      engine,
      samplesMs: samples,
      medianMs: [...samples].sort((a, b) => a - b)[2],
    });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    "screenshots/comparison/validation.json",
    JSON.stringify(
      {
        source: process.env.GITHUB_SHA ?? "local",
        results,
        refreshCases,
        timing,
        timingMethod:
          "Wall time from navigation to all 18 plots drawing marks, five fresh Chromium contexts per renderer, localhost CI runner at 1440px. Includes module fetch, parse, React mount and layout. No network/device throttling; directional evidence only.",
        runtimeErrors: errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await server.httpServer.close();
}
