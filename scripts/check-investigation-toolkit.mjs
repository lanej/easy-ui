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
        axe.run(document.body, {
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
async function waitForFocus(locator) {
  await page.waitForFunction(
    (element) => element === document.activeElement,
    await locator.elementHandle(),
  );
}
async function choose(label, option) {
  await page.getByRole("button", { name: new RegExp(label) }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function reviewStageColors(theme) {
  const colors = [];
  for (const [id, stage] of [
    ["CASE-1042", "Unreviewed"],
    ["CASE-1003", "In review"],
    ["CASE-1008", "Reviewed"],
  ]) {
    const row = page.getByRole("row").filter({
      has: page.getByRole("button", { name: `Open case ${id}` }),
    });
    colors.push(
      await row
        .getByText(stage, { exact: true })
        .evaluate(
          (node) => getComputedStyle(node.parentElement).backgroundColor,
        ),
    );
  }
  const categoryColor = await page
    .getByText("Delivery review", { exact: true })
    .first()
    .evaluate((node) => getComputedStyle(node.parentElement).backgroundColor);
  assert.equal(
    new Set([...colors, categoryColor]).size,
    4,
    "Review stages are visibly distinct from each other and neutral categories",
  );
  const channels = colors.map((color) => color.match(/[\d.]+/g).map(Number));
  const [amber, blue, green] = channels;
  assert(amber[0] >= amber[1] && amber[1] > amber[2], "Unreviewed is amber");
  assert(blue[2] > blue[0] && blue[2] > blue[1], "In review is blue");
  assert(green[1] > green[0] && green[1] > green[2], "Reviewed is green");
  checks.push(
    `review stage colors convey waiting, active, and completed work in ${theme} mode`,
  );
}
async function compactHeaderRisk(context) {
  const score = page.getByRole("meter", { name: "Risk score for CASE-1042" });
  assert.equal(await score.getAttribute("aria-valuenow"), "82");
  assert.equal(await score.getAttribute("aria-valuemax"), "100");
  assert.equal(await score.locator('span[style*="inline-size:"]').count(), 0);
  const centers = await score.evaluate((meter) => {
    const category = [...meter.parentElement.querySelectorAll("span")].find(
      (node) => node.textContent === "Case category:Delivery review",
    );
    const scoreRect = meter.getBoundingClientRect();
    const categoryRect = category.getBoundingClientRect();
    return [
      scoreRect.top + scoreRect.height / 2,
      categoryRect.top + categoryRect.height / 2,
    ];
  });
  assert(
    Math.abs(centers[0] - centers[1]) <= 1,
    "The compact score and category align in the case header",
  );
  checks.push(
    `${context} header aligns the compact risk score while retaining its accessible range`,
  );
}
try {
  await open(`${comparison}--linked-map`);
  await mapReady();
  assert.match(
    await page
      .getByRole("button", { name: /^Accepted/ })
      .first()
      .getAttribute("aria-label"),
    /North Harbor/,
    "Observation accessible names include their visible location",
  );
  checks.push("observation accessible names retain location context");
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
  await open(`${comparison}--linked-map`, "light", 900);
  await mapReady();
  assert.equal(
    await page
      .getByRole("table", { name: "Candidate path comparison" })
      .getByRole("cell")
      .first()
      .evaluate((cell) => getComputedStyle(cell).display),
    "table-cell",
    "Intermediate widths retain side-by-side candidates rather than squeezing them beside the map",
  );
  await audit("comparison-medium", true);
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
  await open("molecules-investigation-eventdetails--stacked", "light", 390);
  await audit("event-details-stacked", true);
  await open(
    "molecules-investigation-eventdetails--stacked-long-identifiers",
    "light",
    390,
  );
  await audit("event-details-stacked-long-identifiers", true);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await audit("event-details-stacked-large-text");
  await open("molecules-investigation-eventdetails--stacked", "dark", 390);
  await audit("event-details-dark", true);

  await open("components-select--with-separator", "light", 390);
  const groupedSelect = page.getByRole("button", { name: /Label/ });
  await groupedSelect.press("Enter");
  await page.getByRole("listbox", { name: "Label" }).waitFor();
  await page.getByRole("group", { name: "Primary options" }).waitFor();
  await page.getByRole("group", { name: "Secondary options" }).waitFor();
  await audit("select-grouped-narrow");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  assert.match(await groupedSelect.textContent(), /Option 6/);
  checks.push(
    "grouped Selects retain accessible option ownership and keyboard selection",
  );

  await open(`${queue}--worklist`);
  await page.getByRole("grid", { name: "Cases" }).waitFor();
  await reviewStageColors("light");
  await audit("queue-light", true);
  for (const heading of ["Category", "Review state", "Last observation"])
    await page
      .getByRole("columnheader", { name: heading, exact: true })
      .waitFor();
  assert.equal(
    await page
      .getByRole("meter", { name: "Risk score for CASE-1042" })
      .locator('span[style*="inline-size:"]')
      .count(),
    0,
    "Queue scores retain their accessible value without a visual bar",
  );
  const firstCase = page
    .getByRole("row")
    .filter({ has: page.getByRole("button", { name: "Open case CASE-1042" }) });
  assert.match(await firstCase.textContent(), /Review state:Unreviewed/);
  checks.push(
    "wide queue separates categorical labels from last-observation freshness",
  );
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
  await choose("Category", "Receipt confirmation");
  assert.equal(
    await page.getByRole("button", { name: /Open case/ }).count(),
    0,
  );
  await page
    .getByText("No cases match these filters.", { exact: true })
    .waitFor();
  checks.push(
    "category combines with review and assessment filters independently",
  );
  await page.getByRole("button", { name: "Clear filters" }).click();
  await choose("Category", "Delivery review");
  assert.deepEqual(
    await page.getByRole("button", { name: /Open case/ }).allTextContents(),
    ["CASE-1042", "CASE-1003", "CASE-1029"],
  );
  await choose("Category", "Receipt confirmation");
  assert.deepEqual(
    await page.getByRole("button", { name: /Open case/ }).allTextContents(),
    ["CASE-1038", "CASE-1008"],
  );
  await page.getByRole("searchbox", { name: "Find a case" }).fill("no-matches");
  await page.getByRole("button", { name: "Clear filters" }).click();
  assert.match(
    await page.getByRole("button", { name: /Category/ }).textContent(),
    /All categories/,
  );
  assert.equal(
    await page.getByRole("button", { name: /Open case/ }).count(),
    5,
  );
  checks.push(
    "category filtering selects the supplied types and clears with the other filters",
  );
  await open(`${queue}--worklist`, "dark");
  await reviewStageColors("dark");
  await audit("queue-wide-dark", true);
  await open(`${queue}--worklist`, "dark", 390);
  await page.getByRole("button", { name: "Filters", exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("columnheader", { name: "Category", exact: true })
      .count(),
    0,
  );
  assert.equal(await page.getByRole("button", { name: /Category/ }).count(), 0);
  await audit("queue-narrow-dark", true);
  await page
    .getByRole("columnheader", { name: "Review state", exact: true })
    .evaluate((header) => {
      const grid = header.closest('[role="grid"]');
      const scroller = grid.parentElement.parentElement;
      const caseHeader = grid.querySelector('[role="columnheader"]');
      // Keep the review column clear of the sticky case column.
      scroller.scrollLeft +=
        header.getBoundingClientRect().left -
        caseHeader.getBoundingClientRect().right;
    });
  await audit("queue-review-stages-narrow-dark", true);
  await page
    .getByRole("columnheader", { name: "Case", exact: true })
    .evaluate((header) => {
      header.closest('[role="grid"]').parentElement.parentElement.scrollLeft =
        0;
    });
  const filterTrigger = page.getByRole("button", { name: /^Filters/ });
  await filterTrigger.focus();
  await filterTrigger.press("Enter");
  const filterDialog = page.getByRole("dialog", { name: "Filter cases" });
  await filterDialog.waitFor();
  await choose("Category", "Delivery review");
  await page.getByRole("button", { name: /Review status/ }).click();
  await page.getByRole("listbox", { name: "Review status" }).waitFor();
  await audit("queue-filter-menu-narrow");
  await page.getByRole("option", { name: "Unreviewed", exact: true }).click();
  await audit("queue-filter-panel-narrow");
  await filterDialog.screenshot({
    path: `${output}/queue-filter-panel-narrow.png`,
  });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await waitForFocus(filterTrigger);
  assert(
    await filterTrigger.evaluate((node) => node === document.activeElement),
  );
  assert.equal(await filterTrigger.textContent(), "Filters (2)");
  assert.deepEqual(
    await page.getByRole("button", { name: /Open case/ }).allTextContents(),
    ["CASE-1042", "CASE-1029"],
  );
  await page
    .getByText("Delivery review · Unreviewed", { exact: true })
    .waitFor();
  await audit("queue-filtered-narrow-dark", true);
  await filterTrigger.press("Enter");
  await filterDialog.waitFor();
  assert.match(
    await page.getByRole("button", { name: /Category/ }).textContent(),
    /Delivery review/,
  );
  await page.keyboard.press("Escape");
  await waitForFocus(filterTrigger);
  assert(
    await filterTrigger.evaluate((node) => node === document.activeElement),
  );
  await filterTrigger.press("Enter");
  await filterDialog
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await filterDialog.getByRole("button", { name: "Done", exact: true }).click();
  await waitForFocus(filterTrigger);
  assert.equal(await filterTrigger.textContent(), "Filters");
  assert.equal(
    await page.getByRole("button", { name: /Open case/ }).count(),
    5,
  );
  checks.push(
    "narrow filter panel supports nested Selects, retained selections, reset, and keyboard focus restoration",
  );
  const queueSearch = page.getByRole("searchbox", { name: "Find a case" });
  await filterTrigger.press("Enter");
  await filterDialog.waitFor();
  await page.setViewportSize({ width: 1200, height: 1000 });
  await filterDialog.waitFor({ state: "hidden" });
  await page.waitForFunction(() =>
    document.activeElement?.matches('input[type="search"]'),
  );
  await page
    .getByRole("columnheader", { name: "Category", exact: true })
    .waitFor();
  assert(await queueSearch.evaluate((node) => node === document.activeElement));
  await page.setViewportSize({ width: 390, height: 1000 });
  await page
    .getByRole("columnheader", { name: "Category", exact: true })
    .waitFor({ state: "hidden" });
  assert(await queueSearch.evaluate((node) => node === document.activeElement));
  checks.push(
    "resizing closes the narrow filter panel and preserves search focus and category data",
  );
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await audit("queue-narrow-large-text");
  await filterTrigger.press("Enter");
  await filterDialog.waitFor();
  await audit("queue-filter-panel-large-text");
  await page.keyboard.press("Escape");
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
  await compactHeaderRisk("review");
  await audit("review-light", true);
  await page.getByRole("button", { name: "Record review" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Choose a review outcome" })
    .waitFor();
  assert(
    await page
      .getByRole("button", { name: /Review outcome/ })
      .evaluate((node) => node === document.activeElement),
  );
  await audit("review-validation");
  await open(`${review}--failed-save`, "light", 390);
  const outcomeSelect = page.getByRole("button", { name: /Review outcome/ });
  await outcomeSelect.focus();
  await outcomeSelect.press("Enter");
  const outcomeMenu = page.getByRole("listbox", { name: "Review outcome" });
  await outcomeMenu.waitFor();
  await audit("review-select-menu-narrow");
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.match(await outcomeSelect.textContent(), /No issue found/);
  checks.push("review outcome supports an explicit keyboard selection");
  await page
    .getByRole("textbox", { name: "Review notes" })
    .fill("Independent confirmation received.");
  const submit = page.locator('form button[type="submit"]');
  await submit.focus();
  await submit.press("Enter");
  await page.getByRole("button", { name: "Saving review…" }).waitFor();
  assert.equal(await submit.getAttribute("aria-disabled"), "true");
  assert(await outcomeSelect.isDisabled());
  assert(await submit.evaluate((node) => node === document.activeElement));
  assert(
    (await page
      .getByRole("textbox", { name: "Review notes" })
      .getAttribute("readonly")) !== null,
  );
  await submit.press("Enter");
  await page
    .getByRole("alert")
    .filter({ hasText: "Your draft is retained" })
    .waitFor();
  assert(await submit.evaluate((node) => node === document.activeElement));
  assert.equal(
    await page.getByRole("textbox", { name: "Review notes" }).inputValue(),
    "Independent confirmation received.",
  );
  assert.match(await outcomeSelect.textContent(), /No issue found/);
  await audit("review-failed-narrow", true);
  await submit.press("Enter");
  await page
    .getByRole("status")
    .filter({ hasText: "Review recorded." })
    .waitFor();
  assert(await submit.evaluate((node) => node === document.activeElement));
  assert.match(await outcomeSelect.textContent(), /Choose a review outcome/);
  checks.push(
    "submit focus survives pending, rejected, and successful review saves",
  );
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
  await open(`${review}--record-review`, "dark");
  await audit("review-wide-dark", true);
  await open(`${review}--record-review`, "dark", 390);
  await audit("review-narrow-dark", true);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await audit("review-narrow-large-text");

  await open("recipes-investigation-workflow--queue-to-review");
  await choose("Category", "Delivery review");
  await choose("Review status", "Unreviewed");
  await page.getByRole("button", { name: "Open case CASE-1042" }).click();
  await page
    .getByRole("heading", { name: "CASE-1042", exact: true })
    .locator("..")
    .getByText("Delivery review", { exact: true })
    .waitFor();
  await mapReady();
  await compactHeaderRisk("workflow");
  await page
    .getByRole("heading", { name: "CASE-1042", exact: true })
    .locator("..")
    .screenshot({ path: `${output}/workflow-case-header.png` });
  assert(
    await page
      .getByRole("table", { name: "Candidate path comparison" })
      .evaluate((node) => node.getBoundingClientRect().width >= 300),
    "The comparison fills its grid column rather than collapsing to its contained minimum width",
  );
  checks.push("workflow comparison retains a readable width in a grid layout");
  assert(
    await page
      .getByRole("heading", { name: "CASE-1042", exact: true })
      .evaluate((node) => node === document.activeElement),
  );
  await page.getByRole("button", { name: /Processed at South Gate/ }).click();
  await page
    .getByRole("region", { name: "Selected observation" })
    .getByText("CASE-1042:south-scan", { exact: true })
    .waitFor();
  await choose("Review outcome", "No issue found");
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
    1,
  );
  assert.match(
    await page.getByRole("button", { name: /Category/ }).textContent(),
    /Delivery review/,
  );
  checks.push(
    "case categories remain visible in the header and survive queue navigation",
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
  await page.getByRole("button", { name: "Back to queue" }).click();
  await choose("Category", "All categories");
  await page.getByRole("searchbox", { name: "Find a case" }).fill("CASE-1038");
  await page.getByRole("button", { name: "Open case CASE-1038" }).click();
  const inspector = page.getByRole("region", { name: "Selected observation" });
  await inspector.getByText("CASE-1038:arrived", { exact: true }).waitFor();
  assert.equal(await inspector.getByText("08:40", { exact: true }).count(), 1);
  assert.equal(await inspector.getByText(/CASE-1042:/).count(), 0);
  assert.equal(
    await page.getByRole("button", { name: /Processed at South Gate/ }).count(),
    0,
  );
  checks.push(
    "opening another case replaces observations and selected event identity",
  );
  await open("recipes-investigation-workflow--queue-to-review", "dark", 390);
  await page.getByRole("searchbox", { name: "Find a case" }).fill("CASE-1014");
  await page.getByRole("button", { name: "Open case CASE-1014" }).click();
  await page
    .getByRole("heading", { name: "No observations available" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("table", { name: "Candidate path comparison" })
      .count(),
    0,
  );
  assert.equal(
    await page.getByRole("region", { name: "Selected observation" }).count(),
    0,
  );
  await audit("workflow-missing-observations-dark", true);
  checks.push(
    "a missing-observations case never borrows another case's map or records",
  );

  await open("recipes-investigation-workflow--slow-save");
  await page.getByRole("button", { name: "Open case CASE-1042" }).click();
  await mapReady();
  await choose("Review outcome", "No issue found");
  await page
    .getByRole("textbox", { name: "Review notes" })
    .fill("One pending review across navigation.");
  await page.getByRole("button", { name: "Record review" }).click();
  await page.getByRole("button", { name: "Saving review…" }).waitFor();
  await page.getByRole("button", { name: "Back to queue" }).click();
  await page.getByRole("button", { name: "Open case CASE-1042" }).click();
  const pendingSubmit = page.getByRole("button", { name: "Saving review…" });
  await pendingSubmit.waitFor();
  assert.equal(await pendingSubmit.getAttribute("aria-disabled"), "true");
  assert.equal(
    await page.getByRole("textbox", { name: "Review notes" }).inputValue(),
    "One pending review across navigation.",
  );
  await pendingSubmit.press("Enter");
  await page.setViewportSize({ width: 640, height: 1000 });
  await audit("workflow-pending-review");
  await page
    .getByRole("region", { name: "Review outcome for CASE-1042" })
    .screenshot({ path: `${output}/workflow-pending-review.png` });
  await page
    .getByRole("status")
    .filter({ hasText: "Review recorded." })
    .waitFor();
  assert.equal(
    await page
      .getByRole("list", { name: "Review history" })
      .getByText("One pending review across navigation.", { exact: true })
      .count(),
    1,
  );
  checks.push(
    "a remounted form retains its pending draft and cannot create a duplicate review",
  );

  await open("recipes-investigation-workflow--failed-save-across-navigation");
  await page.getByRole("button", { name: "Open case CASE-1042" }).click();
  await choose("Review outcome", "Inconclusive");
  await page
    .getByRole("textbox", { name: "Review notes" })
    .fill("Retain the original case after a hidden failure.");
  await page.getByRole("button", { name: "Record review" }).click();
  await page.getByRole("button", { name: "Back to queue" }).click();
  await page.getByRole("button", { name: "Open case CASE-1038" }).click();
  await page
    .getByRole("textbox", { name: "Review notes" })
    .fill("Independent draft for another case.");
  // Let the explicitly delayed example service reject while its case is hidden.
  await page.waitForTimeout(4100);
  assert(
    await page
      .getByRole("textbox", { name: "Review notes" })
      .evaluate((node) => node === document.activeElement),
  );
  assert.equal(await page.getByRole("alert").count(), 0);
  await page.getByRole("button", { name: "Back to queue" }).click();
  await page.getByRole("button", { name: "Open case CASE-1042" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Your draft is retained" })
    .waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Review notes" }).inputValue(),
    "Retain the original case after a hidden failure.",
  );
  assert.match(
    await page.getByRole("button", { name: /Review outcome/ }).textContent(),
    /Inconclusive/,
  );
  await page.getByRole("button", { name: "Record review" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Review recorded." })
    .waitFor();
  await page.getByRole("button", { name: "Back to queue" }).click();
  await page.getByRole("button", { name: "Open case CASE-1038" }).click();
  assert.equal(
    await page.getByRole("textbox", { name: "Review notes" }).inputValue(),
    "Independent draft for another case.",
  );
  checks.push(
    "hidden failures retain the original draft without changing another case's input or focus",
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
