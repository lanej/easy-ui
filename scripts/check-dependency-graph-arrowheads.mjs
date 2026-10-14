import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9018";
const output = resolve(
  process.env.FACILITY_REPORT_DIR ?? "/tmp/easy-ui-metrics",
  "dependency-arrowheads",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const page = await browser.newPage();
const errors = [],
  results = [];
page.on("pageerror", (error) => errors.push(error.message));
async function settle() {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => {
    const unit =
      (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) /
      16;
    return [...document.querySelectorAll("[data-graph-resource-card]")].every(
      (card) => {
        const scale = new DOMMatrix(
          getComputedStyle(card.parentElement).transform,
        ).a;
        return (
          Math.ceil(
            card.getBoundingClientRect().height / scale / unit - 0.001,
          ) === Number(card.dataset.graphLayoutHeight)
        );
      },
    );
  });
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
}
async function inspect(name, strict = true) {
  const data = await page.evaluate(() => {
    const graph = document.querySelector("[data-dependency-graph]");
    const arrivals = [...graph.querySelectorAll("path[marker-end]")].map(
      (path) => {
        const marker = document.getElementById(
          path.getAttribute("marker-end").slice(5, -1),
        );
        const size = Number(marker.getAttribute("markerWidth"));
        const length = path.getTotalLength();
        const end = path.getPointAtLength(length);
        const before = path.getPointAtLength(Math.max(0, length - size - 16));
        const samples = [];
        for (let distance = 0; distance <= size + 16; distance += 0.5) {
          const point = path.getPointAtLength(Math.max(0, length - distance));
          samples.push(Math.abs(point.y - end.y));
        }
        return {
          ids:
            path.parentElement.dataset.graphEdgeIds ??
            path.parentElement.dataset.graphConvergenceEdgeIds,
          units: marker.getAttribute("markerUnits"),
          refX: marker.getAttribute("refX"),
          size,
          length,
          run: end.x - before.x,
          deviation: Math.max(...samples),
          shared: path.parentElement.hasAttribute("data-graph-convergence"),
        };
      },
    );
    const near = graph.querySelector('[data-graph-edge-ids*="db-user"]');
    return {
      arrivals,
      near: near ? JSON.parse(near.dataset.graphRoutePoints) : null,
      positions: Object.fromEntries(
        [...graph.querySelectorAll("[data-graph-resource-card]")].map(
          (node) => [
            node.dataset.graphResourceCard,
            [node.style.left, node.style.top, node.style.width],
          ],
        ),
      ),
    };
  });
  assert.ok(data.arrivals.length, `${name}: rendered arrows`);
  for (const arrow of data.arrivals) {
    assert.equal(
      arrow.units,
      "userSpaceOnUse",
      `${name}: marker size is independent of stroke`,
    );
    assert.equal(arrow.refX, "10", `${name}: tip meets the path endpoint`);
    if (strict) {
      assert.ok(
        arrow.run >= arrow.size + 16 - 0.1,
        `${name}: ${arrow.ids} needs a full straight shaft; ${JSON.stringify(arrow)}`,
      );
      assert.ok(
        arrow.deviation < 0.1,
        `${name}: ${arrow.ids} has a bend under its arrowhead`,
      );
    }
  }
  if (strict && data.near) {
    assert.equal(
      data.near.length,
      2,
      `${name}: near-level headers must not have a terminal jog`,
    );
    assert.equal(data.near[0].y, data.near[1].y);
  }
  results.push({ name, arrivals: data.arrivals });
  return data;
}
try {
  for (const theme of ["light", "dark"])
    for (const width of [1440, 390, 320]) {
      const name = `nested-subgraphs-${theme}-${width}`;
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(
        `${base}/iframe.html?id=components-dependencygraph--nested-subgraphs&viewMode=story&globals=colorScheme:${theme}`,
      );
      await page.locator('[data-graph-resource-card="api"]').waitFor();
      await settle();
      const initial = await inspect(name);
      await page
        .locator("[data-dependency-graph]")
        .screenshot({ path: resolve(output, `${name}.png`) });
      if (width === 1440) {
        const shared = page.locator(
          "[data-graph-convergence] path[marker-end]",
        );
        const point = await shared.evaluate((path) => {
          const p = path
            .getPointAtLength(path.getTotalLength() - 20)
            .matrixTransform(path.getScreenCTM());
          return { x: p.x, y: p.y };
        });
        await page.mouse.move(point.x, point.y);
        await inspect(`${name}-hover`);
        await page.mouse.click(point.x, point.y);
        assert.equal(
          await shared.locator("..").getAttribute("data-selected"),
          "true",
        );
        const selected = await inspect(`${name}-selected`);
        assert.deepEqual(
          selected.positions,
          initial.positions,
          `${name}: no resource movement`,
        );
      }
      await page
        .getByRole("button", {
          name: "Show attribute differences for api",
          exact: true,
        })
        .press("Enter");
      await settle();
      await inspect(`${name}-expanded`);
      await page
        .getByRole("button", {
          name: "Hide attribute differences for api",
          exact: true,
        })
        .press("Enter");
      for (let i = 0; i < 5; i++) {
        const out = page.getByRole("button", {
          name: "Zoom out graph",
          exact: true,
        });
        if (await out.isEnabled()) await out.press("Enter");
      }
      await settle();
      await inspect(`${name}-overview`);
      if (width === 1440 && theme === "dark")
        await page
          .locator("[data-dependency-graph]")
          .screenshot({ path: resolve(output, "overview-dark.png") });
    }
  for (const story of [
    "attribute-dependencies",
    "relationship-changes",
    "cyclic-relationships",
    "collapsed-subgraphs",
  ]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(
      `${base}/iframe.html?id=components-dependencygraph--${story}&viewMode=story&globals=colorScheme:dark`,
    );
    await page.locator("[data-dependency-graph]").waitFor();
    await settle();
    await inspect(story, false);
  }
  assert.deepEqual(errors, []);
} catch (error) {
  errors.push(error.stack ?? String(error));
  await page.screenshot({
    path: resolve(output, "failure.png"),
    fullPage: true,
  });
  throw error;
} finally {
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
}
console.log(`Verified ${results.length} arrowhead and shaft cases.`);
