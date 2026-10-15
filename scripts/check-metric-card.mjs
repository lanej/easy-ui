import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const output = resolve(
  process.env.FACILITY_REPORT_DIR ?? "/tmp/easy-ui-metrics",
  "metric-card",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const page = await browser.newPage();
const errors = [];
const checks = [];
page.on("pageerror", (error) => errors.push(error.message));
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9018";
const stories = [
  "default",
  "row",
  "shipping-overview",
  "shipping-rows",
  "compact-summary",
  "typography-presets",
  "value-alignment",
  "sentiments",
  "narrow",
  "large-text",
  "right-to-left",
  "row-right-to-left",
  "row-long-content",
  "loading",
  "no-data",
  "zero",
  "caller-owned-frame",
  "comparison-only",
  "signed-values",
];
const sharedStories = [
  "shipping-overview",
  "shipping-rows",
  "compact-summary",
  "row-right-to-left",
];

async function accessibility(name) {
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await page.evaluate(async () =>
        window.axe.run(document.querySelector("#storybook-root"), {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        }),
      );
      assert.deepEqual(
        result.violations.map(({ id, nodes }) => ({
          id,
          targets: nodes.map(({ target }) => target),
        })),
        [],
        `${name}: accessibility`,
      );
      return;
    } catch (error) {
      if (!String(error).includes("already running") || attempt === 39)
        throw error;
      await new Promise((done) => setTimeout(done, 50));
    }
  }
}

