import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9018";
const output = resolve(
  process.env.FACILITY_REPORT_DIR ?? "/tmp/easy-ui-metrics",
  "dependency-graph",
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
page.on("console", (event) => {
  if (["warning", "error"].includes(event.type()))
    errors.push(`${event.type()}: ${event.text()}`);
});
async function open(story, theme = "light") {
  await page.goto(
    `${base}/iframe.html?id=components-dependencygraph--${story}&viewMode=story&globals=colorScheme:${theme}`,
  );
  await page.locator("[data-dependency-graph]").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await settledCards();
}
async function settledCards() {
  await page.waitForFunction(() => {
    const unit =
      parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
    return [...document.querySelectorAll("[data-graph-item-card]")].every(
      (card) =>
        Math.abs(
          card.getBoundingClientRect().height /
            new DOMMatrix(getComputedStyle(card.parentElement).transform).a /
            unit -
            Number(card.dataset.graphLayoutHeight),
        ) <= 1.1,
    );
  });
}
async function accessibility(name) {
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  let result;
  for (let attempt = 0; ; attempt++) {
    try {
      result = await page.evaluate(async () =>
        axe.run(document.querySelector("#storybook-root"), {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        }),
      );
      break;
    } catch (error) {
      if (!String(error).includes("already running") || attempt === 59)
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  assert.deepEqual(
    result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map(({ target }) => target),
    })),
    [],
    `${name}: accessibility`,
  );
  return result.incomplete.map(({ id }) => id);
}
try {
  for (const theme of ["light", "dark"])
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const story of [
        "replacement-review",
        "change-summary",
        "specific-changes",
        "expanded-attribute-differences",
        "collapsed-modules",
        "collapsible-branches",
        "partial-evidence",
        "cyclic-relationships",
        "thousand-resources",
      ]) {
        const name = `${story}-${theme}-${width}`;
        await open(story, theme);
        const geometry = await page.evaluate(() => {
          const boxes = [
            ...document.querySelectorAll("[data-graph-item-card]"),
          ].map((node) => {
            const { left, right, top, bottom } = node.getBoundingClientRect();
            return { left, right, top, bottom };
          });
          return {
            overflow: document.documentElement.scrollWidth - innerWidth,
            boxes,
          };
        });
        assert.ok(geometry.overflow <= 1, `${name}: page overflow`);
        for (let a = 0; a < geometry.boxes.length; a++)
          for (let b = a + 1; b < geometry.boxes.length; b++) {
            const first = geometry.boxes[a],
              second = geometry.boxes[b];
            assert.ok(
              first.right <= second.left ||
                second.right <= first.left ||
                first.bottom <= second.top ||
                second.bottom <= first.top,
              `${name}: overlapping resource cards`,
            );
          }
        if (story === "expanded-attribute-differences" && width < 600) {
          const visibleDiff = await page.evaluate(() => {
            const viewport = document
              .querySelector("[data-graph-canvas]")
              .getBoundingClientRect();
            const row = document
              .querySelector(
                '[data-graph-card-diff="azurerm_subnet.application"] [data-diff="addition"]',
              )
              .getBoundingClientRect();
            return row.top >= viewport.top && row.bottom <= viewport.bottom;
          });
          assert.ok(
            visibleDiff,
            `${name}: anchored card differences are visible on mobile`,
          );
        }
        if (story === "thousand-resources")
          assert.ok(
            geometry.boxes.length <= 5,
            `${name}: bounded grouped neighborhood`,
          );
        checks.push({
          name,
          ...geometry,
          accessibilityIncomplete: await accessibility(name),
        });
        if (
          [
            "replacement-review",
            "specific-changes",
            "expanded-attribute-differences",
            "collapsible-branches",
          ].includes(story) &&
          width !== 320
        )
          await page
            .locator("[data-dependency-graph]")
            .screenshot({ path: resolve(output, `${name}.png`) });
      }
    }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open("expanded-attribute-differences");
  const card = page.locator(
    '[data-graph-resource-card="azurerm_container_app.api"]',
  );
  const selectionBefore = await card.getAttribute("data-selected");
  const expandedHeight = await card.evaluate(
    (el) => el.getBoundingClientRect().height,
  );
  assert.equal(await card.locator('[data-diff="addition"]').count(), 4);
  assert.equal(await card.locator('[data-diff="removal"]').count(), 4);
  await card
    .getByRole("button", {
      name: "Hide attribute differences for Shipping API",
    })
    .press("Enter");
  await settledCards();
  assert.equal(await card.locator("[data-diff]").count(), 0);
  assert.ok(
    (await card.evaluate((el) => el.getBoundingClientRect().height)) <
      expandedHeight,
  );
  await card
    .getByRole("button", {
      name: "Show attribute differences for Shipping API",
    })
    .press("Enter");
  await settledCards();
  assert.equal(
    await card.getAttribute("data-selected"),
    selectionBefore,
    "Card expansion does not change selection",
  );
  assert.equal(
    await page.locator("[data-graph-details]").count(),
    0,
    "Inline differences work without an inspector",
  );
  assert.ok(
    await card
      .getByRole("button", {
        name: "Hide attribute differences for Shipping API",
      })
      .evaluate((el) => document.activeElement === el),
    "Toggle retains keyboard focus",
  );
  checks.push({ name: "inline-card-expansion-keyboard-and-measured-layout" });
  await open("expanded-attribute-differences");
  const graph = page.locator("[data-dependency-graph]");
  await page.getByRole("button", { name: "Zoom out graph" }).click();
  await settledCards();
  assert.equal(await graph.getAttribute("data-graph-density"), "summary");
  assert.equal(await card.locator("[data-diff]").count(), 0);
  await page.getByRole("button", { name: "Zoom out graph" }).click();
  await settledCards();
  assert.equal(await graph.getAttribute("data-graph-density"), "overview");
  await card
    .getByRole("button", {
      name: "Show attribute differences for Shipping API",
    })
    .press("Enter");
  await settledCards();
  assert.equal(await graph.getAttribute("data-graph-density"), "detail");
  assert.equal(await card.locator('[data-diff="addition"]').count(), 4);
  const inlineValues = await card
    .locator("[data-diff] code")
    .evaluateAll((values) => values.map((value) => value.textContent));
  assert.ok(inlineValues.includes("registry.example.com/shipping:1.8"));
  assert.ok(inlineValues.includes("registry.example.com/shipping:1.9"));
  assert.equal(
    await card.locator("[data-resource-changes] h4").count(),
    0,
    "Compact cards omit redundant headings",
  );
  checks.push({ name: "semantic-zoom-restores-inline-diffs-and-exact-values" });
  const canvas = page.locator("[data-graph-canvas]");
  await canvas.focus();
  await canvas.press("-");
  assert.equal(await graph.getAttribute("data-graph-density"), "summary");
  await canvas.press("+");
  assert.equal(await graph.getAttribute("data-graph-density"), "detail");
  await canvas.evaluate((element) =>
    element.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        deltaY: 200,
      }),
    ),
  );
  await settledCards();
  assert.equal(await graph.getAttribute("data-graph-density"), "overview");
  const targets = await page
    .locator("[data-graph-canvas] button")
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    );
  assert.ok(
    targets.every(({ width, height }) => width >= 24 && height >= 24),
    "Overview controls keep usable click targets",
  );
  await graph.screenshot({ path: resolve(output, "overview-desktop.png") });
  checks.push({ name: "keyboard-and-modified-wheel-zoom" });
  await open("collapsible-branches");
  const database = page.getByRole("button", {
    name: /^Primary database, Update/,
  });
  assert.ok((await database.getAttribute("aria-label")).includes("Database"));
  await page
    .getByRole("button", { name: "Collapse dependents of Primary database" })
    .press("Enter");
  await settledCards();
  assert.equal(await page.locator('[data-graph-node="storage"]').count(), 0);
  assert.equal(
    await page.locator('[data-graph-node="authorization"]').count(),
    1,
    "Shared policy stays reachable from authentication",
  );
  assert.equal(
    await page
      .locator("[data-graph-edge-ids]")
      .filter({ has: page.locator("title", { hasText: "db-policy" }) })
      .count(),
    0,
    "Folded outgoing relationship is hidden even when its target is shared",
  );
  assert.ok((await graph.innerText()).includes("1 hidden"));
  await page
    .getByRole("button", { name: "Expand dependents of Primary database" })
    .press("Enter");
  await settledCards();
  assert.equal(await page.locator('[data-graph-node="storage"]').count(), 1);
  await page
    .getByRole("button", { name: "Collapse dependents of Private network" })
    .press("Enter");
  await settledCards();
  assert.equal(await page.locator("[data-graph-node]").count(), 1);
  await page
    .getByRole("button", { name: "Expand all branches" })
    .press("Enter");
  await settledCards();
  assert.equal(await page.locator("[data-graph-node]").count(), 5);
  checks.push({
    name: "branch-disclosures-shared-paths-type-icons-and-expand-all",
  });
  for (const atom of ["expandbutton", "collapsebutton"]) {
    await page.goto(
      `${base}/iframe.html?id=components-${atom}--disclosure&viewMode=story`,
    );
    const toggle = page.getByRole("button", { name: /resource details/ });
    await toggle.waitFor();
    const previous = await toggle.getAttribute("aria-expanded");
    await toggle.press("Space");
    assert.notEqual(await toggle.getAttribute("aria-expanded"), previous);
    assert.ok(
      await toggle.evaluate((element) => document.activeElement === element),
    );
    await accessibility(`${atom}-disclosure`);
    checks.push({ name: `${atom}-keyboard-disclosure` });
  }
  await page.setViewportSize({ width: 390, height: 1000 });
  await open("expanded-attribute-differences");
  await page.getByRole("button", { name: "Zoom out graph" }).click();
  await page.getByRole("button", { name: "Zoom out graph" }).click();
  await settledCards();
  await card
    .getByRole("button", {
      name: "Show attribute differences for Shipping API",
    })
    .click();
  await settledCards();
  await page.waitForFunction(() => {
    const control = document.querySelector(
      '[data-graph-resource-card="azurerm_container_app.api"] button[aria-controls*="-diff-"]',
    );
    const box = control.getBoundingClientRect();
    const viewport = document
      .querySelector("[data-graph-canvas]")
      .getBoundingClientRect();
    return (
      box.left >= viewport.left &&
      box.right <= viewport.right &&
      box.top >= viewport.top &&
      box.bottom <= viewport.bottom
    );
  });
  assert.equal(await graph.getAttribute("data-graph-density"), "detail");
  assert.equal(await card.locator('[data-diff="addition"]').count(), 4);
  await graph.screenshot({
    path: resolve(output, "mobile-overview-expansion.png"),
  });
  checks.push({ name: "mobile-overview-disclosure-keeps-resource-in-view" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open("replacement-review");
  const resourceChanges = page.locator(
    "[data-graph-details] [data-resource-changes]",
  );
  await resourceChanges.getByRole("button", { name: "Summary" }).press("Enter");
  assert.equal(
    await resourceChanges.locator("[data-diff]").count(),
    0,
    "Summary hides field values",
  );
  await resourceChanges
    .getByRole("button", { name: "Specific changes" })
    .press("Enter");
  assert.equal(
    await resourceChanges.locator('[data-diff="removal"]').count(),
    1,
  );
  assert.equal(
    await resourceChanges.locator('[data-diff="addition"]').count(),
    1,
  );
  assert.ok((await resourceChanges.innerText()).includes("10.20.0.0/24"));
  assert.ok((await resourceChanges.innerText()).includes("10.20.4.0/24"));
  const colors = await resourceChanges
    .locator("[data-diff]")
    .evaluateAll((rows) =>
      rows.map((row) => [
        getComputedStyle(row).color,
        getComputedStyle(row).backgroundColor,
      ]),
    );
  assert.notDeepEqual(
    colors[0],
    colors[1],
    "Removal and addition have distinct themed colors",
  );
  await open("specific-changes");
  assert.ok((await resourceChanges.innerText()).includes("Redacted value"));
  assert.ok((await resourceChanges.innerText()).includes("Unknown value"));
  await page
    .getByRole("button", { name: /^Legacy bastion, Delete/ })
    .press("Enter");
  assert.equal(
    await resourceChanges.getAttribute("data-resource-changes"),
    "azurerm_bastion_host.legacy",
  );
  assert.equal(
    await resourceChanges.locator('[data-diff="removal"]').count(),
    2,
  );
  assert.equal(
    await resourceChanges.locator('[data-diff="addition"]').count(),
    0,
    "Deletion has no fabricated additions",
  );
  await page
    .getByRole("button", { name: /^API availability alert, Create/ })
    .press("Enter");
  assert.equal(
    await resourceChanges.locator('[data-diff="addition"]').count(),
    2,
  );
  assert.equal(
    await resourceChanges.locator('[data-diff="removal"]').count(),
    0,
    "Creation has no fabricated removals",
  );
  checks.push({ name: "per-resource-summary-diff-and-value-semantics" });
  await open("replacement-review");
  const viewport = page.locator("[data-graph-canvas]");
  await viewport.evaluate((element) => {
    element.scrollLeft = 100;
    element.scrollTop = 50;
  });
  const before = await page
    .locator("[data-graph-item-card]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("style")));
  const camera = await viewport.evaluate((element) => [
    element.scrollLeft,
    element.scrollTop,
  ]);
  await page
    .getByRole("button", { name: /^Shipping API, Update/ })
    .press("Enter");
  await page
    .locator("[data-graph-details] h3")
    .filter({ hasText: /^Shipping API$/ })
    .waitFor();
  assert.equal(
    await page.locator("[data-graph-details] h3").innerText(),
    "Shipping API",
  );
  assert.deepEqual(
    await page
      .locator("[data-graph-item-card]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("style"))),
    before,
    "Selection preserves coordinates",
  );
  // Native keyboard focus can scroll to a node; a data refresh must then retain that camera.
  const selectedCamera = await viewport.evaluate((element) => [
    element.scrollLeft,
    element.scrollTop,
  ]);
  await page.getByRole("button", { name: "Expand one level" }).click();
  assert.ok(
    (await page.locator("[data-dependency-graph]").innerText()).includes(
      "Dependents of Application subnet",
    ),
    "Selection does not silently move the traversal anchor",
  );
  assert.deepEqual(
    await viewport.evaluate((element) => [
      element.scrollLeft,
      element.scrollTop,
    ]),
    selectedCamera,
    "Neighborhood expansion preserves camera",
  );
  await page
    .getByRole("searchbox", { name: "Find resource" })
    .fill("Database DNS");
  await page
    .getByRole("region", { name: "Resource search results" })
    .getByRole("button", { name: /Database DNS/ })
    .press("Enter");
  await page
    .locator('[data-graph-node="azurerm_private_dns_zone.database"]')
    .waitFor();
  assert.equal(
    await page.locator("[data-graph-details] h3").innerText(),
    "Database DNS",
    "Search reveals a previously hidden module member",
  );
  await page
    .getByRole("button", { name: /^Database DNS, Unchanged/ })
    .press("ArrowRight");
  assert.ok(
    await page.evaluate(() =>
      document.activeElement.hasAttribute("data-graph-item"),
    ),
    "Arrow-key resource navigation",
  );
  checks.push({
    name: "keyboard-exploration-and-camera",
    camera,
    selectedCamera,
  });
  await open("collapsed-modules");
  const details = page.locator("[data-graph-details]");
  await details
    .getByRole("button", {
      name: /Application subnet.*Shipping API.*Network attachment/,
    })
    .press("Enter");
  await details
    .locator("h3")
    .filter({ hasText: /^Network attachment$/ })
    .waitFor();
  assert.equal(await details.locator("h3").innerText(), "Network attachment");
  assert.ok(
    (await details.innerText()).includes("api.infrastructure_subnet_id"),
    "Selected edge retains supplied evidence",
  );
  await details
    .getByRole("button", { name: "Inspect dependent" })
    .press("Enter");
  await details
    .locator("h3")
    .filter({ hasText: /^Shipping API$/ })
    .waitFor();
  assert.equal(await details.locator("h3").innerText(), "Shipping API");
  await page.getByRole("button", { name: "Reveal selected resource" }).click();
  await page.locator('[data-graph-node="azurerm_container_app.api"]').waitFor();
  checks.push({ name: "collapsed-group-original-edge-and-node-identities" });
  await open("replacement-review", "dark");
  await page.evaluate(() => (document.documentElement.style.fontSize = "20px"));
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.getByRole("button", { name: "Fit visible" }).click();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Enlarged text does not overflow the page",
  );
  await accessibility("enlarged-text");
  await page
    .locator("[data-dependency-graph]")
    .screenshot({ path: resolve(output, "enlarged-text-dark-320.png") });
  checks.push({ name: "enlarged-text-dark-320" });
  assert.deepEqual(errors, [], "Runtime diagnostics");
  console.log(`DependencyGraph: ${checks.length} browser cases passed.`);
} catch (error) {
  errors.push(error.stack ?? String(error));
  throw error;
} finally {
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}
