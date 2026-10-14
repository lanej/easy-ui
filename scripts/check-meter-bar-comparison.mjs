import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const output = resolve(
  process.env.FACILITY_REPORT_DIR ?? "/tmp/easy-ui-metrics",
  "meter-bar-comparison",
);
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9018";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const page = await browser.newPage();
const errors = [];
const checks = [];
page.on("pageerror", (error) => errors.push(error.message));

try {
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [1040, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const story of [
        "comparison",
        "comparison-narrow",
        "comparison-states",
        "comparison-right-to-left",
        "comparison-large-text",
      ]) {
        const name = `${story}-${theme}-${width}`;
        await page.goto(
          `${base}/iframe.html?id=components-meterbar--${story}&viewMode=story&globals=colorScheme:${theme}`,
        );
        const group = page.locator("[data-meter-comparison]");
        await group.waitFor();
        await page.evaluate(() => document.fonts.ready);
        const result = await group.evaluate((root) => {
          const rows = [...root.querySelectorAll("[data-meter-row]")];
          return {
            overflow: root.scrollWidth > root.clientWidth + 1,
            keyboardStops: root.querySelectorAll(
              "[tabindex], button, input, select, textarea, a[href]",
            ).length,
            meters: rows.map((row) => {
              const track = row.querySelector("[data-meter-bar]");
              const fill = row.querySelector("[data-meter-fill]");
              const box = track?.getBoundingClientRect();
              return {
                state: row.getAttribute("data-state"),
                role: row.getAttribute("role"),
                name: row.getAttribute("aria-label"),
                value: row.getAttribute("aria-valuenow"),
                max: row.getAttribute("aria-valuemax"),
                text: row.getAttribute("aria-valuetext"),
                nestedMeters: row.querySelectorAll('[role="meter"]').length,
                hiddenTrack: track?.getAttribute("aria-hidden"),
                trackWidth: box?.width,
                trackLeft: box?.left,
                fillWidth: fill?.getBoundingClientRect().width,
                fillLeft: fill?.getBoundingClientRect().left,
                fillRight: fill?.getBoundingClientRect().right,
                trackRight: box?.right,
                direction: getComputedStyle(row).direction,
              };
            }),
          };
        });
        assert.equal(result.overflow, false, `${name}: no horizontal overflow`);
        assert.equal(result.keyboardStops, 0, `${name}: no keyboard stops`);
        const valid = result.meters.filter((row) => row.state === "valid");
        assert.ok(valid.length > 0, `${name}: contains measurements`);
        for (const row of result.meters) {
          assert.equal(row.nestedMeters, 0, `${name}: no nested meters`);
          if (row.state === "unavailable") {
            assert.equal(row.role, null, `${name}: unavailable is not a meter`);
            assert.equal(row.value, null, `${name}: no invented missing value`);
            assert.equal(row.trackWidth, undefined, `${name}: no missing track`);
            continue;
          }
          assert.equal(row.role, "meter", `${name}: one meter per valid row`);
          assert.ok(row.name && row.text, `${name}: named and described value`);
          assert.equal(row.max, "12", `${name}: shared maximum`);
          assert.equal(row.hiddenTrack, "true", `${name}: visual-only fill`);
          assert.ok(row.trackWidth > 1, `${name}: bar has visible width`);
          const expected = (Number(row.value) / Number(row.max)) * row.trackWidth;
          assert.ok(
            Math.abs(row.fillWidth - expected) < 0.6,
            `${name}: exact geometry for ${row.name}`,
          );
          assert.ok(
            Math.abs(row.trackLeft - valid[0].trackLeft) < 0.6 &&
              Math.abs(row.trackWidth - valid[0].trackWidth) < 0.6,
            `${name}: aligned bars with equal scale lengths`,
          );
          const startDifference =
            row.direction === "rtl"
              ? row.trackRight - row.fillRight
              : row.fillLeft - row.trackLeft;
          assert.ok(Math.abs(startDifference) < 0.6, `${name}: inline start`);
        }
        await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
        const violations = await page.evaluate(async () => {
          for (let attempt = 0; ; attempt++) {
            try {
              const result = await window.axe.run(
                document.querySelector("[data-meter-comparison]"),
                {
                  runOnly: {
                    type: "tag",
                    values: ["wcag2a", "wcag2aa", "wcag21aa"],
                  },
                },
              );
              return result.violations.map(({ id }) => id);
            } catch (error) {
              if (!String(error).includes("already running") || attempt === 39) {
                throw error;
              }
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
          }
        });
        assert.deepEqual(violations, [], `${name}: accessibility`);
        await group.screenshot({ path: resolve(output, `${name}.png`) });
        checks.push(name);
      }
    }
  }
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto(
    `${base}/iframe.html?id=components-meterbar--comparison&viewMode=story`,
  );
  await page.locator("[data-meter-comparison]").waitFor();
  const firstTrack = page.locator("[data-meter-bar]").first();
  const contrast = await firstTrack.evaluate((track) => {
    const fill = track.querySelector("[data-meter-fill]");
    if (fill === null) {
      throw new Error("Expected a meter fill");
    }
    const trackStyle = getComputedStyle(track);
    const fillStyle = getComputedStyle(fill);
    return {
      outline: trackStyle.outlineWidth,
      track: trackStyle.backgroundColor,
      fill: fillStyle.backgroundColor,
    };
  });
  assert.notEqual(contrast.outline, "0px", "forced colors: track outline");
  assert.notEqual(contrast.fill, contrast.track, "forced colors: visible fill");
  checks.push("forced-colors");
  assert.deepEqual(errors, [], "no browser errors");
  console.log(`MeterBar comparison: ${checks.length} browser cases passed.`);
} finally {
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}
