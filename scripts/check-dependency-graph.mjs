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
      (card) => {
        const height =
          card.getBoundingClientRect().height /
          new DOMMatrix(getComputedStyle(card.parentElement).transform).a /
          unit;
        const layoutHeight = Number(card.dataset.graphLayoutHeight);
        // Collapsed groups use fixed, potentially fractional CSS heights.
        if (!card.hasAttribute("data-graph-resource-card"))
          return Math.abs(height - layoutHeight) <= 1.1;
        // Match the ResizeObserver's rounded layout measurement before capturing
        // positions. A one-pixel tolerance could accept its previous reading.
        return Math.ceil(height - 0.001) === layoutHeight;
      },
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
        "relationship-changes",
        "attribute-dependencies",
        "expanded-attribute-differences",
        "collapsed-modules",
        "stable-resource-order",
        "embedded-inspector",
        "risk-annotations",
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
            "relationship-changes",
            "attribute-dependencies",
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
  // Native wheel updates are batched; the previous layout may still be settled.
  await page.waitForFunction(
    () =>
      document.querySelector("[data-dependency-graph]").dataset.graphDensity ===
      "overview",
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

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await open("relationship-changes", width === 390 ? "dark" : "light");
    const diff = page.locator(
      "[data-graph-resource-card] [data-resource-changes]",
    );
    assert.equal(await diff.getByRole("columnheader").count(), 0);
    assert.ok(
      await diff.locator("[data-field-values]").evaluateAll((rows) =>
        rows.every((row) => {
          const [before, after] = [...row.children].map((cell) =>
            cell.getBoundingClientRect(),
          );
          return (
            after.top >= before.bottom - 1 &&
            Math.abs(before.left - after.left) <= 1 &&
            Math.abs(before.right - after.right) <= 1
          );
        }),
      ),
      "Narrow graph cards stack full-width values",
    );
    assert.equal(
      await page
        .locator('[data-graph-edge-ids][data-link-change="add"]')
        .count(),
      1,
    );
    assert.equal(
      await page
        .locator('[data-graph-edge-ids][data-link-change="remove"]')
        .count(),
      1,
    );
    const strokes = await page
      .locator(
        '[data-graph-edge-ids]:is([data-link-change="add"], [data-link-change="remove"]) path',
      )
      .evaluateAll((paths) =>
        paths
          .filter(
            (path) => getComputedStyle(path).stroke !== "rgba(0, 0, 0, 0)",
          )
          .map((path) => getComputedStyle(path).stroke),
      );
    assert.equal(
      new Set(strokes).size,
      2,
      "Added and removed links have distinct strokes",
    );
    const details = page.locator("[data-graph-details]");
    await details
      .getByRole("button", {
        name: /Previous database connection.*Removed relationship/,
      })
      .click();
    assert.equal(
      await details
        .getByRole("button", {
          name: /Previous database connection.*Removed relationship/,
        })
        .getAttribute("aria-pressed"),
      "true",
    );
    await details
      .getByRole("button", { name: "Inspect dependent", exact: true })
      .click();
    await details
      .getByRole("button", {
        name: /New database connection.*Added relationship/,
      })
      .click();
    assert.equal(
      await details
        .getByRole("button", {
          name: /New database connection.*Added relationship/,
        })
        .getAttribute("aria-pressed"),
      "true",
    );
    checks.push({
      name: `stacked-resource-diffs-and-independent-link-changes-${width}`,
    });
  }

  for (const [width, theme, columns] of [
    [1440, "light", 2],
    [390, "dark", 1],
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(
      `${base}/iframe.html?id=components-dependencygraph--responsive-attribute-differences&viewMode=story&globals=colorScheme:${theme}`,
    );
    const diff = page.locator("[data-resource-changes]");
    await diff.locator("[data-field-values]").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.getByRole("columnheader").count(), 0);
    const geometry = await diff
      .locator("[data-field-values]")
      .evaluateAll((rows) =>
        rows.map((row) => {
          const [before, after] = [...row.children].map((cell) =>
            cell.getBoundingClientRect(),
          );
          return {
            stacked:
              after.top >= before.bottom - 1 &&
              Math.abs(before.left - after.left) <= 1 &&
              Math.abs(before.right - after.right) <= 1,
            paired:
              Math.abs(before.top - after.top) <= 1 &&
              Math.abs(before.bottom - after.bottom) <= 1 &&
              before.right <= after.left + 1,
          };
        }),
      );
    assert.ok(
      geometry.every((row) => (columns === 1 ? row.stacked : row.paired)),
      `Responsive diff uses ${columns} column(s) at ${width}px`,
    );
    assert.ok(
      await diff
        .getByText("Before:", { exact: true })
        .evaluateAll((labels) =>
          labels.every(
            (label) =>
              label.getBoundingClientRect().width <= 1 &&
              label.getBoundingClientRect().height <= 1,
          ),
        ),
      "Before labels are screen-reader-only",
    );
    assert.ok(
      await diff
        .getByText("After:", { exact: true })
        .evaluateAll((labels) =>
          labels.every(
            (label) =>
              label.getBoundingClientRect().width <= 1 &&
              label.getBoundingClientRect().height <= 1,
          ),
        ),
      "After labels are screen-reader-only",
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await accessibility(`responsive-diff-${theme}-${width}`);
    await diff.screenshot({
      path: resolve(output, `responsive-diff-${theme}-${width}.png`),
    });
    if (columns === 2) {
      await diff.evaluate((element) => (element.style.width = "320px"));
      assert.ok(
        await diff.locator("[data-field-values]").evaluateAll((rows) =>
          rows.every((row) => {
            const [a, b] = [...row.children].map((c) =>
              c.getBoundingClientRect(),
            );
            return b.top >= a.bottom - 1 && Math.abs(a.left - b.left) <= 1;
          }),
        ),
        "Diff responds to its narrow container on a wide page",
      );
      checks.push({ name: "responsive-diff-container-width-on-wide-page" });
    }
    checks.push({ name: `responsive-diff-${theme}-${width}` });
  }

  for (const [width, theme] of [
    [1440, "light"],
    [390, "dark"],
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    await open("attribute-dependencies", theme);
    await page.waitForFunction(
      () =>
        document.querySelectorAll("[data-graph-target-attribute]").length === 2,
    );
    const graph = page.locator("[data-dependency-graph]");
    const compactCards = await graph
      .locator("[data-graph-resource-card]")
      .evaluateAll((cards) =>
        cards.map((card) => {
          const select = card.querySelector("[data-graph-node]"),
            label = select.querySelector("strong"),
            status = select.querySelector("[data-change]"),
            l = label.getBoundingClientRect(),
            s = status.getBoundingClientRect();
          return {
            id: card.dataset.graphResourceCard,
            height: card.getBoundingClientRect().height,
            sameRow: Math.abs((l.top + l.bottom - s.top - s.bottom) / 2) < 1,
            controls: [...card.querySelectorAll("button")].every((button) => {
              const r = button.getBoundingClientRect();
              return r.width >= 24 && r.height >= 24;
            }),
            compactControls: [
              ...card.querySelectorAll("button[aria-expanded]"),
            ].every((button) => {
              const r = button.getBoundingClientRect();
              return r.width <= 26 && r.height <= 26;
            }),
            readableValues: [
              ...card.querySelectorAll("[data-diff] code"),
            ].every(
              (code) => parseFloat(getComputedStyle(code).fontSize) >= 13,
            ),
          };
        }),
      );
    assert.ok(
      compactCards.every(
        (card) =>
          card.sameRow &&
          card.controls &&
          card.compactControls &&
          card.readableValues,
      ),
      "Dense cards preserve single-row identity/status, readable values and usable targets",
    );
    assert.ok(
      compactCards.find((card) => card.id === "api").height > 224,
      "Expanded cards grow to fit full differences",
    );
    assert.ok(
      compactCards.find((card) => card.id === "network").height <= 64,
      "Summary cards omit redundant IDs and empty header space",
    );
    assert.equal(
      await graph
        .locator("[data-graph-edge-ids] text, [data-graph-edge-ids] rect")
        .count(),
      0,
      "Edges have no status or count badges",
    );
    assert.equal(
      await graph
        .locator('[data-graph-edge-ids][data-link-change="update"]')
        .count(),
      1,
    );
    assert.equal(
      await graph
        .locator(
          '[data-graph-edge-ids]:is([data-link-change="add"], [data-link-change="remove"])',
        )
        .count(),
      0,
      "A matched modified reference renders once",
    );
    const block = graph.locator('[data-graph-edge-ids*="network-depends-on"]');
    assert.equal(await block.getAttribute("data-graph-source-attribute"), null);
    assert.equal(await block.getAttribute("data-graph-target-attribute"), null);
    const modified = graph.locator(
      '[data-graph-edge-ids][data-link-change="update"]',
    );
    assert.equal(
      await modified.getAttribute("data-graph-source-attribute"),
      "replica_endpoint",
    );
    assert.equal(
      await modified.getAttribute("data-graph-target-attribute"),
      "env.DATABASE_URL",
    );
    assert.notEqual(
      await modified
        .locator("path[marker-end]")
        .evaluate((el) => getComputedStyle(el).stroke),
      await block
        .locator("path[marker-end]")
        .evaluate((el) => getComputedStyle(el).stroke),
      "Modified and unchanged links have distinct colors",
    );
    const routes = await page.evaluate(() => {
      const svg = document
          .querySelector("[data-graph-edge-ids]")
          .closest("svg"),
        matrix = svg.getScreenCTM();
      const cards = [
        ...document.querySelectorAll("[data-graph-resource-card]"),
      ];
      return [...document.querySelectorAll("[data-graph-edge-ids]")].map(
        (group) => {
          const points = JSON.parse(group.dataset.graphRoutePoints);
          const pixels = points.map((point) =>
            new DOMPoint(point.x, point.y).matrixTransform(matrix),
          );
          const clear = points.slice(1).every((b, i) => {
            const a = points[i];
            if (a.x !== b.x && a.y !== b.y) return false;
            const p = pixels[i],
              q = pixels[i + 1];
            return cards.every((card) => {
              const r = card.getBoundingClientRect();
              return !(a.x === b.x
                ? p.x > r.left + 1 &&
                  p.x < r.right - 1 &&
                  Math.max(p.y, q.y) > r.top + 1 &&
                  Math.min(p.y, q.y) < r.bottom - 1
                : p.y > r.top + 1 &&
                  p.y < r.bottom - 1 &&
                  Math.max(p.x, q.x) > r.left + 1 &&
                  Math.min(p.x, q.x) < r.right - 1);
            });
          });
          if (!group.dataset.graphTargetAttribute)
            return { clear, aligned: true };
          const target = cards.find(
            (card) => card.dataset.graphResourceCard === "api",
          );
          const field = [
            ...target.querySelectorAll("[data-field-change]"),
          ].find(
            (field) =>
              field.dataset.fieldChange === group.dataset.graphTargetAttribute,
          );
          const rect = field.querySelector("dt").getBoundingClientRect(),
            end = pixels[pixels.length - 1];
          return {
            clear,
            aligned:
              Math.abs(end.x - target.getBoundingClientRect().left) < 2 &&
              Math.abs(end.y - (rect.top + rect.height / 2)) <=
                7 * Math.abs(matrix.a),
          };
        },
      );
    });
    assert.ok(
      routes.every((route) => route.clear && route.aligned),
      "Orthogonal routes avoid cards and land at the requested field rows",
    );
    await graph.screenshot({
      path: resolve(output, `attribute-ports-${theme}-${width}.png`),
    });
    await page
      .getByRole("button", { name: "Hide attribute differences for Database" })
      .click();
    await page.waitForFunction(
      () => !document.querySelector("[data-graph-source-attribute]"),
    );
    assert.equal(
      await graph.locator("[data-graph-target-attribute]").count(),
      2,
    );
    await page
      .getByRole("button", { name: "Show attribute differences for Database" })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll("[data-graph-source-attribute]").length === 2,
    );

    await page
      .getByRole("button", {
        name: "Hide attribute differences for Shipping API",
      })
      .click();
    await page.waitForFunction(
      () => !document.querySelector("[data-graph-target-attribute]"),
    );
    await settledCards();
    await page
      .getByRole("button", {
        name: "Show attribute differences for Shipping API",
      })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll("[data-graph-target-attribute]").length === 2,
    );
    await page.getByRole("button", { name: "Zoom out" }).click();
    await page.waitForFunction(
      () => !document.querySelector("[data-graph-target-attribute]"),
    );
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll("[data-graph-target-attribute]").length === 2,
    );
    assert.equal(
      await page
        .locator("[data-graph-details]")
        .getByRole("button", {
          name: /Database reference.*Modified relationship/,
        })
        .count(),
      1,
    );
    checks.push({
      name: `attribute-ports-routing-and-collapse-zoom-fallback-${width}`,
    });
  }
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await open("stable-resource-order");
    const boxes = () =>
      page.locator("[data-graph-resource-card]").evaluateAll((cards) =>
        Object.fromEntries(
          cards.map((card) => [
            card.dataset.graphResourceCard,
            {
              x: parseFloat(getComputedStyle(card).left),
              y: parseFloat(getComputedStyle(card).top),
              width: card.offsetWidth,
              height: card.offsetHeight,
            },
          ]),
        ),
      );
    const initial = await boxes();
    const assertOrder = async (transition) => {
      await settledCards();
      const current = await boxes();
      for (const [id, a] of Object.entries(current))
        for (const [other, b] of Object.entries(current)) {
          for (const axis of ["x", "y"])
            assert.equal(
              Math.sign(a[axis] - b[axis]),
              Math.sign(initial[id][axis] - initial[other][axis]),
              `${width}: ${transition} preserves ${id}/${other} order`,
            );
          if (id !== other)
            assert.ok(
              a.x + a.width <= b.x ||
                b.x + b.width <= a.x ||
                a.y + a.height <= b.y ||
                b.y + b.height <= a.y,
              `${width}: ${transition} has no overlapping cards`,
            );
        }
    };
    const fullContent = async () => {
      const content = await page
        .locator('[data-graph-card-diff="api"]')
        .evaluate((element) => ({
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
          bottom: element.getBoundingClientRect().bottom,
          last: element
            .querySelector(
              '[data-field-change="env.HEALTHCHECK_DATABASE_ENDPOINT"] [data-diff="addition"]',
            )
            .getBoundingClientRect().bottom,
          overflow: getComputedStyle(element).overflowY,
        }));
      assert.ok(
        content.last <= content.bottom + 1,
        "Final full value fits in the expanded card",
      );
      assert.ok(
        content.scrollHeight <= content.clientHeight + 1,
        "Full differences need no nested scroll",
      );
      assert.equal(content.overflow, "visible");
      assert.ok(
        (await boxes()).api.height > 224,
        "Cards expand beyond the removed height cap",
      );
    };
    await fullContent();
    for (const transition of [
      "Hide all edges",
      "Show all edges",
      "Collapse attribute differences",
      "Expand attribute differences",
      "Collapse database group",
      "Expand database group",
    ]) {
      await page.getByRole("button", { name: transition, exact: true }).click();
      await assertOrder(transition);
      const current = await boxes();
      if (transition === "Hide all edges" || transition === "Show all edges") {
        assert.deepEqual(
          current,
          initial,
          "Edge visibility leaves geometry unchanged",
        );
        assert.equal(
          await page.locator("[data-graph-edge-ids]").count(),
          transition === "Hide all edges" ? 0 : 3,
        );
      }
      if (transition === "Collapse attribute differences") {
        assert.ok(
          current.api.height < initial.api.height,
          "Collapse shrinks the card",
        );
        assert.ok(
          current.database.height < initial.database.height,
          "Collapse shrinks the other card",
        );
      }
      if (transition === "Expand attribute differences") await fullContent();
      if (
        width === 1440 &&
        [
          "Show all edges",
          "Hide all edges",
          "Collapse attribute differences",
        ].includes(transition)
      ) {
        const name = {
          "Show all edges": "expanded",
          "Hide all edges": "hidden-edges",
          "Collapse attribute differences": "collapsed",
        }[transition];
        await page
          .locator("[data-dependency-graph]")
          .screenshot({ path: resolve(output, `stable-order-${name}.png`) });
      }
    }
    assert.deepEqual(
      await boxes(),
      initial,
      "Restoring disclosure returns the same layout",
    );
    await accessibility(`stable-resource-order-${width}`);
    await page
      .locator("[data-dependency-graph]")
      .screenshot({ path: resolve(output, `stable-order-${width}.png`) });
    checks.push({ name: `stable-order-and-full-card-expansion-${width}` });
  }
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await open("embedded-inspector");
    const graph = page.locator("[data-dependency-graph]");
    const details = graph.locator("[data-graph-details]");
    assert.equal(await graph.locator("header").count(), 0);
    assert.equal(
      await graph.getAttribute("aria-label"),
      "Resource change review",
    );
    assert.equal(
      await graph.getByLabel("Relationship changes legend").count(),
      0,
    );
    const widthBefore = await details.evaluate(
      (el) => el.getBoundingClientRect().width,
    );
    const positions = () =>
      graph.locator("[data-graph-resource-card]").evaluateAll((cards) =>
        cards.map((card) => ({
          id: card.dataset.graphResourceCard,
          x: parseFloat(getComputedStyle(card).left),
          y: parseFloat(getComputedStyle(card).top),
        })),
      );
    const before = await positions();
    if (width === 1440)
      await graph.screenshot({
        path: resolve(output, "embedded-inspector-desktop.png"),
      });
    const expand = details.getByRole("button", {
      name: "Expand selection details",
    });
    await expand.focus();
    await expand.press("Enter");
    await page.waitForFunction(
      () =>
        document.querySelector("[data-graph-details]").dataset.expanded ===
        "true",
    );
    await settledCards();
    const collapse = details.getByRole("button", {
      name: "Collapse selection details",
    });
    assert.equal(
      await collapse.evaluate((el) => el === document.activeElement),
      true,
    );
    assert.equal(await details.locator("h3").innerText(), "Shipping API");
    assert.equal(
      await details
        .getByRole("button", { name: "Specific changes" })
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(
      await details.evaluate((el) => getComputedStyle(el).maxHeight),
      "none",
    );
    if (width === 1440)
      assert.ok(
        (await details.evaluate((el) => el.getBoundingClientRect().width)) >
          widthBefore + 100,
      );
    const after = await positions();
    for (let a = 0; a < before.length; a++)
      for (let b = a + 1; b < before.length; b++) {
        assert.equal(after[a].id, before[a].id);
        for (const axis of ["x", "y"])
          assert.equal(
            Math.sign(after[a][axis] - after[b][axis]),
            Math.sign(before[a][axis] - before[b][axis]),
            "Inspector expansion preserves resource ordering",
          );
      }
    await accessibility(`expanded-inspector-${width}`);
    await graph.screenshot({
      path: resolve(output, `expanded-inspector-${width}.png`),
    });
    await collapse.press("Enter");
    await page.waitForFunction(
      () => !document.querySelector("[data-graph-details]").dataset.expanded,
    );
    await settledCards();
    assert.equal(
      await details.evaluate((el) => el.getBoundingClientRect().width),
      widthBefore,
    );
    assert.deepEqual(await positions(), before);
    checks.push({ name: `optional-heading-and-expanded-inspector-${width}` });

    await open("risk-annotations");
    assert.equal(await graph.locator("header").count(), 0);
    assert.equal(
      await graph.locator("[data-graph-node-annotation]").count(),
      2,
    );
    assert.equal(
      await graph
        .locator(
          '[data-graph-resource-card="network"] [data-graph-node-annotation]',
        )
        .count(),
      0,
    );
    assert.equal(
      await graph
        .locator('[data-graph-edge-ids][data-link-change="update"]')
        .count(),
      1,
    );
    await graph.screenshot({
      path: resolve(output, `risk-annotations-${width}.png`),
    });
    const worker = graph.getByRole("button", {
      name: "Background worker, Unchanged",
      exact: true,
    });
    await worker.click();
    assert.equal(await details.locator("h3").innerText(), "Background worker");
    const assessment = details.getByRole("region", { name: "Risk assessment" });
    assert.ok((await assessment.innerText()).includes("Medium risk"));
    assert.ok(
      (await assessment.innerText()).includes("no planned resource changes"),
    );
    assert.equal(
      await worker.evaluate((el) =>
        document
          .getElementById(el.getAttribute("aria-describedby"))
          .textContent.trim(),
      ),
      "Medium risk",
    );
    await accessibility(`risk-annotations-${width}`);
    checks.push({ name: `caller-owned-risk-and-unchanged-resource-${width}` });
  }
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
