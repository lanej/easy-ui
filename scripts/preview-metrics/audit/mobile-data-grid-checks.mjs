import assert from "node:assert/strict";

export async function auditMobileDataGrid(
  driver,
  site,
  outputDir,
  { scan, diagnostics },
) {
  const measurements = [];
  const constrain = async (width) => {
    await driver.resize(width, 1100);
    await driver.evaluate((width) => {
      Object.assign(document.querySelector("main").style, {
        width: `${width}px`,
        maxWidth: "100%",
        boxSizing: "border-box",
        margin: "0",
      });
    }, width);
  };
  const measure = () => {
    const table = document.querySelector('[role="grid"]');
    const scroll = table.parentElement.parentElement;
    const cells = [...table.querySelectorAll("td")];
    const clipped = cells
      .filter((cell) => {
        const box = cell.getBoundingClientRect();
        // Measure text, excluding the intentional sticky-edge shadow.
        const walker = document.createTreeWalker(
          cell.firstElementChild,
          NodeFilter.SHOW_TEXT,
        );
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(walker.currentNode);
          const text = range.getBoundingClientRect();
          if (
            text.left < box.left - 1 ||
            text.right > box.right + 1 ||
            text.top < box.top - 1 ||
            text.bottom > box.bottom + 1
          )
            return true;
        }
        return false;
      })
      .map((cell) => cell.textContent);
    const labels = [
      ...table.querySelectorAll(
        '[role="rowheader"] > div > span > span:first-child',
      ),
    ].map((label) => {
      const range = document.createRange();
      range.selectNodeContents(label);
      return { text: label.textContent, lines: range.getClientRects().length };
    });
    return {
      containerWidth: document.querySelector("main").getBoundingClientRect()
        .width,
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
      tableOverflow: scroll.scrollWidth - scroll.clientWidth,
      columns: table.querySelectorAll('[role="columnheader"]').length,
      rows: table.querySelectorAll("tbody tr").length,
      clipped,
      labels,
      valueSize: parseFloat(
        getComputedStyle(table.querySelector("strong")).fontSize,
      ),
    };
  };
  await driver.open(`${site}/mobile-data-grid.html`);
  await driver.wait(() => document.querySelector('[role="grid"]'));
  await driver.evaluate(() => document.fonts.ready.then(() => true));
  for (const [width, large] of [
    [390, false],
    [320, false],
    [320, true],
    [768, true],
  ]) {
    await constrain(width);
    if (large && width === 320) await driver.click("#large-text");
    const bounds = await driver.evaluate(measure);
    assert.equal(bounds.containerWidth, width);
    assert.ok(bounds.pageOverflow <= 1);
    assert.ok(
      bounds.tableOverflow <= 1,
      "Focused metrics must fit without horizontal scrolling",
    );
    assert.equal(bounds.columns, 2);
    assert.equal(bounds.rows, 8);
    assert.deepEqual(
      bounds.clipped,
      [],
      "Cell contents must not overlap adjacent rows or columns",
    );
    assert.ok(
      bounds.labels.every((label) => label.lines === 1),
      "Zone labels must stay on one line",
    );
    assert.ok(bounds.valueSize >= (large ? 20 : 14));
    measurements.push({ width, large, ...bounds });
    await scan(`mobile-grid-${width}-${large ? "large" : "default"}`);
    await driver.screenshot(
      `${outputDir}/mobile-grid-${width}-${large ? "large" : "default"}.png`,
    );
  }
  await constrain(390);
  await driver.click("#large-text");
  // Exercise the actual React Aria selector with keyboard input, including the
  // smaller population for guaranteed SLA; do not mutate the React state.
  await driver.key('[aria-haspopup="listbox"]', "Enter");
  await driver.key('[role="option"][data-key="guaranteed"]', "Enter");
  assert.equal(
    await driver.evaluate(() => document.querySelector("tbody tr").textContent),
    "Zone 160 shipments98%+1.5 pts",
  );
  await driver.key('[data-mobile-grid] input[type="checkbox"]', "Space");
  const all = await driver.evaluate(measure);
  assert.equal(all.columns, 9);
  assert.equal(all.rows, 8);
  assert.ok(all.tableOverflow > 0);
  assert.ok(all.pageOverflow <= 1);
  assert.deepEqual(all.clipped, []);
  await scan("mobile-grid-all");
  for (let index = 1; index < 9; index++) {
    await driver.key(
      `tbody tr:first-child td:nth-child(${index})`,
      "ArrowRight",
    );
  }
  // React Aria scrolls the newly focused cell on the next animation frame.
  await driver.wait(() => {
    const table = document.querySelector('[role="grid"]');
    const frame = table.parentElement.parentElement.getBoundingClientRect();
    const focus = document.activeElement.getBoundingClientRect();
    return focus.right <= frame.right + 1;
  });
  const scrolled = await driver.evaluate(() => {
    const table = document.querySelector('[role="grid"]');
    const scroll = table.parentElement.parentElement;
    const first = table.querySelector("tbody tr td").getBoundingClientRect();
    const last = document.activeElement.getBoundingClientRect();
    const frame = scroll.getBoundingClientRect();
    return {
      scrollLeft: scroll.scrollLeft,
      zoneLeft: first.left,
      zoneRight: first.right,
      left: frame.left,
      right: frame.right,
      focusLeft: last.left,
      focusRight: last.right,
    };
  });
  assert.ok(
    scrolled.scrollLeft > 0,
    "Keyboard navigation must reach the final metric",
  );
  assert.ok(
    Math.abs(scrolled.zoneLeft - scrolled.left) <= 1,
    "The zone remains visible while scrolling",
  );
  assert.ok(
    scrolled.focusLeft >= scrolled.zoneRight - 1 &&
      scrolled.focusRight <= scrolled.right + 1,
  );
  measurements.push({ mode: "all", ...all, scrolled });
  await driver.screenshot(`${outputDir}/mobile-grid-scrolled.png`);
  await constrain(320);
  await driver.click("#large-text");
  const allLarge = await driver.evaluate(measure);
  assert.equal(allLarge.columns, 9);
  assert.ok(allLarge.pageOverflow <= 1);
  assert.deepEqual(allLarge.clipped, []);
  measurements.push({ mode: "all-large", ...allLarge });
  await scan("mobile-grid-all-large");
  await driver.key('[data-mobile-grid] input[type="checkbox"]', "Space");
  assert.equal(
    await driver.evaluate(() => document.querySelector("tbody tr").textContent),
    "Zone 160 shipments98%+1.5 pts",
    "Returning from all metrics preserves the selected metric and population",
  );
  await diagnostics("mobile-grid");

  await driver.open(`${site}/mobile-data-grid.html?expanded=1`);
  await driver.wait(() => document.querySelector('[role="grid"]'));
  await constrain(320);
  // Enter through the grid's row/cell navigation. Directly focusing a child
  // before the grid has a focused key can restore focus to the row instead.
  await driver.key("tbody tr:first-child", "ArrowRight");
  await driver.wait(
    () =>
      document.activeElement ===
      document.querySelector("tbody tr:first-child button"),
  );
  await driver.key("tbody tr:first-child button", "Enter");
  for (const large of [false, true]) {
    if (large) await driver.click("#large-text");
    await driver.wait(() => {
      const details = document.querySelector(
        "[data-ezui-data-grid-expanded-row-content]",
      );
      if (!details || getComputedStyle(details).opacity !== "1") return false;
      const contentBottom = Math.max(
        ...[...document.querySelectorAll("tbody tr:first-child td > div")].map(
          (node) => node.getBoundingClientRect().bottom,
        ),
      );
      return details.getBoundingClientRect().top >= contentBottom - 1;
    });
    const geometry = await driver.evaluate(() => {
      const contentBottom = Math.max(
        ...[...document.querySelectorAll("tbody tr:first-child td > div")].map(
          (node) => node.getBoundingClientRect().bottom,
        ),
      );
      const details = document
        .querySelector("[data-ezui-data-grid-expanded-row-content]")
        .getBoundingClientRect();
      const next = document
        .querySelector("tbody tr:nth-child(2)")
        .getBoundingClientRect();
      return {
        contentBottom,
        detailTop: details.top,
        detailBottom: details.bottom,
        nextTop: next.top,
      };
    });
    assert.ok(
      geometry.detailTop >= geometry.contentBottom - 1,
      "Details must follow the full height of wrapped cells",
    );
    assert.ok(
      geometry.nextTop >= geometry.detailBottom - 1,
      "Expanded details must not cover the following row",
    );
    measurements.push({ mode: "expanded", large, ...geometry });
  }
  await scan("mobile-grid-expanded");
  await driver.screenshot(`${outputDir}/mobile-grid-expanded.png`);
  await diagnostics("mobile-grid-expanded");
  return {
    measurements,
    checks: [
      "focused benchmark metric fits 320/390 px",
      "20 px values without clipping",
      "single-line zone labels and meaningful sample counts",
      "keyboard metric selection and full nine-column comparison",
      "sticky zone identity and keyboard horizontal navigation",
      "wrapped rich rows expand without overlapping details",
    ],
  };
}
