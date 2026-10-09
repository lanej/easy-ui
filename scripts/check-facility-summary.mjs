import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const output = resolve(
  process.env.FACILITY_REPORT_DIR ?? "/tmp/easy-ui-facility-summary",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const checks = [];
const baselineChecks = [];
const errors = [];
const page = await browser.newPage({
  viewport: { width: 1040, height: 900 },
  deviceScaleFactor: 2,
});
page.on("pageerror", (e) => errors.push(e.message));
// A zero-height inline marker sits on the text baseline. Box centers miss
// misalignment between different font sizes and nested inline/flex elements.
async function textBaseline(locator) {
  return locator.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let text;
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.trim()) {
        text = walker.currentNode;
        break;
      }
    }
    if (!text)
      throw new Error("Expected visible text for baseline measurement");
    const wrapper = document.createElement("span");
    wrapper.style.display = "inline";
    text.replaceWith(wrapper);
    wrapper.append(text);
    const marker = document.createElement("span");
    marker.style.cssText =
      "display:inline-block;width:0;height:0;margin:0;padding:0;vertical-align:baseline";
    wrapper.append(marker);
    const baseline = marker.getBoundingClientRect().top;
    wrapper.replaceWith(text);
    return baseline;
  });
}

async function assertSharedBaseline(locators, name) {
  const baselines = [];
  // Measure sequentially so temporary markers never affect other measurements.
  for (const locator of locators) baselines.push(await textBaseline(locator));
  const spread = Math.max(...baselines) - Math.min(...baselines);
  assert.ok(spread <= 0.25, `${name}: text baselines differ by ${spread}px`);
  baselineChecks.push({ name, spread });
}

