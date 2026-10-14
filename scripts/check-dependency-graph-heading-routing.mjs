import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9018";
const output = resolve(
  process.env.FACILITY_REPORT_DIR ?? "/tmp/easy-ui-metrics",
  "dependency-heading-routing",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const page = await browser.newPage();
const errors = [];
const results = [];
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
async function geometry() {
  return page.evaluate(() => {
    const svg = document.querySelector("[data-graph-edge-ids]").closest("svg");
    const matrix = svg.getScreenCTM();
    const rect = (element) => {
      const r = element.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    };
    const cards = [...document.querySelectorAll("[data-graph-item-card]")].map(
      rect,
    );
    const controls = [
      ...document.querySelectorAll("[data-graph-group-heading] button"),
    ].map(rect);
    const inside = (p, r) =>
      p.x > r.left + 1 &&
      p.x < r.right - 1 &&
      p.y > r.top + 1 &&
      p.y < r.bottom - 1;
    const routes = [...document.querySelectorAll("[data-graph-edge-ids]")].map(
      (group) => {
        const points = JSON.parse(group.dataset.graphRoutePoints);
        const path = group.querySelector("path:last-of-type");
        const length = path.getTotalLength();
        const collisions = [];
        for (let step = 1; step < length; step += 2) {
          const p = path.getPointAtLength(step).matrixTransform(matrix);
          if ([...cards, ...controls].some((r) => inside(p, r)))
            collisions.push({ x: p.x, y: p.y });
        }
        return {
          ids: JSON.parse(group.dataset.graphEdgeIds),
          points,
          collisions,
          pixels: points.map((p) => {
            const point = new DOMPoint(p.x, p.y).matrixTransform(matrix);
            return { x: point.x, y: point.y };
          }),
          length: points
            .slice(1)
            .reduce(
              (sum, p, i) =>
                sum + Math.abs(p.x - points[i].x) + Math.abs(p.y - points[i].y),
              0,
            ),
        };
      },
    );
    const heading = document.querySelector(
      '[data-graph-group-heading="runtime"]',
    );
    const headingBox = heading && rect(heading);
    const db = routes.find((route) => route.ids.includes("db-api"));
    const crossing =
      db &&
      headingBox &&
      db.pixels.slice(1).flatMap((b, i) => {
        const a = db.pixels[i];
        const y = (headingBox.top + headingBox.bottom) / 2;
        return Math.abs(a.x - b.x) < 0.01 &&
          Math.min(a.y, b.y) < y &&
          Math.max(a.y, b.y) > y &&
          a.x > headingBox.left &&
          a.x < headingBox.right
          ? [{ x: a.x, y }]
          : [];
      })[0];
    return {
      routes,
      crossing,
      positions: Object.fromEntries(
        [...document.querySelectorAll("[data-graph-resource-card]")].map(
          (card) => [
            card.dataset.graphResourceCard,
            [card.style.left, card.style.top, card.style.width],
          ],
        ),
      ),
    };
  });
}
function checkRoutes(data, name, compact = false) {
  for (const route of data.routes) {
    assert.ok(route.points.length > 1, `${name}: relationship has a route`);
    assert.deepEqual(
      route.collisions,
      [],
      `${name}: ${route.ids} must not cross a resource, title, or control`,
    );
    for (const [index, b] of route.points.slice(1).entries()) {
      const a = route.points[index];
      assert.ok(a.x === b.x || a.y === b.y, `${name}: orthogonal route`);
    }
  }
  const route = data.routes.find((route) => route.ids.includes("db-api"));
  if (compact) {
    const a = route.points[0],
      b = route.points.at(-1);
    assert.ok(
      route.length <= Math.abs(b.x - a.x) + Math.abs(b.y - a.y) + 1,
      `${name}: db-api takes a shortest route, not a perimeter excursion`,
    );
    assert.ok(
      route.points.length <= 4,
      `${name}: at most two bends through the open heading gap`,
    );
    assert.ok(data.crossing, `${name}: crosses the heading's empty space`);
  }
}
try {
  for (const theme of ["light", "dark"])
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const name = `nested-subgraphs-${theme}-${width}`;
      await page.goto(
        `${base}/iframe.html?id=components-dependencygraph--nested-subgraphs&viewMode=story&globals=colorScheme:${theme}`,
      );
      await page.locator('[data-graph-resource-card="api"]').waitFor();
      await settle();
      let data = await geometry();
      checkRoutes(data, name, true);
      results.push({
        name,
        route: data.routes.find((route) => route.ids.includes("db-api")),
      });
      await page
        .locator("[data-dependency-graph]")
        .screenshot({ path: resolve(output, `${name}.png`) });
      // The transparent header gap must not hide the connector or intercept clicks.
      // Scroll the graph viewport without changing any graph positions on narrow screens.
      await page
        .locator('[data-graph-resource-card="api"]')
        .scrollIntoViewIfNeeded();
      data = await geometry();
      // A fully revealed card can leave its approach just outside a 320px
      // viewport. Pan to the edge itself before exercising its real hit target.
      await page.locator("[data-graph-canvas]").evaluate((element, point) => {
        const rect = element.getBoundingClientRect();
        element.scrollLeft += point.x - (rect.left + rect.width / 2);
        element.scrollTop += point.y - (rect.top + rect.height / 2);
      }, data.crossing);
      data = await geometry();
      const before = data.positions;
      await page.mouse.click(data.crossing.x, data.crossing.y);
      assert.equal(
        await page
          .locator('[data-graph-edge-ids*="db-api"]')
          .getAttribute("data-selected"),
        "true",
        `${name}: blank header space leaves the edge selectable`,
      );
      assert.deepEqual(
        (await geometry()).positions,
        before,
        `${name}: routing/selection never repositions the resources`,
      );
      await page
        .getByRole("button", { name: "Collapse Runtime module", exact: true })
        .press("Enter");
      await settle();
      checkRoutes(await geometry(), `${name}-collapsed`);
      await page
        .getByRole("button", { name: "Expand Runtime module", exact: true })
        .press("Enter");
      await settle();
      checkRoutes(await geometry(), `${name}-reopened`, true);
      // Capture controls at fixed-screen-size overview zoom as well as enlarged text.
      for (let count = 0; count < 5; count++) {
        const out = page.getByRole("button", {
          name: "Zoom out graph",
          exact: true,
        });
        if (await out.isEnabled()) await out.press("Enter");
      }
      await settle();
      checkRoutes(await geometry(), `${name}-overview`);
      results.push({ name: `${name}-overview` });
      if (width === 1440 && theme === "dark")
        await page
          .locator("[data-dependency-graph]")
          .screenshot({ path: resolve(output, "overview-dark.png") });
    }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `${base}/iframe.html?id=components-dependencygraph--nested-subgraphs&viewMode=story&globals=colorScheme:dark`,
  );
  await page.locator('[data-graph-resource-card="api"]').waitFor();
  await settle();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "20px";
  });
  await settle();
  checkRoutes(await geometry(), "enlarged-root-text", true);
  results.push({ name: "enlarged-root-text" });
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
console.log(
  `Passed ${results.length} heading-routing cases, including painted paths and edge hit testing.`,
);
