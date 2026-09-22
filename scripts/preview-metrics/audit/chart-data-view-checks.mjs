import assert from "node:assert/strict";

export async function auditChartDataView(
  driver,
  site,
  outputDir,
  { scan, diagnostics },
) {
  await driver.resize(1440, 1000);
  await driver.open(`${site}/chart-data-view.html`);
  await driver.wait(() =>
    document.querySelector('[data-chart-state="ready"] svg'),
  );
  await driver.evaluate(() => document.fonts.ready.then(() => true));
  const folded = await driver.evaluate(() => ({
    open: document.querySelector("details").open,
    richCells: document.querySelectorAll("tbody strong").length,
    tables: document.querySelectorAll("table").length,
  }));
  assert.deepEqual(folded, { open: false, richCells: 0, tables: 1 });
  await scan("chart-data-folded");
  await driver.screenshot(`${outputDir}/chart-data-folded.png`);
  await driver.key("summary", "Enter");
  await driver.wait(
    () => document.querySelectorAll("tbody strong").length === 40,
  );
  const expanded = await driver.evaluate(() => ({
    rows: document.querySelectorAll("tbody tr").length,
    firstCost: document.querySelector("tbody tr td:nth-child(4)").textContent,
    numericAlignment: getComputedStyle(
      document.querySelector("tbody tr td:nth-child(3)"),
    ).textAlign,
    tableHeightLimit: getComputedStyle(
      document.querySelector("details [role=region]"),
    ).maxHeight,
    plot: Boolean(document.querySelector('[data-chart-state="ready"] svg')),
  }));
  assert.equal(expanded.rows, 40);
  assert.match(expanded.firstCost, /\$6\.60/);
  assert.match(expanded.firstCost, /−\$0\.25/);
  assert.match(expanded.firstCost, /vs August/);
  assert.equal(expanded.numericAlignment, "end");
  assert.equal(expanded.tableHeightLimit, "360px");
  assert.ok(expanded.plot, "The rich table belongs to the displayed chart");
  await scan("chart-data-expanded");
  await diagnostics("chart-data-expanded");
  await driver.screenshot(`${outputDir}/chart-data-expanded.png`);
  await driver.key("summary", "Enter");
  assert.equal(
    await driver.evaluate(() => document.querySelector("details").open),
    false,
  );
  assert.equal(
    await driver.evaluate(
      () => document.querySelectorAll("tbody strong").length,
    ),
    40,
    "Folding retains mounted rich content",
  );
  await driver.key("summary", "Enter");
  await driver.click('input[type="checkbox"]');
  await driver.resize(390, 844);
  const mobile = await driver.evaluate(() => ({
    viewportWidth: innerWidth,
    pageOverflow: document.documentElement.scrollWidth - innerWidth,
    fontSize: parseFloat(
      getComputedStyle(document.querySelector("tbody strong")).fontSize,
    ),
    tableOverflow:
      document.querySelector("details [role=region]").scrollWidth -
      document.querySelector("details [role=region]").clientWidth,
    contentFits: [...document.querySelectorAll("tbody td:nth-child(4)")].every(
      (cell) =>
        cell.firstElementChild.getBoundingClientRect().height <=
        cell.getBoundingClientRect().height,
    ),
  }));
  assert.ok(mobile.pageOverflow <= 1);
  assert.ok(mobile.fontSize >= 18);
  assert.ok(mobile.tableOverflow > 0);
  assert.ok(
    mobile.contentFits,
    "Rich content and large text grow native table rows",
  );
  await driver.key("details [role=region]", "ArrowRight");
  await driver.wait(
    () => document.querySelector("details [role=region]").scrollLeft > 0,
  );
  await scan("chart-data-mobile-large-text");
  await diagnostics("chart-data-mobile-large-text");
  await driver.screenshot(`${outputDir}/chart-data-mobile-large-text.png`);
  return {
    checks: [
      "folded-by-default chart data with deferred rich content",
      "formatted values and comparison badges in the existing table",
      "retained content across collapse",
      "numeric column layout and configurable height",
      "large-text table-local overflow and keyboard scrolling",
    ],
    measurements: { folded, expanded, mobile },
  };
}
