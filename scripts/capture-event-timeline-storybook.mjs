import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "./preview-maps/node_modules/playwright/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const storybook = resolve(root, "storybook-static");
const output = resolve(root, "documentation/images");
if (!existsSync(resolve(storybook, "iframe.html"))) {
  throw new Error("Build Storybook before capturing rendered components");
}
mkdirSync(output, { recursive: true });
const server = spawn("python3", [
  "-m", "http.server", "4179", "--bind", "127.0.0.1", "--directory", storybook,
], { stdio: "ignore" });

let browser;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch("http://127.0.0.1:4179/iframe.html")).ok) break;
    } catch { /* Starting. */ }
    if (attempt === 59) throw new Error("Storybook HTTP server did not start");
    await delay(250);
  }
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({
    viewport: { width: 1100, height: 1900 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  async function inspectSelected({ expectedWidth, expectConcentration = false, hiddenReference = false }) {
    const results = await page.evaluate(() => (
      Array.from(document.querySelectorAll('li > div[data-current="true"]')).map((row) => {
        const button = row.querySelector("button");
        const trailing = Array.from(row.children).find((el) => el !== button);
        const title = button?.querySelector('[class*="title_"]');
        const dot = button?.querySelector('[role="img"][data-current="true"]');
        const ref = trailing?.querySelector('[data-concentration]');
        const reference = trailing?.querySelector("figure");
        const strip = trailing?.querySelector('svg[data-concentration-style="smooth"]');
        const duration = trailing?.querySelector('[role="group"]');
        const indicator = trailing?.querySelector('[data-assessment]');
        if (!button || !trailing || !title || !dot || !duration || !indicator) {
          throw new Error("Selected event, status dot, observation or assessment missing");
        }
        const b = button.getBoundingClientRect();
        const t = trailing.getBoundingClientRect();
        const d = dot.getBoundingClientRect();
        const label = title.getBoundingClientRect();
        const r = row.getBoundingClientRect();
        const entry = row.closest("li");
        const lineLeft = Number.parseFloat(getComputedStyle(entry, "::before").left);
        const connectorX = entry.getBoundingClientRect().left + lineLeft;
        return {
          width: Math.round(r.width),
          // StatusDot's selected halo is 30px wide, independent of the dot size.
          haloClearance: Number((label.left - ((d.left + d.right) / 2 + 15)).toFixed(2)),
          connectorError: Number(Math.abs(connectorX - (d.left + d.right) / 2).toFixed(2)),
          titleOverflow: Number((title.scrollWidth - title.clientWidth).toFixed(2)),
          rowCenterDelta: Number(Math.abs((b.top + b.height / 2) - (t.top + t.height / 2)).toFixed(2)),
          trailingOverflow: Math.max(0, trailing.scrollWidth - trailing.clientWidth),
          outsideRow: Math.max(0, t.right - r.right),
          tinyLabels: trailing.querySelectorAll("dt, dd").length,
          refPresent: !!ref,
          refVisible: !!reference && reference.getClientRects().length > 0,
          concentration: strip?.getClientRects().length > 0,
          gradientStops: strip?.querySelectorAll("stop").length ?? 0,
          refAccessible: ref?.querySelector('[role="img"]')?.getAttribute("aria-label") ?? "",
        };
      })
    ));
    if (!results.length) throw new Error("Expected selected event not found");
    console.log("Selected event layout:", JSON.stringify(results));
    for (const result of results) {
      if (result.width !== expectedWidth) {
        throw new Error(`Timeline should be ${expectedWidth}px wide, got ${result.width}`);
      }
      if (result.haloClearance < 2 || result.titleOverflow > 1) {
        throw new Error("Current status halo overlaps or clips the primary event label");
      }
      if (result.connectorError > 1) {
        throw new Error("Connector no longer aligns with StatusDot");
      }
      if (result.rowCenterDelta > 24 || result.trailingOverflow > 2 || result.outsideRow > 2) {
        throw new Error("Duration summary is not aligned with its event row");
      }
      if (result.tinyLabels) throw new Error("Tiny percentile text must not appear inline");
      if (hiddenReference && result.refVisible) {
        throw new Error("Narrow width must suppress optional reference visualizations");
      }
      if (expectConcentration) {
        if (!result.concentration || result.gradientStops < 4) {
          throw new Error("Smooth concentration gradient is not rendered");
        }
        if (!result.refAccessible.includes("P50") || !result.refAccessible.includes("P90")) {
          throw new Error("Reference landmark values lost their accessible names");
        }
      }
    }
  }

  async function capture({ story, theme = "light", filename, expected, width = 1100, validate }) {
    await page.setViewportSize({ width, height: 1950 });
    await page.goto(
      `http://127.0.0.1:4179/iframe.html?id=organisms-data-display-eventtimeline--${story}&viewMode=story&globals=colorScheme:${theme}`,
    );
    const scene = page.locator("#storybook-root > :not(style)").first();
    await scene.waitFor({ state: "visible" });
    await page.waitForFunction((phrases) => {
      const text = document.querySelector("#storybook-root")?.textContent ?? "";
      return phrases.every((phrase) => text.includes(phrase));
    }, expected);
    await page.evaluate(() => document.fonts.ready);
    if (errors.length) throw new Error(`Storybook runtime errors: ${errors.join("; ")}`);
    if (validate) await inspectSelected(validate);
    const bounds = await scene.boundingBox();
    if (!bounds || bounds.width < 250 || bounds.height < 160) {
      throw new Error(`Storybook scene is missing: ${JSON.stringify(bounds)}`);
    }
    await scene.screenshot({
      path: resolve(output, filename),
      animations: "disabled",
      timeout: 20000,
    });
    console.log(`${story} (${theme}) captured at ${Math.round(bounds.width)}x${Math.round(bounds.height)}`);
  }

  await capture({
    story: "presentation-modes",
    filename: "event-timeline-presentation-light.png",
    expected: ["01 · Minimal", "02 · Inline quantiles", "03 · Inline density concentration", "04 · Inline smooth density", "05 · Expanded interval", "6"],
    validate: { expectedWidth: 446, expectConcentration: false },
  });
  await capture({
    story: "presentation-modes", theme: "dark",
    filename: "event-timeline-presentation-dark.png",
    expected: ["01 · Minimal", "03 · Inline density concentration", "05 · Expanded interval"],
    validate: { expectedWidth: 446 },
  });
  await capture({
    story: "map-adjacent",
    filename: "event-timeline-map-adjacent.png",
    expected: ["Events · 420px column", "Map integration space", "6"],
    validate: { expectedWidth: 420, expectConcentration: true },
  });
  await capture({
    story: "narrow-quantiles", width: 480,
    filename: "event-timeline-quantiles-narrow.png",
    expected: ["17:06", "Arrived", "6"],
    validate: { expectedWidth: 360, hiddenReference: true },
  });
  await capture({
    story: "inline-concentration", width: 480,
    filename: "event-timeline-concentration-inline.png",
    expected: ["17:06", "Arrived", "6"],
    // Default story occupies the viewport, not a fixed-width map column.
  });
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
