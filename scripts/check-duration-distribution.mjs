import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { checkHealthObservationLayout } from "./check-health-observation-layout.mjs";

const require = createRequire(
  new URL("./preview-metrics/package.json", import.meta.url),
);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const rootRequire = createRequire(import.meta.url);
const baseUrl = process.env.STORYBOOK_URL ?? "http://localhost:9013";
const output = resolve(
  process.env.DURATION_REPORT_DIR ?? "/tmp/easy-ui-duration-distribution",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || undefined,
  executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const results = [],
  errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 720, height: 900 },
    deviceScaleFactor: 2,
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const goto = async (
    id,
    scheme = "light",
    prefix = "molecules-data-visualization-durationdistribution",
  ) => {
    await page.goto(
      `${baseUrl}/iframe.html?id=${prefix}--${id}&viewMode=story&globals=colorScheme:${scheme}`,
    );
    await page.locator("#storybook-root").waitFor({ state: "attached" });
    await page.waitForFunction(
      () =>
        document.querySelector("#storybook-root")?.textContent.trim().length >
        0,
    );
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator(".sb-errordisplay").isVisible(), false);
  };
  const check = async (name) => {
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `${name}: horizontal overflow`,
    );
    await page.evaluate(() => {
      for (const plot of document.querySelectorAll(
        '[class*="plot"][role="img"]',
      )) {
        if (!plot.getBoundingClientRect().width) continue;
        const p = plot.getBoundingClientRect();
        for (const point of plot.querySelectorAll(
          '[class*="curvePoint"], [class*="histogramPoint"], [class*="marker_"]',
        )) {
          const b = point.getBoundingClientRect();
          if (Math.abs(b.width - 8) > 0.1 || Math.abs(b.height - 8) > 0.1)
            throw Error("Marker size drift");
        }
        for (const mark of plot.querySelectorAll(
          '[class*="elapsed_"], [class*="percentile_"]',
        )) {
          const b = mark.getBoundingClientRect();
          const projected = parseFloat(mark.style.left) / 100;
          if (Math.abs(b.x + b.width / 2 - (p.x + p.width * projected)) > 1)
            throw Error("Marker projection drift");
        }
        for (const path of plot.querySelectorAll("path")) {
          if (/NaN|Infinity/.test(path.getAttribute("d")))
            throw Error("Invalid curve geometry");
        }
      }
    });
    await page.addScriptTag({
      path: rootRequire.resolve("axe-core/axe.min.js"),
    });
    let audit;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        audit = await page.evaluate(
          async () =>
            await axe.run(document.querySelector("#storybook-root"), {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21aa"],
              },
            }),
        );
        break;
      } catch (error) {
        if (!String(error).includes("already running") || attempt === 39)
          throw error;
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    assert.deepEqual(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
      name,
    );
    results.push({ name, violations: [] });
  };
  const capture = async (name) =>
    page
      .locator("#storybook-root")
      .screenshot({ path: resolve(output, `${name}.png`) });
  for (const scheme of ["light", "dark"]) {
    await page.setViewportSize({ width: 720, height: 900 });
    for (const [id, file] of [
      ["default", `duration-distribution-${scheme}`],
      ["active-health-region", `duration-distribution-active-region-${scheme}`],
      ["all-health-regions", `duration-distribution-all-regions-${scheme}`],
      ["quantiles-only", `duration-distribution-quantiles-${scheme}`],
      [
        "quantiles-only-with-labels",
        `duration-distribution-quantiles-labeled-${scheme}`,
      ],
      ["presentation-options", `duration-distribution-presentations-${scheme}`],
      ["smooth-histogram", `duration-distribution-smooth-${scheme}`],
      [
        "binned-concentration",
        `duration-distribution-concentration-binned-${scheme}`,
      ],
      [
        "histogram-concentration-preview",
        `duration-distribution-concentration-${scheme}`,
      ],
      ["reference-states", `duration-distribution-states-${scheme}`],
      ["minutes", `duration-distribution-minutes-${scheme}`],
      ["composed-assessment", `duration-distribution-composed-${scheme}`],
    ]) {
      await goto(id, scheme);
      await check(`${scheme}-${id}`);
      if (
        ["default", "active-health-region", "all-health-regions"].includes(id)
      ) {
        const expected =
          id === "all-health-regions"
            ? ["healthy", "degraded", "unhealthy"]
            : [id === "active-health-region" ? "degraded" : "healthy"];
        assert.deepEqual(
          await page
            .locator('figure [class*="track_"] > span')
            .evaluateAll((bands) =>
              bands.map((band) => band.dataset.assessment),
            ),
          expected,
          `${scheme}-${id}: highlighted policy regions`,
        );
      }
      await capture(file);
    }
    for (const id of [
      "quantiles-only",
      "binned-concentration",
      "smooth-with-cumulative",
      "cumulative-only",
      "histogram-only",
      "empirical-steps",
      "boundary-jumps",
      "partial-reference",
      "endpoint-quantiles",
      "with-labels",
      "with-count-axis",
      "with-context",
      "without-bands",
      "without-percentiles",
      "without-policy",
      "missing-reference",
      "missing-observation",
      "invalid-reference",
      "outside-scale",
      "clamped-observation",
      "zero-sample",
      "loading",
      "independent-metrics",
    ]) {
      await goto(id, scheme);
      await check(`${scheme}-${id}`);
      if (id === "endpoint-quantiles")
        assert.equal(
          await page.locator('[class*="endpoint_"]').count(),
          0,
          "Duplicate endpoint labels",
        );
      if (id === "partial-reference")
        assert.equal(
          await page.locator('[class*="marker_"]').count(),
          0,
          "Extrapolated current CDF",
        );
      if (id === "quantiles-only") {
        const bar = page.locator('figure [class*="track_"]');
        const geometry = await bar.boundingBox();
        assert.equal(geometry.height, 8, "Quantile reference bar height");
        assert.ok(geometry.width > 0, "Quantile reference bar width");
        assert.ok(
          await bar.evaluate(
            (node) => Number(getComputedStyle(node).opacity) > 0,
          ),
          "Quantile bar is visible",
        );
        assert.equal(
          await page.locator("figure svg").count(),
          0,
          "Quantiles imply geometry",
        );
      }
      if (id === "without-bands")
        assert.equal(await page.locator("figure [data-assessment]").count(), 0);
      if (id === "without-policy")
        assert.equal(
          await page
            .locator(
              'figure [data-reference-assessment]:not([data-reference-assessment="unassessed"])',
            )
            .count(),
          0,
        );
      if (id === "without-percentiles")
        assert.equal(await page.locator("figure [data-percentile]").count(), 0);
      if (id === "loading")
        assert.equal(await page.locator("figure").count(), 0);
    }
    await goto("with-exact-data", scheme);
    await check(`${scheme}-exact-data-closed`);
    const summary = page.locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("details").getAttribute("open"), "");
    assert.equal(await page.locator("details dl").isVisible(), true);
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("details dl").isVisible(), false);
    results.push({ name: `${scheme}-exact-data-keyboard`, passed: true });
    await goto("composed-exact-data", scheme);
    await page.locator("summary").focus();
    await page.keyboard.press("Enter");
    await check(`${scheme}-composed-exact-data`);
    await page.evaluate(() => {
      const layout = document.querySelector('[data-has-reference="true"]');
      const [left, right] = Array.from(layout.children).map((n) =>
        n.getBoundingClientRect(),
      );
      const content =
        layout.children[1].firstElementChild.getBoundingClientRect();
      if (
        Math.abs(left.height - right.height) > 1 ||
        Math.abs(right.height - content.height) > 1
      )
        throw Error("Expanded exact data escapes its reference column");
    });
    for (const width of [320, 420]) {
      await page.setViewportSize({ width, height: 900 });
      for (const id of [
        "default",
        "narrow",
        "quantiles-only-with-labels",
        "histogram-concentration-preview",
        "binned-concentration",
        "smooth-histogram",
        "endpoint-quantiles",
        "minutes",
        "with-count-axis",
        "outside-scale",
        "composed-assessment",
      ]) {
        await goto(id, scheme);
        await check(`${scheme}-${width}-${id}`);
      }
    }
    await page.setViewportSize({ width: 720, height: 900 });
    await goto("with-labels", scheme);
    await page.evaluate(
      () => (document.documentElement.style.fontSize = "32px"),
    );
    await check(`${scheme}-enlarged-text`);
    await goto("default", scheme);
    await page.emulateMedia({ forcedColors: "active" });
    await check(`${scheme}-forced-colors`);
    for (const id of [
      "smooth-histogram",
      "histogram-concentration-preview",
      "binned-concentration",
    ]) {
      await goto(id, scheme);
      await check(`${scheme}-${id}-forced-colors`);
    }
    await page.emulateMedia({ forcedColors: "none" });
    for (const id of ["reference-options", "distribution-options"]) {
      await page.setViewportSize({ width: 1800, height: 1200 });
      await goto(id, scheme, "organisms-feedback-healthassessment");
      const layouts = await page.evaluate(checkHealthObservationLayout);
      await check(`${scheme}-${id}`);
      results.push({ name: `${scheme}-${id}-alignment`, layouts });
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(
    JSON.stringify({ checks: results.length, violations: 0, output }),
  );
} finally {
  await browser.close();
}
