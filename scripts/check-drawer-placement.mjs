import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(
  new URL("./preview-metrics/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const baseUrl = process.env.STORYBOOK_URL ?? "http://localhost:9013";
const output =
  process.env.DRAWER_PLACEMENT_REPORT_DIR ?? "/tmp/easy-ui-drawer-placement";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || undefined,
  executablePath: process.env.BROWSER_EXECUTABLE || undefined,
});
const results = [];
let activePage;
const schemes = ["light", "dark"];
async function focusedInside(dialog) {
  assert.ok(
    await dialog.evaluate((node) => node.contains(document.activeElement)),
    "Focus must remain inside the drawer",
  );
}
async function waitForRestoredFocus(page, opener) {
  await page.waitForFunction(
    (element) => element === document.activeElement,
    await opener.elementHandle(),
  );
}
async function audit(page) {
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const violations = await page.evaluate(async () => {
    const deadline = performance.now() + 10000;
    while (true) {
      try {
        return (
          await window.axe.run(document.body, {
            rules: { region: { enabled: false } },
          })
        ).violations;
      } catch (error) {
        if (
          !String(error).includes("Axe is already running") ||
          performance.now() > deadline
        )
          throw error;
        await new Promise((done) => setTimeout(done, 50));
      }
    }
  });
  assert.deepEqual(violations, []);
}
try {
  for (const [story, placement, requestedWidth] of [
    ["left-navigation", "left", 280],
    ["right-navigation", "right", 440],
    ["wide-navigation", "left", 960],
  ]) {
    for (const scheme of schemes) {
      for (const width of [1280, 390, 320]) {
        const page = (activePage = await browser.newPage({
          viewport: { width, height: 900 },
          colorScheme: scheme,
        }));
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(
          `${baseUrl}/iframe.html?id=components-drawer--${story}&viewMode=story&globals=colorScheme:${scheme}`,
        );
        const opener = page.getByRole("button", {
          name: "Open navigation",
          exact: true,
        });
        await opener.click();
        const dialog = page.getByRole("dialog", {
          name: "Workspace navigation",
          exact: true,
        });
        await dialog.waitFor();
        await page.waitForTimeout(200);
        await focusedInside(dialog);
        assert.equal(
          await dialog.locator("h1,h2,h3,h4,h5,h6").count(),
          0,
          "Headerless naming must work",
        );
        const bounds = await dialog.boundingBox();
        assert.equal(Math.round(bounds.width), Math.min(width, requestedWidth));
        assert.equal(
          Math.round(bounds.x),
          placement === "left" ? 0 : width - Math.min(width, requestedWidth),
        );
        for (let count = 0; count < 10; count++) {
          await page.keyboard.press("Tab");
          await focusedInside(dialog);
        }
        for (let count = 0; count < 10; count++) {
          await page.keyboard.press("Shift+Tab");
          await focusedInside(dialog);
        }
        const scrollBefore = await page.evaluate(() => window.scrollY);
        await page.mouse.move(
          Math.min(width - 1, bounds.x + bounds.width / 2),
          500,
        );
        await page.mouse.wheel(0, 600);
        await page.waitForTimeout(80);
        assert.equal(
          await page.evaluate(() => window.scrollY),
          scrollBefore,
          "Background scroll must stay locked",
        );
        await audit(page);
        const screenshot = `${story}-${scheme}-${width}.png`;
        await page.screenshot({ path: resolve(output, screenshot) });
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        await waitForRestoredFocus(page, opener);
        await page.getByText("Dismiss requests: 1", { exact: true }).waitFor();
        await opener.click();
        await dialog.waitFor();
        await page.waitForTimeout(200);
        if (requestedWidth < width) {
          await page.mouse.click(placement === "left" ? width - 5 : 5, 450);
          await dialog.waitFor({ state: "hidden" });
          await waitForRestoredFocus(page, opener);
          await page
            .getByText("Dismiss requests: 2", { exact: true })
            .waitFor();
          await opener.click();
        }
        await dialog
          .getByRole("button", { name: "Orders", exact: true })
          .click();
        await dialog.waitFor({ state: "hidden" });
        await waitForRestoredFocus(page, opener);
        await page
          .getByText("Current destination: Orders", { exact: true })
          .waitFor();
        await page.mouse.move(width / 2, 700);
        await page.mouse.wheel(0, 400);
        await page.waitForFunction(() => window.scrollY > 0);
        assert.deepEqual(errors, []);
        results.push({
          story,
          scheme,
          width,
          bounds,
          screenshot,
          keyboard: true,
          scrollLock: true,
          controlledReopen: true,
          axe: true,
        });
        await page.close();
      }
      // Resize an already open overlay in both directions without replacing its content.
      const page = (activePage = await browser.newPage({
        viewport: { width: 1280, height: 900 },
      }));
      await page.goto(
        `${baseUrl}/iframe.html?id=components-drawer--${story}&viewMode=story&globals=colorScheme:${scheme}`,
      );
      await page.getByRole("button", { name: "Open navigation" }).click();
      const dialog = page.getByRole("dialog", { name: "Workspace navigation" });
      await dialog
        .getByRole("button", { name: "Settings", exact: true })
        .focus();
      for (const width of [320, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(200);
        assert.equal(
          Math.round((await dialog.boundingBox()).width),
          Math.min(width, requestedWidth),
        );
        await focusedInside(dialog);
        assert.equal(
          await dialog
            .getByRole("button", { name: "Settings", exact: true })
            .evaluate((node) => node === document.activeElement),
          true,
        );
      }
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      results.push({
        story,
        scheme,
        resize: "1280 → 320 → 1280",
        focusPreserved: true,
      });
      await page.close();
    }
  }
  // Existing callers retain the right-side 608px default and title-based naming.
  const page = (activePage = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  }));
  await page.goto(
    `${baseUrl}/iframe.html?id=components-drawer--standalone&viewMode=story`,
  );
  const opener = page.getByRole("button", { name: "Open drawer" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Drawer Title" });
  await page.waitForTimeout(200);
  const bounds = await dialog.boundingBox();
  assert.equal(Math.round(bounds.width), 608);
  assert.equal(Math.round(bounds.x), 672);
  await page.mouse.click(5, 450);
  await dialog.waitFor({ state: "hidden" });
  await waitForRestoredFocus(page, opener);
  await opener.click();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await waitForRestoredFocus(page, opener);
  results.push({
    story: "standalone",
    defaultRight: true,
    defaultWidth: 608,
    dismissal: true,
  });
  await page.close();
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(
    `Drawer placement: ${results.length} browser scenarios passed; evidence: ${output}`,
  );
} catch (error) {
  await activePage
    ?.screenshot({ path: resolve(output, "failure.png") })
    .catch(() => {});
  await writeFile(
    resolve(output, "failure.json"),
    JSON.stringify({ error: String(error), completed: results }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
