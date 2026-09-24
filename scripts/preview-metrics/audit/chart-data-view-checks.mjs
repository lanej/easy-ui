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
    firstCost: document.querySelector("tbody tr td:nth-child(2)").textContent,
    firstChange: document.querySelector("tbody tr td:nth-child(3)").textContent,
    comparisonHeading: document.querySelector("thead th:nth-child(3)")
      .textContent,
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
  assert.match(expanded.firstChange, /−\$0\.25/);
  assert.match(expanded.comparisonHeading, /Change vs August/);
  assert.doesNotMatch(expanded.firstChange, /August/);
  assert.equal(expanded.numericAlignment, "end");
  assert.equal(expanded.tableHeightLimit, "360px");
  assert.ok(expanded.plot, "The rich table belongs to the displayed chart");
  await driver.key("thead th:nth-child(2) button", "Enter");
  await driver.wait(
    () =>
      document
        .querySelector("thead th:nth-child(2)")
        .getAttribute("aria-sort") === "ascending",
  );
  assert.equal(
    await driver.evaluate(
      () => document.querySelector("tbody strong").textContent,
    ),
    "$6.60",
  );
  await driver.key("thead th:nth-child(2) button", "Enter");
  await driver.wait(
    () => document.querySelector("tbody strong").textContent === "$19.20",
  );
  assert.match(
    await driver.evaluate(() => document.querySelector("tbody td").textContent),
    /InternationalZone 8/,
  );
  await driver.key("thead th:nth-child(2) button", "Enter");
  assert.equal(
    await driver.evaluate(() =>
      document.querySelector("thead th:nth-child(2)").getAttribute("aria-sort"),
    ),
    null,
  );
  assert.equal(
    await driver.evaluate(
      () => document.querySelector("tbody strong").textContent,
    ),
    "$6.60",
  );

  await driver.evaluate(() => {
    document.querySelector("details [role=region]").scrollTop = 180;
  });
  await driver.wait(() => {
    const container = document
      .querySelector("details [role=region]")
      .getBoundingClientRect();
    const heading = document
      .querySelector("thead th:nth-child(2)")
      .getBoundingClientRect();
    return Math.abs(heading.top - container.top) < 1;
  });
  await driver.evaluate(() => {
    document.querySelector("details [role=region]").scrollTop = 0;
  });
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
    contentFits: [...document.querySelectorAll("tbody td:nth-child(3)")].every(
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
  // Finish the browser's animated arrow-key scroll before assigning the next
  // scenario's position; otherwise that pending motion offsets the focus check.
  await driver.evaluate(
    () =>
      new Promise((resolve) => {
        const scroll = document.querySelector("details [role=region]");
        let previous = scroll.scrollLeft;
        let stableFrames = 0;
        const settled = () => {
          stableFrames = scroll.scrollLeft === previous ? stableFrames + 1 : 0;
          previous = scroll.scrollLeft;
          if (stableFrames === 4) resolve(true);
          else requestAnimationFrame(settled);
        };
        requestAnimationFrame(settled);
      }),
  );
  await driver.evaluate(() => {
    const scroll = document.querySelector("details [role=region]");
    scroll.scrollLeft = scroll.scrollWidth;
    scroll.scrollTop = 180;
  });
  await driver.wait(() => {
    const scroll = document.querySelector("details [role=region]");
    const bounds = scroll.getBoundingClientRect();
    const heading = document.querySelector("thead th").getBoundingClientRect();
    const identity = document.querySelector("tbody td").getBoundingClientRect();
    return (
      Math.abs(heading.top - bounds.top) < 1 &&
      Math.abs(identity.left - bounds.left) < 1
    );
  });
  const pinned = await driver.evaluate(() => {
    const scroll = document.querySelector("details [role=region]");
    const cell = document.querySelector("tbody td");
    return {
      position: getComputedStyle(cell).position,
      width: cell.getBoundingClientRect().width,
      viewportWidth: scroll.clientWidth,
      identity: cell.textContent,
    };
  });
  assert.equal(pinned.position, "sticky");
  assert.ok(pinned.width <= pinned.viewportWidth / 2);
  assert.match(pinned.identity, /NortheastZone 1/);
  await driver.key("thead th:nth-child(3) button", "Enter");
  await driver.wait(() => {
    const scroll = document.querySelector("details [role=region]");
    const button = document
      .querySelector("thead th:nth-child(3) button")
      .getBoundingClientRect();
    const identity = document.querySelector("thead th").getBoundingClientRect();
    const right = scroll.getBoundingClientRect().left + scroll.clientWidth;
    return button.left >= identity.right && button.right <= right + 1;
  });
  await scan("chart-data-mobile-large-text");
  await diagnostics("chart-data-mobile-large-text");
  const focused = await driver.evaluate(() => {
    const scroll = document.querySelector("details [role=region]");
    const button = document
      .querySelector("thead th:nth-child(3) button")
      .getBoundingClientRect();
    const identity = document.querySelector("thead th").getBoundingClientRect();
    return {
      left: button.left,
      right: button.right,
      start: identity.right,
      end: scroll.getBoundingClientRect().left + scroll.clientWidth,
    };
  });
  assert.ok(
    focused.left >= focused.start && focused.right <= focused.end + 1,
    JSON.stringify(focused),
  );
  await driver.screenshot(`${outputDir}/chart-data-mobile-large-text.png`);

  // Logical pin offsets retain the same identity at the inline start in RTL.
  await driver.evaluate(() => {
    document.documentElement.dir = "rtl";
    const scroll = document.querySelector("details [role=region]");
    scroll.scrollLeft = -scroll.scrollWidth;
  });
  await driver.wait(() => {
    const scroll = document.querySelector("details [role=region]");
    const identity = document.querySelector("tbody td").getBoundingClientRect();
    // The RTL scrollbar is on the left. Safari's native scrollbar is not
    // consistently included in clientLeft, so measure the right padding edge.
    const right =
      scroll.getBoundingClientRect().right -
      parseFloat(getComputedStyle(scroll).borderRightWidth);
    return Math.abs(identity.right - right) < 1;
  });
  const rtl = await driver.evaluate(() => {
    const scroll = document.querySelector("details [role=region]");
    return {
      identityRight: document.querySelector("tbody td").getBoundingClientRect()
        .right,
      scrollRight: scroll.getBoundingClientRect().right,
      clientLeft: scroll.clientLeft,
      clientWidth: scroll.clientWidth,
    };
  });
  await driver.evaluate(() => {
    document.documentElement.dir = "ltr";
  });
  await driver.resize(320, 844);
  await driver.wait(() => {
    const scroll = document.querySelector("details [role=region]");
    const cell = document.querySelector("tbody td");
    return (
      getComputedStyle(cell).position !== "sticky" ||
      cell.getBoundingClientRect().width <= scroll.clientWidth / 2
    );
  });
  assert.ok(
    await driver.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await driver.key("thead th:nth-child(3) button", "Enter");
  await driver.wait(() => {
    const scroll = document.querySelector("details [role=region]");
    const heading = document.querySelector("thead th");
    const button = document
      .querySelector("thead th:nth-child(3) button")
      .getBoundingClientRect();
    const bounds = scroll.getBoundingClientRect();
    const start =
      getComputedStyle(heading).insetInlineStart !== "auto"
        ? heading.getBoundingClientRect().right
        : bounds.left + scroll.clientLeft;
    return (
      button.left >= start - 1 &&
      button.right <= bounds.left + scroll.clientLeft + scroll.clientWidth + 1
    );
  });
  return {
    checks: [
      "folded-by-default chart data with deferred rich content",
      "formatted values and comparison badges in the existing table",
      "retained content across collapse",
      "numeric column layout and configurable height",
      "large-text table-local overflow and keyboard scrolling",
      "keyboard numeric sorting and restoration of application order",
      "sticky headings and complete pinned row identity during scrolling",
      "focused sort controls remain visible beside pinned columns",
      "logical RTL pinning and space reserved for data in narrow layouts",
    ],
    measurements: { folded, expanded, mobile, pinned, focused, rtl },
  };
}
