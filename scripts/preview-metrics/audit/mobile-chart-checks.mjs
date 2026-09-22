import assert from "node:assert/strict";

export async function auditMobileCharts(
  driver,
  site,
  outputDir,
  { scan, diagnostics },
) {
  const measurements = [];
  await driver.resize(390, 900);
  await driver.open(`${site}/mobile-charts.html`);
  await driver.wait(() =>
    document.querySelector('[aria-label="Chart series"] button'),
  );
  await driver.evaluate(() => document.fonts.ready.then(() => true));
  const legend = '[aria-label="Chart series"]';
  await driver.key(`${legend} button`, "Space");
  assert.equal(
    await driver.evaluate(
      async () =>
        (await window.__mobileChart()).legend[0].selected["Express Saver"],
    ),
    false,
  );
  await driver.key(`${legend} button`, "Space");
  for (const [width, large] of [
    [390, false],
    [320, false],
    [320, true],
    [768, true],
  ]) {
    await driver.resize(width, 1000);
    // Safari has a native window minimum; constrain the actual containing
    // block too, so all engines exercise the same available chart width.
    await driver.evaluate((width) => {
      Object.assign(document.querySelector("main").style, {
        width: `${width}px`,
        maxWidth: "100%",
        boxSizing: "border-box",
        margin: "0",
      });
    }, width);
    if (large && width === 320) await driver.click("#large-text");
    const tiers =
      large && width === 320
        ? ["1", "9+"]
        : ["1", "2", "3", "4", "5–6", "7–8", "9+"];
    // SVG dimensions can update before the resized axis labels are painted.
    // Wait for the same labels asserted below before sampling their geometry.
    await driver.wait((tiers) => {
      const plot = document.querySelector('[data-chart-state="ready"] > div');
      const labels = [...plot.querySelectorAll("svg text")].map(
        (node) => node.textContent,
      );
      return (
        Math.abs(
          plot.clientWidth -
            plot.querySelector("svg").getBoundingClientRect().width,
        ) < 1 && tiers.every((tier) => labels.includes(tier))
      );
    }, tiers);
    const bounds = await driver.evaluate(() => {
      const plot = document.querySelector('[data-chart-state="ready"] svg');
      const rect = plot.getBoundingClientRect();
      const list = document.querySelector('[aria-label="Chart series"]');
      const texts = [...plot.querySelectorAll("text")].map((node) => {
        const box = node.getBoundingClientRect();
        return {
          text: node.textContent,
          x: box.x,
          y: box.y,
          right: box.right,
          bottom: box.bottom,
          fontSize: parseFloat(getComputedStyle(node).fontSize),
        };
      });
      return {
        viewportWidth: innerWidth,
        containerWidth: document.querySelector("main").getBoundingClientRect()
          .width,
        overflow: document.documentElement.scrollWidth - innerWidth,
        legendGap: list.getBoundingClientRect().top - rect.bottom,
        targets: [...list.querySelectorAll("button")].map((button) => {
          const box = button.getBoundingClientRect();
          return {
            name: button.textContent,
            width: box.width,
            height: box.height,
            right: box.right,
          };
        }),
        texts,
        clipped: texts.filter(
          (text) =>
            text.x < rect.left - 1 ||
            text.right > rect.right + 1 ||
            text.y < rect.top - 1 ||
            text.bottom > rect.bottom + 1,
        ),
        folded: !document.querySelector("details").open,
      };
    });
    assert.ok(bounds.overflow <= 1, "The mobile chart must not widen the page");
    assert.equal(
      bounds.containerWidth,
      width,
      "Every browser must exercise the requested containing width",
    );
    assert.ok(
      bounds.legendGap >= 0,
      "Legend rows must sit outside the plot, including axis labels",
    );
    assert.equal(bounds.targets.length, 4);
    assert.ok(
      bounds.targets.every(
        (target) =>
          target.height >= 44 && target.width >= 44 && target.right <= width,
      ),
      "All four series retain usable touch targets",
    );
    assert.deepEqual(
      bounds.clipped,
      [],
      "Axis names and labels must stay inside the plot",
    );
    assert.ok(
      bounds.texts.every((text) => text.fontSize >= (large ? 16 : 12)),
      "Typography must not shrink to fit",
    );
    assert.ok(bounds.folded, "Exact data remains folded by default");
    for (const tier of tiers)
      assert.ok(
        bounds.texts.some((text) => text.text === tier),
        `Tier ${tier} remains visible at ${width}px`,
      );
    const categoryLabels = bounds.texts
      .filter((text) =>
        ["1", "2", "3", "4", "5–6", "7–8", "9+"].includes(text.text),
      )
      .sort((a, b) => a.x - b.x);
    assert.ok(
      categoryLabels.every(
        (text, index) =>
          index === 0 || text.x >= categoryLabels[index - 1].right,
      ),
      "Large text may thin ticks, but must not overlap category labels",
    );
    measurements.push({ width, large, ...bounds });
    await scan(`mobile-chart-${width}-${large ? "large" : "default"}`);
    await driver.screenshot(
      `${outputDir}/mobile-chart-${width}-${large ? "large" : "default"}.png`,
    );
  }
  await driver.key(`${legend} button`, "Enter");
  await driver.resize(390, 1000);
  await driver.click("#dark-theme");
  assert.equal(
    await driver.evaluate(() =>
      document
        .querySelector('[aria-label="Chart series"] button')
        .getAttribute("aria-pressed"),
    ),
    "false",
  );
  await scan("mobile-chart-dark");
  await driver.key("summary", "Enter");
  assert.equal(
    await driver.evaluate(() => document.querySelectorAll("tbody tr").length),
    28,
  );
  await diagnostics("mobile-chart");
  await driver.open(`${site}/mobile-charts.html?renderer=canvas`);
  await driver.wait(() =>
    document.querySelector('[data-chart-state="ready"] canvas'),
  );
  await driver.key(`${legend} button`, "Enter");
  assert.equal(
    await driver.evaluate(
      async () =>
        (await window.__mobileChart()).legend[0].selected["Express Saver"],
    ),
    false,
  );
  await scan("mobile-chart-canvas");
  await diagnostics("mobile-chart-canvas");
  return {
    measurements,
    checks: [
      "mobile legend never overlaps axes",
      "320/390 px and larger typography",
      "readable category ticks and all four series keys",
      "44 px keyboard/touch legend controls",
      "legend state survives theme changes",
      "same legend with SVG and canvas",
      "folded exact-data table retains all 28 values",
    ],
  };
}
