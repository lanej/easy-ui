import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(
  new URL("./preview-metrics/package.json", import.meta.url),
);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseUrl = process.env.STORYBOOK_URL ?? "http://localhost:9013";
const output = resolve(
  process.env.NOTIFICATION_REPORT_DIR ?? "/tmp/easy-ui-notifications-browser",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || undefined,
  executablePath: process.env.BROWSER_EXECUTABLE || undefined,
});
const results = [];
let activePage;
let activeCase;
let activeErrors;
try {
  for (const mode of ["light", "dark"]) {
    for (const width of [1280, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 720 } });
      const errors = [];
      activePage = page;
      activeCase = `${mode}-${width}`;
      activeErrors = errors;
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(
        `${baseUrl}/iframe.html?id=components-notification--stacked-notifications&viewMode=story&globals=colorScheme:${mode}`,
      );
      await page
        .locator('[data-notification-interactions="complete"]')
        .waitFor();
      await page.waitForTimeout(200); // finish the story's exit transitions
      const clockStart = new Date("2026-01-01T00:00:00Z");
      await page.clock.install({ time: clockStart });
      await page.clock.pauseAt(new Date(clockStart.getTime() + 1000));
      await page
        .getByRole("button", { name: "Save two orders", exact: true })
        .click();
      await page.clock.runFor(200);
      const closeA = page.getByRole("button", {
        name: "Dismiss Order A saved",
        exact: true,
      });
      const closeB = page.getByRole("button", {
        name: "Dismiss Order B saved",
        exact: true,
      });
      assert.equal(await page.getByRole("alertdialog").count(), 3);
      assert.equal(await page.getByRole("status").count(), 2);
      assert.equal(await page.getByRole("alert").count(), 1);
      assert.equal(
        await page.getByRole("region").getAttribute("aria-live"),
        null,
      );
      for (const button of [closeA, closeB])
        assert.ok(await button.isVisible());
      await page
        .getByRole("button", { name: "Show long update", exact: true })
        .click();
      await page.clock.runFor(200);
      for (const item of await page.getByRole("alertdialog").all()) {
        const rect = await item.boundingBox();
        assert.ok(
          rect.x >= 0 && rect.x + rect.width <= width + 1,
          `notification fits ${width}`,
        );
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: resolve(output, `${mode}-${width}-stack.png`),
      });
      await closeA.click();
      await page.clock.runFor(200);
      assert.equal(await closeA.count(), 0);
      assert.ok(await closeB.isVisible());
      await page.clock.runFor(1600); // first notifications have now used 2200ms
      await closeB.hover();
      await closeB.focus();
      await page.clock.runFor(10000);
      await page.mouse.move(0, 0);
      await page.clock.runFor(10000); // keyboard focus must continue the pause
      assert.ok(await closeB.isVisible());
      await page
        .getByRole("button", { name: "Repeat identical message", exact: true })
        .focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      assert.equal(
        await page
          .getByRole("button", { name: "Dismiss Order saved", exact: true })
          .count(),
        2,
      );
      await page
        .getByRole("button", {
          name: "Dismiss last repeated message",
          exact: true,
        })
        .click();
      await page.clock.runFor(200);
      assert.equal(
        await page
          .getByRole("button", { name: "Dismiss Order saved", exact: true })
          .count(),
        1,
      );
      await page.clock.runFor(2599);
      assert.ok(await closeB.isVisible());
      await page.clock.runFor(201); // expiration + exit animation, not a new five seconds
      assert.equal(await closeB.count(), 0);
      assert.equal(
        await page
          .getByRole("button", { name: "Dismiss Order saved", exact: true })
          .count(),
        1,
      );
      await page.clock.runFor(2500);
      assert.equal(await page.getByRole("status").count(), 0);
      await page
        .getByRole("button", { name: "Repeat identical message", exact: true })
        .click();
      const newestClose = page.getByRole("button", {
        name: "Dismiss Order saved",
        exact: true,
      });
      await newestClose.focus();
      await page.keyboard.press("Enter");
      await page.clock.runFor(200);
      assert.ok(
        await page
          .getByRole("alertdialog")
          .evaluate((element) => element === document.activeElement),
      );
      const alertClose = page.getByRole("button", {
        name: "Dismiss Address review required",
        exact: true,
      });
      assert.ok(await alertClose.isVisible());
      await alertClose.focus();
      await page.keyboard.press("Enter");
      await page.clock.runFor(200);
      assert.equal(await page.getByRole("alertdialog").count(), 0);
      assert.deepEqual(errors, []);
      results.push({ mode, width, passed: true });
      await page.close();
    }
  }
} catch (error) {
  if (activePage) {
    await activePage
      .screenshot({ path: resolve(output, `${activeCase}-failure.png`) })
      .catch(() => {});
    await writeFile(
      resolve(output, "failure.json"),
      JSON.stringify(
        {
          case: activeCase,
          error: String(error),
          pageErrors: activeErrors,
          body: await activePage
            .locator("body")
            .innerText()
            .catch(() => ""),
        },
        null,
        2,
      ),
    );
  }
  throw error;
} finally {
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify({ output, results }, null, 2));
