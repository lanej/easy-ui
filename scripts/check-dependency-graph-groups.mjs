import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9018";
const output = resolve(
  process.env.FACILITY_REPORT_DIR ?? "/tmp/easy-ui-metrics",
  "dependency-subgraphs",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const errors = [];
const checks = [];
const page = await browser.newPage();
page.on("pageerror", (error) => errors.push(error.message));
async function settle() {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => {
    const unit =
      parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
    const cards = [...document.querySelectorAll("[data-graph-item-card]")];
    return (
      cards.length &&
      cards.every((card) => {
        const scale = new DOMMatrix(
          getComputedStyle(card.parentElement).transform,
        ).a;
        const height = card.getBoundingClientRect().height / scale / unit;
        return card.hasAttribute("data-graph-resource-card")
          ? Math.ceil(height - 0.001) === Number(card.dataset.graphLayoutHeight)
          : Math.abs(height - Number(card.dataset.graphLayoutHeight)) <= 1.1;
      })
    );
  });
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
}
async function geometry() {
  return page.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const groups = [...document.querySelectorAll("[data-graph-group]")].map(
      (el) => ({
        id: el.dataset.graphGroup,
        ...box(el),
        heading: box(el.firstElementChild),
      }),
    );
    const cards = [...document.querySelectorAll("[data-graph-item-card]")].map(
      (el) => ({
        id: el.dataset.graphResourceCard ?? el.dataset.graphCollapsedGroup,
        ...box(el),
      }),
    );
    return {
      groups,
      cards,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
}
function contains(a, b) {
  return (
    a.x <= b.x + 1 &&
    a.y <= b.y + 1 &&
    a.x + a.width >= b.x + b.width - 1 &&
    a.y + a.height >= b.y + b.height - 1
  );
}
function disjoint(a, b) {
  return (
    a.x + a.width <= b.x + 1 ||
    b.x + b.width <= a.x + 1 ||
    a.y + a.height <= b.y + 1 ||
    b.y + b.height <= a.y + 1
  );
}
function checkGeometry(result) {
  assert.equal(
    result.overflow,
    false,
    "Only the graph viewport may overflow horizontally",
  );
  const parent = result.groups.find(({ id }) => id === "production");
  for (const group of result.groups) {
    if (parent && group !== parent)
      assert(contains(parent, group), "Parent must enclose child boundary");
    for (const card of result.cards)
      assert(
        disjoint(group.heading, card),
        "Group heading must not cover a card",
      );
  }
  const siblings = result.groups.filter(({ id }) => id !== "production");
  if (siblings.length === 2)
    assert(
      disjoint(siblings[0], siblings[1]),
      "Sibling subgraphs must not overlap",
    );
  for (const a of result.cards)
    for (const b of result.cards)
      if (a.id !== b.id)
        assert(disjoint(a, b), "Resource cards must not overlap");
  for (const card of result.cards.filter(({ id }) =>
    ["image", "output", "audit"].includes(id),
  ))
    for (const group of result.groups)
      assert(
        disjoint(group, card),
        "Ungrouped resources must stay outside group boundaries",
      );
}
try {
  for (const theme of ["light", "dark"])
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const story of [
        "grouped-subgraphs",
        "nested-subgraphs",
        "collapsed-subgraphs",
      ]) {
        await page.goto(
          `${base}/iframe.html?id=components-dependencygraph--${story}&viewMode=story&globals=colorScheme:${theme}`,
        );
        await page.locator("[data-dependency-graph]").waitFor();
        await settle();
        checkGeometry(await geometry());
        await page.screenshot({
          path: resolve(output, `${story}-${theme}-${width}.png`),
          fullPage: true,
        });
        if (story === "nested-subgraphs") {
          const initial = await geometry();
          const collapseChild = page.getByRole("button", {
            name: "Collapse Runtime module",
            exact: true,
          });
          await collapseChild.focus();
          await page.keyboard.press("Enter");
          await page
            .locator('[data-graph-collapsed-group="runtime"]')
            .waitFor();
          await settle();
          checkGeometry(await geometry());
          await page
            .getByRole("button", { name: "Collapse Production", exact: true })
            .click();
          await page
            .locator('[data-graph-collapsed-group="production"]')
            .waitFor();
          await settle();
          assert.equal(await page.locator("[data-graph-group]").count(), 0);
          await page
            .getByRole("button", { name: "Expand Production", exact: true })
            .click();
          await page
            .locator('[data-graph-collapsed-group="runtime"]')
            .waitFor();
          await settle();
          checkGeometry(await geometry());
          await page
            .getByRole("button", { name: "Expand Runtime module", exact: true })
            .click();
          await settle();
          const restored = await geometry();
          for (const a of initial.cards)
            for (const b of initial.cards) {
              if (a.id === b.id) continue;
              const nextA = restored.cards.find(({ id }) => id === a.id);
              const nextB = restored.cards.find(({ id }) => id === b.id);
              assert.equal(
                Math.sign(Math.round(nextA.x - nextB.x)),
                Math.sign(Math.round(a.x - b.x)),
                "Horizontal order survives group disclosure",
              );
              assert.equal(
                Math.sign(Math.round(nextA.y - nextB.y)),
                Math.sign(Math.round(a.y - b.y)),
                "Vertical order survives group disclosure",
              );
            }
          await page
            .getByRole("button", {
              name: "Collapse Runtime module",
              exact: true,
            })
            .click();
          await page
            .getByRole("button", { name: "Collapse Production", exact: true })
            .click();
          await page
            .getByRole("searchbox", { name: "Find resource" })
            .fill("api");
          await page
            .getByRole("region", { name: "Resource search results" })
            .getByRole("button")
            .first()
            .click();
          await page.locator('[data-graph-resource-card="api"]').waitFor();
          await settle();
          assert.equal(
            await page
              .locator('[data-graph-collapsed-group="production"]')
              .count(),
            0,
          );
          assert.equal(
            await page
              .locator('[data-graph-collapsed-group="runtime"]')
              .count(),
            0,
          );
          checkGeometry(await geometry());
        }
        checks.push({ story, theme, width });
      }
    }
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(
    `Passed ${checks.length} subgraph browser cases with keyboard disclosure and nested search.`,
  );
} finally {
  await browser.close();
}

// Contrast is checked against the actual containing subgraph, not the DOM parent.
await import("./check-dependency-graph-contrast.mjs");
