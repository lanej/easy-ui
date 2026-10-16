import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9018";
const output = resolve(
  process.env.FACILITY_REPORT_DIR ?? "/tmp/easy-ui-metrics",
  "dependency-tree",
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
async function open(story, theme = "light") {
  await page.goto(
    `${base}/iframe.html?id=components-dependencygraph--${story}&viewMode=story&globals=colorScheme:${theme}`,
  );
  await page.getByRole("treegrid", { name: "Resource tree" }).waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function geometry() {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Page must not overflow horizontally",
  );
  assert(
    await page
      .locator("[data-tree-viewport]")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    "Tree must fit its available width",
  );
}
try {
  for (const theme of ["light", "dark"]) {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const story of [
        "compact-tree",
        "dependency-tree",
        "tree-without-inspector",
      ]) {
        await open(story, theme);
        await geometry();
        if (width === 1280 && story !== "tree-without-inspector") {
          const heights = await page
            .locator("[data-tree-row-header]")
            .evaluateAll((rows) =>
              rows.map((row) => row.getBoundingClientRect().height),
            );
          assert(
            heights.every((height) => height <= 48),
            "Desktop tree rows stay compact",
          );
        }
        await page.addScriptTag({
          path: require.resolve("axe-core/axe.min.js"),
        });
        const violations = await page.evaluate(async () => {
          // Storybook's addon may already be auditing this frame.
          for (let attempt = 0; attempt < 240; attempt++) {
            if (window.axe._running) {
              await new Promise(requestAnimationFrame);
              continue;
            }
            return (
              await window.axe.run(
                document.querySelector("[data-dependency-graph]"),
                {
                  runOnly: {
                    type: "tag",
                    values: ["wcag2a", "wcag2aa", "wcag21aa"],
                  },
                },
              )
            ).violations.map(({ id, nodes }) => ({
              id,
              targets: nodes.map(({ target }) => target),
            }));
          }
          throw new Error("Storybook accessibility audit did not finish");
        });
        assert.deepEqual(
          violations,
          [],
          `${story} ${theme} ${width}: accessibility`,
        );
        await page.locator("[data-dependency-graph]").screenshot({
          path: resolve(output, `${story}-${theme}-${width}.png`),
        });
        checks.push(`${story}-${theme}-${width}`);
      }
    }
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await open("compact-tree");
  const production = page.locator('[data-tree-group="production"]');
  await production.focus();
  await page.keyboard.press("ArrowLeft");
  assert.equal(await production.getAttribute("aria-expanded"), "false");
  assert.equal(await page.locator('[data-tree-node="api"]').count(), 0);
  assert.match(await production.innerText(), /4 resources · 1 changed/);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await page.evaluate(() => document.activeElement.dataset.treeGroup),
    "database",
  );
  await page.keyboard.press("End");
  assert.equal(
    await page.evaluate(() => document.activeElement.dataset.treeNode),
    "output",
  );
  await page.keyboard.press("Home");
  assert.equal(
    await page.evaluate(() => document.activeElement.dataset.treeGroup),
    "production",
  );
  checks.push("arrow-home-end-keyboard-navigation");

  await open("compact-tree");
  const apiRow = page.locator('[data-tree-node="api"]');
  const apiDrawer = apiRow.getByRole("region", { name: "Details for api" });
  assert(await apiDrawer.isVisible());
  assert.equal(await page.getByRole("complementary").count(), 0);
  const treeWidth = await page
    .locator("[data-tree-viewport]")
    .evaluate((el) => el.clientWidth);
  const drawerWidth = await apiDrawer.evaluate((el) => el.clientWidth);
  assert(drawerWidth >= treeWidth - 50, "Drawer uses full tree width");
  const apiIcon = apiRow.locator("[data-tree-row-header] svg").first();
  assert(await apiIcon.isVisible());
  await apiDrawer.getByRole("button", { name: "Summary", exact: true }).focus();
  await page.keyboard.press("Enter");
  assert(
    await apiDrawer.isVisible(),
    "Drawer controls must not toggle row selection",
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent),
    "Specific changes",
  );
  await page.keyboard.press("Enter");
  assert(await apiDrawer.getByText("app:v2", { exact: true }).isVisible());
  await apiDrawer
    .getByRole("button", { name: "Close details for api" })
    .click();
  await page.waitForFunction(
    () => document.activeElement?.dataset.treeNode === "api",
  );
  assert(await apiIcon.isVisible());
  assert.equal(await apiDrawer.count(), 0);
  await page.keyboard.press("Enter");
  assert(await apiDrawer.isVisible(), "Enter opens row drawer");
  await page.keyboard.press("Enter");
  assert.equal(
    await apiDrawer.count(),
    0,
    "Enter closes the selected row drawer",
  );
  checks.push("drawer-width-native-controls-icons-and-keyboard");

  await page
    .getByRole("button", { name: "Show details for api", exact: true })
    .click();
  await page.locator('[data-tree-group="database"] [slot="chevron"]').click();
  await apiDrawer
    .getByRole("button", { name: /primary is a dependency of api/ })
    .click();
  const relationshipDrawer = apiRow.getByRole("region", {
    name: "Details for Relationship",
  });
  assert(await relationshipDrawer.isVisible());
  await relationshipDrawer
    .getByRole("button", { name: "Inspect dependency" })
    .click();
  await page.waitForFunction(
    () => document.activeElement?.dataset.treeNode === "db",
  );
  assert(
    await page
      .locator('[data-tree-node="db"]')
      .getByRole("region", { name: "Details for primary" })
      .isVisible(),
  );
  checks.push("drawer-relationship-inspection-and-folded-endpoint");

  await open("compact-tree");
  const treeViewport = page.locator("[data-tree-viewport]");
  const embeddedMaxHeight = await treeViewport.evaluate(
    (el) => el.style.maxHeight,
  );
  await page
    .getByRole("button", { name: "Enter full screen", exact: true })
    .click();
  await page.waitForFunction(() =>
    document.fullscreenElement?.hasAttribute("data-graph-fullscreen"),
  );
  assert.equal(await treeViewport.evaluate((el) => el.style.maxHeight), "");
  assert(
    await page.getByRole("region", { name: "Details for api" }).isVisible(),
  );
  await page.getByRole("button", { name: /Graph scope/ }).click();
  await page.getByRole("listbox").waitFor();
  assert(
    await page
      .getByRole("listbox")
      .evaluate((el) => document.fullscreenElement.contains(el)),
  );
  await page
    .getByRole("option", { name: "All resources", exact: true })
    .click();
  await page.getByRole("button", { name: "Graph", exact: true }).click();
  assert.equal(
    await page.locator('[data-graph-node="api"]').getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "Edit layout", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Card width", exact: true })
    .fill("360");
  await page
    .getByRole("textbox", { name: "Card height", exact: true })
    .fill("240");
  await page.getByRole("button", { name: "Apply size", exact: true }).click();
  const cardWidth = await page
    .locator('[data-graph-resource-card="api"]')
    .evaluate((el) => el.style.width);
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  assert(
    await page.getByRole("region", { name: "Details for api" }).isVisible(),
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Reset layout", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("textbox", { name: "Card width", exact: true })
      .count(),
    0,
  );
  await page.getByRole("button", { name: "Graph", exact: true }).click();
  assert.equal(
    await page
      .locator('[data-graph-resource-card="api"]')
      .evaluate((el) => el.style.width),
    cardWidth,
  );
  await page.getByRole("button", { name: "Done editing", exact: true }).click();
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  checks.push("card-layout-retained-with-editing-hidden-in-tree");
  await page
    .getByRole("button", { name: "Exit full screen", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      !document.fullscreenElement &&
      !document.querySelector("[data-graph-fullscreen]"),
  );
  assert.equal(
    await treeViewport.evaluate((el) => el.style.maxHeight),
    embeddedMaxHeight,
  );
  checks.push("tree-fullscreen-presentation-switch-and-portals");

  await page.getByRole("button", { name: "Collapse all", exact: true }).click();
  await page.getByRole("searchbox", { name: "Find resource" }).fill("api");
  await page
    .getByRole("region", { name: "Resource search results" })
    .getByRole("button")
    .click();
  await page.waitForFunction(
    () => document.activeElement?.dataset.treeNode === "api",
  );
  assert.equal(
    await page.locator('[data-tree-node="api"]').getAttribute("aria-selected"),
    "true",
  );
  assert.equal(
    await page
      .locator('[data-tree-group="database"]')
      .getAttribute("aria-expanded"),
    "false",
  );
  assert(
    await page.getByRole("region", { name: "Details for api" }).isVisible(),
  );
  await page.getByRole("button", { name: "Graph", exact: true }).click();
  await page.locator('[data-graph-resource-card="api"]').waitFor();
  await page
    .getByRole("button", {
      name: "Show attribute differences for api",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Zoom in graph" }).click();
  const zoom = await page.getByLabel("Graph zoom").textContent();
  const canvas = page.locator("[data-graph-canvas]");
  await canvas.evaluate((el) => {
    el.scrollLeft = 80;
    el.scrollTop = 120;
  });
  const camera = await canvas.evaluate((el) => ({
    left: el.scrollLeft,
    top: el.scrollTop,
  }));
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  assert.equal(
    await page.locator('[data-tree-node="api"]').getAttribute("aria-selected"),
    "true",
  );
  assert(
    await page
      .getByRole("button", {
        name: "Hide details for api",
        exact: true,
      })
      .isVisible(),
  );
  await page.getByRole("button", { name: "Graph", exact: true }).click();
  assert(
    await page
      .getByRole("button", {
        name: "Hide attribute differences for api",
        exact: true,
      })
      .isVisible(),
  );
  assert.equal(await page.getByLabel("Graph zoom").textContent(), zoom);
  assert.deepEqual(
    await canvas.evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop })),
    camera,
  );
  checks.push("search-reveal-selection-diff-and-camera-retention");

  await open("dependency-tree");
  await page
    .locator('[data-tree-node="authentication"] [slot="chevron"]')
    .click();
  assert.equal(
    await page.locator('[data-tree-node="authorization"]').count(),
    0,
  );
  await page
    .getByRole("button", {
      name: "Reveal primary row for Access policy",
      exact: true,
    })
    .click();
  await page.waitForFunction(
    () => document.activeElement?.dataset.treeNode === "authorization",
  );
  assert.equal(
    await page
      .locator('[data-tree-node="authorization"]')
      .getAttribute("aria-selected"),
    "true",
  );
  await page
    .getByRole("button", {
      name: "Reveal primary row for Primary database",
      exact: true,
    })
    .click();
  await page.waitForFunction(
    () => document.activeElement?.dataset.treeNode === "database",
  );
  checks.push("shared-and-cycle-reference-navigation");

  await open("dependency-tree", "dark");
  await page
    .getByRole("button", {
      name: "Hide details for Primary database",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Tree", exact: true }).focus();
  await page.locator("[data-dependency-graph]").screenshot({
    path: resolve(output, "dependency-tree-references-dark-1280.png"),
  });

  await page.setViewportSize({ width: 320, height: 1000 });
  await open("tree-without-inspector", "dark");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "24px";
  });
  await geometry();
  await page.screenshot({
    path: resolve(output, "tree-large-text-320.png"),
    fullPage: true,
  });
  checks.push("narrow-large-text");
  await open("compact-tree", "dark");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "24px";
  });
  await geometry();
  assert(
    await page.getByRole("region", { name: "Details for api" }).isVisible(),
  );
  checks.push("drawer-narrow-large-text");
  assert.deepEqual(errors, [], "No runtime errors");
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(
    `Dependency tree: ${checks.length} browser checks passed (${output})`,
  );
} finally {
  await browser.close();
}
