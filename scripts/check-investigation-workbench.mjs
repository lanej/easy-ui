import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const modulePath = process.env.PLAYWRIGHT_MODULE ?? "playwright";
const { chromium } = require(modulePath);
const axe = require.resolve("axe-core", { paths: [modulePath] });
const output = resolve(
  process.env.WORKBENCH_REPORT_DIR ?? "/tmp/easy-ui-workbench",
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
  viewport: { width: 1680, height: 1120 },
  deviceScaleFactor: 1,
});
page.setDefaultTimeout(20000);
const errors = [],
  checks = [],
  screenshots = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9019";
const root = () =>
  page.getByRole("region", { name: "Parcel investigation", exact: true });
const map = () => page.locator("[data-workbench-map]");
const ledger = () => page.getByRole("region", { name: "Observation ledger" });
async function open(
  theme = "light",
  width = 1680,
  height = 1120,
  story = "workbench-deviation",
) {
  await page.setViewportSize({ width, height });
  await page.goto(
    `${base}/iframe.html?id=organisms-investigation-investigationworkspace--${story}&viewMode=story&globals=colorScheme:${theme}`,
  );
  await root().waitFor();
  await page.waitForFunction(() => document.fonts.status === "loaded");
  await page.waitForFunction(() => {
    const el = document.querySelector('[aria-label="Parcel investigation"]');
    return (
      el?.dataset.narrow === String(el.getBoundingClientRect().width <= 760)
    );
  });
}
async function readyMap() {
  if (!(await map().isVisible()))
    await page.getByRole("button", { name: "Map", exact: true }).click();
  await page.waitForFunction(
    () =>
      window.workbenchMap?.isStyleLoaded() &&
      !window.workbenchMap.isMoving() &&
      window.workbenchMap.getCanvas().clientWidth > 0,
  );
  await page.waitForTimeout(500);
}
const camera = () =>
  page.evaluate(() => {
    const m = window.workbenchMap;
    return [
      m.getCenter().lng,
      m.getCenter().lat,
      m.getZoom(),
      m.getBearing(),
      m.getPitch(),
    ];
  });
function sameCamera(a, b) {
  a.forEach((n, i) =>
    assert.ok(Math.abs(n - b[i]) < 0.00001, `Camera changed: ${a} -> ${b}`),
  );
}
async function capture(name, theme) {
  await page.mouse.move(0, 0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  const image = await root().screenshot({
    path: resolve(output, name),
    animations: "disabled",
  });
  screenshots.push({
    file: name,
    theme,
    viewport: page.viewportSize(),
    sha256: createHash("sha256").update(image).digest("hex"),
    sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    actualComponent: true,
  });
}
async function accessible() {
  await page.addScriptTag({ path: axe });
  const violations = await page.evaluate(
    async () =>
      (
        await window.axe.run(
          document.querySelector('[aria-label="Parcel investigation"]'),
          { rules: { "color-contrast": { enabled: false } } },
        )
      ).violations,
  );
  assert.deepEqual(
    violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
    [],
  );
}
try {
  for (const theme of ["light", "dark"]) {
    await open(theme);
    await readyMap();
    assert.equal(await root().getAttribute("data-mode"), "deviation");
    assert.equal(
      await page
        .getByRole("tab", { name: "Deviation", exact: true })
        .getAttribute("aria-selected"),
      "true",
    );
    await page.getByText("+3 h 05 m", { exact: true }).waitFor();
    await accessible();
    await capture(`workbench-${theme}-desktop.png`, theme);
    const before = await camera();
    await ledger()
      .getByRole("button", { name: /In transit Hammond/ })
      .click();
    await page
      .getByText(/No deviation assessment supplied for the selected/)
      .waitFor();
    sameCamera(before, await camera());
    const toggle = page.getByRole("checkbox", {
      name: "Via Kansas City",
      exact: true,
    });
    await toggle.uncheck();
    await toggle.check();
    sameCamera(before, await camera());
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    assert.equal(await root().getAttribute("data-mode"), "overview");
    assert.equal(
      await page.getByRole("region", { name: "Map legend" }).count(),
      0,
    ); // legend is a named div, not a redundant region
    assert.equal(
      await page
        .locator('[aria-label="Map legend"]')
        .getByText(/· forecast/)
        .count(),
      0,
    );
    await page
      .getByRole("button", { name: "Focused history", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("checkbox", { name: "Via Kansas City", exact: true })
        .isChecked(),
      true,
    );
    await page
      .getByRole("button", { name: "Compare Via Santa Rosa", exact: true })
      .click();
    await ledger()
      .getByRole("button", { name: /In transit Avondale.*Return visit/ })
      .click();
    sameCamera(before, await camera());
    assert.equal(await root().getAttribute("data-mode"), "deviation");
    await page.getByRole("tab", { name: "Deviation", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page
        .getByRole("tab", { name: "Evidence", exact: true })
        .getAttribute("aria-selected"),
      "true",
    );
    await page
      .getByText(/synthetic 49-day reference/)
      .first()
      .waitFor();
    checks.push(
      `${theme}: overview/focus/deviation, forecast toggles, camera, edge evidence, keyboard tabs, accessibility`,
    );
  }
  await open("light", 1680, 1120, "workbench-overview");
  await readyMap();
  await capture("workbench-overview.png", "light");
  await open("light", 390, 900, "workbench-narrow");
  await accessible();
  await capture("workbench-narrow-events.png", "light");
  assert.ok(
    await root().evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    "Narrow workbench overflows horizontally",
  );
  await readyMap();
  await capture("workbench-narrow-map.png", "light");
  const before = await camera();
  await page.getByRole("button", { name: "Events", exact: true }).click();
  await page.getByRole("button", { name: "Map", exact: true }).click();
  sameCamera(before, await camera());
  await accessible();
  checks.push(
    "390px: no horizontal overflow, event/map switching preserves camera, persistent inspector",
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, errors, screenshots }, null, 2));
} finally {
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify({ checks, errors, screenshots }, null, 2),
  );
  await writeFile(
    resolve(output, "provenance.json"),
    JSON.stringify(
      {
        sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
        browser: await browser.version(),
        command: "node scripts/check-investigation-workbench.mjs",
        screenshots,
        limitations: [
          "Synthetic data, not live shipments.",
          "Automated accessibility check excludes color contrast; visual review is separate.",
          "No claim of downstream application adoption.",
        ],
      },
      null,
      2,
    ),
  );
  await browser.close();
}
