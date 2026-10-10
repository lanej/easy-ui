import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(
  new URL("./preview-metrics/package.json", import.meta.url),
);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.STORYBOOK_URL ?? "http://localhost:9019";
const output = resolve(
  process.env.EVENT_TIMELINE_REPORT_DIR ?? "/tmp/easy-ui-event-timeline",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    ...JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
  ],
});
const page = await browser.newPage({
  viewport: { width: 420, height: 1000 },
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});
const checks = [],
  errors = [];
page.on("pageerror", (error) => errors.push(error.message));

async function open(story, theme, width, component = "eventtimeline") {
  await page.setViewportSize({ width, height: 1000 });
  const prefix = component === "eventtimeline" ? "organisms" : "molecules";
  await page.goto(
    `${base}/iframe.html?id=${prefix}-data-display-${component}--${story}&viewMode=story&globals=colorScheme:${theme}`,
  );
  await page.locator("[data-event-metrics]").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator(".sb-errordisplay").isVisible(), false);
}

async function enlargeText() {
  // html font-size alone misses fixed-pixel component fonts. Double the
  // rendered text and line height, leaving available layout width unchanged.
  await page.evaluate(() => {
    const textElements = [...document.querySelectorAll("#storybook-root *")]
      .filter(
        (element) =>
          element instanceof HTMLElement &&
          [...element.childNodes].some(
            (node) =>
              node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
          ),
      )
      .map((element) => {
        const style = getComputedStyle(element);
        return {
          element,
          fontSize: parseFloat(style.fontSize),
          lineHeight: parseFloat(style.lineHeight),
        };
      });
    for (const { element, fontSize, lineHeight } of textElements) {
      element.style.setProperty("font-size", `${fontSize * 2}px`, "important");
      if (Number.isFinite(lineHeight))
        element.style.setProperty(
          "line-height",
          `${lineHeight * 2}px`,
          "important",
        );
    }
  });
}

async function auditAccessibility(name) {
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
      if (!String(error).includes("already running") || attempt === 39)
        throw error;
      await page.waitForTimeout(50);
    }
  }
  assert.deepEqual(
    result.violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map(({ target }) => target),
    })),
    [],
    `${name}: accessibility`,
  );
}

