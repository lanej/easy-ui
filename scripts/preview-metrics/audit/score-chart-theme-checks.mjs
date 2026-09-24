import assert from "node:assert/strict";

export async function auditScoreChartThemes(driver, site, diagnostics) {
  const measurements = [];
  const read = () =>
    [...document.querySelectorAll("[data-score-chart]")].map((root) => {
      const svg = root.querySelector("svg");
      const curve = svg.querySelector('path[stroke-width="2.5"]');
      return {
        kind: root.dataset.scoreChart,
        instance: root
          .querySelector("[_echarts_instance_]")
          .getAttribute("_echarts_instance_"),
        line: getComputedStyle(curve).stroke,
        dot: getComputedStyle(
          root.querySelector("[data-score-chart-callout] > span"),
        ).backgroundColor,
        swatches: [...root.querySelectorAll("li [data-sentiment]")].map(
          (node) => getComputedStyle(node).backgroundColor,
        ),
        bands: [...svg.querySelectorAll('path[stroke-width="0"]')].map(
          (node) => getComputedStyle(node).fill,
        ),
        tableOpen: root.querySelector("details").open,
        data: root.querySelector("table").textContent,
      };
    });
  const snapshot = async (scheme, os, hidden = false) => {
    const dark =
      scheme === "dark" ||
      (scheme === "system" && os === "dark") ||
      (scheme === "inverted" && os === "light");
    await driver.wait(
      (dark) =>
        getComputedStyle(document.body).backgroundColor ===
        (dark ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)"),
      dark,
    );
    // Match actual SVG paint to the CSS legend, not just a changed option object.
    await driver.wait((source) => {
      const charts = (0, eval)(`(${source})`)();
      return (
        charts.length === 2 &&
        charts.every(
          (chart) =>
            chart.line === chart.dot &&
            chart.swatches.every((color, i) => chart.bands[i] === color),
        )
      );
    }, read.toString());
    const charts = await driver.evaluate(read);
    measurements.push({ name: "chart-theme", scheme, os, hidden, charts });
    return charts;
  };
  try {
    await driver.resize(1440, 1100);
    for (const scheme of ["system", "inverted", "light", "dark"]) {
      await driver.colorScheme("light");
      await driver.open(
        `${site}/score-composition.html?rich=1&scheme=${scheme}`,
      );
      if (scheme === "dark") await driver.click("#dark-theme");
      await driver.click('[data-score-id="ratio"] button');
      await driver.click('[data-score-id="international"] button');
      await driver.wait(
        () =>
          document.querySelectorAll(
            '[data-score-chart] [data-chart-state="ready"] svg',
          ).length === 2,
      );
      for (const kind of ["history", "response"]) {
        await driver.click(`[data-score-chart="${kind}"] summary`);
      }
      const initial = await snapshot(scheme, "light");
      const invariant = (charts) =>
        charts.map(({ kind, instance, data, tableOpen }) => ({
          kind,
          instance,
          data,
          tableOpen,
        }));
      for (const os of ["dark", "light"]) {
        await driver.colorScheme(os);
        const charts = await snapshot(scheme, os);
        assert.deepEqual(
          invariant(charts),
          invariant(initial),
          "Media changes preserve chart instances and open exact data",
        );
        for (const [i, chart] of charts.entries()) {
          const changes =
            os === "dark" && (scheme === "system" || scheme === "inverted");
          assert.equal(
            chart.line !== initial[i].line,
            changes,
            "Only automatic schemes follow OS changes",
          );
          assert.equal(
            JSON.stringify(chart.bands) !== JSON.stringify(initial[i].bands),
            changes,
          );
        }
      }
      const column = '[data-score-column="contributions"] > div > button';
      await driver.click(column);
      await driver.colorScheme("dark");
      // Re-read CSS while the contribution is hidden, then verify restoration.
      await snapshot(scheme, "dark", true);
      await driver.click(column);
      const restored = await snapshot(scheme, "dark");
      assert.deepEqual(
        invariant(restored),
        invariant(initial),
        "Hidden charts update without losing their instance or data",
      );
      await diagnostics(`score-chart-theme-${scheme}`);
    }
  } finally {
    await driver.colorScheme(null);
  }
  return {
    measurements,
    checks: [
      "system/inverted score-chart colors track OS changes in place, including hidden columns; explicit schemes retain their colors and exact data",
    ],
  };
}