try {
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [320, 390, 1040]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const story of stories) {
        const name = `${story}-${theme}-${width}`;
        await page.goto(
          `${base}/iframe.html?id=components-metriccard--${story}&viewMode=story&globals=colorScheme:${theme}`,
        );
        await page
          .locator(
            story === "comparison-only"
              ? "[data-metric-comparison]"
              : "[data-metric-content]",
          )
          .first()
          .waitFor();
        await page.evaluate(() => document.fonts.ready);
        const measurements = await page.evaluate(() => {
          const rect = (element) => {
            if (!element) return null;
            const { top, bottom, left, right, width, height } =
              element.getBoundingClientRect();
            return { top, bottom, left, right, width, height };
          };
          const baseline = (element) => {
            if (!element) return null;
            const marker = document.createElement("span");
            marker.style.cssText =
              "display:inline-block;width:0;height:0;padding:0;border:0;vertical-align:baseline";
            element.appendChild(marker);
            const y = marker.getBoundingClientRect().top;
            marker.remove();
            return y;
          };
          const luminance = (color) =>
            (color.match(/[\d.]+/g) ?? [])
              .slice(0, 3)
              .map(Number)
              .map((channel) => {
                const v = channel / 255;
                return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
              })
              .reduce(
                (sum, channel, index) =>
                  sum + channel * [0.2126, 0.7152, 0.0722][index],
                0,
              );
          const layouts = [
            ...document.querySelectorAll("[data-metric-content]"),
          ].map((metric) => {
            const value = metric.querySelector("[data-metric-value]");
            const number = metric.querySelector("[data-metric-number]");
            const unit = metric.querySelector("[data-metric-unit]");
            return {
              layout: metric.dataset.layout,
              box: rect(metric),
              label: rect(metric.querySelector("[data-metric-label]")),
              value: rect(value),
              number: rect(number),
              unit: rect(unit),
              pill: rect(metric.querySelector("[data-metric-pill]")),
              pair: rect(metric.querySelector("[data-metric-value-group]")),
              numberBaseline: baseline(number),
              unitBaseline: baseline(unit),
              valueSize: parseFloat(getComputedStyle(value).fontSize),
              unitSize: unit
                ? parseFloat(getComputedStyle(unit).fontSize)
                : null,
              direction: getComputedStyle(metric).direction,
              overflow: metric.scrollWidth - metric.clientWidth,
            };
          });
          const comparisons = [
            ...document.querySelectorAll("[data-metric-comparison]"),
          ].map((comparison) => {
            const pill = comparison.querySelector("[data-metric-pill] > span");
            const text = [...pill.querySelectorAll("span")].findLast(
              (element) =>
                element.childElementCount === 0 && element.textContent.trim(),
            );
            const foreground = getComputedStyle(text).color;
            const background = getComputedStyle(pill).backgroundColor;
            const context = document.getElementById(
              comparison.getAttribute("aria-describedby"),
            );
            return {
              contrast:
                (Math.max(luminance(foreground), luminance(background)) +
                  0.05) /
                (Math.min(luminance(foreground), luminance(background)) + 0.05),
              foreground,
              background,
              sentiment: comparison.dataset.sentiment,
              baselineVisible:
                !!context &&
                context.getBoundingClientRect().height > 0 &&
                getComputedStyle(context).visibility === "visible",
              baseline: context?.textContent.trim(),
              localBaseline:
                !!context &&
                !!comparison
                  .closest("[data-metric-content]")
                  ?.contains(context),
              pillHeight: pill.getBoundingClientRect().height,
            };
          });
          return {
            overflow: document.documentElement.scrollWidth - innerWidth,
            layouts,
            comparisons,
          };
        });
        await page
          .locator("#storybook-root")
          .screenshot({ path: resolve(output, `${name}.png`) });
        assert.ok(
          measurements.overflow <= 1,
          `${name}: page overflow ${measurements.overflow}`,
        );
        for (const metric of measurements.layouts) {
          assert.ok(
            metric.overflow <= 1,
            `${name}: metric overflow ${metric.overflow}`,
          );
          for (const element of [
            metric.label,
            metric.value,
            metric.pill,
            metric.unit,
          ].filter(Boolean)) {
            assert.ok(
              element.left >= metric.box.left - 1 &&
                element.right <= metric.box.right + 1,
              `${name}: content stays within metric`,
            );
          }
          if (metric.layout === "summary") {
            assert.ok(
              metric.value.top >= metric.label.bottom - 1,
              `${name}: summary label remains above the reading`,
            );
            const startGap =
              metric.direction === "rtl"
                ? metric.label.right - metric.value.right
                : metric.label.left - metric.value.left;
            assert.ok(
              Math.abs(startGap) <= 1,
              `${name}: summary remains start-aligned`,
            );
          }
          if (metric.unit) {
            assert.ok(
              metric.unitSize < metric.valueSize,
              `${name}: unit is secondary`,
            );
            if (
              metric.number.top < metric.unit.bottom &&
              metric.unit.top < metric.number.bottom
            )
              assert.ok(
                Math.abs(metric.numberBaseline - metric.unitBaseline) <= 1,
                `${name}: unit and number share a baseline`,
              );
          }
          if (metric.pill) {
            const sameRow =
              metric.value.top < metric.pill.bottom &&
              metric.pill.top < metric.value.bottom;
            if (
              metric.layout === "summary" &&
              metric.value.width + metric.pill.width + 8 <= metric.box.width
            )
              assert.ok(
                sameRow,
                `${name}: value/pill pair stays together when it fits`,
              );
            if (sameRow) {
              const centerDelta = Math.abs(
                (metric.value.top +
                  metric.value.bottom -
                  metric.pill.top -
                  metric.pill.bottom) /
                  2,
              );
              assert.ok(
                centerDelta <= 1,
                `${name}: pill vertical center ${centerDelta}`,
              );
              const gap =
                metric.direction === "rtl"
                  ? metric.value.left - metric.pill.right
                  : metric.pill.left - metric.value.right;
              assert.ok(
                gap >= -1 && gap <= 9,
                `${name}: value/pill gap ${gap}`,
              );
            } else {
              const startDelta =
                metric.direction === "rtl"
                  ? metric.value.right - metric.pill.right
                  : metric.value.left - metric.pill.left;
              assert.ok(
                Math.abs(startDelta) <= 1,
                `${name}: wrapped pill retains the reading edge`,
              );
              assert.ok(
                metric.pill.top - metric.value.bottom <= 5,
                `${name}: wrapped pill stays adjacent`,
              );
            }
          }
        }
        if (["shipping-rows", "row-right-to-left"].includes(story)) {
          const first = measurements.layouts[0];
          for (const metric of measurements.layouts.slice(1)) {
            const valueDelta =
              first.direction === "rtl"
                ? first.value.left - metric.value.left
                : first.value.right - metric.value.right;
            const pillDelta =
              first.direction === "rtl"
                ? first.pill.right - metric.pill.right
                : first.pill.left - metric.pill.left;
            assert.ok(
              Math.abs(valueDelta) <= 1 && Math.abs(pillDelta) <= 1,
              `${name}: shared value and comparison columns`,
            );
          }
        }
        for (const comparison of measurements.comparisons) {
          assert.ok(
            Number.isFinite(comparison.contrast) && comparison.contrast >= 4.5,
            `${name}: ${comparison.sentiment} contrast ${comparison.contrast} (${comparison.foreground}/${comparison.background})`,
          );
          assert.ok(
            comparison.baselineVisible && comparison.baseline,
            `${name}: visible comparison context`,
          );
          if (sharedStories.includes(story)) {
            assert.equal(
              comparison.localBaseline,
              false,
              `${name}: shared baseline not repeated`,
            );
            assert.ok(
              comparison.pillHeight <= 25,
              `${name}: comparison is a compact annotation`,
            );
          }
        }
        if (sharedStories.includes(story))
          assert.equal(
            await page.getByRole("region").count(),
            1,
            `${name}: exactly one shared frame`,
          );
        if (["loading", "no-data", "zero"].includes(story))
          assert.equal(
            measurements.comparisons.length,
            0,
            `${name}: no stale or fabricated comparison`,
          );
        if (["loading", "no-data"].includes(story))
          assert.equal(
            await page.locator("[data-metric-unit]").count(),
            0,
            `${name}: no orphaned unit`,
          );
        if (story === "loading")
          assert.equal(await page.getByRole("status").count(), 1);
        await accessibility(name);
        checks.push({ name, ...measurements });
      }
    }
  }
  assert.deepEqual(errors, [], "Browser exceptions");
  console.log(
    `MetricCard: ${checks.length} hierarchy, contrast, unit baseline, alignment, context, and reflow cases passed.`,
  );
} catch (error) {
  errors.push(error.stack ?? String(error));
  throw error;
} finally {
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}
