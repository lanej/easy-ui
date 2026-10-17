import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const baseUrl = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9078";
const output = resolve(
  process.env.EVIDENCE_TYPOGRAPHY_REPORT_DIR ??
    "/tmp/easy-ui-evidence-typography",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const checks = [];
const errors = [];
try {
  for (const scheme of ["light", "dark"]) {
    const context = await browser.newContext({ colorScheme: scheme });
    await context.addInitScript((value) => {
      localStorage.setItem("easy-ui-storybook-color-scheme", value);
    }, scheme);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    for (const width of [390, 1200]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(
        `${baseUrl}/iframe.html?id=components-scorecomposition--default&viewMode=story`,
      );
      const warnings = page.locator(
        '[data-sentiment="warning"][class*="Status"]',
      );
      await warnings.first().waitFor();
      assert.equal(
        await warnings
          .first()
          .evaluate((element) => getComputedStyle(element).colorScheme),
        scheme,
        "requested native theme is active",
      );
      await page.evaluate(() => document.fonts.ready);
      const contrast = await warnings.evaluateAll((elements) => {
        const luminance = (color) => {
          const channels = color
            .match(/[\d.]+/g)
            .slice(0, 3)
            .map(Number);
          return channels.reduce((sum, channel, i) => {
            const value = channel / 255;
            return (
              sum +
              (value <= 0.04045
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4) *
                [0.2126, 0.7152, 0.0722][i]
            );
          }, 0);
        };
        return elements.map((element) => {
          // Signal text is a child; measure its actual rendered foreground too.
          const text =
            element.querySelector('[class*="StatusLabel"]') ?? element;
          const foreground = getComputedStyle(text).color;
          const background = getComputedStyle(element).backgroundColor;
          const a = luminance(foreground),
            b = luminance(background);
          return {
            label: element.textContent,
            foreground,
            background,
            ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          };
        });
      });
      assert.ok(
        contrast.length >= 3,
        "both warning signals and contribution render",
      );
      for (const value of contrast)
        assert.ok(value.ratio >= 4.5, JSON.stringify(value));
      await page.screenshot({
        path: resolve(output, `score-${scheme}-${width}.png`),
        fullPage: true,
      });
      checks.push({ scheme, width, contrast });
      for (const variant of [
        "full-timestamps",
        "full-timestamps-inline",
        "full-timestamps-compact",
      ]) {
        await page.goto(
          `${baseUrl}/iframe.html?id=organisms-data-display-eventtimeline--${variant}&viewMode=story`,
        );
        const times = page.locator('[id$="-time"], [id$="-received"]');
        await times.first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        const measurements = await times.evaluateAll((elements) =>
          elements.map((element) => {
            const box = element.getBoundingClientRect();
            const label = element.textContent;
            const walker = document.createTreeWalker(
              element,
              NodeFilter.SHOW_TEXT,
            );
            const words = [];
            while (walker.nextNode()) {
              const node = walker.currentNode;
              words.push(
                ...[...node.textContent.matchAll(/\S+/g)].map((match) => {
                  const range = document.createRange();
                  range.setStart(node, match.index);
                  range.setEnd(node, match.index + match[0].length);
                  const rects = [...range.getClientRects()];
                  return {
                    text: match[0],
                    lines: rects.length,
                    fits: rects.every(
                      (rect) =>
                        rect.left >= box.left - 1 &&
                        rect.right <= box.right + 1 &&
                        rect.top >= box.top - 1 &&
                        rect.bottom <= box.bottom + 1,
                    ),
                  };
                }),
              );
            }
            return {
              received: element.id.endsWith("-received"),
              label,
              fontSize: parseFloat(getComputedStyle(element).fontSize),
              width: box.width,
              words,
            };
          }),
        );
        const occurrences = measurements.filter((time) => !time.received);
        const receipts = measurements.filter((time) => time.received);
        assert.equal(occurrences.length, 3);
        assert.equal(receipts.length, variant.endsWith("compact") ? 0 : 3);
        for (const [index, time] of occurrences.entries()) {
          assert.equal(
            time.label,
            `2026-10-16 ${["09:42:00", "13:18:00", "17:06:00"][index]} UTC`,
          );
        }
        for (const [index, time] of receipts.entries()) {
          assert.equal(
            time.label,
            `Received: 2026-10-16 ${["09:43:00", "13:20:00", "17:14:00"][index]} UTC`,
          );
        }
        for (const time of measurements) {
          assert.ok(time.fontSize >= 12, "timestamps stay at least 12px");
          assert.ok(
            time.words.every((word) => word.lines === 1 && word.fits),
            JSON.stringify(time),
          );
        }
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          "no horizontal page overflow",
        );
        const buttons = page
          .getByRole("button")
          .filter({ has: page.locator('[class*="title"]') });
        await buttons.first().focus();
        await page.keyboard.press("ArrowDown");
        assert.equal(await buttons.nth(1).getAttribute("aria-current"), "true");
        await page.keyboard.press("End");
        assert.equal(await buttons.nth(2).getAttribute("aria-current"), "true");
        await page.keyboard.press("Home");
        assert.equal(
          await buttons.first().getAttribute("aria-current"),
          "true",
        );
        await page.screenshot({
          path: resolve(output, `${variant}-${scheme}-${width}.png`),
          fullPage: true,
        });
        checks.push({ scheme, width, variant, timestamps: measurements });
      }
    }
    await context.close();
  }
  assert.deepEqual(errors, [], "no browser runtime errors");
  await writeFile(
    resolve(output, "checks.json"),
    JSON.stringify(checks, null, 2),
  );
  console.log(
    `Evidence typography passed: ${checks.length} theme/viewport checks; ${output}`,
  );
} finally {
  await browser.close();
}
