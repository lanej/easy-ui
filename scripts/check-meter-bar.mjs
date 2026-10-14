import assert from "node:assert/strict";
import { resolve } from "node:path";

// Reuse the existing ProportionBar browser session, accessibility audit,
// reporting, and CI artifact rather than creating another workflow.
export async function checkMeterBar({
  page,
  base,
  output,
  checks,
  accessibility,
}) {
  async function open(story, theme) {
    await page.goto(
      `${base}/iframe.html?id=test-meterbar--${story}&viewMode=story&globals=colorScheme:${theme}`,
    );
    await page
      .locator(story === "states" ? '[role="meter"]' : "[data-meter-bar]")
      .first()
      .waitFor();
    await page.evaluate(() => document.fonts.ready);
  }
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme, forcedColors: "none" });
    for (const width of [1040, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const story of [
        "compositions",
        "narrow",
        "right-to-left",
        "localized-right-to-left",
        "states",
        "tones-and-thicknesses",
      ]) {
        const name = `meter-${story}-${theme}-${width}`;
        await open(story, theme);
        const result = await page.evaluate(() => {
          const root = document.querySelector("#storybook-root");
          const meters = [...root.querySelectorAll('[role="meter"]')];
          const nestedSelector = '[role="meter"] [role="meter"]';
          const nestedMeters = root.querySelectorAll(nestedSelector).length;
          return {
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            nestedMeters,
            meters: meters.map((meter) => ({
              value: meter.getAttribute("aria-valuenow"),
              description: meter.getAttribute("aria-valuetext"),
              risk: meter.hasAttribute("data-assessment"),
              bars: meter.querySelectorAll("[data-meter-bar]").length,
            })),
            bars: [...root.querySelectorAll("[data-meter-bar]")].map((track) => {
              const fill = track.querySelector("[data-meter-fill]");
              const meter = track.closest('[role="meter"]');
              const trackBox = track.getBoundingClientRect();
              const fillBox = fill.getBoundingClientRect();
              const direction = window.getComputedStyle(track).direction;
              return {
                hidden: track.getAttribute("aria-hidden"),
                role: track.getAttribute("role"),
                height: trackBox.height,
                thickness: track.dataset.thickness,
                ratio: fillBox.width / trackBox.width,
                expected: meter
                  ? Number(meter.getAttribute("aria-valuenow")) /
                    Number(meter.getAttribute("aria-valuemax"))
                  : 0.72,
                direction,
                startDifference:
                  direction === "rtl"
                    ? trackBox.right - fillBox.right
                    : fillBox.left - trackBox.left,
                tone: track.dataset.tone,
                assessment: meter?.getAttribute("data-assessment"),
                outline: window.getComputedStyle(track).outlineStyle,
                adjustment: window.getComputedStyle(fill).forcedColorAdjust,
              };
            }),
          };
        });
        assert.ok(result.overflow <= 1, `${name}: overflow`);
        assert.equal(result.nestedMeters, 0, `${name}: no nested meters`);
        assert.equal(await page.getByRole("progressbar").count(), 0);
        const primitive = story === "tones-and-thicknesses";
        const states = story === "states";
        assert.equal(result.meters.length, primitive ? 0 : states ? 1 : 4);
        assert.equal(result.bars.length, primitive ? 12 : states ? 0 : 4);
        for (const bar of result.bars) {
          assert.equal(bar.hidden, "true");
          assert.equal(bar.role, null);
          assert.equal(bar.height, { sm: 4, md: 8, lg: 12 }[bar.thickness]);
          assert.ok(
            Math.abs(bar.ratio - bar.expected) <= 0.001,
            `${name}: exact geometry`,
          );
          const startsAtEdge = Math.abs(bar.startDifference) <= 0.1;
          assert.ok(startsAtEdge, `${name}: inline start`);
          if (story.endsWith("right-to-left")) assert.equal(bar.direction, "rtl");
          if (bar.assessment) {
            assert.equal(
              bar.tone,
              {
                low: "success",
                medium: "warning",
                high: "danger",
                unassessed: "neutral",
              }[bar.assessment],
            );
          }
        }
        for (const meter of result.meters) {
          assert.equal(meter.bars, states ? 0 : 1);
          assert.equal(meter.description.includes("%"), !meter.risk);
        }
        if (states) {
          assert.equal(await page.getByRole("status").count(), 2);
          assert.equal(
            await page.getByText("Not scored", { exact: true }).count(),
            2,
          );
          assert.equal(
            await page.getByText("No population", { exact: true }).count(),
            1,
          );
        }
        const expressions = await assertNumericOrder(page, name);
        await accessibility(name);
        await page
          .locator("#storybook-root")
          .screenshot({ path: resolve(output, `${name}.png`) });
        checks.push({ name, ...result, expressions });
      }
    }
  }
  await checkCompactRisk({ page, base, output, checks, accessibility });
  await page.emulateMedia({ forcedColors: "active" });
  await open("compositions", "light");
  const forced = await page.locator("[data-meter-bar]").evaluateAll((tracks) =>
    tracks.map((track) => ({
      outline: window.getComputedStyle(track).outlineStyle,
      adjustment: window.getComputedStyle(track.firstElementChild)
        .forcedColorAdjust,
    })),
  );
  assert.equal(forced.length, 4);
  for (const bar of forced) {
    assert.equal(bar.outline, "solid");
    assert.equal(bar.adjustment, "none");
  }
  await page
    .locator("#storybook-root")
    .screenshot({ path: resolve(output, "meter-forced-colors.png") });
  checks.push({ name: "meter-forced-colors", bars: forced });
}

