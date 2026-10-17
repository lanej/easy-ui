import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9018";
const output = resolve(
  process.env.WAFFLE_REPORT_DIR ?? "/tmp/easy-ui-waffle-chart",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const results = [];
const errors = [];
let currentPage;
const observe = (page) => {
  currentPage = page;
  page.on("pageerror", (error) => errors.push(error.message));
};
const visit = async (page, story, theme) => {
  await page.goto(
    `${base}/iframe.html?id=components-wafflechart--${story}&viewMode=story&globals=colorScheme:${theme}`,
  );
  await page.locator("[data-waffle-item]").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
};
const screenshot = (page, name) =>
  page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
const noOverflow = async (page) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  assert.ok(overflow <= 1, `no page-level horizontal overflow (${overflow}px)`);
  // Every cell must fit its containing group, not just the page viewport.
  assert.ok(
    await page.locator("[data-waffle-item]").evaluateAll((cells) =>
      cells.every((cell) => {
        const bounds = cell.getBoundingClientRect();
        const group = cell.closest('[role="group"]') ?? cell.parentElement;
        const container = group.getBoundingClientRect();
        return (
          bounds.left >= container.left - 1 &&
          bounds.right <= container.right + 1
        );
      }),
    ),
    "cells fit their available group width",
  );
};
const connectionsAligned = (page) =>
  page.waitForFunction(() => {
    const frame = document.querySelector('[data-waffle-example="connections"]');
    if (!frame) return false;
    const parent = frame.getBoundingClientRect();
    const relationships = [
      ["shared-atlas", "shared", "atlas"],
      ["shared-beacon", "shared", "beacon"],
      ["specialist-beacon", "specialist", "beacon"],
    ];
    return relationships.every(([id, groupId, targetId]) => {
      const edge = frame.querySelector(`[data-waffle-connection="${id}"]`);
      const group = frame.querySelector(`[data-waffle-group="${groupId}"]`);
      const target = frame.querySelector(`[data-waffle-target="${targetId}"]`);
      if (!edge || !group || !target) return false;
      const values = edge
        .getAttribute("d")
        ?.match(/-?[\d.]+/g)
        ?.map(Number);
      if (!values || values.length !== 8) return false;
      const source = group.getBoundingClientRect();
      const destination = target.getBoundingClientRect();
      const below = destination.left < source.right;
      const expected = [
        (below ? source.left + source.width / 2 : source.right) - parent.left,
        (below ? source.bottom : source.top + source.height / 2) - parent.top,
        (below ? destination.left + destination.width / 2 : destination.left) -
          parent.left,
        (below ? destination.top : destination.top + destination.height / 2) -
          parent.top,
      ];
      return [values[0], values[1], values[6], values[7]].every(
        (value, index) => Math.abs(value - expected[index]) < 1,
      );
    });
  });

