import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const output = resolve(
  process.env.INVESTIGATION_REPORT_DIR ?? "/tmp/easy-ui-investigation",
  "toolkit",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    ...JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
  ],
});
const page = await browser.newPage({
  viewport: { width: 1200, height: 1000 },
  deviceScaleFactor: 1.5,
});
const errors = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.message));
const base = process.env.STORYBOOK_URL ?? "http://localhost:9019";
const comparison = "organisms-investigation-pathcomparison";
const queue = "recipes-investigation-investigationqueue";
const review = "recipes-investigation-reviewoutcome";
async function open(id, theme = "light", width = 1200) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(
    `${base}/iframe.html?id=${id}&viewMode=story&globals=colorScheme:${theme}`,
  );
  await page.locator("#storybook-root").waitFor();
  await page.waitForFunction(() => document.fonts.status === "loaded");
  console.log(`Open ${id} ${theme} ${width}`);
}
async function mapReady() {
  await page.waitForFunction(
    () =>
      window.toolkitMap?.isStyleLoaded() &&
      document.querySelector('[data-map-state="ready"]') &&
      document.querySelector('[data-map-idle="true"]'),
  );
}
async function audit(name, capture = false) {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `${name}: no page overflow`,
  );
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  let result;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      result = await page.evaluate(() =>
        axe.run(document.querySelector("#storybook-root"), {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        }),
      );
      break;
    } catch (error) {
      if (!String(error).includes("Axe is already running") || attempt === 39)
        throw error;
      await page.waitForTimeout(100);
    }
  }
  await writeFile(
    `${output}/${name}-axe.json`,
    JSON.stringify(result.violations, null, 2),
  );
  assert.deepEqual(
    result.violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map(({ target }) => target),
    })),
    [],
    `${name}: accessibility`,
  );
  if (capture)
    await page
      .locator("#storybook-root > :not(style)")
      .first()
      .screenshot({ path: `${output}/${name}.png` });
  checks.push(name);
}
async function choose(label, option) {
  await page.getByRole("button", { name: new RegExp(label) }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
try {
  await open(`${comparison}--linked-map`);
  await mapReady();
  await audit("comparison-linked-light", true);
  await page.evaluate(() => {
    window.toolkitCanvas = window.toolkitMap.getCanvas();
    window.toolkitMap.jumpTo({ center: [0.5, 0.2], zoom: 4.3 });
  });
  const south = page.getByRole("button", { name: /Processed at South Gate/ });
  await south.focus();
  await south.press("Enter");
  await page
    .getByRole("region", { name: "Selected observation" })
    .getByText("south-scan", { exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Via South Gate", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert(
    await page.evaluate(
      () =>
        window.toolkitMap.getCanvas() === window.toolkitCanvas &&
        Math.abs(window.toolkitMap.getZoom() - 4.3) < 0.001 &&
        Math.abs(window.toolkitMap.getCenter().lng - 0.5) < 0.001,
    ),
    "Changing a comparison selection preserves the camera and map",
  );
  await page.waitForFunction(
    () =>
      document
        .querySelector('button[aria-label="Select South Gate"]')
        ?.getAttribute("aria-pressed") === "true",
  );
  checks.push(
    "keyboard scoped selection updates details without resetting the map",
  );
  await page.setViewportSize({ width: 390, height: 1000 });
  assert(
    await south.evaluate((node) => node === document.activeElement),
    "Responsive comparison retains focused observation",
  );
  await audit("comparison-narrow", true);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await audit("comparison-narrow-large-text");
  await open(`${comparison}--linked-map`, "dark");
  await mapReady();
  await audit("comparison-linked-dark", true);
  await page
    .getByRole("button", { name: "Select North Gate", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Selected observation" })
    .getByRole("heading", { name: "North Gate", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("table", { name: "Candidate path comparison" })
      .getByRole("button", { pressed: true })
      .count(),
    0,
  );
  checks.push(
    "map-driven selection updates the shared inspector and candidate context",
  );
  for (const story of ["missing-records", "empty"]) {
    await open(`${comparison}--${story}`, "light", 390);
    await audit(`comparison-${story}`);
  }
  await open(
    "molecules-investigation-eventdetails--long-identifiers",
    "light",
    390,
  );
  await audit("event-details-long-identifiers", true);
  await open("molecules-investigation-eventdetails--stacked", "dark", 390);
  await audit("event-details-dark");

  await open(`${queue}--worklist`);
  await page.getByRole("grid", { name: "Cases" }).waitFor();
  await audit("queue-light", true);
  await page
    .getByRole("navigation", { name: "Case pages" })
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await page.getByRole("button", { name: "Open case CASE-1014" }).waitFor();
  await page
    .getByRole("searchbox", { name: "Find a case" })
    .fill("9400111899223847261950");
  assert.equal(
    await page.getByRole("button", { name: /Open case/ }).count(),
    1,
  );
  await page.getByRole("button", { name: "Open case CASE-1042" }).click();
  await page.getByText("Opened CASE-1042", { exact: true }).waitFor();
  checks.push("queue pagination, identifier search, and stable case action");
  await page.getByRole("searchbox", { name: "Find a case" }).fill("no-matches");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await choose("Review status", "Unreviewed");
  assert.equal(
    await page.getByRole("button", { name: /Open case/ }).count(),
    3,
  );
  await choose("Risk assessment", "High risk");
  assert.equal(
    await page.getByRole("button", { name: /Open case/ }).count(),
    1,
  );
  checks.push("queue filters combine without interpreting risk thresholds");
  await open(`${queue}--worklist`, "dark", 390);
  await audit("queue-narrow-dark", true);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await audit("queue-narrow-large-text");
  await open(`${queue}--retry`);
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.getByRole("button", { name: /Open case/ }).count(),
    0,
  );
  await page.getByRole("button", { name: "Try again" }).click();
  await page.getByRole("button", { name: "Open case CASE-1042" }).waitFor();
  checks.push("queue recovers from a loading failure");
  for (const story of ["empty", "loading"]) {
    await open(`${queue}--${story}`);
    await audit(`queue-${story}`);
  }

  await open(`${review}--record-review`);
  await audit("review-light", true);
  await page.getByRole("button", { name: "Record review" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Choose a review outcome" })
    .waitFor();
  assert(
    await page
      .getByRole("radio", { name: "Confirmed issue" })
      .evaluate((node) => node === document.activeElement),
  );
  await audit("review-validation");
  await open(`${review}--failed-save`, "light", 390);
  await page.getByRole("radio", { name: "No issue found" }).check();
  await page
    .getByRole("textbox", { name: "Review notes" })
    .fill("Independent confirmation received.");
  await page.getByRole("button", { name: "Record review" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Your draft is retained" })
    .waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Review notes" }).inputValue(),
    "Independent confirmation received.",
  );
  await audit("review-failed-narrow", true);
  await page.getByRole("button", { name: "Record review" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Review recorded." })
    .waitFor();
  await page
    .getByRole("list", { name: "Review history" })
    .getByText("No issue found", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Review notes" }).inputValue(),
    "",
  );
  assert.equal(
    await page.getByRole("meter").getAttribute("aria-valuenow"),
    "82",
  );
  checks.push(
    "review retry persists an independent outcome without changing the risk assessment",
  );
  await open(`${review}--record-review`, "dark", 390);
  await audit("review-narrow-dark", true);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await audit("review-narrow-large-text");

  await open("recipes-investigation-workflow--queue-to-review");
  await choose("Review status", "Unreviewed");
  await page.getByRole("button", { name: "Open case CASE-1042" }).click();
  await mapReady();
  assert(
    await page
      .getByRole("heading", { name: "CASE-1042", exact: true })
      .evaluate((node) => node === document.activeElement),
  );
  await page.getByRole("button", { name: /Processed at South Gate/ }).click();
  await page
    .getByRole("region", { name: "Selected observation" })
    .getByText("south-scan", { exact: true })
    .waitFor();
  await page.getByRole("radio", { name: "No issue found" }).check();
  await page
    .getByRole("textbox", { name: "Review notes" })
    .fill("Confirmed independently for this case.");
  await page.getByRole("button", { name: "Record review" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Review recorded." })
    .waitFor();
  await page.getByRole("button", { name: "Back to queue" }).click();
  assert.equal(
    await page.getByRole("button", { name: /Open case/ }).count(),
    2,
  );
  assert(
    await page
      .getByRole("searchbox", { name: "Find a case" })
      .evaluate((node) => node === document.activeElement),
  );
  await choose("Review status", "All reviews");
  await page.getByRole("button", { name: "Open case CASE-1042" }).click();
  await page
    .getByRole("list", { name: "Review history" })
    .getByText("Confirmed independently for this case.")
    .waitFor();
  await mapReady();
  await audit("workflow-recorded-review", true);
  checks.push(
    "queue-to-review keeps filters, restores focus, and retains confirmed history per case",
  );
  assert.deepEqual(errors, [], "Browser runtime errors");
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ checks, errors, violations: 0 }, null, 2),
  );
  console.log(JSON.stringify({ checks: checks.length, violations: 0 }));
} catch (error) {
  await writeFile(
    `${output}/layout-failure.json`,
    JSON.stringify(
      await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        elements: [...document.querySelectorAll("#storybook-root *")]
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              tag: el.tagName,
              role: el.getAttribute("role"),
              cls: el.className,
              width: r.width,
              right: r.right,
              scroll: el.scrollWidth,
              min: getComputedStyle(el).minWidth,
            };
          })
          .filter((x) => x.right > innerWidth + 1)
          .slice(0, 25),
      })),
      null,
      2,
    ),
  );
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  await writeFile(`${output}/failure.txt`, String(error.stack ?? error));
  throw error;
} finally {
  await browser.close();
}
