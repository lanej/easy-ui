import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(
  new URL("./preview-metrics/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const baseUrl = process.env.STORYBOOK_URL ?? "http://localhost:9013";
const output = resolve(
  process.env.THEME_TOGGLE_REPORT_DIR ?? "/tmp/easy-ui-theme-toggle-browser",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || undefined,
});
const results = [];

try {
  for (const mode of ["light", "dark"]) {
    for (const width of [1280, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 480 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const story = mode === "light" ? "default" : "dark";
      await page.goto(
        `${baseUrl}/iframe.html?id=atoms-actions-themetoggle--${story}&viewMode=story&globals=colorScheme:${mode}`,
      );
      const nextMode = mode === "light" ? "dark" : "light";
      const button = page.getByRole("button", {
        name: `Switch to ${nextMode} mode`,
        exact: true,
      });
      await button.waitFor();
      const surface = page.locator("#storybook-root button").locator("..");
      const initialBackground = await surface.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      );
      const bounds = await button.boundingBox();
      const iconBounds = await button.locator("svg").boundingBox();
      assert.ok(bounds.width >= 24 && bounds.height >= 24);
      assert.ok(iconBounds.width > 0 && iconBounds.height > 0);
      assert.ok(iconBounds.x >= bounds.x && iconBounds.y >= bounds.y);
      assert.ok(iconBounds.x + iconBounds.width <= bounds.x + bounds.width);
      assert.ok(iconBounds.y + iconBounds.height <= bounds.y + bounds.height);
      await page.keyboard.press("Tab");
      assert.ok(
        await button.evaluate((element) => element === document.activeElement),
      );
      await page.screenshot({
        path: resolve(output, `${mode}-${width}-focus.png`),
      });
      await page.keyboard.press("Enter");
      const switched = page.getByRole("button", {
        name: `Switch to ${mode} mode`,
        exact: true,
      });
      await switched.waitFor();
      assert.ok(
        await switched.evaluate(
          (element) => element === document.activeElement,
        ),
      );
      assert.notEqual(
        await surface.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
        initialBackground,
      );
      await page.keyboard.press("Space");
      await button.waitFor();
      assert.equal(
        await surface.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
        initialBackground,
      );
      await button.click();
      await switched.waitFor();
      await switched.click();
      await button.waitFor();
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      const violations = await page.evaluate(async () => {
        const deadline = performance.now() + 10000;
        while (true) {
          try {
            return (
              await window.axe.run(document.querySelector("#storybook-root"))
            ).violations;
          } catch (error) {
            if (
              !String(error).includes("Axe is already running") ||
              performance.now() >= deadline
            ) {
              throw error;
            }
            await new Promise((finish) => setTimeout(finish, 50));
          }
        }
      });
      assert.deepEqual(violations, []);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      assert.ok(overflow <= 1);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: resolve(output, `${mode}-${width}.png`) });
      results.push({ mode, width, bounds, iconBounds, overflow });
      await page.close();
    }
  }
  const page = await browser.newPage();
  await page.goto(
    `${baseUrl}/iframe.html?id=atoms-actions-themetoggle--disabled&viewMode=story`,
  );
  const disabled = page.getByRole("button", { name: "Switch to dark mode" });
  await disabled.waitFor();
  assert.ok(await disabled.isDisabled());
  await page.keyboard.press("Tab");
  assert.ok(
    await disabled.evaluate((element) => element !== document.activeElement),
  );
  await page.screenshot({ path: resolve(output, "disabled.png") });
  await page.close();
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(`ThemeToggle browser checks passed. Evidence: ${output}`);
} finally {
  await browser.close();
}
