import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const output = resolve(
  process.env.FACILITY_REPORT_DIR ?? "/tmp/easy-ui-facility-summary",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const checks = [];
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1040, height: 900 },
    deviceScaleFactor: 2,
  });
  page.on("pageerror", (e) => errors.push(e.message));
  for (const theme of ["light", "dark"]) {
    for (const width of [1040, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const story of [
        "default",
        "compact",
        "detailed",
        "identity-only",
        "missing-observation",
        "loading",
        "narrow",
        "multiple-observations",
        "comparison",
        "table",
      ]) {
        await page.goto(
          `${process.env.STORYBOOK_URL ?? "http://localhost:9018"}/iframe.html?id=organisms-facilities-facilitysummary--${story}&viewMode=story&globals=colorScheme:${theme}`,
        );
        await page.waitForFunction(() =>
          document
            .querySelector("#storybook-root")
            ?.textContent.includes("North Harbor"),
        );
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator(".sb-errordisplay").isVisible(), false);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${theme}-${width}-${story}: overflow`,
        );
        if (story === "missing-observation")
          assert.equal(
            await page.getByText("As expected", { exact: true }).count(),
            0,
          );
        if (story === "loading") {
          assert.equal(await page.getByRole("status").count(), 1);
          assert.equal(
            await page.locator('[role="img"][class*="plot"]').count(),
            0,
          );
        }
        if (story === "compact") {
          assert.equal(
            await page
              .locator('[data-variant="compact"][data-size="sm"]')
              .count(),
            1,
          );
          assert.equal(
            await page.locator('[role="img"][class*="plot"]').count(),
            0,
          );
        }
        await page.addScriptTag({
          path: require.resolve("axe-core/axe.min.js"),
        });
        const audit = await page.evaluate(
          async () =>
            await axe.run(document.querySelector("#storybook-root"), {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21aa"],
              },
            }),
        );
        assert.deepEqual(
          audit.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
          [],
          `${theme}-${width}-${story}`,
        );
        checks.push(`${theme}-${width}-${story}`);
        if (
          (width === 1040 && ["comparison", "table"].includes(story)) ||
          (width === 320 && ["narrow", "missing-observation"].includes(story))
        )
          await page.locator("#storybook-root").screenshot({
            path: resolve(output, `facility-summary-${story}-${theme}.png`),
          });
      }
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify({ checks: checks.length, violations: 0 }, null, 2),
  );
  console.log(JSON.stringify({ checks: checks.length, violations: 0 }));
} finally {
  await browser.close();
}