async function auditAccessibility(page, name) {
  await page.addScriptTag({
    path: require.resolve("axe-core/axe.min.js"),
  });
  let audit;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      audit = await page.evaluate(
        async () =>
          await axe.run(document.querySelector("#storybook-root"), {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21aa"],
            },
          }),
      );
      break;
    } catch (error) {
      if (!String(error).includes("already running") || attempt === 39)
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  assert.deepEqual(
    audit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
    [],
    name,
  );
}
try {
  for (const theme of ["light", "dark"]) {
    for (const width of [1040, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const story of [
        "default",
        "compact",
        "detailed",
        "identity-only",
        "missing-observation",
        "loading",
        "narrow",
        "multiple-observations",
        "comparison",
        "fresh-unhealthy",
        "table",
      ]) {
        await page.goto(
          `${process.env.STORYBOOK_URL ?? "http://localhost:9018"}/iframe.html?id=organisms-facilities-facilitysummary--${story}&viewMode=story&globals=colorScheme:${theme}`,
        );
        await page.waitForFunction(() =>
          document
            .querySelector("#storybook-root")
            ?.textContent.includes("North Harbor"),
        );
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator(".sb-errordisplay").isVisible(), false);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${theme}-${width}-${story}: overflow`,
        );
        if (story === "missing-observation")
          assert.equal(
            await page.getByText("As expected", { exact: true }).count(),
            0,
          );
        if (story === "loading") {
          assert.equal(await page.getByRole("status").count(), 1);
          assert.equal(
            await page.locator('[role="img"][class*="plot"]').count(),
            0,
          );
        }
        if (["compact", "default", "detailed", "narrow"].includes(story)) {
          const aligned = [
            page.getByText("Current dwell", { exact: true }),
            page.getByRole("img", { name: "6 h", exact: true }),
            page
              .getByRole("img", { name: "6 h", exact: true })
              .getByText("h", { exact: true }),
          ];
          if (["default", "detailed"].includes(story) && width === 1040) {
            aligned.push(
              page.getByText("As expected", { exact: true }),
              page.getByText("Updated recently", { exact: true }),
              page.locator('[data-percentile="P50"] dt'),
              page.locator('[data-percentile="P50"] dd'),
              page.locator('[data-percentile="P90"] dt'),
              page.locator('[data-percentile="P90"] dd'),
            );
          }
          await assertSharedBaseline(aligned, `${theme}-${width}-${story}`);
        }
        if (story === "compact") {
          const dot = page.getByRole("img", {
            name: "As expected",
            exact: true,
          });
          const label = page.getByText("Current dwell", { exact: true });
          assert.equal(await dot.count(), 1);
          const dotBox = await dot.boundingBox();
          const labelBox = await label.boundingBox();
          const valueBox = await page
            .getByRole("img", { name: "6 h", exact: true })
            .boundingBox();
          assert.ok(valueBox, "Compact duration must be visible");
          assert.ok(labelBox.x + labelBox.width <= dotBox.x);
          assert.ok(dotBox.x + dotBox.width <= valueBox.x);
          assert.ok(
            Math.abs(
              dotBox.y + dotBox.height / 2 - labelBox.y - labelBox.height / 2,
            ) < 2,
          );
          assert.equal(
            await page.getByText("As expected", { exact: true }).count(),
            0,
          );
          assert.equal(
            await page
              .locator('[data-variant="compact"][data-size="sm"]')
              .count(),
            1,
          );
          assert.equal(
            await page.locator('[role="img"][class*="plot"]').count(),
            0,
          );
        }
        if (story === "default") {
          const label = page.getByText("Current dwell", { exact: true });
          const freshness = page.getByRole("group", {
            name: "Observation freshness",
          });
          assert.equal(
            await freshness
              .getByText("Updated recently", { exact: true })
              .isVisible(),
            true,
          );
          assert.equal(
            await label.locator("..").getByRole("img").count(),
            0,
            "A freshness dot must not occupy the compact health-dot position",
          );
          const metricBox = await page
            .locator('dl[aria-label="Reference percentiles"]')
            .boundingBox();
          const referenceBox = await page
            .locator('[role="img"][class*="plot"]')
            .boundingBox();
          assert.ok(
            metricBox.y + metricBox.height <= referenceBox.y,
            "Percentile metrics belong above the bar",
          );
          assert.equal(
            await page
              .locator('dl[aria-label="Reference percentiles"]')
              .count(),
            1,
          );
        }
        if (story === "fresh-unhealthy") {
          for (const variant of ["compact", "default", "detailed"]) {
            const facility = page.locator(`section[data-variant="${variant}"]`);
            assert.equal(
              await facility
                .locator('[data-assessment="unhealthy"][data-size]')
                .count(),
              1,
            );
            const label = facility.getByText("Current dwell", { exact: true });
            if (variant === "compact") {
              const dot = label.locator("..").getByRole("img", {
                name: "Outside expectations",
                exact: true,
              });
              assert.equal(await dot.getAttribute("data-tone"), "danger");
              assert.equal(
                await facility
                  .getByRole("group", { name: "Observation freshness" })
                  .count(),
                0,
              );
            } else {
              assert.equal(
                await facility
                  .getByText("Outside expectations", { exact: true })
                  .isVisible(),
                true,
              );
              assert.equal(
                await label.locator("..").getByRole("img").count(),
                0,
              );
              const freshness = facility.getByRole("group", {
                name: "Observation freshness",
              });
              assert.equal(
                await freshness
                  .getByText("Updated recently", { exact: true })
                  .isVisible(),
                true,
              );
              assert.equal(
                await freshness
                  .getByRole("img", { name: "Updated recently" })
                  .getAttribute("data-tone"),
                "success",
              );
            }
          }
        }
        if (["default", "detailed"].includes(story) && width === 1040) {
          const plot = await page
            .locator('[role="img"][class*="plot"]')
            .boundingBox();
          const assessment = await page
            .locator('[data-reference-layout="below"]')
            .boundingBox();
          assert.ok(
            Math.abs(plot.x - assessment.x) < 2,
            "Reference must align with the observation row",
          );
          const metrics = await page
            .locator('dl[aria-label="Reference percentiles"]')
            .boundingBox();
          assert.ok(
            plot.y >= metrics.y + metrics.height,
            "Reference belongs below the observation row",
          );
          assert.equal(
            await page.locator('[class*="percentileLabel"]').count(),
            0,
            "Percentile labels must not be repeated on the graph",
          );
        }
        await auditAccessibility(page, `${theme}-${width}-${story}`);
        checks.push(`${theme}-${width}-${story}`);
        if (width === 1040 && ["default", "compact"].includes(story))
          await page.locator(`section[data-variant="${story}"]`).screenshot({
            path: resolve(output, `facility-summary-${story}-${theme}.png`),
          });

        if (
          (width === 1040 &&
            ["comparison", "table", "fresh-unhealthy"].includes(story)) ||
          (width === 320 && ["narrow", "missing-observation"].includes(story))
        )
          await page.locator("#storybook-root").screenshot({
            path: resolve(output, `facility-summary-${story}-${theme}.png`),
          });
      }
    }
  }
  // Real layout checks catch clipped indicators that DOM visibility assertions miss.
  for (const theme of ["light", "dark"]) {
    for (const width of [312, 452]) {
      await page.setViewportSize({ width, height: 900 });
      for (const story of [
        "responsive-form",
        "responsive-label-health",
        "responsive-label-dot",
      ]) {
        const name = `${theme}-${width}-${story}`;
        await page.goto(
          `${process.env.STORYBOOK_URL ?? "http://localhost:9018"}/iframe.html?id=organisms-feedback-healthassessment--${story}&viewMode=story&globals=colorScheme:${theme}`,
        );
        await page.locator('[data-variant="responsive"]').waitFor();
        await page.evaluate(() => document.fonts.ready);
        const health = page.locator('[data-assessment="healthy"][data-size]');
        assert.equal(await health.count(), 1, `${name}: one assessment`);
        const geometry = await health.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const hiddenAncestors = [];
          for (
            let ancestor = element;
            ancestor;
            ancestor = ancestor.parentElement
          ) {
            const style = getComputedStyle(ancestor);
            const rect = ancestor.getBoundingClientRect();
            if (
              style.clipPath !== "none" ||
              style.visibility === "hidden" ||
              style.display === "none" ||
              (style.overflow === "hidden" &&
                (rect.width <= 1 || rect.height <= 1))
            ) {
              hiddenAncestors.push(ancestor.className);
            }
          }
          return {
            width: box.width,
            height: box.height,
            left: box.left,
            right: box.right,
            hiddenAncestors,
            viewport: innerWidth,
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        assert.deepEqual(
          geometry.hiddenAncestors,
          [],
          `${name}: assessment must not be clipped`,
        );
        assert.ok(
          geometry.width > 1 && geometry.height > 1,
          `${name}: visible assessment size`,
        );
        assert.ok(
          geometry.left >= 0 && geometry.right <= geometry.viewport,
          `${name}: assessment in viewport`,
        );
        assert.equal(
          geometry.overflow,
          false,
          `${name}: no horizontal overflow`,
        );
        assert.equal(
          await page
            .getByRole("img", { name: "6 hours", exact: true })
            .isVisible(),
          true,
        );
        await auditAccessibility(page, name);
        await page.locator("#storybook-root").screenshot({
          path: resolve(output, `health-assessment-${name}.png`),
        });
        checks.push(name);
      }
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(
      {
        checks: checks.length,
        scenarios: checks,
        baselineChecks,
        violations: 0,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks: checks.length, violations: 0 }));
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
