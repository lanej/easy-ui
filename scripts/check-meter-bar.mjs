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
      `${base}/iframe.html?id=components-meterbar--${story}&viewMode=story&globals=colorScheme:${theme}`,
    );
    await page
      .locator("#storybook-root")
      .getByText(
        story === "tones-and-thicknesses"
          ? "neutral: 72 / 100"
          : story === "states"
            ? "Unavailable share"
            : "Observed proportion",
        { exact: true },
      )
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
        "states",
        "tones-and-thicknesses",
      ]) {
        const name = `meter-${story}-${theme}-${width}`;
        await open(story, theme);
        const result = await page.evaluate(() => {
          const root = document.querySelector("#storybook-root");
          const meters = [...root.querySelectorAll('[role="meter"]')];
          return {
            overflow: document.documentElement.scrollWidth - innerWidth,
            nestedMeters: root.querySelectorAll('[role="meter"] [role="meter"]')
              .length,
            meters: meters.map((meter) => ({
              value: meter.getAttribute("aria-valuenow"),
              description: meter.getAttribute("aria-valuetext"),
              risk: meter.hasAttribute("data-assessment"),
              bars: meter.querySelectorAll("[data-meter-bar]").length,
            })),
            bars: [...root.querySelectorAll("[data-meter-bar]")].map(
              (track) => {
                const fill = track.querySelector("[data-meter-fill]");
                const meter = track.closest('[role="meter"]');
                const trackBox = track.getBoundingClientRect();
                const fillBox = fill.getBoundingClientRect();
                const direction = getComputedStyle(track).direction;
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
                  outline: getComputedStyle(track).outlineStyle,
                  adjustment: getComputedStyle(fill).forcedColorAdjust,
                };
              },
            ),
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
          assert.ok(
            Math.abs(bar.startDifference) <= 0.1,
            `${name}: inline start`,
          );
          if (story === "right-to-left") assert.equal(bar.direction, "rtl");
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
        await accessibility(name);
        await page
          .locator("#storybook-root")
          .screenshot({ path: resolve(output, `${name}.png`) });
        checks.push({ name, ...result });
      }
    }
  }
  await page.emulateMedia({ forcedColors: "active" });
  await open("compositions", "light");
  const forced = await page.locator("[data-meter-bar]").evaluateAll((tracks) =>
    tracks.map((track) => ({
      outline: getComputedStyle(track).outlineStyle,
      adjustment: getComputedStyle(track.firstElementChild).forcedColorAdjust,
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
