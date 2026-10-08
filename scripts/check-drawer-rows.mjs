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
  process.env.DRAWER_REPORT_DIR ?? "/tmp/easy-ui-drawer-rows",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || undefined,
});
const results = [];
const paginationResults = [];

try {
  for (const scheme of ["light", "dark"]) {
    for (const width of [1280, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 960 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(
        `${baseUrl}/iframe.html?id=components-drawertable--default&viewMode=story&globals=colorScheme:${scheme}`,
      );
      const list = page.getByRole("list", { name: "Parcel operations" });
      const rows = list.locator(":scope > li");
      await rows.first().waitFor();
      assert.equal(await rows.count(), 3);
      const first = rows.nth(0).locator("button[aria-expanded]");
      const second = rows.nth(1).locator("button[aria-expanded]");
      const summary = await first.innerText();
      await first.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("textbox", { name: /EP1001/ }).waitFor();
      assert.equal(await first.getAttribute("aria-expanded"), "true");
      assert.equal(await first.innerText(), summary);
      const panel = page.locator(
        `[id="${await first.getAttribute("aria-controls")}"]`,
      );
      const rowBounds = await rows.first().boundingBox();
      const panelBounds = await panel.boundingBox();
      assert.ok(Math.abs(rowBounds.width - panelBounds.width) <= 2);
      assert.ok(Math.abs(rowBounds.x - panelBounds.x) <= 1);
      await page.getByRole("button", { name: "Track EP1001" }).click();
      assert.equal(await first.getAttribute("aria-expanded"), "true");
      await page.getByRole("textbox", { name: /EP1001/ }).fill("Caller note");
      await second.focus();
      await page.keyboard.press("Space");
      await page.getByRole("textbox", { name: /EP1002/ }).waitFor();
      assert.equal(await first.getAttribute("aria-expanded"), "false");
      assert.equal(await second.getAttribute("aria-expanded"), "true");
      assert.equal(
        await page.getByRole("textbox", { name: /EP1001/ }).count(),
        0,
      );
      await first.click();
      assert.equal(
        await page.getByRole("textbox", { name: /EP1001/ }).inputValue(),
        "",
      );
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      assert.ok(overflow <= 1, `${scheme}/${width}: overflow ${overflow}`);
      const axe = require.resolve("axe-core/axe.min.js");
      await page.addScriptTag({ path: axe });
      const violations = await page.evaluate(async () => {
        const deadline = performance.now() + 10000;
        while (true) {
          try {
            const report = await window.axe.run(
              document.querySelector("#storybook-root"),
              { rules: { region: { enabled: false } } },
            );
            return report.violations;
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
      assert.deepEqual(errors, []);
      const screenshot = `${scheme}-${width}.png`;
      await list.screenshot({
        path: resolve(output, screenshot),
      });
      await page.addStyleTag({
        content: "html { font-size: 200% !important; }",
      });
      const largeTextOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      assert.ok(largeTextOverflow <= 1);
      results.push({ scheme, width, overflow, largeTextOverflow, screenshot });
      await page.goto(
        `${baseUrl}/iframe.html?id=components-drawertable--paginated&viewMode=story&globals=colorScheme:${scheme}`,
      );
      const navigation = page.getByRole("navigation", { name: "Parcel pages" });
      await navigation.waitFor();
      assert.equal(await list.locator(":scope > li").count(), 3);
      await page.getByRole("button", { name: "Track EP1001" }).waitFor();
      await page.getByRole("button", { name: "Next", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Track EP1004" }).waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Track EP1001" }).count(),
        0,
      );
      assert.equal(
        await navigation
          .getByRole("button", { name: "Page 2 of 8" })
          .getAttribute("aria-current"),
        "page",
      );
      await navigation
        .getByRole("button", { name: "Last", exact: true })
        .click();
      await page.getByRole("button", { name: "Track EP1024" }).waitFor();
      assert.equal(
        await navigation
          .getByRole("button", { name: "Next", exact: true })
          .isDisabled(),
        true,
      );
      await page.getByRole("button", { name: "Rows Per Page: 3" }).click();
      await page.getByRole("menuitemradio", { name: "6", exact: true }).click();
      assert.equal(await list.locator(":scope > li").count(), 6);
      await page.getByRole("button", { name: "Track EP1001" }).waitFor();
      assert.equal(
        await navigation
          .getByRole("button", { name: "Page 1 of 4" })
          .getAttribute("aria-current"),
        "page",
      );
      const paginationOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      assert.ok(
        paginationOverflow <= 1,
        `${scheme}/${width}: pagination overflow ${paginationOverflow}`,
      );
      const paginationScreenshot = `pagination-${scheme}-${width}.png`;
      await list
        .locator("..")
        .screenshot({ path: resolve(output, paginationScreenshot) });
      await page.addStyleTag({
        content: "html { font-size: 200% !important; }",
      });
      const paginationLargeTextOverflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      assert.ok(
        paginationLargeTextOverflow <= 1,
        `${scheme}/${width}: enlarged pagination overflow ${paginationLargeTextOverflow}`,
      );
      await page.addScriptTag({ path: axe });
      const paginationViolations = await page.evaluate(async () => {
        const deadline = performance.now() + 10000;
        while (true) {
          try {
            return (
              await window.axe.run(document.querySelector("#storybook-root"), {
                rules: { region: { enabled: false } },
              })
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
      assert.deepEqual(paginationViolations, []);
      assert.deepEqual(errors, []);
      paginationResults.push({
        scheme,
        width,
        overflow: paginationOverflow,
        largeTextOverflow: paginationLargeTextOverflow,
        screenshot: paginationScreenshot,
      });
      await page.close();
    }
  }
  const page = await browser.newPage();
  await page.goto(
    `${baseUrl}/iframe.html?id=components-drawerrow--disabled&viewMode=story`,
  );
  const disabled = page.locator("button[aria-expanded]");
  await disabled.waitFor();
  assert.equal(await disabled.isDisabled(), true);
  assert.equal(await disabled.getAttribute("aria-expanded"), "false");
  await page.close();
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(
      { results, paginationResults, disabled: "passed" },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({ output, results, paginationResults, disabled: "passed" }),
  );
} finally {
  await browser.close();
}