async function audit(name) {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `${name}: horizontal page overflow`,
  );
  const geometry = await page.evaluate(() => {
    const failures = [];
    const sameLine = (a, b) => a.top < b.bottom && b.top < a.bottom;
    const box = (element) => element.getBoundingClientRect();
    function readable(element, context) {
      if (!element || !box(element).width) return;
      const style = getComputedStyle(element);
      if (style.textOverflow === "ellipsis" || style.whiteSpace === "nowrap")
        failures.push(`${context}: identity or metric text can be truncated`);
      if (element.scrollWidth > element.clientWidth + 1 && element.clientWidth)
        failures.push(`${context}: text overflows its element`);
      const range = document.createRange();
      range.selectNodeContents(element);
      const outer = box(element);
      for (const rect of range.getClientRects())
        if (rect.left < outer.left - 1 || rect.right > outer.right + 1)
          failures.push(`${context}: rendered text escapes its bounds`);
    }

    for (const timeline of document.querySelectorAll("ol[aria-label]")) {
      if (!box(timeline).width) continue;
      for (const button of timeline.querySelectorAll(
        "button[class*='select_']",
      )) {
        const title = button.querySelector("[class*='title_']");
        const time = button.querySelector("[class*='time_']");
        if (time && time.scrollWidth > time.clientWidth + 1)
          failures.push("event timestamp is truncated");
        readable(title, "event label");
        readable(
          button.querySelector("[class*='location_'] > span:last-child"),
          "facility location",
        );
        const dot = button.querySelector("[data-tone][data-current='true']");
        if (dot && title) {
          const dotBox = box(dot);
          const ring = parseFloat(getComputedStyle(dot, "::before").width);
          if (dotBox.x + dotBox.width / 2 + ring / 2 > box(title).x + 1)
            failures.push("selected event dot obscures the event label");
        }
      }
      if (timeline.querySelector("button button"))
        failures.push("event selection contains a nested button");
    }

    let metricCount = 0,
      referenceCount = 0;
    for (const root of document.querySelectorAll("[data-event-metrics]")) {
      if (!box(root).width) continue;
      const variant = root.dataset.variant;
      const inlineReferences = [];
      for (const metric of root.querySelectorAll("[data-metric-id]")) {
        metricCount++;
        const context = `${variant}/${metric.dataset.metricId}`;
        const header = metric.querySelector("[data-metric-header]");
        const label = metric.querySelector("[data-metric-label]");
        const status = metric.querySelector("[data-assessment][data-size]");
        const reference = metric.querySelector("[data-metric-reference]");
        if (!header || !status) {
          failures.push(`${context}: missing metric headline`);
          continue;
        }
        readable(label, context);
        readable(status, context);
        const headerBox = box(header),
          statusBox = box(status),
          metricBox = box(metric);
        if (Math.abs(headerBox.x - metricBox.x) > 1)
          failures.push(`${context}: headline does not start at the left`);
        if (label) {
          const labelBox = box(label);
          const gap = statusBox.left - labelBox.right;
          if (sameLine(labelBox, statusBox)) {
            if (gap < -1 || gap > 12)
              failures.push(
                `${context}: status is separated from the label by ${gap}px`,
              );
          } else if (Math.abs(statusBox.left - headerBox.left) > 1) {
            failures.push(`${context}: wrapped pill is aligned to the right`);
          }
        }
        if (statusBox.right > metricBox.right + 1)
          failures.push(`${context}: pill escapes its available width`);
        if (variant === "minimal" && reference)
          failures.push(`${context}: minimal includes a distribution`);
        if (
          ["loading", "unavailable"].includes(status.dataset.assessment) &&
          reference
        )
          failures.push(`${context}: stale distribution remains visible`);
        if (!reference) continue;
        referenceCount++;
        const referenceBox = box(reference);
        if (referenceBox.width < 95)
          failures.push(`${context}: unreadably narrow distribution`);
        if (variant === "expanded" && referenceBox.top < headerBox.bottom - 1)
          failures.push(
            `${context}: expanded distribution is not below its headline`,
          );
        if (sameLine(referenceBox, headerBox)) {
          if (referenceBox.left < headerBox.right - 1)
            failures.push(`${context}: reference overlaps the headline`);
          if (variant === "compact") {
            inlineReferences.push(referenceBox);
            const strip = reference.querySelector("[data-concentration-style]");
            const dot = reference.querySelector("[data-current-assessment] [class*='marker_']");
            if (strip && dot) {
              const stripBox = box(strip),
                dotBox = box(dot),
                stripCenter = stripBox.y + stripBox.height / 2,
                dotCenter = dotBox.y + dotBox.height / 2;
              if (Math.abs(stripCenter - dotCenter) > 1)
                failures.push(`${context}: current dot is detached from the concentration strip`);
              if ((!label || sameLine(box(label), statusBox)) &&
                Math.abs(stripCenter - statusBox.y - statusBox.height / 2) > 1)
                failures.push(`${context}: visible reference and pill centers do not align`);
            }
          }
        } else if (Math.abs(referenceBox.left - metricBox.left) > 1) {
          failures.push(
            `${context}: wrapped reference does not align with its metric`,
          );
        }
        if (reference.querySelector("[data-percentile]"))
          failures.push(`${context}: distracting percentile markers remain`);
        const current = reference.querySelectorAll("[data-current-assessment]");
        if (current.length !== 1)
          failures.push(
            `${context}: expected exactly one current value marker`,
          );
        const assessment = status.dataset.assessment;
        const colored = [
          ...reference.querySelectorAll("[data-reference-assessment]"),
        ]
          .map((node) => node.dataset.referenceAssessment)
          .filter((value) => value !== "unassessed");
        if (!colored.length || colored.some((value) => value !== assessment))
          failures.push(`${context}: another policy region is highlighted`);
        const bands = [
          ...reference.querySelectorAll(
            "figure [class*='track_'] > [data-assessment]",
          ),
        ];
        if (
          bands.length > 1 ||
          bands.some((band) => band.dataset.assessment !== assessment)
        )
          failures.push(`${context}: expected only the current policy band`);
        const plot = reference.querySelector("[role='img'][class*='plot_']");
        if (plot && current.length === 1) {
          const plotBox = box(plot),
            marker = box(current[0]),
            fraction = parseFloat(current[0].style.left) / 100;
          if (
            Math.abs(
              marker.x +
                marker.width / 2 -
                plotBox.x -
                plotBox.width * fraction,
            ) > 1
          )
            failures.push(`${context}: current value projection drift`);
        }
      }
      if (inlineReferences.length > 1) {
        const lefts = inlineReferences.map((reference) => reference.x);
        const widths = inlineReferences.map((reference) => reference.width);
        if (Math.max(...lefts) - Math.min(...lefts) > 1 ||
          Math.max(...widths) - Math.min(...widths) > 1)
          failures.push("compact references do not share the same left edge and width");
      }
    }
    return { failures, metricCount, referenceCount };
  });
  assert.deepEqual(geometry.failures, [], `${name}: layout`);
  assert(geometry.metricCount > 0, `${name}: metrics present`);
  await auditAccessibility(name);
  checks.push({
    name,
    metrics: geometry.metricCount,
    references: geometry.referenceCount,
  });
  console.log(`Pass ${name}`);
}