// Measure glyph ranges: textContent and CSS direction alone miss reordered
// Arabic-Indic operands. These assertions inspect the actual rendered order.
async function assertNumericOrder(page, name) {
  const expressions = await page
    .locator("[data-proportion-counts], [data-risk-score-expression]")
    .evaluateAll((groups) =>
      groups.map((group) => {
        const walker = document.createTreeWalker(group, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let node,
          offset = 0;
        while ((node = walker.nextNode())) {
          nodes.push({ node, start: offset, end: offset + node.length });
          offset += node.length;
        }
        const text = group.textContent;
        const slash = text.indexOf("/");
        const box = (start, end) => {
          const first = nodes.find((entry) => entry.end > start);
          const last = nodes.find((entry) => entry.end >= end);
          const range = document.createRange();
          range.setStart(first.node, start - first.start);
          range.setEnd(last.node, end - last.start);
          const { left, right, top, bottom } = range.getBoundingClientRect();
          return { left, right, top, bottom };
        };
        return {
          text,
          numerator: box(0, slash),
          slash: box(slash, slash + 1),
          denominator: box(slash + 1, text.length),
        };
      }),
    );
  for (const expression of expressions) {
    assert.ok(
      expression.numerator.right <= expression.slash.left + 1,
      `${name}: numerator before slash (${expression.text})`,
    );
    assert.ok(
      expression.slash.right <= expression.denominator.left + 1,
      `${name}: denominator after slash (${expression.text})`,
    );
  }
  return expressions;
}

async function checkCompactRisk({ page, base, output, checks, accessibility }) {
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({
      colorScheme: theme,
      forcedColors: "none",
      media: "screen",
    });
    for (const width of [1040, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const name = `risk-compact-${theme}-${width}`;
      await page.goto(
        `${base}/iframe.html?id=components-riskscore--compact-assessments&viewMode=story&globals=colorScheme:${theme}`,
      );
      await page.getByRole("meter").first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const scores = await page
        .locator('[role="meter"][data-size="sm"]')
        .evaluateAll((meters) => {
          const darkScheme =
            window.getComputedStyle(meters[0]).colorScheme === "dark";
          const expectedTokens = {
            low: darkScheme ? "positive-500" : "positive-700",
            medium: darkScheme ? "warning-500" : "warning-800",
            high: darkScheme ? "negative-500" : "negative-600",
            unassessed: "neutral-900",
          };
          const rgb = (color) =>
            (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
          const luminance = (color) =>
            rgb(color)
              .map((channel) => {
                const value = channel / 255;
                return value <= 0.04045
                  ? value / 12.92
                  : ((value + 0.055) / 1.055) ** 2.4;
              })
              .reduce(
                (sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i],
                0,
              );
          return meters.map((meter) => {
            const valueSelector = "[data-risk-score-value]";
            const valueElement = meter.querySelector(valueSelector);
            const value = valueElement.firstElementChild;
            const selector = "[data-risk-score-expression]";
            const score = meter.querySelector(selector);
            const maximum = score.lastElementChild.firstElementChild;
            const probe = document.createElement("span");
            meter.append(probe);
            probe.style.color = `var(--ezui-color-${expectedTokens[meter.dataset.assessment]})`;
            const expected = window.getComputedStyle(probe).color;
            probe.style.color = "var(--ezui-color-neutral-600)";
            const neutral = window.getComputedStyle(probe).color;
            probe.remove();
            let ancestor = meter,
              background = "rgba(0, 0, 0, 0)";
            while (ancestor && background === "rgba(0, 0, 0, 0)") {
              background = window.getComputedStyle(ancestor).backgroundColor;
              ancestor = ancestor.parentElement;
            }
            if (background === "rgba(0, 0, 0, 0)")
              background = "rgb(255, 255, 255)";
            const color = window.getComputedStyle(value).color;
            const high = Math.max(luminance(color), luminance(background));
            const low = Math.min(luminance(color), luminance(background));
            const label = meter.querySelector("[data-risk-score-compact-label]");
            return {
              color,
              expected,
              maximum: window.getComputedStyle(maximum).color,
              neutral,
              contrast: (high + 0.05) / (low + 0.05),
              title: meter.title,
              description: meter.getAttribute("aria-valuetext"),
              hiddenLabel: window.getComputedStyle(label).display === "none",
              pillCount: meter.querySelectorAll('[class*="_pill_"]').length,
            };
          });
        });
      assert.equal(scores.length, 8);
      for (const score of scores) {
        assert.equal(
          score.color,
          score.expected,
          `${name}: supplied assessment color`,
        );
        assert.equal(score.maximum, score.neutral, `${name}: neutral scale`);
        assert.ok(
          score.contrast >= 4.5,
          `${name}: score text contrast ${score.contrast}`,
        );
        assert.equal(score.pillCount, 0, `${name}: no compact pill`);
        assert.equal(score.hiddenLabel, true);
        assert.ok(
          score.description.includes(score.title),
          `${name}: accessible assessment`,
        );
      }
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `${name}: overflow`,
      );
      await accessibility(name);
      const expressions = await assertNumericOrder(page, name);
      await page
        .locator("#storybook-root")
        .screenshot({ path: resolve(output, `${name}.png`) });
      checks.push({ name, scores, expressions });
    }
  }
  for (const mode of ["forced-colors", "print"]) {
    await page.emulateMedia({
      forcedColors: mode === "forced-colors" ? "active" : "none",
      media: mode === "print" ? "print" : "screen",
    });
    const labels = page.locator("[data-risk-score-compact-label]");
    assert.equal(await labels.count(), 8);
    for (const label of await labels.all())
      assert.equal(
        await label.isVisible(),
        true,
        `${mode}: text assessment fallback`,
      );
    await page
      .locator("#storybook-root")
      .screenshot({ path: resolve(output, `risk-compact-${mode}.png`) });
    checks.push({ name: `risk-compact-${mode}`, visibleAssessments: 8 });
  }
  await page.emulateMedia({ forcedColors: "none", media: "screen" });
}
