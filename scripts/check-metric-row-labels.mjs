import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9018";
let cases = 0;
try {
  const page = await browser.newPage();
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [320, 390, 1040]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(
        `${base}/iframe.html?id=components-metriccard--row-long-content&viewMode=story&globals=colorScheme:${theme}`,
      );
      await page.locator("[data-metric-content]").first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll("[data-metric-content]")].map((row) => {
          const box = row.getBoundingClientRect();
          const label = row
            .querySelector("[data-metric-label]")
            .getBoundingClientRect();
          const number = row.querySelector("[data-metric-number]");
          const value = row
            .querySelector("[data-metric-value]")
            .getBoundingClientRect();
          return {
            width: box.width,
            height: box.height,
            labelWidth: label.width,
            labelBottom: label.bottom,
            valueTop: value.top,
            numberHeight: number.getBoundingClientRect().height,
            numberLineHeight: parseFloat(getComputedStyle(number).lineHeight),
          };
        }),
      );
      for (const row of rows) {
        assert.ok(
          row.labelWidth >= row.width / 4,
          `${theme}-${width}: reading columns must not collapse the label`,
        );
        assert.ok(
          row.height < 300,
          `${theme}-${width}: long labels must not form a vertical character column`,
        );
        assert.ok(
          row.numberHeight <= row.numberLineHeight + 1,
          `${theme}-${width}: the formatted number must remain intact`,
        );
        if (row.width <= 384) {
          assert.ok(
            row.valueTop >= row.labelBottom - 1,
            `${theme}-${width}: narrow rows give the label its own line`,
          );
        }
      }
      cases++;
    }
  }
  console.log(`Metric rows: ${cases} long-content readability cases passed.`);
} finally {
  await browser.close();
}
