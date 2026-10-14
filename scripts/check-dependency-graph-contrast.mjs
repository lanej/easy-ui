import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9018";
const output = resolve(process.env.FACILITY_REPORT_DIR ?? "/tmp/easy-ui-metrics", "dependency-contrast");
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
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll("[data-graph-resource-card]")];
    const unit = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
    return cards.length && cards.every((card) => {
      const scale = new DOMMatrix(getComputedStyle(card.parentElement).transform).a;
      return Math.ceil(card.getBoundingClientRect().height / scale / unit - 0.001) === Number(card.dataset.graphLayoutHeight);
    });
  });
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}

// WCAG 2.2 SC 1.4.3/1.4.11: compare computed colors without rounding thresholds.
// Groups and cards are sibling layers: DOM ancestry alone gives a false backdrop.
async function audit(forcedColors = false) {
  return page.evaluate((forced) => {
    const graph = document.querySelector("[data-dependency-graph]");
    const viewport = graph.querySelector("[data-graph-canvas]");
    const groups = [...graph.querySelectorAll("[data-graph-group]")];
    const cards = [...graph.querySelectorAll("[data-graph-item-card]")];
    const failures = [];
    const borders = [];
    const text = [];
    const lines = [];
    function rgb(value) {
      const match = value.match(/^rgba?\(([^)]+)\)$/);
      if (!match) throw new Error(`Unsupported computed color: ${value}`);
      const values = match[1].split(/[, /]+/).map(Number);
      return [...values.slice(0, 3), values[3] ?? 1];
    }
    function over(a, b) {
      const alpha = a[3] + b[3] * (1 - a[3]);
      return alpha ? [0, 1, 2].map((i) => (a[i] * a[3] + b[i] * b[3] * (1 - a[3])) / alpha).concat(alpha) : [0, 0, 0, 0];
    }
    function surface(el) {
      let color = [0, 0, 0, 0];
      for (let current = el; current && color[3] < 1; current = current.parentElement)
        color = over(color, rgb(getComputedStyle(current).backgroundColor));
      return over(color, [255, 255, 255, 1]);
    }
    function luminance(color) {
      const linear = color.slice(0, 3).map((v) => {
        const n = v / 255;
        return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    }
    function ratio(fg, bg) {
      const a = luminance(over(fg, bg));
      const b = luminance(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }
    function id(el) {
      return el.dataset.graphResourceCard ?? el.dataset.graphCollapsedGroup ?? el.dataset.graphGroup;
    }
    function contains(a, b) {
      return a.left <= b.left + 0.5 && a.top <= b.top + 0.5 && a.right >= b.right - 0.5 && a.bottom >= b.bottom - 0.5;
    }
    function surrounding(el) {
      const rect = el.getBoundingClientRect();
      return groups.filter((g) => g !== el && contains(g.getBoundingClientRect(), rect))
        .sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0] ?? viewport;
    }
    for (const el of [...groups, ...cards]) {
      const style = getComputedStyle(el);
      const bg = surface(el);
      const backdrop = surface(surrounding(el));
      const border = rgb(style.borderLeftColor);
      const value = Math.min(ratio(border, bg), ratio(border, backdrop));
      borders.push({ id: id(el), ratio: value });
      if (value < 3) failures.push(`${id(el)} boundary ${value}`);
      const scale = new DOMMatrix(getComputedStyle(el.parentElement).transform).a;
      if (parseFloat(style.borderLeftWidth) * scale < 0.95) failures.push(`${id(el)} subpixel boundary`);
      for (let current = el; current; current = current.parentElement) {
        if (Number(getComputedStyle(current).opacity) < 1) failures.push(`${id(el)} ancestor opacity`);
        if (current === graph) break;
      }
      if (cards.includes(el) && rgb(style.backgroundColor)[3] !== 1) failures.push(`${id(el)} transparent card`);
      if (!forced && el.dataset.nodeKind === "unresolved" && style.backgroundColor === getComputedStyle(viewport).backgroundColor)
        failures.push(`${id(el)} unresolved card uses canvas fill`);
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent.trim()) continue;
        const parent = node.parentElement;
        const rect = parent.getBoundingClientRect();
        const computed = getComputedStyle(parent);
        if (rect.width <= 1 || rect.height <= 1 || computed.visibility !== "visible" || !parent.getClientRects().length) continue;
        const contrast = ratio(rgb(computed.color), surface(parent));
        text.push({ id: id(el), label: node.textContent.trim(), ratio: contrast });
        if (contrast < 4.5) failures.push(`${id(el)} text ${node.textContent.trim()}: ${contrast}`);
      }
      if (!forced && groups.includes(el) && surrounding(el) !== viewport && style.backgroundColor === getComputedStyle(surrounding(el)).backgroundColor)
        failures.push(`${id(el)} nested group has identical surface`);
    }
    const backdrops = [viewport, ...groups].map(surface);
    for (const path of graph.querySelectorAll("[data-graph-edge-ids] > path:last-of-type, [data-graph-convergence] > path:last-of-type")) {
      const value = Math.min(...backdrops.map((bg) => ratio(rgb(getComputedStyle(path).stroke), bg)));
      lines.push(value);
      if (value < 3) failures.push(`relationship contrast ${value}`);
    }
    return { failures, borders, text, lines };
  }, forcedColors);
}

