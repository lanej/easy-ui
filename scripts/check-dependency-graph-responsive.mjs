import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9018";
const output = resolve(
  process.env.FACILITY_REPORT_DIR ?? "/tmp/easy-ui-metrics",
  "dependency-responsive",
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

async function settle() {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
  await page.waitForFunction(() => {
    const unit =
      parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
    return [...document.querySelectorAll("[data-graph-resource-card]")].every(
      (card) => {
        const zoom = new DOMMatrix(
          getComputedStyle(card.parentElement).transform,
        ).a;
        return (
          Math.ceil(
            card.getBoundingClientRect().height / zoom / unit - 0.001,
          ) === Number(card.dataset.graphLayoutHeight)
        );
      },
    );
  });
}
async function open(story, theme) {
  await page.goto(
    `${base}/iframe.html?id=components-dependencygraph--${story}&viewMode=story&globals=colorScheme:${theme}`,
  );
  await page.locator("[data-dependency-graph]").waitFor();
  await settle();
}
async function geometry() {
  return page.evaluate(() => {
    const canvas = document.querySelector("[data-graph-canvas]");
    const cards = [...document.querySelectorAll("[data-graph-resource-card]")];
    const unit =
      parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
    const viewportBox = canvas.getBoundingClientRect();
    return {
      viewport: canvas.clientWidth / unit,
      scrollWidth: canvas.scrollWidth / unit,
      zoom: document.querySelector("[data-dependency-graph] output")
        .textContent,
      pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      visibleCards: cards.filter((card) => {
        const box = card.getBoundingClientRect();
        return (
          box.left < viewportBox.right &&
          box.right > viewportBox.left &&
          box.top < viewportBox.bottom &&
          box.bottom > viewportBox.top
        );
      }).length,
      cards: cards.map((card) => {
        const summary = card.firstElementChild.getBoundingClientRect();
        const diff = card
          .querySelector("[data-graph-card-diff]:not([hidden])")
          ?.getBoundingClientRect();
        return {
          id: card.dataset.graphResourceCard,
          x: parseFloat(card.style.left) * 16,
          y: parseFloat(card.style.top) * 16,
          width: card.offsetWidth / unit,
          height: card.offsetHeight / unit,
          wide: card.clientWidth / unit >= 832,
          comparisonBeside: diff
            ? diff.left >= summary.right - 1 &&
              Math.abs(diff.top - summary.top) < 1
            : undefined,
          comparisonBelow: diff ? diff.top >= summary.bottom - 1 : undefined,
        };
      }),
      values: [...document.querySelectorAll("[data-diff] code")].map(
        (value) => ({
          fontSize: parseFloat(getComputedStyle(value).fontSize) / unit,
          overflow: value.scrollWidth > value.clientWidth + 1,
        }),
      ),
      clippedDiffs: [
        ...document.querySelectorAll("[data-graph-card-diff]"),
      ].some((diff) => diff.scrollHeight > diff.clientHeight + 1),
      edgeIds: [...document.querySelectorAll("[data-graph-edge-ids]")]
        .flatMap((edge) => JSON.parse(edge.dataset.graphEdgeIds))
        .sort(),
    };
  });
}
function checkGeometry(state, expectedEdges) {
  assert.equal(state.pageOverflow, false, "Overflow is confined to the canvas");
  assert.equal(
    state.clippedDiffs,
    false,
    "Every attribute remains readable without a nested scroller",
  );
  assert.equal(
    state.edgeIds.length,
    expectedEdges,
    "Every supplied relationship is retained",
  );
  for (const a of state.cards) {
    assert.equal(
      a.wide ? a.comparisonBeside : a.comparisonBelow,
      true,
      `${a.id} places comparisons beside a wide summary and below a narrow one`,
    );
    assert.ok(
      Object.values(a).every(
        (value) => typeof value !== "number" || Number.isFinite(value),
      ),
    );
    for (const b of state.cards)
      if (a.id !== b.id)
        assert.ok(
          a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y,
          `${a.id} and ${b.id} must not overlap`,
        );
  }
  assert.ok(
    state.values.length,
    "Expanded cards contain actual attribute text",
  );
  assert.ok(
    state.values.every((value) => value.fontSize >= 13 && !value.overflow),
    "Full-size values fit their cards",
  );
}
function sameOrder(before, after) {
  for (const a of after.cards)
    for (const b of after.cards)
      for (const axis of ["x", "y"])
        assert.equal(
          Math.sign(a[axis] - b[axis]),
          Math.sign(
            before.cards.find((c) => c.id === a.id)[axis] -
              before.cards.find((c) => c.id === b.id)[axis],
          ),
          `${a.id}/${b.id} preserve ${axis} order`,
        );
}

try {
  for (const theme of ["light", "dark"]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open("responsive-resource-card", theme);
    const wide = await geometry();
    checkGeometry(wide, 0);
    assert.equal(wide.cards[0].comparisonBeside, true);
    await page.locator("[data-dependency-graph]").screenshot({
      path: resolve(output, `resource-card-${theme}-wide.png`),
    });
    // A narrow embedding must stack even on a wide browser window.
    await page.locator("[data-dependency-graph]").evaluate((graph) => {
      graph.style.maxWidth = "640px";
    });
    await settle();
    const embedded = await geometry();
    checkGeometry(embedded, 0);
    assert.equal(embedded.cards[0].comparisonBelow, true);
    assert.ok(wide.cards[0].height < embedded.cards[0].height);
    await page.setViewportSize({ width: 390, height: 900 });
    await settle();
    checkGeometry(await geometry(), 0);
    await page.locator("[data-dependency-graph]").screenshot({
      path: resolve(output, `resource-card-${theme}-narrow.png`),
    });
    checks.push({ name: `resource-card-wide-embedded-narrow-${theme}` });
  }
  for (const theme of ["light", "dark"])
    for (const width of [2048, 390, 320])
      for (const scenario of ["wide", "deep", "cyclic", "grouped"]) {
        await page.setViewportSize({ width, height: 1600 });
        await open(`${scenario}-attribute-inspection`, theme);
        const state = await geometry();
        checkGeometry(state, scenario === "cyclic" ? 8 : 6);
        assert.equal(
          state.zoom,
          "100%",
          "Initial expanded text stays at native zoom",
        );
        if (width === 2048 && scenario === "wide") {
          assert.ok(state.cards.every((card) => card.width > 800));
          assert.ok(
            state.scrollWidth <= state.viewport + 1,
            "Shallow layout fits the available width",
          );
          const root = state.cards.find((card) => card.id === "network");
          const child = state.cards.find((card) => card.id === "service-1");
          assert.equal(
            child.x - root.x - root.width,
            88,
            "Width goes to cards, not edge gaps",
          );
        }
        if (scenario === "deep" && width === 2048) {
          assert.ok(state.cards.every((card) => card.width >= 352));
          assert.ok(
            state.scrollWidth > state.viewport,
            "Deep chains scroll without squeezing text",
          );
        }
        if (width < 600) {
          assert.ok(state.cards.every((card) => card.width <= state.viewport));
          assert.ok(
            state.visibleCards > 0,
            "Narrow canvases initially show a resource, not empty space between columns",
          );
        }
        const name = `${scenario}-${theme}-${width}`;
        await page
          .locator("[data-dependency-graph]")
          .screenshot({ path: resolve(output, `${name}.png`) });
        checks.push({
          name,
          width: state.cards[0].width,
          height: Math.max(...state.cards.map((card) => card.y + card.height)),
        });

        if (width !== 2048 || scenario !== "wide") continue;
        const canvas = page.locator("[data-graph-canvas]");
        const service = page.locator('[data-graph-node="service-1"]');
        await service.focus();
        await service.press("Enter");
        await settle();
        assert.equal(await service.getAttribute("aria-pressed"), "true");
        assert.deepEqual(
          (await geometry()).cards,
          state.cards,
          "Selection leaves geometry unchanged",
        );
        await page
          .getByRole("button", {
            name: "Hide attribute differences for Application service 1",
            exact: true,
          })
          .click();
        await settle();
        sameOrder(state, await geometry());
        await page
          .getByRole("button", {
            name: "Show attribute differences for Application service 1",
            exact: true,
          })
          .click();
        await settle();
        assert.deepEqual(
          (await geometry()).cards,
          state.cards,
          "Disclosure restores the exact layout",
        );
        await canvas.press("+");
        await settle();
        const zoomed = await geometry();
        assert.equal(zoomed.zoom, "120%");
        assert.deepEqual(
          zoomed.cards,
          state.cards,
          "Explicit zoom scales without reallocating widths",
        );
        await page.setViewportSize({ width: 1440, height: 1600 });
        await settle();
        const resized = await geometry();
        assert.equal(resized.zoom, "120%", "Resize preserves the chosen zoom");
        sameOrder(state, resized);
        await canvas.press("-");
        await settle();
        await page.setViewportSize({ width: 880, height: 1600 });
        await settle();
        const compact = await geometry();
        assert.ok(compact.cards.every((card) => card.width === 352));
        assert.ok(
          state.cards[1].height < compact.cards[1].height * 0.7,
          "Wide cards materially reduce wrapping and vertical scrolling",
        );
        await page.setViewportSize({ width: 2048, height: 1600 });
        await settle();
        assert.deepEqual(
          (await geometry()).cards,
          state.cards,
          "Resize round trip restores the layout",
        );
        assert.equal(
          await service.getAttribute("aria-pressed"),
          "true",
          "Resize retains selection",
        );
        await canvas.press("-");
        await settle();
        assert.equal(
          await page.locator("[data-graph-card-diff]:not([hidden])").count(),
          0,
        );
        await canvas.press("+");
        await settle();
        assert.deepEqual(
          (await geometry()).cards,
          state.cards,
          "Zoom density round trip retains expanded state",
        );
        // Browser text sizing uses layout units, not raw viewport pixels.
        await page.evaluate(() => {
          document.documentElement.style.fontSize = "20px";
        });
        await settle();
        const largeText = await geometry();
        checkGeometry(largeText, 6);
        assert.ok(
          largeText.scrollWidth <= largeText.viewport + 1,
          "Larger text still budgets cards in rem units",
        );
        sameOrder(state, largeText);
        assert.equal(largeText.zoom, "100%");
        await page.locator("[data-dependency-graph]").screenshot({
          path: resolve(output, `wide-${theme}-large-text.png`),
        });
        checks.push({
          name: `interaction-and-large-text-${theme}`,
          wideHeight: state.cards[1].height,
          compactHeight: compact.cards[1].height,
        });
      }
  assert.deepEqual(errors, [], "No runtime errors");
  console.log(
    `DependencyGraph responsive layout: ${checks.length} browser cases passed.`,
  );
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
