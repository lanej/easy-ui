import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const output = resolve(
  process.env.INVESTIGATION_REPORT_DIR ?? "/tmp/easy-ui-investigation",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    ...JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
  ],
});
const page = await browser.newPage({
  viewport: { width: 1200, height: 1100 },
  deviceScaleFactor: 1.5,
});
const errors = [],
  checks = [];
page.on("pageerror", (error) => {
  console.log(`Browser error: ${error.message}`);
  errors.push(error.message);
});
const base = process.env.STORYBOOK_URL ?? "http://localhost:9019";
const root = () =>
  page.getByRole("region", { name: "Event investigation", exact: true });
const details = () =>
  page.getByRole("region", { name: "Selection details", exact: true });
const timeline = () => page.getByRole("list", { name: "Events", exact: true });
async function open(story, theme = "light", width = 1200) {
  await page.setViewportSize({ width, height: 1100 });
  await page.goto(
    `${base}/iframe.html?id=organisms-investigation-investigationworkspace--${story}&viewMode=story&globals=colorScheme:${theme}`,
  );
  console.log(`Open ${story} ${theme} ${width}`);
  await root().waitFor();
  await page.waitForSelector('[data-map-state="ready"]', {
    timeout: 30000,
  });
  await page.waitForSelector('[data-map-idle="true"]');
  await page.waitForFunction(
    () =>
      document.fonts.status === "loaded" &&
      window.investigationMap?.isStyleLoaded(),
  );
}
async function audit(name) {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `${name}: page overflow`,
  );
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  let result;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      result = await page.evaluate(() =>
        axe.run(document.querySelector("#storybook-root"), {
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
      nodes: nodes.map(({ target }) => target),
    })),
    [],
    `${name}: accessibility`,
  );
  checks.push(name);
}
async function screenshot(name) {
  await page.mouse.move(0, 0);
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}
try {
  const stories = [
    "linked-selection",
    "shared-connection",
    "conflicting-histories",
    "multiple-events-at-location",
    "unlocated-event",
    "location-without-events",
    "narrow",
    "selection-without-charts",
    "external-selection",
    "empty-events",
  ];
  for (const theme of process.env.INVESTIGATION_INTERACTIONS_ONLY
    ? []
    : ["light", "dark"]) {
    for (const width of [1200, 390]) {
      for (const story of stories) {
        await open(story, theme, width);
        await audit(`${story}-${theme}-${width}`);
        if (
          ["linked-selection", "shared-connection", "unlocated-event"].includes(
            story,
          )
        )
          await screenshot(`${story}-${theme}-${width}`);
      }
    }
  }
  await open("linked-selection");
  const originalCamera = await page.evaluate(() => ({
    center: window.investigationMap.getCenter().toArray(),
    zoom: window.investigationMap.getZoom(),
  }));
  await timeline()
    .getByRole("button", { name: /Processed at North Gate/ })
    .click();
  assert(
    await details()
      .getByRole("heading", { name: "Processed at North Gate" })
      .isVisible(),
  );
  assert.equal(
    await page
      .locator('.maplibregl-marker[aria-pressed="true"]')
      .getAttribute("aria-label"),
    "Select North Gate",
  );
  // Hover a different marker without changing persistent selection.
  await page
    .locator(".maplibregl-marker")
    .filter({ hasText: "" })
    .first()
    .hover();
  assert(
    await details()
      .getByRole("heading", { name: "Processed at North Gate" })
      .isVisible(),
  );
  await page
    .getByRole("button", { name: "Select Central Exchange", exact: true })
    .click();
  assert(await details().getByText("3 associated events").isVisible());
  await details()
    .getByRole("button", { name: "Next event", exact: true })
    .click();
  assert(await details().getByText("10:34", { exact: true }).isVisible());
  await details()
    .getByRole("button", { name: "Next event", exact: true })
    .click();
  assert(await details().getByText("11:05", { exact: true }).isVisible());
  // Select the physical midpoint of the shared connection through the map hit layer.
  await page.keyboard.press("Escape");
  await page.locator(".maplibregl-canvas").scrollIntoViewIfNeeded();
  const point = await page.evaluate(() => {
    const map = window.investigationMap;
    const point = map.project([-1.9, 0]);
    const box = map.getCanvas().getBoundingClientRect();
    return { x: point.x + box.x, y: point.y + box.y };
  });
  await page.mouse.click(point.x, point.y);
  await details()
    .getByRole("heading", {
      name: "North Harbor → Central Exchange",
      exact: true,
    })
    .waitFor();
  assert(
    await details()
      .getByRole("heading", {
        name: "North Harbor → Central Exchange",
        exact: true,
      })
      .isVisible(),
  );
  assert(
    await details()
      .getByRole("button", { name: "Via North Gate", exact: true })
      .isVisible(),
  );
  assert(
    await details()
      .getByRole("button", { name: "Via South Gate", exact: true })
      .isVisible(),
  );
  await details()
    .getByRole("button", { name: "Via South Gate", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await timeline()
    .getByRole("button", { name: /Location not reported/ })
    .focus();
  await page.keyboard.press("Enter");
  assert(
    await details().getByText("Not supplied", { exact: true }).isVisible(),
  );
  assert.equal(
    await page.locator('.maplibregl-marker[aria-pressed="true"]').count(),
    0,
  );
  const currentCamera = await page.evaluate(() => ({
    center: window.investigationMap.getCenter().toArray(),
    zoom: window.investigationMap.getZoom(),
  }));
  assert.deepEqual(
    currentCamera,
    originalCamera,
    "Selection must not reset camera",
  );
  // Responsive layout changes preserve the same mounted map and selection.
  await page.evaluate(() => {
    window.savedInvestigationMap = window.investigationMap;
  });
  await page.setViewportSize({ width: 390, height: 1100 });
  await page.waitForFunction(
    () =>
      window.investigationMap.getCanvas().clientWidth ===
      window.investigationMap.getContainer().clientWidth,
  );
  assert(
    await details()
      .getByRole("heading", { name: "Location not reported" })
      .isVisible(),
  );
  assert(
    await page.evaluate(
      () => window.savedInvestigationMap === window.investigationMap,
    ),
  );
  await page
    .getByText("Browse locations and connections", { exact: true })
    .click();
  await page.getByRole("button", { name: "West Annex", exact: true }).focus();
  await page.keyboard.press("Enter");
  assert(await details().getByText("0 associated events").isVisible());
  await audit("linked-keyboard-pointer-and-resize");
  await open("external-selection");
  await page
    .getByRole("button", { name: "Select unlocated event externally" })
    .click();
  await page.getByRole("button", { name: "Refresh records" }).click();
  assert(
    await details()
      .getByRole("heading", { name: "Location not reported" })
      .isVisible(),
  );
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page.setViewportSize({ width: 390, height: 1100 });
  await audit("external-selection-refresh-large-text");
  assert.deepEqual(errors, [], "Browser runtime errors");
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ checks, errors, violations: 0 }, null, 2),
  );
  console.log(JSON.stringify({ checks: checks.length, violations: 0 }));
} finally {
  await browser.close();
}
