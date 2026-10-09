import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "./preview-maps/node_modules/playwright/index.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "documentation/images");
const storybook = resolve(root, "storybook-static");
if (!existsSync(resolve(storybook, "iframe.html"))) {
  throw new Error("Build Storybook before capturing its rendered components");
}
mkdirSync(output, { recursive: true });
const server = spawn("python3", [
  "-m", "http.server", "4179", "--bind", "127.0.0.1", "--directory", storybook,
], { stdio: "ignore" });
let browser;
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await fetch("http://127.0.0.1:4179/iframe.html")).ok) break;
    } catch { /* Server starting. */ }
    if (attempt === 49) throw new Error("Storybook HTTP server did not start");
    await delay(250);
  }
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({
    viewport: { width: 1100, height: 1200 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  async function assertInlineRows() {
    const results = await page.evaluate(() => Array.from(
      document.querySelectorAll('li > [data-current="true"]'),
    ).map((row) => {
      const [button, trailing] = Array.from(row.children);
      if (!button || !trailing) throw new Error("Selected event lacks inline content");
      const b = button.getBoundingClientRect();
      const t = trailing.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      const assessment = trailing.querySelector('[data-variant="inline"]');
      if (!assessment) throw new Error("Expected inline health variant");
      const plot = trailing.querySelector('[data-visualization]');
      const summary = assessment.querySelector('[data-assessment]');
      const duration = assessment.querySelector('[role="group"]');
      return {
        centerDelta: Math.abs((b.top + b.height / 2) - (t.top + t.height / 2)),
        overhang: Math.max(0, t.right - r.right),
        overflow: Math.max(0, trailing.scrollWidth - trailing.clientWidth),
        width: Math.round(r.width),
        reference: plot?.getAttribute("data-visualization") ?? "none",
        hasSmooth: !!trailing.querySelector('[data-density-curve="true"]'),
        hasStatus: !!summary,
        hasDuration: !!duration,
      };
    }));
    if (!results.length) throw new Error("No selected events found");
    console.log("Inline row geometry:", JSON.stringify(results));
    for (const result of results) {
      if (result.centerDelta > 24 || result.overhang > 2 || result.overflow > 2) {
        throw new Error("Metrics are not actually inline with the selected event");
      }
      if (result.reference === "histogram" && !result.hasSmooth) {
        throw new Error("Smooth inline example did not render its density curve");
      }
      if (!result.hasStatus || !result.hasDuration) {
        throw new Error("Inline state does not show both assessment and current duration");
      }
    }
  }

  async function capture(story, theme, filename, expected, { width = 1100, inline = true } = {}) {
    await page.setViewportSize({ width, height: 1300 });
    await page.goto(
      `http://127.0.0.1:4179/iframe.html?id=organisms-data-display-eventtimeline--${story}&viewMode=story&globals=colorScheme:${theme}`,
    );
    const scene = page.locator("#storybook-root > *").first();
    await scene.waitFor({ state: "visible" });
    await page.waitForFunction((phrases) => {
      const text = document.querySelector("#storybook-root")?.textContent ?? "";
      return phrases.every((phrase) => text.includes(phrase));
    }, expected);
    await page.evaluate(() => document.fonts.ready);
    if (errors.length) throw new Error(`Storybook runtime errors: ${errors.join("; ")}`);
    if (inline) await assertInlineRows();
    const bounds = await scene.boundingBox();
    if (!bounds || bounds.width < 250 || bounds.height < 160) {
      throw new Error(`Storybook component missing/too small: ${JSON.stringify(bounds)}`);
    }
    await scene.screenshot({
      path: resolve(output, filename),
      animations: "disabled",
      timeout: 20000,
    });
    console.log(`${story} (${theme}): ${Math.round(bounds.width)}×${Math.round(bounds.height)} captured`);
  }

  await capture("presentation-modes", "light", "event-timeline-presentation-light.png",
    ["01 · Minimal", "02 · Inline quantiles", "03 · Inline smooth density",
      "04 · Expanded interval", "P50", "P90", "6"]);
  await capture("presentation-modes", "dark", "event-timeline-presentation-dark.png",
    ["01 · Minimal", "02 · Inline quantiles", "03 · Inline smooth density", "P50", "P90"]);
  await capture("map-adjacent", "light", "event-timeline-map-adjacent.png",
    ["Events · 420px column", "Map integration space", "P50", "P90", "6"]);
  await capture("narrow-quantiles", "light", "event-timeline-quantiles-narrow.png",
    ["17:06", "P50", "P90", "6"], { width: 480 });
  await capture("inline-smooth-curve", "light", "event-timeline-smooth-curve-narrow.png",
    ["17:06", "P50", "P90", "6"], { width: 480 });
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
