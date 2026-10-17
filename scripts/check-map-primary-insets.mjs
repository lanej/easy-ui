import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9018";
const output = resolve(
  process.env.MAP_PRIMARY_REPORT_DIR ?? "/tmp/easy-ui-map-primary-insets",
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
const results = [];
const errors = [];
const settledMaps = (page, count) =>
  page.waitForFunction((expectedCount) => {
    const maps = [...document.querySelectorAll(".maplibregl-map")];
    return (
      maps.length === expectedCount &&
      maps.every(
        (map) =>
          map.getAttribute("data-initial-view-ready") === "true" &&
          map.getAttribute("data-map-idle") === "true",
      )
    );
  }, count);
const membership = async (page, ids) => {
  await page.waitForFunction((expected) => {
    const markers = [...document.querySelectorAll("[data-map-facility-id]")];
    return (
      markers.length > 0 &&
      markers.every((marker) => {
        const value = marker.getAttribute("data-primary");
        return expected === null
          ? value === null
          : value ===
              String(
                expected.includes(marker.getAttribute("data-map-facility-id")),
              );
      })
    );
  }, ids);
};

try {
  for (const theme of ["light", "dark"]) {
    for (const width of [1200, 390]) {
      const page = await browser.newPage({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(
        `${base}/iframe.html?id=components-networkmap--primary-route-insets&viewMode=story&globals=colorScheme:${theme}`,
      );
      await page.locator('[data-map-state="ready"]').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await settledMaps(page, 1);
      const source = page
        .locator(
          '[data-map-facility-id="oak"][data-map-inset-available="origin"]',
        )
        .first();
      await source.waitFor();
      const overviewBefore = await source.boundingBox();
      await source.press("Enter");
      const inset = page.locator('[data-map-zoom-section="origin"]');
      await inset.waitFor();
      await inset.locator('[data-map-state="ready"]').waitFor();
      await inset.locator('[data-map-facility-id="acceptance"]').waitFor();
      const retained = await inset.elementHandle();
      const overview = page.locator("[data-map-geography] > [data-map-state]");
      if (width === 390) {
        assert.equal(
          await overview.evaluate(
            (element) => getComputedStyle(element).visibility,
          ),
          "hidden",
          "narrow overview is hidden from view and keyboard navigation",
        );
        assert.ok(
          await inset
            .getByText("Back to overview", { exact: true })
            .isVisible(),
          "narrow drill-in has a clear return action",
        );
        assert.ok(
          await inset.locator(".maplibregl-map").isVisible(),
          "narrow close-up keeps its local map",
        );
        assert.ok(
          await inset
            .locator("[data-map-inset-header]")
            .evaluate((element) => element.contains(document.activeElement)),
          "opening moves focus out of hidden overview",
        );
        const height = await page
          .locator("[data-map-geography]")
          .evaluate((element) => element.getBoundingClientRect().height);
        assert.ok(
          height < 400,
          "narrow drill-in does not reserve the tall overview space",
        );
      } else {
        assert.equal(
          await overview.evaluate(
            (element) => getComputedStyle(element).visibility,
          ),
          "visible",
        );
      }
      await membership(page, ["oak", "slc", "dtw"]);
      const insetIds = await inset
        .locator("[data-map-facility-id]")
        .evaluateAll((markers) =>
          markers
            .map((marker) => marker.getAttribute("data-map-facility-id"))
            .sort(),
        );
      assert.deepEqual(insetIds, ["acceptance", "oak", "origin-sort"]);
      await settledMaps(page, 2);
      await page.screenshot({
        path: resolve(output, `mixed-${theme}-${width}.png`),
        fullPage: true,
      });
      await page.getByLabel("Primary membership").selectOption("second");
      await membership(page, ["acceptance", "chi", "dst"]);
      assert.ok(
        await retained.evaluate((element) => element.isConnected),
        "membership update retains the open inset",
      );
      await page.getByLabel("Primary membership").selectOption("empty");
      await membership(page, []);
      await page.getByLabel("Primary membership").selectOption("unset");
      await membership(page, null);
      assert.ok(
        await retained.evaluate((element) => element.isConnected),
        "clearing membership retains the open inset",
      );
      await settledMaps(page, 2);
      await page.screenshot({
        path: resolve(output, `cleared-${theme}-${width}.png`),
        fullPage: true,
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      );
      assert.ok(overflow <= 1, "story has no page-level horizontal overflow");
      await inset
        .getByRole("button", {
          name: width === 390 ? "Back to overview" : "Close close-up",
          exact: true,
        })
        .press("Escape");
      await inset.waitFor({ state: "detached" });
      assert.ok(
        await source.evaluate((element) => element === document.activeElement),
        "Escape returns focus to the source marker",
      );
      const overviewAfter = await source.boundingBox();
      assert.ok(
        Math.abs(overviewBefore.x - overviewAfter.x) < 1 &&
          Math.abs(overviewBefore.y - overviewAfter.y) < 1,
        "dismissal restores the original overview camera",
      );
      await source.press("Enter");
      await inset.waitFor();
      await inset.locator('[data-map-state="ready"]').waitFor();
      await membership(page, null);
      await inset
        .getByRole("button", {
          name: width === 390 ? "Back to overview" : "Close close-up",
          exact: true,
        })
        .click();
      await inset.waitFor({ state: "detached" });
      if (width === 1200) {
        await source.press("Enter");
        await inset.waitFor();
        await inset.locator('[data-map-state="ready"]').waitFor();
        const frame = page.locator("[data-map-geography]");
        await frame.evaluate((element) => {
          element.style.width = "480px";
        });
        await page.waitForFunction(
          () =>
            getComputedStyle(
              document.querySelector("[data-map-geography] > [data-map-state]"),
            ).visibility === "hidden",
        );
        await inset
          .getByRole("button", { name: "Back to overview", exact: true })
          .waitFor();
        await page.screenshot({
          path: resolve(output, `panel-${theme}-480.png`),
          fullPage: true,
        });
        await frame.evaluate((element) => {
          element.style.width = "481px";
        });
        await page.waitForFunction(
          () =>
            getComputedStyle(
              document.querySelector("[data-map-geography] > [data-map-state]"),
            ).visibility === "visible",
        );
        await inset
          .getByRole("button", { name: "Close close-up", exact: true })
          .waitFor();
        await source.focus();
        await frame.evaluate((element) => {
          element.style.width = "480px";
        });
        await page.waitForFunction(() =>
          document
            .querySelector("[data-map-inset-header]")
            .contains(document.activeElement),
        );
        await inset
          .getByRole("button", { name: "Back to overview", exact: true })
          .press("Escape");
        await inset.waitFor({ state: "detached" });
        assert.ok(
          await source.evaluate(
            (element) => element === document.activeElement,
          ),
          "panel Escape restores focus after resize",
        );
      }
      results.push({
        theme,
        width,
        insetIds,
        overflow,
        checks: [
          "mixed",
          "immutable-update",
          "empty",
          "clear",
          "keyboard-dismiss",
          "reopen-cleared",
          "pointer-dismiss",
        ],
      });
      await page.close();
    }
  }
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log(
    "Primary-route inset Storybook checks passed in both themes at 390px and 1200px.",
  );
} finally {
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify({ results, errors }, null, 2),
  );
  await browser.close();
}
