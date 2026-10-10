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
    state: "attached",
  });
  await waitForResponsiveLayout();
  if ((await root().getAttribute("data-narrow")) !== "true") await waitForMap();
  await page.waitForFunction(
    () =>
      document.fonts.status === "loaded" &&
      window.investigationMap?.isStyleLoaded(),
  );
}
async function waitForResponsiveLayout() {
  await page.waitForFunction(() => {
    const workspace = document.querySelector(
      '[aria-label="Event investigation"]',
    );
    return (
      workspace?.getAttribute("data-narrow") ===
      String(workspace.getBoundingClientRect().width <= 740)
    );
  });
}
async function waitForMap() {
  await page.waitForFunction(() => {
    const map = window.investigationMap;
    const element = map?.getContainer();
    return (
      element?.clientWidth > 0 &&
      element.dataset.initialViewReady === "true" &&
      element.dataset.mapIdle === "true" &&
      !map.isMoving() &&
      map.getCanvas().clientWidth === element.clientWidth &&
      map.getCanvas().clientHeight === element.clientHeight
    );
  });
}
async function showMap() {
  const tab = page.getByRole("tab", { name: "Map", exact: true });
  if (await tab.count()) await tab.click();
  await waitForMap();
}
async function audit(name) {
  // setViewportSize can resolve before ResizeObserver commits the mobile view.
  await waitForResponsiveLayout();
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
  if ((await root().getAttribute("data-narrow")) === "true") {
    assert.equal(
      await root().locator("[data-view-panel]:visible").count(),
      1,
      `${name}: only the active tab panel is visible`,
    );
  } else {
    const map = await root().locator('[data-view-panel="map"]').boundingBox();
    const inspector = await details().boundingBox();
    const rowGap = await root()
      .locator('[data-view-panel="map"]')
      .evaluate((panel) =>
        parseFloat(getComputedStyle(panel.parentElement).rowGap),
      );
    const events = await root()
      .locator('[data-view-panel="events"]')
      .boundingBox();
    assert(
      Math.abs(events.y - map.y) <= 1 &&
        Math.abs(events.y + events.height - inspector.y - inspector.height) <=
          1,
      `${name}: both columns share top and bottom boundaries`,
    );
    assert(
      Math.abs(inspector.y - map.y - map.height - rowGap) <= 1,
      `${name}: short inspectors stay directly below the map`,
    );
  }
  const headline = details().getByRole("group", {
    name: "Current dwell",
    exact: true,
  });
  if (await headline.isVisible()) {
    const label = await headline
      .getByText("Current dwell", { exact: true })
      .boundingBox();
    const value = await headline
      .getByRole("img", { name: "6 h", exact: true })
      .boundingBox();
    assert(
      Math.abs(label.y + label.height / 2 - value.y - value.height / 2) < 8,
      `${name}: label, status and value share one row`,
    );
    assert(label.width > 70, `${name}: headline has readable width`);
  }
  checks.push(name);
}
async function screenshot(name) {
  await page.mouse.move(0, 0);
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.activeElement?.blur());
  await page
    .locator("#storybook-root")
    .screenshot({ path: `${output}/${name}.png` });
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
    "scoped-event",
  ];
  for (const theme of process.env.INVESTIGATION_INTERACTIONS_ONLY
    ? []
    : ["light", "dark"]) {
    for (const width of [1200, 390]) {
      for (const story of stories) {
        await open(story, theme, width);
        await audit(`${story}-${theme}-${width}`);
        if (
          [
            "linked-selection",
            "shared-connection",
            "unlocated-event",
            "scoped-event",
            "selection-without-charts",
          ].includes(story)
        )
          await screenshot(`${story}-${theme}-${width}`);
        if ((await root().getAttribute("data-narrow")) === "true") {
          await showMap();
          await audit(`${story}-${theme}-${width}-map`);
          assert(
            await page.evaluate(() => {
              const map = window.investigationMap;
              const box = map.getCanvas();
              return [
                [-3, 0],
                [-0.8, 0],
                [1, 1],
                [1, -1],
                [3, 0],
                [-2, 1.3],
              ].every((coordinate) => {
                const point = map.project(coordinate);
                return (
                  point.x >= 12 &&
                  point.x <= box.clientWidth - 12 &&
                  point.y >= 12 &&
                  point.y <= box.clientHeight - 12
                );
              });
            }),
            `${story}: initial map frame contains every location`,
          );
          assert(
            await page.evaluate(() => {
              const markers = [
                ...document.querySelectorAll(".maplibregl-marker"),
              ];
              const labels = markers
                .map((marker) => marker.lastElementChild)
                .filter(
                  (label) => getComputedStyle(label).visibility === "visible",
                );
              return labels.every((label) => {
                const box = label.getBoundingClientRect();
                return markers.every((marker) => {
                  if (marker === label.parentElement) return true;
                  const pin = marker.firstElementChild.getBoundingClientRect();
                  return (
                    box.right <= pin.left ||
                    box.left >= pin.right ||
                    box.bottom <= pin.top ||
                    box.top >= pin.bottom
                  );
                });
              });
            }),
            `${story}: map labels do not cover location markers`,
          );
          if (story === "linked-selection") {
            await screenshot(`${story}-${theme}-${width}-map`);
            await details()
              .getByRole("button", { name: "Show details", exact: true })
              .click();
            await audit(`${story}-${theme}-${width}-expanded`);
            await screenshot(`${story}-${theme}-${width}-expanded`);
          }
        }
      }
    }
  }
  await open("linked-selection", "light", 820);
  await audit("linked-selection-tablet");
  await open("linked-selection");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await audit("linked-selection-desktop-large-text");
  await screenshot("linked-selection-desktop-large-text");
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
  assert(await details().getByText("Location · 3 events").isVisible());
  await page
    .getByRole("region", { name: "Facility details", exact: true })
    .waitFor({
      state: "hidden",
    });
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
  await waitForMap();
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
    await root()
      .getByRole("button", { name: "Via North Gate", exact: true })
      .isVisible(),
  );
  assert(
    await root()
      .getByRole("button", { name: "Via South Gate", exact: true })
      .isVisible(),
  );
  await root()
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
  await page.getByRole("tab", { name: "Events", exact: true }).waitFor();
  await page.getByRole("tab", { name: "Events", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  assert(
    await page
      .getByRole("tab", { name: "Map", exact: true })
      .evaluate((tab) => tab === document.activeElement),
  );
  await waitForMap();
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
  assert(await details().getByText("Location · 0 events").isVisible());
  const retainedCamera = await page.evaluate(() => ({
    center: window.investigationMap.getCenter().toArray(),
    zoom: window.investigationMap.getZoom(),
  }));
  await page.getByRole("tab", { name: "Events", exact: true }).click();
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  await waitForMap();
  assert.deepEqual(
    await page.evaluate(() => ({
      center: window.investigationMap.getCenter().toArray(),
      zoom: window.investigationMap.getZoom(),
    })),
    retainedCamera,
    "Tab switching preserves camera",
  );
  await audit("linked-keyboard-pointer-and-resize");
  await open("scoped-event");
  assert(
    await details()
      .getByText("Via North Gate · Event 2 of 4", { exact: true })
      .isVisible(),
  );
  assert.equal(await timeline().locator('[data-related="true"]').count(), 4);
  await page.getByRole("checkbox", { name: "Related only" }).check();
  assert.equal(await timeline().getByRole("button").count(), 4);
  await details()
    .getByRole("button", { name: "Next event", exact: true })
    .click();
  assert(
    await details()
      .getByText("Via North Gate · Event 3 of 4", { exact: true })
      .isVisible(),
  );
  await details()
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  assert.equal(await timeline().getByRole("button").count(), 7);
  await audit("scoped-timeline-filter-and-stepping");
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
  await open("control-placement");
  await page.evaluate(() => {
    window.savedInvestigationMap = window.investigationMap;
    window.savedInvestigationCanvas = window.investigationMap.getCanvas();
    window.investigationMap.jumpTo({ center: [0.4, 0.3], zoom: 5 });
  });
  await waitForMap();
  const chosenCamera = await page.evaluate(() => ({
    center: window.investigationMap.getCenter().toArray(),
    zoom: window.investigationMap.getZoom(),
  }));
  for (const placement of ["toolbar", "map"]) {
    await page
      .getByRole("button", {
        name: `Move controls to ${placement}`,
        exact: true,
      })
      .click();
    await waitForMap();
    assert(
      await page.evaluate(
        () =>
          window.savedInvestigationMap === window.investigationMap &&
          window.savedInvestigationCanvas ===
            window.investigationMap.getCanvas(),
      ),
      "Control placement preserves the map and canvas",
    );
    assert.deepEqual(
      await page.evaluate(() => ({
        center: window.investigationMap.getCenter().toArray(),
        zoom: window.investigationMap.getZoom(),
      })),
      chosenCamera,
      "Control placement preserves the chosen camera",
    );
    await audit(`control-placement-${placement}`);
  }

  await open("linked-selection");
  const marker = page.getByRole("button", {
    name: "Select Central Exchange",
    exact: true,
  });
  await marker.focus();
  await page.setViewportSize({ width: 390, height: 1100 });
  await waitForResponsiveLayout();
  await waitForMap();
  assert.equal(
    await page
      .getByRole("tab", { name: "Map", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  assert(
    await marker.evaluate((node) => node === document.activeElement),
    "Narrowing keeps the focused map marker visible",
  );
  await page.getByRole("tab", { name: "Map", exact: true }).focus();
  await page.setViewportSize({ width: 1200, height: 1100 });
  await waitForResponsiveLayout();
  assert(
    await root()
      .locator('[data-view-panel="map"]')
      .evaluate((node) => node === document.activeElement),
    "Widening moves map-tab focus to its panel",
  );
  const eventButton = timeline().getByRole("button", {
    name: /08:00.*Accepted/,
  });
  await eventButton.focus();
  await page.setViewportSize({ width: 390, height: 1100 });
  await waitForResponsiveLayout();
  assert.equal(
    await page
      .getByRole("tab", { name: "Events", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  assert(
    await eventButton.evaluate((node) => node === document.activeElement),
    "Narrowing keeps the focused event visible",
  );
  await page.getByRole("tab", { name: "Events", exact: true }).focus();
  await page.setViewportSize({ width: 1200, height: 1100 });
  await waitForResponsiveLayout();
  assert(
    await root()
      .locator('[data-view-panel="events"]')
      .evaluate((node) => node === document.activeElement),
    "Widening moves events-tab focus to its panel",
  );
  await audit("responsive-focus-preservation");

  await open("external-selection");
  const outsideButton = page.getByRole("button", {
    name: "Refresh records",
    exact: true,
  });
  await outsideButton.focus();
  for (const width of [390, 1200]) {
    await page.setViewportSize({ width, height: 1100 });
    await waitForResponsiveLayout();
    assert(
      await outsideButton.evaluate((node) => node === document.activeElement),
      "Responsive layout does not steal outside focus",
    );
  }
  await audit("responsive-outside-focus");
  assert.deepEqual(errors, [], "Browser runtime errors");
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ checks, errors, violations: 0 }, null, 2),
  );
  console.log(JSON.stringify({ checks: checks.length, violations: 0 }));
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  throw error;
} finally {
  await browser.close();
}
