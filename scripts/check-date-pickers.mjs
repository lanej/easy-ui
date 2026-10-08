import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(
  new URL("./preview-metrics/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const baseUrl = process.env.STORYBOOK_URL ?? "http://localhost:9013";
const output = process.env.DATE_REPORT_DIR ?? "/tmp/easy-ui-date-pickers";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || undefined,
});
const results = [];
async function audit(page) {
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
          performance.now() >= deadline
        ) {
          throw error;
        }
        await new Promise((finish) => setTimeout(finish, 50));
      }
    }
  });
  assert.deepEqual(violations, []);
}
try {
  for (const range of [false, true]) {
    const id = `components-datepicker-${range ? "daterangepicker" : "datepicker"}`;
    const label = range ? "Review period" : "Review date";
    const clear = range ? "Clear date range" : "Clear date";
    const submit = range ? "Apply period" : "Apply date";
    for (const scheme of ["light", "dark"]) {
      for (const width of [1280, 390, 320]) {
        const page = await browser.newPage({
          viewport: { width, height: 960 },
        });
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(
          `${baseUrl}/iframe.html?id=${id}--form&viewMode=story&globals=colorScheme:${scheme}`,
        );
        const field = page.getByRole("group", { name: label, exact: true });
        await field.waitFor();
        assert.equal(
          await field
            .getByRole("spinbutton")
            .evaluateAll(
              (segments) =>
                segments.filter((segment) => segment.closest("button")).length,
            ),
          0,
        );
        const submitted = range
          ? "Submitted: 2026-10-06 – 2026-10-13"
          : "Submitted: 2026-10-06";
        await page.getByRole("button", { name: submit, exact: true }).click();
        await page.getByText(submitted, { exact: true }).waitFor();
        const trigger = page.getByRole("button", { name: /calendar/i });
        await trigger.click();
        const dialog = page.getByRole("dialog");
        await dialog.waitFor();
        assert.ok(
          await dialog.evaluate((element) =>
            element.contains(document.activeElement),
          ),
        );
        await page.keyboard.press("Tab");
        assert.ok(
          await dialog.evaluate((element) =>
            element.contains(document.activeElement),
          ),
        );
        const bounds = await dialog.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
        await page.addScriptTag({
          path: require.resolve("axe-core/axe.min.js"),
        });
        await audit(page);
        const screenshot = `${id}-${scheme}-${width}.png`;
        await page.screenshot({
          path: resolve(output, screenshot),
          clip: {
            x: 0,
            y: 0,
            width: Math.min(width, 620),
            height: Math.ceil(bounds.y + bounds.height + 24),
          },
        });
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        await page.waitForFunction(
          (element) => element === document.activeElement,
          await trigger.elementHandle(),
          { timeout: 1000 },
        );
        await trigger.click();
        await dialog
          .getByRole("button", { name: /Thursday, October 8, 2026/ })
          .click();
        if (range) {
          await dialog
            .getByRole("button", { name: /Friday, October 16, 2026/ })
            .click();
        }
        await dialog.waitFor({ state: "hidden" });
        await page.getByRole("button", { name: submit, exact: true }).click();
        const selected = range
          ? "Submitted: 2026-10-08 – 2026-10-16"
          : "Submitted: 2026-10-08";
        await page.getByText(selected, { exact: true }).waitFor();
        await page.getByRole("button", { name: clear, exact: true }).click();
        assert.ok(
          await field
            .getByRole("spinbutton")
            .first()
            .evaluate((element) => element === document.activeElement),
        );
        assert.ok(
          await page
            .getByRole("button", { name: clear, exact: true })
            .isDisabled(),
        );
        assert.deepEqual(
          await page
            .locator("form")
            .evaluate((form) => [...new FormData(form).values()]),
          range ? ["", ""] : [""],
        );
        await page.getByRole("button", { name: submit, exact: true }).click();
        await page
          .getByText(/Choose (a date|a period) in October 2026\./)
          .last()
          .waitFor();
        assert.equal(
          await page.getByText(selected, { exact: true }).count(),
          1,
        );
        await audit(page);
        await page.addStyleTag({
          content: "html { font-size: 200% !important; }",
        });
        await trigger.click();
        await dialog.waitFor();
        assert.ok(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth + 1,
          ),
        );
        assert.ok(
          await dialog.evaluate(
            (element) => element.scrollWidth <= element.clientWidth + 1,
          ),
        );
        await page.keyboard.press("Escape");
        results.push({ id, scheme, width, screenshot });
        assert.deepEqual(errors, []);
        await page.close();
      }
    }
    const page = await browser.newPage();
    await page.goto(
      `${baseUrl}/iframe.html?id=${id}--read-only&viewMode=story`,
    );
    await page.getByRole("button", { name: clear, exact: true }).waitFor();
    assert.ok(
      await page.getByRole("button", { name: clear, exact: true }).isDisabled(),
    );
    assert.ok(
      await page.getByRole("button", { name: /calendar/i }).isDisabled(),
    );
    await page.close();
  }
  const page = await browser.newPage();
  await page.goto(
    `${baseUrl}/iframe.html?id=components-datepicker-datepicker--localized&viewMode=story`,
  );
  await page.getByRole("button", { name: "Effacer la date" }).waitFor();
  await page.getByRole("button", { name: /calendrier/i }).click();
  await page
    .getByRole("dialog")
    .locator("span")
    .filter({ hasText: /^octobre 2026$/ })
    .waitFor();
  await page.close();
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify({ results, localization: "fr-FR" }, null, 2),
  );
  console.log(JSON.stringify({ output, cases: results.length }, null, 2));
} finally {
  await browser.close();
}
