import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const output = resolve(process.env.FACILITY_REPORT_DIR ?? "/tmp/easy-ui-metrics", "proportion-bar");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const page = await browser.newPage({ viewport: { width: 1040, height: 900 } });
const errors = [];
const checks = [];
page.on("pageerror", (error) => errors.push(error.message));
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9018";
async function open(story, theme) {
  await page.goto(`${base}/iframe.html?id=components-proportionbar--${story}&viewMode=story&globals=colorScheme:${theme}`);
  await page.locator("[data-proportion-bar]").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function accessibility(name) {
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await page.evaluate(async () => axe.run(document.querySelector("#storybook-root"), { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } }));
      assert.deepEqual(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })), [], `${name}: accessibility`);
      return;
    } catch (error) {
      if (!String(error).includes("already running") || attempt === 39) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}
try {
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [1040, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const story of ["default", "expanded", "presentations", "bar-only", "tones", "zero", "full", "no-data", "empty-population", "invalid-data", "loading", "narrow", "large-text", "right-to-left"]) {
        const name = `${story}-${theme}-${width}`;
        await open(story, theme);
        const measurements = await page.evaluate(() => {
          const rgb = (color) => (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
          const luminance = (color) => rgb(color).map((channel) => { const value = channel / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
          return {
            overflow: document.documentElement.scrollWidth - innerWidth,
            meters: [...document.querySelectorAll('[data-proportion-bar][role="meter"]')].map((meter) => {
              const track = meter.querySelector("[data-proportion-track]");
              const fill = meter.querySelector("[data-proportion-fill]");
              const trackBox = track.getBoundingClientRect();
              const fillBox = fill.getBoundingClientRect();
              const style = getComputedStyle(meter);
              const fillColor = getComputedStyle(fill).backgroundColor;
              const trackColor = getComputedStyle(track).backgroundColor;
              const light = Math.max(luminance(fillColor), luminance(trackColor));
              const dark = Math.min(luminance(fillColor), luminance(trackColor));
              return {
                ratio: fillBox.width / trackBox.width,
                expected: Number(meter.getAttribute("aria-valuenow")) / Number(meter.getAttribute("aria-valuemax")),
                direction: style.direction,
                startDifference: style.direction === "rtl" ? trackBox.right - fillBox.right : fillBox.left - trackBox.left,
                border: style.borderTopWidth,
                padding: style.paddingTop,
                background: style.backgroundColor,
                fillColor, trackColor, contrast: (light + 0.05) / (dark + 0.05),
              };
            }),
          };
        });
        assert.ok(measurements.overflow <= 1, `${name}: page overflow`);
        for (const meter of measurements.meters) {
          assert.ok(Math.abs(meter.ratio - meter.expected) <= 0.001, `${name}: unrounded fill geometry`);
          assert.ok(Math.abs(meter.startDifference) <= 0.1, `${name}: inline-start alignment`);
          assert.equal(meter.border, "0px", `${name}: no card border`);
          assert.equal(meter.padding, "0px", `${name}: no card padding`);
          assert.equal(meter.background, "rgba(0, 0, 0, 0)", `${name}: no card background`);
          assert.ok(meter.contrast >= 3, `${name}: fill/track contrast ${meter.contrast} (${meter.fillColor} / ${meter.trackColor})`);
        }
        const empty = ["no-data", "empty-population", "invalid-data", "loading"].includes(story);
        assert.equal(measurements.meters.length === 0, empty, `${name}: valid meter semantics`);
        assert.equal(await page.getByRole("progressbar").count(), 0, `${name}: not task progress`);
        if (story === "loading") assert.equal(await page.getByRole("status").count(), 1);
        await accessibility(name);
        checks.push({ name, ...measurements });
        if (["default", "expanded"].includes(story) && width === 1040) {
          await page.locator("[data-proportion-bar]").screenshot({ path: resolve(output, `proportion-bar-${name}.png`) });
        } else if (["presentations", "narrow", "large-text", "right-to-left"].includes(story)) {
          await page.locator("#storybook-root").screenshot({ path: resolve(output, `proportion-bar-${name}.png`) });
        }
      }
    }
  }
  await page.emulateMedia({ forcedColors: "active" });
  await open("expanded", "light");
  const forced = await page.locator("[data-proportion-fill]").evaluate((fill) => ({ adjustment: getComputedStyle(fill).forcedColorAdjust, outline: getComputedStyle(fill.parentElement).outlineStyle }));
  assert.equal(forced.adjustment, "none");
  assert.equal(forced.outline, "solid");
  await page.locator("[data-proportion-bar]").screenshot({ path: resolve(output, "proportion-bar-forced-colors.png") });
  checks.push({ name: "forced-colors", ...forced });
  assert.deepEqual(errors, [], "Browser exceptions");
  console.log(`ProportionBar: ${checks.length} browser cases passed.`);
} finally {
  await writeFile(resolve(output, "results.json"), JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
