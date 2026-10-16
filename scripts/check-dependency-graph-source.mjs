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

async function settled() {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.waitForFunction(() => {
    const unit =
      parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
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
}
async function positions() {
  return page
    .locator("[data-graph-resource-card]")
    .evaluateAll((cards) =>
      Object.fromEntries(
        cards.map((card) => [
          card.dataset.graphResourceCard,
          [parseFloat(card.style.left), parseFloat(card.style.top)],
        ]),
      ),
    );
}
function sameOrder(before, after) {
  for (const [id, a] of Object.entries(after))
    for (const [other, b] of Object.entries(after))
      for (const axis of [0, 1])
        assert.equal(
          Math.sign(a[axis] - b[axis]),
          Math.sign(before[id][axis] - before[other][axis]),
          `Resource order: ${id}/${other}/${axis}`,
        );
}
try {
  for (const theme of ["light", "dark"])
    for (const width of [1440, 390, 320]) {
      const name = `source-evidence-interaction-${theme}-${width}`;
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(
        `${base}/iframe.html?id=components-dependencygraph--source-only-evidence&viewMode=story&globals=colorScheme:${theme}`,
      );
      await page.locator("[data-dependency-graph]").waitFor();
      await page.evaluate(() => document.fonts.ready);
      await settled();
      if (width !== 320)
        await page.locator("[data-dependency-graph]").screenshot({
          path: resolve(output, `source-only-evidence-${theme}-${width}.png`),
        });
      const cards = page.locator("[data-graph-resource-card]");
      assert.equal(await cards.count(), 10);
      assert.equal(
        await cards.locator("[data-change]").count(),
        0,
        "Absent plan data is not a change badge",
      );
      assert.equal(
        await page.locator('[data-node-kind="unresolved"]').count(),
        4,
      );
      assert.equal(
        await page.getByText("1 branch", { exact: true }).count(),
        0,
      );
      assert.equal(
        await page.locator("[data-graph-attribute-controls] button").count(),
        1,
      );
      const categoryPills = cards.locator("[data-graph-category]");
      assert.equal(await categoryPills.count(), 5);
      assert.equal(
        await categoryPills.filter({ hasText: "Source unchanged" }).count(),
        4,
      );
      assert.equal(
        await categoryPills.filter({ hasText: "Source modified" }).count(),
        1,
      );
      const categories = await categoryPills.evaluateAll((pills) =>
        pills.map((pill) => {
          const box = pill.getBoundingClientRect();
          const card = pill
            .closest("[data-graph-resource-card]")
            .getBoundingClientRect();
          const identity = pill
            .closest("[data-graph-resource-card]")
            .querySelector("[data-graph-resource-label]")
            .getBoundingClientRect();
          return {
            inside: box.left >= card.left && box.right <= card.right + 1,
            clearOfIdentity:
              box.top >= identity.bottom - 1 || box.left >= identity.right,
            radius: parseFloat(getComputedStyle(pill).borderRadius),
          };
        }),
      );
      for (const pill of categories) {
        assert.ok(pill.inside, `${name}: category stays inside the card`);
        assert.ok(
          pill.clearOfIdentity,
          `${name}: category does not overlap identity`,
        );
        assert.ok(pill.radius >= 999, `${name}: category has pill geometry`);
      }
      const arrivals = await page
        .locator("[data-graph-edge-ids]")
        .evaluateAll((groups) =>
          groups.map((group) => ({
            ids: JSON.parse(group.dataset.graphEdgeIds),
            points: JSON.parse(group.dataset.graphRoutePoints),
          })),
        );
      const runtime = arrivals.filter((route) =>
        route.ids.some((id) =>
          ["image-runtime", "module-runtime"].includes(id),
        ),
      );
      assert.equal(runtime.length, 2);
      assert.deepEqual(
        runtime[0].points.at(-1),
        runtime[1].points.at(-1),
        "Converging paths have one arrival",
      );
      assert.equal(
        await page.locator("path[marker-end]").count(),
        5,
        "Six relationships render five arrival arrows",
      );
      const convergence = page.locator("[data-graph-convergence]");
      assert.equal(await convergence.count(), 1);
      assert.deepEqual(
        JSON.parse(
          await convergence.getAttribute("data-graph-convergence-edge-ids"),
        ).sort(),
        ["image-runtime", "module-runtime"],
      );
      const initial = await positions();
      await page
        .getByRole("button", {
          name: "Collapse dependents of var.pipeline_identity",
          exact: true,
        })
        .press("Enter");
      await settled();
      assert.equal(await cards.count(), 8);
      const hiddenCount = page.getByText("2 hidden", { exact: true });
      assert.equal(await hiddenCount.count(), 1);
      const countFontSize = await hiddenCount.evaluate((element) =>
        parseFloat(getComputedStyle(element).fontSize),
      );
      assert.ok(countFontSize >= 12, `${name}: hidden count is readable`);
      sameOrder(initial, await positions());
      await page
        .getByRole("button", {
          name: "Expand dependents of var.pipeline_identity",
          exact: true,
        })
        .press("Enter");
      await settled();
      assert.equal(await cards.count(), 10);
      sameOrder(initial, await positions());
      const expand = page.getByRole("button", {
        name: "Show attribute differences for pipeline",
        exact: true,
      });
      await expand.press("Enter");
      await settled();
      sameOrder(initial, await positions());
      assert.equal(
        await page
          .locator(
            '[data-graph-card-diff="google_sql_user.pipeline"] [data-diff]',
          )
          .count(),
        2,
      );
      await page
        .getByRole("button", {
          name: "Hide attribute differences for pipeline",
          exact: true,
        })
        .press("Enter");
      await settled();
      const select = page.locator(
        '[data-graph-resource-card="google_sql_user.pipeline"] [data-graph-node]',
      );
      const identity = await select.evaluate((button) => {
        const label = button.querySelector("strong");
        const primary = label.getBoundingClientRect();
        const card = button.closest("[data-graph-resource-card]");
        const type = [...card.querySelectorAll("span")]
          .find((span) => span.textContent === "google_sql_user")
          .getBoundingClientRect();
        return {
          primaryWidth: primary.width,
          labelClipped: label.scrollWidth > label.clientWidth,
          contained:
            primary.left >= button.getBoundingClientRect().left &&
            primary.right <= button.getBoundingClientRect().right,
          typeTop: type.top,
          primaryBottom: primary.bottom,
        };
      });
      assert.ok(
        identity.primaryWidth > 0 &&
          !identity.labelClipped &&
          identity.contained,
        `${name}: short resource name remains fully readable`,
      );
      assert.ok(
        identity.typeTop >= identity.primaryBottom - 1,
        `${name}: type is secondary`,
      );
      // Minimum zoom must retain the end of an unsplit address, not ellipsize it again.
      for (let i = 0; i < 4; i++) {
        const zoomOut = page.getByRole("button", {
          name: "Zoom out graph",
          exact: true,
        });
        if (await zoomOut.isEnabled()) await zoomOut.press("Enter");
      }
      await settled();
      const tail = await page
        .locator(
          '[data-graph-resource-card="module.observability.module.database.google_sql_user.audit_pipeline"] [data-graph-resource-label]',
        )
        .evaluate((label) => {
          const inner = label.querySelector(
            ":scope > span > span:last-child > span",
          );
          const text = inner.getBoundingClientRect();
          const clip = inner.parentElement.getBoundingClientRect();
          return {
            text: inner.textContent,
            right: text.right,
            clipRight: clip.right,
          };
        });
      assert.ok(tail.text.endsWith("audit_pipeline"));
      assert.ok(
        Math.abs(tail.right - tail.clipRight) < 1,
        `${name}: distinguishing suffix remains visible`,
      );
      checks.push({ name });
    }
  for (const theme of ["light", "dark"])
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.goto(
        `${base}/iframe.html?id=components-dependencygraph--category-palette&viewMode=story&globals=colorScheme:${theme}`,
      );
      await page.locator("[data-dependency-graph]").waitFor();
      await page.evaluate(() => document.fonts.ready);
      await settled();
      const card = page.locator('[data-graph-resource-card="palette"]');
      assert.equal(await card.locator("[data-graph-category]").count(), 9);
      assert.equal(await card.locator("[data-change]").count(), 0);
      await card.locator("[data-graph-node]").press("Enter");
      const palette = await card
        .locator("[data-graph-category]")
        .evaluateAll((pills) => {
          const luminance = (css) => {
            const rgb = css
              .match(/[\d.]+/g)
              .slice(0, 3)
              .map(Number)
              .map((v) => {
                const s = v / 255;
                return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
              });
            return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
          };
          return pills.map((pill) => {
            const style = getComputedStyle(pill);
            const fg = luminance(style.color);
            const bg = luminance(style.backgroundColor);
            const box = pill.getBoundingClientRect();
            const owner = pill
              .closest("[data-graph-resource-card]")
              .getBoundingClientRect();
            return {
              label: pill.textContent,
              variant: pill.dataset.categoryVariant,
              foreground: style.color,
              background: style.backgroundColor,
              contrast: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05),
              inside: box.left >= owner.left && box.right <= owner.right + 1,
            };
          });
        });
      for (const pill of palette) {
        assert.ok(
          pill.inside,
          `${theme}/${width}/${pill.label}: card containment`,
        );
        assert.ok(
          pill.contrast >= 4.5,
          `${theme}/${width}/${pill.label}: text contrast ${pill.contrast}`,
        );
        const detail = page.locator(
          `[data-graph-details] [data-category-variant="${pill.variant}"]`,
        );
        assert.equal(await detail.textContent(), pill.label);
        const colors = await detail.evaluate((element) => {
          const style = getComputedStyle(element);
          return [style.color, style.backgroundColor];
        });
        assert.deepEqual(colors, [pill.foreground, pill.background]);
      }
      const neutral = palette.find((pill) => pill.variant === "neutral");
      for (const variant of [
        "primary",
        "secondary",
        "success",
        "warning",
        "danger",
      ])
        assert.notEqual(
          palette.find((pill) => pill.variant === variant).background,
          neutral.background,
          `${theme}: ${variant} must actually be colored`,
        );
      checks.push({ name: `category-palette-${theme}-${width}`, palette });
      await page.goto(
        `${base}/iframe.html?id=components-dependencygraph--category-colors&viewMode=story&globals=colorScheme:${theme}`,
      );
      await page.locator("[data-dependency-graph]").waitFor();
      await page.evaluate(() => document.fonts.ready);
      await settled();
      const modified = page.locator(
        '[data-graph-resource-card="google_sql_user.pipeline"] [data-graph-category]',
      );
      assert.equal(await modified.textContent(), "Source modified");
      assert.equal(
        await modified.getAttribute("data-category-variant"),
        "primary",
      );
      assert.equal(
        await page.locator("[data-graph-resource-card] [data-change]").count(),
        0,
      );
      if (width !== 320)
        await page.locator("[data-dependency-graph]").screenshot({
          path: resolve(output, `category-colors-${theme}-${width}.png`),
        });
      await page
        .getByRole("searchbox", { name: "Find resource" })
        .fill("Source modified");
      assert.equal(
        await page
          .getByRole("region", { name: "Resource search results" })
          .getByRole("status")
          .textContent(),
        "1 matching resources",
      );
      checks.push({ name: `category-colors-${theme}-${width}` });
    }
  assert.deepEqual(errors, []);
} finally {
  await writeFile(
    resolve(output, "source-evidence-checks.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}
console.log(`Verified ${checks.length} source-evidence interaction cases.`);