async function verify(name, forcedColors = false) {
  const result = await audit(forcedColors);
  assert.ok(result.borders.length, `${name}: measured boundaries`);
  assert.ok(result.text.length, `${name}: measured visible text`);
  checks.push({ name, ...result });
  assert.deepEqual(result.failures, [], name);
}

try {
  for (const theme of ["light", "dark"]) {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const story of ["nested-subgraphs", "grouped-subgraphs", "collapsed-subgraphs", "source-only-evidence", "category-colors", "category-palette", "explicit-change-evidence"]) {
        const name = `${story}-${theme}-${width}`;
        await page.goto(`${base}/iframe.html?id=components-dependencygraph--${story}&viewMode=story&globals=colorScheme:${theme}`);
        await page.locator("[data-dependency-graph]").waitFor();
        await settle();
        await verify(`${name}:initial`);
        if (story === "nested-subgraphs" && width !== 320)
          await page.locator("[data-dependency-graph]").screenshot({ path: resolve(output, `${name}.png`) });
        const button = page.locator("[data-graph-node]").first();
        await button.press("Enter");
        await settle();
        await verify(`${name}:selected-focused`);
        await button.hover();
        await verify(`${name}:hovered`);
        await page.mouse.move(0, 0);
        const zoomOut = page.getByRole("button", { name: "Zoom out graph", exact: true });
        for (let i = 0; i < 10 && await zoomOut.isEnabled(); i++) await zoomOut.press("Enter");
        await settle();
        assert.equal((await page.getByLabel("Graph zoom").textContent()).trim(), "40%");
        await verify(`${name}:overview`);
        if (story === "nested-subgraphs" && width === 1440) {
          await page.locator("[data-dependency-graph]").screenshot({ path: resolve(output, `overview-${theme}.png`) });
          // Negative controls: fail on faint boundaries and whole-card fading.
          const faint = await page.addStyleTag({ content: "[data-graph-item-card] { border-color: transparent !important; }" });
          assert.ok((await audit()).failures.some((failure) => failure.includes("boundary")), "Detect invisible card boundaries");
          await faint.evaluate((el) => el.remove());
          const faded = await page.addStyleTag({ content: "[data-graph-item-card] { opacity: .3 !important; }" });
          assert.ok((await audit()).failures.some((failure) => failure.includes("opacity")), "Detect composited card fading");
          await faded.evaluate((el) => el.remove());
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto(`${base}/iframe.html?id=components-dependencygraph--nested-subgraphs&viewMode=story&globals=colorScheme:${theme}`);
    await page.locator("[data-dependency-graph]").waitFor();
    await settle();
    await verify(`forced-colors-${theme}`, true);
    await page.emulateMedia({ forcedColors: "none" });
  }
  assert.deepEqual(errors, []);
  console.log(`Passed ${checks.length} resource/subgraph contrast cases.`);
} finally {
  await writeFile(resolve(output, "results.json"), JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
