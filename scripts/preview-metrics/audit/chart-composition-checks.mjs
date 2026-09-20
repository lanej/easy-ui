import assert from "node:assert/strict";

/** Shared Chrome, Firefox and Safari assertions for the public Chart composition. */
export async function auditChartComposition(
  driver,
  site,
  outputDir,
  { scan, diagnostics },
) {
  const checks = [];
  const measurements = {};
  const state = (key) =>
    driver.evaluate(
      async (name) => window.__chartComposition.readState(name),
      key,
    );
  const ranges = (value) => value.zoom.map(({ start, end }) => [start, end]);
  for (const renderer of ["svg", "canvas"]) {
    await driver.open(`${site}/chart-composition.html?renderer=${renderer}`);
    await driver.wait(
      () =>
        document.querySelectorAll('[data-chart-state="ready"]').length === 3,
    );
    await driver.evaluate(() => document.fonts.ready.then(() => true));
    const external = await driver.evaluate(() => {
      const report = document.querySelector('[data-chart-case="independent"]');
      const surface = report.querySelector('[data-chart-state="ready"]');
      return {
        labelledBy: surface.getAttribute("aria-labelledby"),
        describedBy: surface.getAttribute("aria-describedby"),
        headings: report.querySelectorAll("h2").length,
        tables: report.querySelectorAll("table").length,
        disclosures: report.querySelectorAll("details").length,
        externalControls: report.querySelector("[data-external-chart-controls]")
          .textContent,
        plotHeight: surface.firstElementChild.getBoundingClientRect().height,
      };
    });
    assert.equal(external.labelledBy, "external-chart-title");
    assert.equal(
      external.describedBy,
      "external-chart-description external-chart-data",
    );
    assert.equal(external.headings, 1);
    assert.equal(external.tables, 1);
    assert.equal(external.disclosures, 0);
    assert.ok(external.externalControls.includes("Zoom in"));
    assert.equal(external.plotHeight, 240);
    await driver.key('[data-chart-case="independent"] tbody button', "Enter");
    await driver.wait(() =>
      document
        .querySelector("[data-chart-selection]")
        .textContent.includes("start"),
    );
    const initial = await state("independent");
    assert.deepEqual(ranges(initial), [
      [20, 80],
      [50, 100],
    ]);
    await driver.key("[data-external-chart-controls] button", "Enter");
    assert.deepEqual(ranges(await state("independent")), [
      [35, 65],
      [50, 100],
    ]);
    await driver.click("#chart-theme");
    await driver.wait(
      () =>
        document.querySelector("[data-chart-review-theme]").dataset
          .chartReviewTheme === "dark",
    );
    const themed = await state("independent");
    assert.equal(themed.engineId, initial.engineId);
    assert.deepEqual(ranges(themed), [
      [35, 65],
      [50, 100],
    ]);
    await driver.key("[data-external-chart-controls] button", "Enter");
    assert.deepEqual(ranges(await state("independent")), [
      [42.5, 57.5],
      [50, 100],
    ]);
    checks.push(
      `${renderer}: external heading/control/data composition`,
      `${renderer}: keyboard exact-row selection`,
      `${renderer}: scoped baseOption keyboard zoom`,
      `${renderer}: theme keeps engine and local zoom`,
    );

    await driver.key('[data-chart-case="pair-a"] button', "Enter");
    await driver.wait(
      () =>
        document.querySelector("[data-chart-requests]").dataset.zoomRequests ===
        "1",
    );
    assert.deepEqual(ranges(await state("pair-a")), [
      [25, 75],
      [50, 100],
    ]);
    assert.deepEqual(ranges(await state("pair-b")), [
      [25, 75],
      [50, 100],
    ]);
    await driver.click("#request-legend");
    await driver.wait(
      () =>
        document.querySelector("[data-chart-requests]").dataset
          .legendRequests === "1",
    );
    assert.equal((await state("pair-a")).selected.A, false);
    assert.equal((await state("pair-b")).selected.A, false);
    await driver.click("#chart-text");
    await driver.wait(
      () =>
        document.querySelector("[data-chart-review-size]").dataset
          .chartReviewSize === "large",
    );
    assert.equal((await state("independent")).typography.fontSize, 16);
    const controlSize = await driver.evaluate(() =>
      parseFloat(
        getComputedStyle(
          document.querySelector("[data-external-chart-controls] button"),
        ).fontSize,
      ),
    );
    assert.equal(controlSize, 18);
    const requests = await driver.evaluate(() => ({
      ...document.querySelector("[data-chart-requests]").dataset,
    }));
    assert.equal(requests.zoomRequests, "1");
    assert.equal(requests.legendRequests, "1");
    checks.push(
      `${renderer}: coordinated zoom and legends without feedback loops`,
      `${renderer}: typography reaches DOM and engine text`,
    );
    await scan(`chart-composition-${renderer}`);
    await driver.screenshot(`${outputDir}/chart-composition-${renderer}.png`);

    await driver.click("#show-retry");
    await driver.wait(() =>
      document.querySelector('[data-chart-case="retry"] [role="alert"]'),
    );
    const failure = await driver.evaluate(() => ({
      table: Boolean(document.querySelector('[data-chart-case="retry"] table')),
      errors: Number(
        document.querySelector("[data-chart-render-errors]").dataset
          .chartRenderErrors,
      ),
    }));
    assert.ok(
      failure.table,
      "Exact data remains available during engine failure",
    );
    assert.ok(
      failure.errors >= 1,
      "Engine initialization errors reach the application",
    );
    await driver.evaluate(() => window.__chartComposition.allowRetry());
    await driver.key('[data-chart-case="retry"] button', "Enter");
    await driver.wait(
      () =>
        document.querySelectorAll('[data-chart-state="ready"]').length === 4,
    );
    assert.equal(
      await driver.evaluate(() =>
        Boolean(
          document.querySelector('[data-chart-case="retry"] [role="alert"]'),
        ),
      ),
      false,
    );
    checks.push(`${renderer}: failed engine initialization recovers in place`);
    await scan(`chart-retry-${renderer}`);
    await diagnostics(`chart-composition-${renderer}`);
    measurements[renderer] = {
      external,
      controlSize,
      independent: await state("independent"),
      pairA: await state("pair-a"),
      pairB: await state("pair-b"),
      failure,
    };

    // Safari may enforce a wider native window. The fixture also constrains its
    // report to 320 CSS pixels so every browser exercises the same narrow layout.
    await driver.resize(320, 640);
    try {
      await driver.open(
        `${site}/chart-composition.html?renderer=${renderer}&large=1&stress=1`,
      );
      await driver.wait(
        () =>
          document.querySelectorAll('[data-chart-state="ready"]').length ===
            3 &&
          document.querySelector("[data-chart-review-size]").dataset
            .chartReviewSize === "large",
      );
      await driver.evaluate(() => document.fonts.ready.then(() => true));
      const mobile = await driver.evaluate(() => {
        const report = document.querySelector("[data-chart-review-stress]");
        const rect = report.getBoundingClientRect();
        const bounds = (element) => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, width: box.width };
        };
        const textSize = (selector) =>
          parseFloat(
            getComputedStyle(document.querySelector(selector)).fontSize,
          );
        const tableRegion = document.getElementById("external-chart-data");
        return {
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          documentClientWidth: document.documentElement.clientWidth,
          container: { left: rect.left, right: rect.right, width: rect.width },
          plots: Array.from(
            report.querySelectorAll('[data-chart-state="ready"] > div'),
            bounds,
          ),
          controls: Array.from(
            report.querySelectorAll("[data-external-chart-controls] button"),
            bounds,
          ),
          table: {
            ...bounds(tableRegion),
            clientWidth: tableRegion.clientWidth,
            scrollWidth: tableRegion.scrollWidth,
            keyboardFocusable: tableRegion.tabIndex === 0,
            overflowX: getComputedStyle(tableRegion).overflowX,
          },
          type: {
            title: textSize("#external-chart-title"),
            description: textSize("#external-chart-description"),
            control: textSize("[data-external-chart-controls] button"),
            detail: textSize("#external-chart-data table"),
          },
        };
      });
      assert.ok(mobile.container.width > 250 && mobile.container.width <= 320);
      assert.ok(
        mobile.documentWidth <= mobile.documentClientWidth + 1,
        `${renderer}: mobile report must not cause page-wide horizontal overflow`,
      );
      assert.equal(mobile.plots.length, 3);
      for (const box of [...mobile.plots, ...mobile.controls, mobile.table]) {
        assert.ok(box.width > 0);
        assert.ok(box.left >= mobile.container.left - 1);
        assert.ok(box.right <= mobile.container.right + 1);
      }
      assert.equal(mobile.table.keyboardFocusable, true);
      assert.equal(mobile.table.overflowX, "auto");
      assert.ok(
        mobile.table.scrollWidth > mobile.table.clientWidth,
        "The narrow exact table exercises its own horizontal scroll region",
      );
      assert.deepEqual(mobile.type, {
        title: 24,
        description: 18,
        control: 18,
        detail: 16,
      });
      assert.equal((await state("independent")).typography.fontSize, 16);
      await driver.key('[data-chart-case="independent"] tbody button', "Enter");
      await driver.wait(() =>
        document
          .querySelector("[data-chart-selection]")
          .textContent.includes("start"),
      );
      await driver.key("[data-external-chart-controls] button", "Enter");
      assert.deepEqual(ranges(await state("independent")), [
        [35, 65],
        [50, 100],
      ]);
      checks.push(
        `${renderer}: 320px report contains plots and wraps larger controls`,
        `${renderer}: larger typography reaches mobile headings, data, controls and engine`,
        `${renderer}: narrow exact table scrolls independently and supports keyboard selection`,
        `${renderer}: mobile external keyboard zoom preserves independent ranges`,
      );
      await scan(`chart-composition-mobile-large-${renderer}`);
      await driver.evaluate(() => window.scrollTo(0, 0));
      await driver.screenshot(
        `${outputDir}/chart-composition-mobile-large-${renderer}.png`,
      );
      await diagnostics(`chart-composition-mobile-large-${renderer}`);
      measurements[renderer].mobile = mobile;
    } finally {
      await driver.resize(1440, 1000);
    }
  }
  return { checks, measurements };
}
