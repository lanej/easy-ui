import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const output = resolve(
  process.env.INVESTIGATION_REPORT_DIR ?? "/tmp/easy-ui-investigation",
  "map-free",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const page = await browser.newPage({
  viewport: { width: 1200, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.message));
const inspector = () =>
  page.getByRole("region", { name: "Selection details", exact: true });
const timeline = () =>
  page.getByRole("list", { name: "Account activity", exact: true });
async function waitForLayout() {
  await page.waitForFunction(() => {
    const panel = document.querySelector('[aria-label="Selection details"]');
    return (
      panel?.getAttribute("data-narrow") ===
      String(panel.getBoundingClientRect().width <= 740)
    );
  });
}
async function audit(name) {
  await waitForLayout();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `${name}: horizontal overflow`,
  );
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  let result;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      result = await page.evaluate(() =>
        window.axe.run(document.querySelector("#storybook-root"), {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        }),
      );
      break;
    } catch (error) {
      if (!String(error).includes("already running") || attempt === 39)
        throw error;
      await page.waitForTimeout(50);
    }
  }
  assert.deepEqual(
    result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target),
    })),
    [],
    `${name}: accessibility`,
  );
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
  checks.push(name);
}
try {
  for (const theme of ["light", "dark"]) {
    for (const width of [1200, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(
        `${process.env.STORYBOOK_URL ?? "http://localhost:9019"}/iframe.html?id=organisms-investigation-investigationworkspace--map-free&viewMode=story&globals=colorScheme:${theme}`,
      );
      await inspector().waitFor();
      await waitForLayout();
      await page.waitForFunction(() => document.fonts.status === "loaded");
      assert.equal(
        await page.locator("[data-map-state], .maplibregl-map").count(),
        0,
        "Composition mounts no map",
      );
      const rows = timeline().getByRole("button");
      await rows.nth(1).focus();
      await page.keyboard.press("Home");
      assert.equal(await rows.nth(0).getAttribute("aria-current"), "true");
      assert(
        await rows.nth(0).evaluate((node) => node === document.activeElement),
      );
      assert(
        await inspector()
          .getByRole("button", { name: "Previous event", exact: true })
          .isDisabled(),
      );
      await page.keyboard.press("End");
      assert.equal(await rows.nth(2).getAttribute("aria-current"), "true");
      assert(
        await inspector()
          .getByRole("button", { name: "Next event", exact: true })
          .isDisabled(),
      );
      await page.keyboard.press("ArrowUp");
      assert.equal(await rows.nth(1).getAttribute("aria-current"), "true");
      await inspector()
        .getByRole("button", { name: "Previous event", exact: true })
        .click();
      await inspector()
        .getByRole("button", { name: "Next event", exact: true })
        .click();
      if (width === 390) {
        assert.equal(
          await inspector()
            .getByRole("button", { name: "Open audit record", exact: true })
            .count(),
          0,
        );
        await inspector()
          .getByRole("button", { name: "Show details", exact: true })
          .click();
        assert(
          await inspector()
            .getByRole("button", { name: "Open audit record", exact: true })
            .isVisible(),
        );
        await audit(`narrow-expanded-${theme}`);
        await inspector()
          .getByRole("button", { name: "Hide details", exact: true })
          .click();
      }
      await audit(`${width === 390 ? "narrow" : "wide"}-${theme}`);
      await inspector()
        .getByRole("button", { name: "Clear selection", exact: true })
        .click();
      assert.equal(
        await timeline().locator('[aria-current="true"]').count(),
        0,
      );
      assert(
        await inspector()
          .getByText("Select an account event.", { exact: true })
          .isVisible(),
      );
      await rows.nth(1).click();
      assert.equal(await rows.nth(1).getAttribute("aria-current"), "true");
    }
  }
  await page.setViewportSize({ width: 1200, height: 1000 });
  await waitForLayout();
  const action = inspector().getByRole("button", {
    name: "Open audit record",
    exact: true,
  });
  await action.focus();
  await page.setViewportSize({ width: 390, height: 1000 });
  await waitForLayout();
  assert(
    await inspector()
      .getByRole("button", { name: "Show details", exact: true })
      .evaluate((node) => node === document.activeElement),
    "Narrowing restores focus to disclosure",
  );
  await inspector()
    .getByRole("button", { name: "Show details", exact: true })
    .click();
  await action.focus();
  await page.setViewportSize({ width: 1200, height: 1000 });
  await waitForLayout();
  assert(
    await action.evaluate((node) => node === document.activeElement),
    "Widening retains rich-action focus",
  );
  assert.deepEqual(errors, [], "Browser runtime errors");
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ checks, errors, violations: 0 }, null, 2),
  );
  console.log(JSON.stringify({ checks, errors, violations: 0 }));
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  throw error;
} finally {
  await browser.close();
}
