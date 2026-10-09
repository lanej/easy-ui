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
          const dot = page.getByRole("img", {
            name: "As expected",
            exact: true,
          });
          const label = page.getByText("Current dwell", { exact: true });
          assert.equal(await dot.count(), 1);
          const dotBox = await dot.boundingBox();
          const labelBox = await label.boundingBox();
          const valueBox = await page
            .getByRole("img", { name: "6 h", exact: true })
            .boundingBox();
          assert.ok(valueBox, "Compact duration must be visible");
          assert.ok(labelBox.x + labelBox.width <= dotBox.x);
          assert.ok(dotBox.x + dotBox.width <= valueBox.x);
          assert.ok(
            Math.abs(
              valueBox.y +
                valueBox.height / 2 -
                labelBox.y -
                labelBox.height / 2,
            ) < 3,
          );
          assert.ok(
            Math.abs(
              dotBox.y + dotBox.height / 2 - labelBox.y - labelBox.height / 2,
            ) < 2,
          );
          assert.equal(
            await page.getByText("As expected", { exact: true }).count(),
            0,
          );
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
        if (story === "default" && width === 1040) {
          const plot = await page
            .locator('[role="img"][class*="plot"]')
            .boundingBox();
          const assessment = await page
            .locator('[data-size="sm"][data-variant="default"]')
            .boundingBox();
          assert.ok(
            plot.x > assessment.x + 30,
            "Default reference must remain beside headline metrics",
          );
          assert.equal(
            await page.locator('[class*="percentileLabel"]').count(),
            0,
            "Percentile labels must not be repeated on the graph",
          );
        }
        await page.addScriptTag({
          path: require.resolve("axe-core/axe.min.js"),
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
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        }
        assert.deepEqual(
          audit.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
          [],
          `${theme}-${width}-${story}`,
        );
        checks.push(`${theme}-${width}-${story}`);
        if (width === 1040 && ["default", "compact"].includes(story))
          await page.locator(`section[data-variant="${story}"]`).screenshot({
            path: resolve(output, `facility-summary-${story}-${theme}.png`),
          });

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
