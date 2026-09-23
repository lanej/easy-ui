import assert from "node:assert/strict";

// Exercise the copyable Chart recipe through the same Chrome, Firefox, and
// native Safari transport as the score primitives. No private engine API.
export async function auditScoreCharts(
  driver,
  site,
  outputDir,
  { scan, diagnostics, endpoints },
) {
  const measurements = [];
  await driver.resize(1440, 1100);
  await driver.open(`${site}/score-composition.html?rich=1`);
  const signal = '[data-score-id="ratio"] button';
  const contribution = '[data-score-id="international"] button';
  const column = '[data-score-column="contributions"] > div > button';
  const ready = () =>
    driver.wait(
      () =>
        document.querySelectorAll(
          '[data-score-chart] [data-chart-state="ready"] svg',
        ).length === 2,
    );
  assert.equal(
    await driver.evaluate(
      () => document.querySelectorAll("[data-score-chart]").length,
    ),
    0,
    "Closed details do not mount the charts",
  );
  assert.equal(
    await driver.evaluate(() =>
      document
        .querySelector('[data-score-id="international"] [role="meter"]')
        .getAttribute("aria-valuenow"),
    ),
    "1",
  );
  await driver.key(signal, "Enter");
  await driver.key(contribution, "Space");
  await ready();
  await driver.evaluate(() => document.fonts.ready.then(() => true));

  const geometry = async (name, refreshed = false) => {
    // ResizeObserver updates the SVG viewport before zrender paints its labels.
    // Wait for both geometry and paint to settle, including column restoration.
    await driver.wait(() =>
      [
        ...document.querySelectorAll(
          '[data-score-chart] [data-chart-state="ready"]',
        ),
      ].every((node) => {
        const svg = node.querySelector("svg");
        const box = svg.getBoundingClientRect();
        return (
          Math.abs(node.getBoundingClientRect().width - box.width) < 1 &&
          [...svg.querySelectorAll("text")].every((text) => {
            const r = text.getBoundingClientRect();
            return (
              !r.width ||
              !r.height ||
              (r.left >= box.left - 1 &&
                r.right <= box.right + 1 &&
                r.top >= box.top - 1 &&
                r.bottom <= box.bottom + 1)
            );
          })
        );
      }),
    );
    const charts = await driver.evaluate(
      (refreshed) =>
        [...document.querySelectorAll("[data-score-chart]")].map((root) => {
          const kind = root.dataset.scoreChart;
          const svg = root.querySelector("svg");
          const box = svg.getBoundingClientRect();
          const curve = svg.querySelector('path[stroke-width="2.5"]');
          // Firefox includes stroke in client bounds; select by fill and
          // compare the center in screen space instead of assuming a width.
          const marker = [...svg.querySelectorAll("path")].find(
            (path) =>
              getComputedStyle(path).fill === getComputedStyle(curve).stroke,
          );
          const mark = marker.getBoundingClientRect();
          const center = {
            x: mark.left + mark.width / 2,
            y: mark.top + mark.height / 2,
          };
          const swatches = [
            ...root.querySelectorAll("li [data-sentiment]"),
          ].map((node) => getComputedStyle(node).backgroundColor);
          const bands = swatches.map((color) =>
            [...svg.querySelectorAll("path")].find(
              (path) =>
                getComputedStyle(path).fill === color &&
                path.getBoundingClientRect().width > 0,
            ),
          );
          const regions = bands.map((path) => path.getBoundingClientRect());
          const plot = {
            left: Math.min(...regions.map((r) => r.left)),
            right: Math.max(...regions.map((r) => r.right)),
            top: Math.min(...regions.map((r) => r.top)),
            bottom: Math.max(...regions.map((r) => r.bottom)),
          };
          const ratio = refreshed ? 0 : 0.26;
          const expected = {
            x:
              kind === "response"
                ? plot.left + ((plot.right - plot.left) * ratio) / 0.5
                : plot.right,
            y:
              plot.bottom -
              (plot.bottom - plot.top) *
                (kind === "response" ? (refreshed ? 0 : 0.5) : ratio / 0.5),
          };
          let distance = Infinity;
          for (let i = 0; i <= 1000; i++) {
            const p = curve.getPointAtLength(
              (curve.getTotalLength() * i) / 1000,
            );
            const point = svg.createSVGPoint();
            point.x = p.x;
            point.y = p.y;
            const screen = point.matrixTransform(curve.getScreenCTM());
            distance = Math.min(
              distance,
              Math.hypot(screen.x - center.x, screen.y - center.y),
            );
          }
          const clipped = [...svg.querySelectorAll("text")]
            .filter((node) => {
              const r = node.getBoundingClientRect();
              return (
                r.width &&
                r.height &&
                (r.left < box.left - 1 ||
                  r.right > box.right + 1 ||
                  r.top < box.top - 1 ||
                  r.bottom > box.bottom + 1)
              );
            })
            .map((node) => node.textContent);
          return {
            kind,
            callout: root.querySelector("[data-score-chart-callout]")
              .textContent,
            distance,
            pointError: Math.hypot(
              center.x - expected.x,
              center.y - expected.y,
            ),
            bands: regions.map((r) =>
              kind === "response"
                ? [
                    (r.left - plot.left) / (plot.right - plot.left),
                    (r.right - plot.left) / (plot.right - plot.left),
                  ]
                : [
                    (plot.bottom - r.bottom) / (plot.bottom - plot.top),
                    (plot.bottom - r.top) / (plot.bottom - plot.top),
                  ],
            ),
            colors: swatches,
            curveColor: getComputedStyle(curve).stroke,
            clipped,
            overflow: root.scrollWidth - root.clientWidth,
            targets: [...root.querySelectorAll("summary")].map(
              (node) => node.getBoundingClientRect().height,
            ),
          };
        }),
      refreshed,
    );
    assert.equal(charts.length, 2);
    for (const chart of charts) {
      assert.ok(
        chart.distance < 1,
        "Observation marker must lie on the rendered curve",
      );
      assert.ok(
        chart.pointError < 1,
        "Observation must be at its exact numeric coordinate",
      );
      assert.deepEqual(chart.clipped, [], "Chart labels fit their SVG");
      assert.ok(chart.overflow <= 1, "Rich content must stay inside its card");
      assert.ok(chart.targets.every((height) => height >= 44));
      assert.equal(new Set(chart.colors).size, 3);
      for (const [i, band] of chart.bands.entries()) {
        assert.ok(Math.abs(band[0] - [0, 0.3, 0.7][i]) < 0.01);
        assert.ok(Math.abs(band[1] - [0.3, 0.7, 1][i]) < 0.01);
      }
      assert.match(chart.callout, refreshed ? /0%.*Low/ : /26%.*Elevated/);
    }
    assert.ok(
      await driver.evaluate(
        () => document.documentElement.scrollWidth - innerWidth <= 1,
      ),
    );
    measurements.push({ name, charts });
  };
  await geometry("rich-desktop");
  await endpoints("rich-connectors");
  await scan("score-rich-desktop");
  await driver.hover("h1");
  await driver.screenshot(`${outputDir}/score-rich-desktop.png`);
  const table = '[data-score-chart="response"] summary';
  await driver.key(table, "Enter");
  assert.match(
    await driver.evaluate(
      () =>
        document.querySelector('[data-score-chart="response"] table')
          .textContent,
    ),
    /26%1\.00/,
  );
  const instance = await driver.evaluate(() =>
    document
      .querySelector('[data-score-chart="response"] [_echarts_instance_]')
      .getAttribute("_echarts_instance_"),
  );
  await driver.key(column, "Enter");
  assert.equal(
    await driver.evaluate(
      () =>
        document
          .querySelector('[data-score-chart="response"]')
          .getBoundingClientRect().width,
    ),
    0,
  );
  await driver.key(column, "Enter");
  await ready();
  assert.equal(
    await driver.evaluate(() =>
      document
        .querySelector('[data-score-chart="response"] [_echarts_instance_]')
        .getAttribute("_echarts_instance_"),
    ),
    instance,
    "Column collapse preserves the chart instance",
  );
  assert.equal(
    await driver.evaluate(
      () =>
        document.querySelector('[data-score-chart="response"] details').open,
    ),
    true,
  );
  await geometry("rich-column-restored");
  await driver.click("#refresh-data");
  await geometry("rich-refreshed", true);
  assert.match(
    await driver.evaluate(
      () =>
        document.querySelector('[data-score-chart="response"] table')
          .textContent,
    ),
    /0%0\.00/,
  );
  await driver.key(contribution, "Enter");
  assert.equal(
    await driver.evaluate(
      () => document.querySelectorAll('[data-score-chart="response"]').length,
    ),
    0,
  );
  assert.equal(
    await driver.evaluate(() =>
      document
        .querySelector('[data-score-id="international"] [role="meter"]')
        .getAttribute("aria-valuenow"),
    ),
    "0",
  );
  await driver.key(contribution, "Enter");
  await ready();
  await geometry("rich-remounted", true);
  await driver.click("#refresh-data");
  await driver.click("#rtl-layout");
  await geometry("rich-rtl");
  await endpoints("rich-rtl-connectors");
  await driver.click("#rtl-layout");
  await driver.click("#dark-theme");
  await driver.wait(
    () =>
      getComputedStyle(
        document.querySelector(
          '[data-score-chart="response"] path[stroke-width="2.5"]',
        ),
      ).stroke ===
      getComputedStyle(
        document.querySelector("[data-score-chart-callout] > span"),
      ).backgroundColor,
  );
  await geometry("rich-dark");
  await scan("score-rich-dark");
  await driver.screenshot(`${outputDir}/score-rich-dark.png`);
  await driver.click("#dark-theme");
  for (const width of [390, 320]) {
    await driver.resize(width, 1100);
    await driver.evaluate((width) => {
      document.querySelector("main").style.width = `${width}px`;
    }, width);
    if (width === 320) await driver.click("#large-text");
    await geometry(`rich-${width}`);
    await driver.key(table, "Space");
    assert.equal(
      await driver.evaluate(
        () =>
          document.querySelector('[data-score-chart="response"] details').open,
      ),
      true,
    );
    await geometry(`rich-${width}-exact-data`);
    await scan(`score-rich-${width}`);
    await driver.screenshot(`${outputDir}/score-rich-${width}.png`);
    await driver.key(table, "Enter");
  }
  await diagnostics("score-chart-details");
  return {
    measurements,
    checks: [
      "rich signal and contribution details mount on demand, retain compact meters, and preserve chart/table state across column collapse",
      "rendered observation markers sit on supplied curves at exact coordinates with correctly bounded threshold bands",
      "rich charts update with observations and retain readable labels, exact-data keyboard access, touch targets, and contained layouts across dark, RTL, mobile, and large text",
    ],
  };
}