async function capture(name) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
  const comparison = page.locator("[class*='comparison_']");
  await (
    (await comparison.count()) ? comparison : page.locator("#storybook-root")
  ).screenshot({
    path: resolve(output, `${name}.png`),
  });
}

async function verifyWorkspace(theme, width) {
  await page.setViewportSize({ width, height: 1100 });
  await page.goto(
    `${base}/iframe.html?id=organisms-investigation-investigationworkspace--with-event-metrics&viewMode=story&globals=colorScheme:${theme}`,
  );
  const workspace = page.getByRole("region", {
    name: "Event investigation",
    exact: true,
  });
  const details = page.getByRole("region", {
    name: "Selection details",
    exact: true,
  });
  await workspace.waitFor();
  await page.waitForFunction(() => {
    const root = document.querySelector('[aria-label="Event investigation"]');
    return (
      root?.getAttribute("data-narrow") ===
      String(root.getBoundingClientRect().width <= 740)
    );
  });
  await page.waitForSelector('[data-map-state="ready"]', { state: "attached" });
  await page.waitForFunction(
    () =>
      document.fonts.status === "loaded" &&
      window.investigationMap?.isStyleLoaded(),
  );
  const narrow = (await workspace.getAttribute("data-narrow")) === "true";
  if (narrow)
    await details
      .getByRole("button", { name: "Show details", exact: true })
      .click();
  else
    await page.waitForFunction(() => {
      const map = window.investigationMap;
      return map.getContainer().dataset.mapIdle === "true" && !map.isMoving();
    });

  const events = workspace.getByRole("list", { name: "Events", exact: true });
  const compact = events.locator(
    '[data-event-metrics][data-variant="compact"]',
  );
  const expanded = details.locator(
    '[data-event-metrics][data-variant="expanded"]',
  );
  assert.equal(await compact.locator("[data-metric-id]").count(), 2);
  assert.equal(await expanded.locator("[data-metric-id]").count(), 2);
  assert(await compact.isVisible());
  assert(await expanded.isVisible());
  await events.getByRole("button", { name: /Processed at North Gate/ }).click();
  await details
    .getByRole("heading", { name: "Processed at North Gate", exact: true })
    .waitFor();
  assert.equal(
    await expanded.count(),
    0,
    "Inspector metrics follow the selected event",
  );
  assert.equal(
    await compact.count(),
    1,
    "Timeline metrics remain attached to the observed event",
  );
  await events
    .getByRole("button", { name: /Arrived at exchange.*Received 10:34/ })
    .click();
  await expanded.waitFor();
  assert.equal(await expanded.locator("[data-metric-id]").count(), 2);
  await audit(`workspace-metrics-${theme}-${width}`);
  await capture(`event-timeline-workspace-${theme}-${width}`);
  if (narrow) {
    await workspace.getByRole("tab", { name: "Map", exact: true }).click();
    await page.waitForFunction(() => {
      const map = window.investigationMap;
      return (
        map.getCanvas().clientWidth === map.getContainer().clientWidth &&
        map.getContainer().dataset.mapIdle === "true" &&
        !map.isMoving()
      );
    });
    await audit(`workspace-metrics-map-${theme}-${width}`);
    await capture(`event-timeline-workspace-map-${theme}-${width}`);
  }
}

