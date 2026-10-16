import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const output = resolve(
  process.env.FACILITY_REPORT_DIR ?? "/tmp/easy-ui-metrics",
  "dependency-card-layout",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const page = await browser.newPage();
const errors = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.message));
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9018";
const card = (id) => page.locator(`[data-graph-resource-card="${id}"]`);
const move = (id) => page.locator(`[data-graph-move="${id}"]`);
const resize = (id) => page.locator(`[data-graph-resize="${id}"]`);
const geometry = (id) =>
  card(id).evaluate((element) => ({
    x: parseFloat(element.style.left) * 16,
    y: parseFloat(element.style.top) * 16,
    width: parseFloat(element.style.width) * 16,
    height: Number(element.dataset.graphLayoutHeight),
    fixed: element.hasAttribute("data-graph-fixed-height"),
  }));
const scale = () =>
  page
    .locator("[data-graph-scene]")
    .evaluate(
      (element) =>
        (new DOMMatrix(getComputedStyle(element).transform).a *
          parseFloat(getComputedStyle(document.documentElement).fontSize)) /
        16,
    );
const path = () =>
  page.evaluate(() =>
    [...document.querySelectorAll("g[data-graph-edge-ids]")]
      .find((el) => JSON.parse(el.dataset.graphEdgeIds).includes("store-api"))
      .querySelector("path")
      .getAttribute("d"),
  );
