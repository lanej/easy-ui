import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const output = resolve(
  process.env.FACILITY_REPORT_DIR ?? "/tmp/easy-ui-metrics",
  "dependency-fullscreen",
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
try {
  for (const theme of ["light", "dark"]) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(
        `${base}/iframe.html?id=components-dependencygraph--fullscreen-inspection&viewMode=story&globals=colorScheme:${theme}`,
      );
      const enter = page.getByRole("button", {
        name: "Enter full screen",
        exact: true,
      });
      await enter.waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole("button", { name: /Graph scope/ }).click();
      await page.getByRole("listbox").waitFor();
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: "Zoom in graph", exact: true })
        .click();
      const zoom = await page
        .getByLabel("Graph zoom", { exact: true })
        .textContent();
      // An expando detects replacement of the mounted card across both transitions.
      await page
        .locator('[data-graph-resource-card="application-user"]')
        .evaluate((card) => {
          card.fullscreenProof = true;
        });
      await enter.focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() =>
        document.fullscreenElement?.hasAttribute("data-dependency-graph"),
      );
      const exit = page.getByRole("button", {
        name: "Exit full screen",
        exact: true,
      });
      await exit.waitFor();
      await page.waitForFunction(
        () =>
          document.querySelector("[data-graph-canvas]").clientHeight !== 320,
      );
      assert.equal(
        await page.getByLabel("Graph zoom", { exact: true }).textContent(),
        zoom,
      );
      const geometry = await page
        .locator("[data-dependency-graph]")
        .evaluate((root) => {
          const box = root.getBoundingClientRect();
          const canvas = root
            .querySelector("[data-graph-canvas]")
            .getBoundingClientRect();
          const button = root
            .querySelector("[data-graph-fullscreen-toggle]")
            .getBoundingClientRect();
          return {
            width: box.width,
            height: box.height,
            screenWidth: innerWidth,
            screenHeight: innerHeight,
            canvasHeight: canvas.height,
            exitVisible: button.bottom <= innerHeight,
            overflow: root.scrollWidth > root.clientWidth + 1,
          };
        });
      assert.equal(geometry.width, geometry.screenWidth);
      assert.equal(geometry.height, geometry.screenHeight);
      assert.ok(geometry.canvasHeight >= 120);
      assert.ok(geometry.exitVisible);
      assert.equal(geometry.overflow, false);
      assert.equal(
        await page
          .locator('[data-graph-resource-card="application-user"]')
          .getAttribute("data-selected"),
        "true",
      );
      assert.equal(
        await page
          .locator('[data-graph-card-diff="application-user"]')
          .isVisible(),
        true,
      );
      assert.equal(
        await page
          .locator('[data-graph-resource-card="application-user"]')
          .evaluate((card) => card.fullscreenProof),
        true,
      );
      // Scope menus use React Aria portals; they must stay inside the fullscreen subtree.
      await page.getByRole("button", { name: /Graph scope/ }).click();
      await page.getByRole("listbox").waitFor();
      assert.equal(
        await page
          .getByRole("listbox")
          .evaluate((list) => document.fullscreenElement.contains(list)),
        true,
      );
      await page
        .getByRole("option", { name: "Changes + context", exact: true })
        .click();
      await page.getByRole("button", { name: /Graph scope/ }).click();
      await page
        .getByRole("option", { name: "All resources", exact: true })
        .click();
      if (width === 1440) {
        await page.waitForFunction(
          () =>
            parseFloat(
              document.querySelector(
                '[data-graph-resource-card="application-user"]',
              ).style.width,
            ) *
              16 >=
            832,
        );
      }
      await page.screenshot({ path: resolve(output, `${theme}-${width}.png`) });
      await page
        .locator('[data-graph-resource-card="application-user"]')
        .evaluate((card) => {
          card.fullscreenProof = true;
        });
      await exit.focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => !document.fullscreenElement);
      await page.waitForFunction(
        () =>
          document.querySelector("[data-graph-canvas]").style.height ===
          "320px",
      );
      assert.equal(
        await enter.evaluate((button) => button === document.activeElement),
        true,
      );
      assert.equal(
        await page.getByLabel("Graph zoom", { exact: true }).textContent(),
        zoom,
      );
      assert.equal(
        await page
          .locator('[data-graph-resource-card="application-user"]')
          .evaluate((card) => card.fullscreenProof),
        true,
      );
      await page.getByRole("button", { name: /Graph scope/ }).click();
      await page.getByRole("listbox").waitFor();
      await page.keyboard.press("Escape");
      // Browser-owned exits, including Escape, must synchronize the control.
      await enter.click();
      await page.waitForFunction(() => !!document.fullscreenElement);
      await page.evaluate(() => document.exitFullscreen());
      await enter.waitFor();
      assert.equal(await enter.getAttribute("aria-pressed"), "false");
      assert.equal(
        await enter.evaluate((button) => button === document.activeElement),
        true,
      );
      checks.push({
        theme,
        width,
        geometry,
        statePreserved: true,
        portalUsable: true,
        keyboardToggle: true,
        externalExit: true,
      });
    }
  }
  assert.deepEqual(errors, []);
  console.log(`PASS ${checks.length} fullscreen browser scenarios`);
} finally {
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}