try {
  await open("presentation-modes", "light", 1400);
  await capture("event-timeline-presentation-light");
  await audit("presentation-light");
  for (const theme of ["light", "dark"]) {
    for (const width of [360, 420, 480]) {
      for (const variant of ["minimal", "compact", "expanded"]) {
        const name = `${variant}-${theme}-${width}`;
        await open(`${variant}-metrics`, theme, width);
        const outcomes = page.locator("[data-event-metrics]").first();
        assert.equal(await outcomes.locator("[data-metric-id]").count(), 2);
        assert.equal(
          await outcomes
            .locator("[data-assessment='healthy'][data-size]")
            .count(),
          1,
        );
        assert.equal(
          await outcomes
            .locator("[data-assessment='degraded'][data-size]")
            .count(),
          1,
        );
        assert.match(await outcomes.innerText(), /2%.*Elevated/);
        await audit(name);
        await capture(`event-timeline-${name}`);
        if (width === 360 || width === 480) {
          await enlargeText();
          await audit(`${name}-200-percent-text`);
          if (width === 360)
            await capture(`event-timeline-${name}-200-percent-text`);
        }
      }
    }
    if (theme !== "light") {
      await open("presentation-modes", theme, 1400);
      await audit(`presentation-${theme}`);
      await capture(`event-timeline-presentation-${theme}`);
    }
    await open("narrow", theme, 360);
    await audit(`narrow-${theme}`);
    await capture(`event-timeline-narrow-${theme}`);
    for (const width of [420, 1200]) {
      await open("map-adjacent", theme, width);
      await audit(`map-adjacent-${theme}-${width}`);
      await capture(`event-timeline-map-adjacent-${theme}-${width}`);
    }
    for (const story of ["missing-data", "loading"]) {
      await open(story, theme, 420, "eventmetrics");
      await audit(`${story}-${theme}`);
      await capture(`event-metrics-${story}-${theme}`);
    }
    for (const width of [1200, 390]) await verifyWorkspace(theme, width);
  }
  await open("map-adjacent", "light", 1200);
  const timeline = page.locator("ol[aria-label]").first();
  const selections = timeline.locator("button[class*='select_']");
  assert(
    (await selections.count()) > 1,
    "keyboard example has multiple events",
  );
  await selections.first().focus();
  await page.keyboard.press("ArrowDown");
  assert(
    await selections
      .nth(1)
      .evaluate((element) => element === document.activeElement),
  );
  await page.keyboard.press("End");
  assert(
    await selections
      .last()
      .evaluate((element) => element === document.activeElement),
  );
  await page.keyboard.press("Home");
  assert(
    await selections
      .first()
      .evaluate((element) => element === document.activeElement),
  );
  checks.push({ name: "keyboard-selection-with-metrics", passed: true });
  assert.deepEqual(errors, [], "browser errors");
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(
      { checks: checks.length, scenarios: checks, violations: 0 },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks: checks.length, violations: 0, output }));
} catch (error) {
  await page.screenshot({
    path: resolve(output, "failure.png"),
    fullPage: true,
  });
  await writeFile(
    resolve(output, "failure.json"),
    JSON.stringify(
      { completed: checks, error: String(error), browserErrors: errors },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