async function settle() {
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-graph-resource-card]")].every(
      (card) =>
        Math.abs(
          card.offsetHeight /
            (parseFloat(getComputedStyle(document.documentElement).fontSize) /
              16) -
            Number(card.dataset.graphLayoutHeight),
        ) < 1.1,
    ),
  );
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}
async function drag(handle, dx, dy, cancel = false) {
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 5 });
  if (cancel) await page.keyboard.press("Escape");
  await page.mouse.up();
  await settle();
  const end = await handle.boundingBox();
  return { x: end.x + end.width / 2 - x, y: end.y + end.height / 2 - y };
}
async function size(width, height) {
  await page
    .getByRole("textbox", { name: "Card width", exact: true })
    .fill(String(width));
  await page
    .getByRole("textbox", { name: "Card height", exact: true })
    .fill(String(height));
  await page.getByRole("button", { name: "Apply size", exact: true }).click();
  await settle();
}
async function checkAnchor() {
  await page.waitForFunction(() => {
    const target = document.querySelector('[data-graph-resource-card="api"]');
    const field = target.querySelector(
      '[data-field-change="database.host"] dt',
    );
    const unit =
      parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
    const zoom = new DOMMatrix(getComputedStyle(target.parentElement).transform)
      .a;
    const box = target.getBoundingClientRect(),
      heading = field.getBoundingClientRect();
    const edge = [...document.querySelectorAll("g[data-graph-edge-ids]")].find(
      (el) => JSON.parse(el.dataset.graphEdgeIds).includes("store-api"),
    );
    const d = edge.querySelector("path").getAttribute("d");
    const end = d.match(/L ([\d.-]+) ([\d.-]+)$/);
    const expected =
      parseFloat(target.style.top) * 16 +
      (heading.top + heading.height / 2 - box.top) / (unit * zoom);
    return end && Math.abs(Number(end[2]) - expected) < 1;
  });
}
try {
  for (const { theme, width, font } of [
    { theme: "light", width: 1440, font: 16 },
    { theme: "dark", width: 1440, font: 16 },
    { theme: "light", width: 390, font: 20 },
  ]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto(
      `${base}/iframe.html?id=components-dependencygraph--editable-resource-cards&viewMode=story&globals=colorScheme:${theme}`,
    );
    await card("store").waitFor();
    if (font !== 16)
      await page.evaluate(
        (size) => (document.documentElement.style.fontSize = `${size}px`),
        font,
      );
    await page
      .getByRole("button", { name: "Edit layout", exact: true })
      .click();
    await settle();
    const initial = await geometry("store"),
      initialScale = await scale();
    await drag(move("store"), 60, 50);
    const moved = await geometry("store");
    assert.ok(Math.abs(moved.x - initial.x - 60 / initialScale) <= 1);
    assert.ok(Math.abs(moved.y - initial.y - 50 / initialScale) <= 1);
    await drag(move("store"), 35, 25, true);
    assert.deepEqual(
      await geometry("store"),
      moved,
      "Escape restores pre-drag geometry",
    );
    const resizedBy = await drag(resize("store"), -50, -40);
    const resized = await geometry("store");
    assert.ok(Math.abs(resizedBy.x + 50) <= 1);
    assert.ok(Math.abs(resizedBy.y + 40) <= 1);
    await size(420, 240);
    assert.equal((await geometry("store")).width, 420);
    assert.equal((await geometry("store")).height, 240);
    await move("store").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    await settle();
    const keyboard = await geometry("store");
    assert.equal(keyboard.x, resized.x + 10);
    assert.equal(keyboard.y, resized.y + 50);
    await resize("store").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await settle();
    assert.equal((await geometry("store")).width, 430);
    assert.equal((await geometry("store")).height, 250);
    const oldPath = await path();
    await card("store").evaluate(
      (element) => (element.scrollTop = element.scrollHeight),
    );
    await page.waitForFunction(
      (old) =>
        [...document.querySelectorAll("g[data-graph-edge-ids]")]
          .find((el) =>
            JSON.parse(el.dataset.graphEdgeIds).includes("store-api"),
          )
          .querySelector("path")
          .getAttribute("d") !== old,
      oldPath,
    );
    await checkAnchor();
    await card("store").evaluate((element) => (element.scrollTop = 0));
    await size(1, -1);
    assert.equal((await geometry("store")).width, 192);
    assert.equal((await geometry("store")).height, 96);
    await size(430, 250);
    await page
      .getByRole("button", { name: "Zoom in graph", exact: true })
      .click();
    await settle();

    const resizedZoom = await drag(resize("store"), 48, 24);
    assert.ok(Math.abs(resizedZoom.x - 48) <= 1);
    assert.ok(Math.abs(resizedZoom.y - 24) <= 1);
    await page
      .getByRole("button", { name: "Zoom out graph", exact: true })
      .click();
    // Every card has a fixed height: toggling edit handles must still remeasure ports.
    await page.locator('[data-graph-node="worker"]').click();
    await size(256, 200);
    await checkAnchor();
    await page
      .getByRole("button", { name: "Done editing", exact: true })
      .click();
    await checkAnchor();
    const retained = await geometry("store");
    await page
      .getByRole("button", { name: "Enter full screen", exact: true })
      .click();
    await page.waitForFunction(() =>
      document.fullscreenElement?.hasAttribute("data-dependency-graph"),
    );
    await settle();
    assert.deepEqual(await geometry("store"), retained);
    await page
      .getByRole("button", { name: "Edit layout", exact: true })
      .click();
    await page.locator('[data-graph-node="store"]').click();
    await settle();
    await page.screenshot({ path: resolve(output, `${theme}-${width}.png`) });
    await page
      .getByRole("button", { name: "Exit full screen", exact: true })
      .click();
    await page.waitForFunction(() => !document.fullscreenElement);
    await page.getByRole("button", { name: "Reset card", exact: true }).click();
    await settle();
    assert.equal((await geometry("store")).fixed, false);
    await move("worker").focus();
    for (let step = 0; step < 20; step++)
      await page.keyboard.press("Shift+ArrowRight");
    await settle();
    assert.equal(
      await page.evaluate(() => {
        const worker = document.querySelector(
          '[data-graph-resource-card="worker"]',
        );
        const scene = document.querySelector("[data-graph-scene]");
        const group = document.querySelector('[data-graph-group="apps"]');
        const x = parseFloat(worker.style.left),
          y = parseFloat(worker.style.top);
        const right = x + parseFloat(worker.style.width);
        const bottom = y + Number(worker.dataset.graphLayoutHeight) / 16;
        return (
          parseFloat(scene.style.width) > right &&
          parseFloat(scene.style.height) > bottom &&
          parseFloat(group.style.left) < x &&
          parseFloat(group.style.top) < y &&
          parseFloat(group.style.left) + parseFloat(group.style.width) >
            right &&
          parseFloat(group.style.top) + parseFloat(group.style.height) > bottom
        );
      }),
      true,
      "Canvas and group boundaries include cards moved beyond the old canvas",
    );
    await page
      .getByRole("button", { name: "Reset layout", exact: true })
      .click();
    await settle();
    assert.equal(
      await page.locator('[data-graph-fixed-height="true"]').count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Reset layout", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    checks.push({
      theme,
      width,
      font,
      pointerMove: true,
      resize: true,
      keyboard: true,
      cancellation: true,
      numericSize: true,
      zoomConversion: true,
      attributeScroll: true,
      editModePorts: true,
      fullscreenRetention: true,
      reset: true,
    });
  }
  assert.deepEqual(errors, []);
  console.log(`PASS ${checks.length} manual card-layout browser scenarios`);
} catch (error) {
  await page.screenshot({ path: resolve(output, "failure.png") });
  throw error;
} finally {
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}