try {
  for (const theme of ["light", "dark"]) {
    for (const width of [1200, 390]) {
      const page = await browser.newPage({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
      observe(page);
      await visit(page, "linked-groups", theme);
      assert.equal(await page.locator("[data-waffle-item]").count(), 17);
      assert.equal(await page.locator("[data-waffle-group]").count(), 3);
      await connectionsAligned(page);
      await noOverflow(page);
      await screenshot(page, `groups-${theme}-${width}`);
      const engineering = page.getByRole("button", {
        name: "Engineering 6",
        exact: true,
      });
      await engineering.click();
      assert.equal(await engineering.getAttribute("aria-pressed"), "true");
      assert.equal(
        await page.locator('[data-waffle-item][data-muted="true"]').count(),
        11,
      );
      assert.equal(await page.locator("[data-waffle-item]").count(), 17);
      assert.ok(await page.getByText("17 items", { exact: true }).isVisible());
      await screenshot(page, `category-${theme}-${width}`);
      await engineering.press("Escape");
      assert.equal(await engineering.getAttribute("aria-pressed"), "false");
      const shared = page.getByRole("button", {
        name: "Shared group 7",
        exact: true,
      });
      await shared.press("Enter");
      assert.equal(await shared.getAttribute("aria-pressed"), "true");
      assert.equal(
        await page.locator('[data-waffle-item][data-selected="true"]').count(),
        7,
      );
      assert.equal(
        await page
          .locator('[data-waffle-connection][data-highlighted="true"]')
          .count(),
        2,
      );
      await screenshot(page, `selected-group-${theme}-${width}`);
      const clearGroup = page.getByRole("button", {
        name: "Clear selection",
        exact: true,
      });
      await clearGroup.focus();
      await clearGroup.press("Escape");
      assert.ok(
        await shared.evaluate((element) => element === document.activeElement),
        "Escape from group details restores caption focus",
      );
      await shared.press("Enter");
      await clearGroup.focus();
      await clearGroup.press("Enter");
      assert.ok(
        await shared.evaluate((element) => element === document.activeElement),
        "clearing a group restores caption focus",
      );
      assert.ok(
        await page
          .getByText("Focus or select a cell or group to inspect it")
          .isVisible(),
      );
      await shared.press("Enter");
      await shared.press("Escape");
      assert.equal(await shared.getAttribute("aria-pressed"), "false");
      const first = page.getByRole("button", {
        name: "Resource 01, Engineering",
        exact: true,
      });
      await first.focus();
      await first.press("ArrowRight");
      const second = page.getByRole("button", {
        name: "Resource 02, Design",
        exact: true,
      });
      assert.ok(
        await second.evaluate((element) => element === document.activeElement),
      );
      await second.press("Space");
      assert.equal(await second.getAttribute("aria-pressed"), "true");
      assert.ok(
        await second.evaluate(
          (element) => getComputedStyle(element).outlineStyle !== "none",
        ),
      );
      await screenshot(page, `keyboard-${theme}-${width}`);
      const clearItem = page.getByRole("button", {
        name: "Clear selection",
        exact: true,
      });
      await clearItem.focus();
      await clearItem.press("Escape");
      assert.ok(
        await second.evaluate((element) => element === document.activeElement),
        "Escape from item details restores cell focus",
      );
      await second.press("Enter");
      await clearItem.focus();
      await clearItem.press("Enter");
      assert.ok(
        await second.evaluate((element) => element === document.activeElement),
        "clearing an item restores cell focus",
      );
      assert.ok(
        await page
          .getByText("Focus or select a cell or group to inspect it")
          .isVisible(),
      );
      await second.press("Enter");
      await second.press("Escape");
      assert.equal(await second.getAttribute("aria-pressed"), "false");
      assert.ok(
        await page
          .getByText("Focus or select a cell or group to inspect it")
          .isVisible(),
      );
      // The same mounted composition must keep endpoints aligned across reflow.
      const originalPath = await page
        .locator('[data-waffle-connection="shared-atlas"]')
        .getAttribute("d");
      await page.setViewportSize({
        width: width === 1200 ? 390 : 1200,
        height: 1000,
      });
      await connectionsAligned(page);
      const reflowedPath = await page
        .locator('[data-waffle-connection="shared-atlas"]')
        .getAttribute("d");
      assert.notEqual(reflowedPath, originalPath);
      await noOverflow(page);
      await page.setViewportSize({ width: 280, height: 1000 });
      await connectionsAligned(page);
      await noOverflow(page);
      await screenshot(page, `reflow-${theme}-${width}-to-280`);
      await page.close();
      results.push({
        theme,
        width,
        checks: [
          "single-copy-pool",
          "one-to-many-connections",
          "unlinked-group",
          "exact-category-counts",
          "pinned-group",
          "keyboard-focus-selection-escape",
          "responsive-anchors",
          "no-clipping",
        ],
      });
    }
    const page = await browser.newPage({
      viewport: { width: 390, height: 1000 },
    });
    observe(page);
    await visit(page, "compact-linked-summary", theme);
    const link = page.getByRole("link", { name: /Synthetic priority/ });
    assert.equal(await link.locator("[data-waffle-item]").count(), 11);
    assert.equal(await link.getByRole("button").count(), 0);
    assert.equal(await link.locator("[tabindex]").count(), 0);
    assert.ok(
      await link.getByRole("img", { name: /11 items.*Draft/ }).isVisible(),
    );
    assert.ok(await link.getByText("/ Draft 2", { exact: true }).isVisible());
    await noOverflow(page);
    await screenshot(page, `compact-${theme}-390`);
    await visit(page, "unknown-and-empty", theme);
    assert.ok(
      await page
        .getByRole("button", {
          name: "Unclassified resource, Unknown category: not-supplied, Draft",
          exact: true,
        })
        .isVisible(),
    );
    assert.ok(
      await page
        .getByRole("group", { name: "Other items", exact: true })
        .isVisible(),
    );
    assert.ok(
      await page.getByText("No items supplied", { exact: true }).isVisible(),
    );
    await noOverflow(page);
    await screenshot(page, `unknown-empty-${theme}-390`);
    await visit(page, "many-items", theme);
    assert.equal(await page.locator("[data-waffle-item]").count(), 137);
    assert.equal(
      await page.locator('[data-waffle-item][tabindex="0"]').count(),
      1,
    );
    assert.ok(await page.getByText("137 items", { exact: true }).isVisible());
    const firstCell = page.locator("[data-waffle-item]").first();
    await firstCell.focus();
    await firstCell.press("ArrowDown");
    const beforeReflow = await page
      .locator("[data-waffle-item]:focus")
      .getAttribute("data-waffle-item");
    assert.ok(
      await page.locator("[data-waffle-item]:focus").evaluate((element) => {
        const origin = document
          .querySelector("[data-waffle-item]")
          .getBoundingClientRect();
        const destination = element.getBoundingClientRect();
        return (
          destination.top > origin.top &&
          Math.abs(destination.left - origin.left) < 1
        );
      }),
      "ArrowDown follows the live wrapped row",
    );
    await noOverflow(page);
    await screenshot(page, `137-items-${theme}-390`);
    await page.setViewportSize({ width: 280, height: 1000 });
    await firstCell.focus();
    await firstCell.press("ArrowDown");
    const afterReflow = await page
      .locator("[data-waffle-item]:focus")
      .getAttribute("data-waffle-item");
    assert.notEqual(
      afterReflow,
      beforeReflow,
      "ArrowDown uses the new column count after reflow",
    );
    await noOverflow(page);
    await page.close();
    results.push({
      theme,
      width: 390,
      checks: [
        "passive-compact-link",
        "draft-marker-label",
        "unknown-category",
        "unmatched-membership",
        "empty",
        "137-exact-items",
      ],
    });
  }
  const page = await browser.newPage({
    viewport: { width: 390, height: 1000 },
    isMobile: true,
    hasTouch: true,
  });
  observe(page);
  await visit(page, "controlled-inspection", "light");
  const first = page.getByRole("button", {
    name: "Resource 01, Engineering",
    exact: true,
  });
  await first.tap();
  assert.equal(await first.getAttribute("aria-pressed"), "true");
  const retained = await first.elementHandle();
  await page.getByRole("button", { name: "Reorder items", exact: true }).tap();
  assert.ok(await retained.evaluate((element) => element.isConnected));
  assert.equal(await first.getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Add item", exact: true }).tap();
  assert.equal(await page.locator("[data-waffle-item]").count(), 18);
  await page
    .getByRole("button", { name: "Remove selected item", exact: true })
    .tap();
  assert.equal(await page.locator("[data-waffle-item]").count(), 17);
  assert.equal(await first.count(), 0);
  const draft = page.getByRole("button", {
    name: "Resource 04, Engineering, Draft",
    exact: true,
  });
  await draft.tap();
  assert.equal(await draft.getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Engineering 5", exact: true }).tap();
  assert.equal(await page.locator("[data-waffle-item]").count(), 17);
  await noOverflow(page);
  await screenshot(page, "touch-update-selected-light-390");
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .tap();
  assert.equal(await draft.getAttribute("aria-pressed"), "false");
  await page.close();
  results.push({
    theme: "light",
    width: 390,
    touch: true,
    checks: [
      "tap-pinning",
      "stable-identity-reorder",
      "add-remove-counts",
      "draft-inspection",
      "category-tap",
      "clear-selection",
    ],
  });
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log(
    "WaffleChart browser checks passed in Light/Dark at desktop, mobile and 280px reflow, including keyboard, touch, exact counts and public connection anchors.",
  );
} catch (error) {
  if (currentPage && !currentPage.isClosed())
    await screenshot(currentPage, "failure");
  throw error;
} finally {
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
}
