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
const inspector = () =>
  page.getByRole("region", { name: "Investigation inspector" });
async function checkHeaderAction() {
  const action = root().getByRole("button", {
    name: "Data notes",
    exact: true,
  });
  assert.equal(
    await action.isVisible(),
    true,
    "Caller action must remain visible",
  );
  await action.click();
  assert.equal(await action.getAttribute("aria-expanded"), "true");
  await page.getByText(/Data notes: city centers are illustrative/).waitFor();
  await action.click();
  assert.equal(await action.getAttribute("aria-expanded"), "false");
}
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
    await checkHeaderAction();
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
    for (const [tab, command] of [
      ["Evidence", "Compare Via Santa Rosa"],
      ["Event", "Deviation analysis"],
    ]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await page.getByRole("button", { name: command, exact: true }).click();
      assert.equal(
        await page
          .getByRole("tab", { name: "Deviation", exact: true })
          .getAttribute("aria-selected"),
        "true",
      );
      await page.getByText("+3 h 05 m", { exact: true }).waitFor();
    }
    sameCamera(before, await camera());
    checks.push(
      `${theme}: repeated analysis commands reveal inspector; header action; overview/focus/deviation, forecast toggles, camera, edge evidence, keyboard tabs, accessibility`,
    );
  }
  await open("light", 1680, 1120, "workbench-overview");
  await readyMap();
  await capture("workbench-overview.png", "light");
  for (const theme of ["light", "dark"]) {
    await open(theme, 390, 900, "workbench-narrow");
    await checkHeaderAction();
    await accessible();
    await capture(`workbench-${theme}-narrow-events.png`, theme);
    assert.ok(
      await root().evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      "Narrow workbench overflows horizontally",
    );
    await readyMap();
    await capture(`workbench-${theme}-narrow-map.png`, theme);
    const before = await camera();
    await page.getByRole("button", { name: "Events", exact: true }).click();
    await page.getByRole("button", { name: "Map", exact: true }).click();
    sameCamera(before, await camera());
    // Use the fluid example for resizing; the narrow story deliberately caps its container.
    await open(theme, 390, 900);
    for (const [view, panel] of [
      ["Events", ledger()],
      ["Map", map()],
    ]) {
      await page.getByRole("button", { name: view, exact: true }).focus();
      await page.setViewportSize({ width: 1000, height: 900 });
      await page.waitForFunction(
        () =>
          document.querySelector('[aria-label="Parcel investigation"]').dataset
            .narrow === "false",
      );
      assert.equal(
        await panel.evaluate((el) => el === document.activeElement),
        true,
        "Widening must retain focus in the matching panel",
      );
      await page.setViewportSize({ width: 390, height: 900 });
      await page.waitForFunction(
        () =>
          document.querySelector('[aria-label="Parcel investigation"]').dataset
            .narrow === "true",
      );
      assert.equal(
        await page
          .getByRole("button", { name: view, exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
    }
    await accessible();
    checks.push(
      `${theme} 390px: no horizontal overflow, event/map switching preserves camera, persistent inspector`,
    );
    await open(theme, 1680, 1120, "workbench-assessment-scopes");
    await readyMap();
    await page
      .getByText(
        "This supplied finding applies to history A, independently of its selected observation.",
      )
      .waitFor();
    assert.equal(await ledger().locator('[aria-current="true"]').count(), 0);
    await capture(`workbench-assessments-${theme}-desktop.png`, theme);
    await ledger()
      .getByRole("button", { name: /In transit Avondale.*Return visit/ })
      .click();
    await page
      .getByText(
        "This supplied finding applies to the return connection. Select its map segment or incoming observation to inspect it.",
      )
      .waitFor();
    await accessible();
    checks.push(
      `${theme}: focused path and incoming connection assessments retain provenance`,
    );
  }
  for (const theme of ["light", "dark"]) {
    for (const width of [1150, 960]) {
      await open(theme, width);
      await checkHeaderAction();
      assert.ok(
        await root().evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        "Wrapped header action overflows",
      );
      if (width === 1150)
        await capture(`workbench-${theme}-header-action-1150.png`, theme);
      checks.push(
        `${theme} ${width}px: caller header action is visible and operable`,
      );
    }
    for (const width of [1680, 390]) {
      await open(
        theme,
        width,
        width === 390 ? 900 : 1120,
        "workbench-unassigned-evidence",
      );
      const disclosure = ledger()
        .getByText("Unassigned observations (2)", { exact: true })
        .locator("..");
      assert.equal(await disclosure.getAttribute("open"), null);
      await readyMap();
      const before = await camera();
      await page
        .getByRole("button", { name: "Select Santa Rosa, NM", exact: true })
        .click();
      await page.getByRole("tab", { name: "Event", exact: true }).click();
      await inspector()
        .getByRole("button", {
          name: "Delivered · Oct 27 · 13:42 UTC",
          exact: true,
        })
        .click();
      if (width === 390) {
        assert.equal(
          await map().isVisible(),
          true,
          "Selecting a visit must not switch the mobile view",
        );
        await page.getByRole("button", { name: "Events", exact: true }).click();
      }
      assert.equal(
        await disclosure.evaluate((el) => el.open),
        true,
        "Selected unassigned visit must reveal its disclosure",
      );
      const selected = disclosure.getByRole("button", {
        name: /Delivered Santa Rosa/,
      });
      assert.equal(await selected.getAttribute("aria-current"), "true");
      assert.equal(await selected.isVisible(), true);
      const visible = await selected.evaluate((el) => {
        const row = el.getBoundingClientRect();
        const panel = el
          .closest("[data-workbench-scroll]")
          .getBoundingClientRect();
        return (
          row.height > 0 && row.top >= panel.top && row.bottom <= panel.bottom
        );
      });
      assert.ok(
        visible,
        "Selected unassigned row must be measured after opening and scrolled inside its panel",
      );
      await disclosure.getByText("Evidence review", { exact: true }).waitFor();
      await disclosure.getByText("High risk", { exact: true }).waitFor();
      await disclosure.getByText("3 h", { exact: true }).first().waitFor();
      assert.equal(
        (await disclosure
          .locator('[data-connection-id="unassigned-report-link"]')
          .count()) > 0,
        true,
      );
      sameCamera(before, await camera());
      await accessible();
      await capture(
        `workbench-unassigned-evidence-${theme}-${width}.png`,
        theme,
      );
      checks.push(
        `${theme} ${width}px: map-selected unassigned visit reveals and scrolls its row; explicit connection, metrics and risks survive focus; camera retained`,
      );
    }
  }
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
