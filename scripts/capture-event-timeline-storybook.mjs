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
const server = spawn("python3", ["-m", "http.server", "4179", "--bind", "127.0.0.1", "--directory", storybook], {
  stdio: "ignore",
});
let browser;
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch("http://127.0.0.1:4179/iframe.html");
      if (response.ok) break;
    } catch { /* Server is starting. */ }
    if (attempt === 49) throw new Error("Storybook server did not start");
    await delay(250);
  }
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1250, height: 920 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  async function capture(story, theme, filename, expected) {
    await page.goto(`http://127.0.0.1:4179/iframe.html?id=organisms-data-display-eventtimeline--${story}&viewMode=story&globals=colorScheme:${theme}`);
    const scene = page.locator("#storybook-root");
    await scene.waitFor({ state: "visible" });
    await page.waitForFunction((target) => {
      const text = document.querySelector("#storybook-root")?.textContent ?? "";
      return target.every((phrase) => text.includes(phrase));
    }, expected);
    await page.evaluate(() => document.fonts.ready);
    if (errors.length) throw new Error(`Storybook runtime errors: ${errors.join("; ")}`);
    const bounds = await scene.boundingBox();
    if (!bounds || bounds.width < 600 || bounds.height < 300) {
      throw new Error(`Invalid rendered Storybook dimensions for ${story}: ${JSON.stringify(bounds)}`);
    }
    await scene.screenshot({
      path: resolve(output, filename),
      animations: "disabled",
      timeout: 20000,
    });
    console.log(`${story} (${theme}) captured: ${Math.round(bounds.width)}×${Math.round(bounds.height)}`);
  }

  await capture(
    "presentation-modes", "light", "event-timeline-presentation-light.png",
    ["01 · Minimal", "02 · Inline quantiles", "03 · Expanded interval", "P50", "P90", "6"],
  );
  await capture(
    "presentation-modes", "dark", "event-timeline-presentation-dark.png",
    ["01 · Minimal", "02 · Inline quantiles", "03 · Expanded interval", "P50", "P90", "6"],
  );
  await page.setViewportSize({ width: 480, height: 880 });
  await capture(
    "narrow-quantiles", "light", "event-timeline-quantiles-narrow.png",
    ["17:06", "P50", "P90", "6"],
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
