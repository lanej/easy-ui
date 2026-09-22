/** Real pointer and keyboard checks against a local, deterministic WebGL surface. */
export async function checkSurfaceInspection({
  browser,
  base,
  check,
  settle,
  capture,
  scan,
  clean,
}) {
  const selector = '[aria-label="Delivery cell details"]';
  const isOpen = () =>
    Boolean(document.querySelector('[aria-label="Delivery cell details"]'));
  async function point(index = 0) {
    // The DOM idle marker can still describe the frame before a resize. Wait
    // for the actual canvas and engine before projecting a pointer coordinate.
    await browser.wait(() => {
      const map = window.__mapRegression.map;
      const canvas = map.getCanvas();
      const viewport = map.getContainer();
      const ratio = map.getPixelRatio();
      return (
        Math.abs(canvas.width - viewport.clientWidth * ratio) <= 1 &&
        Math.abs(canvas.height - viewport.clientHeight * ratio) <= 1 &&
        map.loaded()
      );
    });
    return browser.evaluate((index) => {
      const { map, cells } = window.__mapRegression;
      const canvas = map.getCanvas();
      canvas.scrollIntoView({ block: "center" });
      const box = canvas.getBoundingClientRect();
      const point = map.project(cells[index].center);
      return { x: box.left + point.x, y: box.top + point.y };
    }, index);
  }
  const contained = () => {
    const viewport = document
      .querySelector("[data-map-state]")
      .getBoundingClientRect();
    const card = document
      .querySelector('[aria-label="Delivery cell details"]')
      .getBoundingClientRect();
    return (
      card.left >= viewport.left &&
      card.right <= viewport.right &&
      card.top >= viewport.top &&
      card.bottom <= viewport.bottom - 40 &&
      document.documentElement.scrollWidth <= window.innerWidth
    );
  };
  await browser.resize(1440, 1100);
  await browser.open(`${base}/regressions.html?inspection=1`);
  await settle();
  let target = await point();
  await browser.move(target.x, target.y);
  await browser.wait(isOpen);
  check(
    "hover shows supplied asymmetric quartiles and exact spread",
    await browser.evaluate(() => {
      const text = document.querySelector(
        '[aria-label="Delivery cell details"]',
      ).textContent;
      return (
        text.includes("20 min–50 min") &&
        text.includes("120 min") &&
        text.includes("Observations80")
      );
    }),
  );
  const inside = await browser.evaluate(() => {
    const box = document
      .querySelector('[aria-label="Delivery cell details"]')
      .getBoundingClientRect();
    return { x: box.left + 12, y: box.top + 12 };
  });
  await browser.move(inside.x, inside.y);
  await browser.evaluate(
    () => new Promise((resolve) => setTimeout(resolve, 250)),
  );
  check(
    "hover card remains open while the pointer reads its content",
    await browser.evaluate(isOpen),
  );
  await browser.clickNamed("button", "Keep open");
  await browser.move(2, 2);
  check(
    "pinned card survives pointer exit and stays inside the map",
    await browser.evaluate(contained),
  );
  await capture("cell-inspection-desktop");
  await scan("cell-inspection-desktop");
  await browser.key(
    `${selector} button[aria-label="Close cell details"]`,
    "Escape",
  );
  check("Escape dismisses the inspector", !(await browser.evaluate(isOpen)));
  target = await point();
  await browser.clickPoint(target.x, target.y);
  await browser.wait(() =>
    document
      .querySelector('[aria-label="Delivery cell details"]')
      ?.textContent.includes("Selected cell"),
  );
  check("click pins a cell without a separate hover action", true);
  await browser.clickNamed("button", "Toggle surface visibility");
  check(
    "hidden layers leave no floating cell card",
    !(await browser.evaluate(isOpen)),
  );
  await browser.clickNamed("button", "Toggle surface visibility");
  await browser.clickNamed("button", "Toggle large text");
  await browser.resize(390, 850);
  await settle();
  target = await point();
  await browser.move(target.x, target.y);
  await browser.wait(isOpen);
  await browser.clickNamed("button", "Keep open");
  await browser.wait(contained);
  check(
    "large-text mobile inspector remains contained above attribution",
    await browser.evaluate(contained),
  );
  check(
    "large text reaches native chart labels",
    await browser.evaluate(() => {
      const plot = document.querySelector(
        '[aria-label="Delivery cell details"] figure',
      );
      return parseFloat(getComputedStyle(plot).fontSize) >= 16;
    }),
  );
  await capture("cell-inspection-mobile");
  await scan("cell-inspection-mobile");
  await browser.clickNamed("button", "Close cell details");
  await browser.clickNamed("button", "Toggle surface visibility");
  await browser.key("[data-map-state] ~ details > summary", "Enter");
  await browser.key("td details > summary", "Enter");
  await browser.wait(() =>
    Boolean(document.querySelector("td details[open] figure")),
  );
  check(
    "keyboard data-table inspection exposes the same supplied chart",
    await browser.evaluate(() =>
      document
        .querySelector("td details[open]")
        .textContent.includes("20 min–50 min"),
    ),
  );
  await clean("cell-inspection");

  await browser.resize(1440, 1100);
  await browser.open(`${base}/regressions.html?inspection=1&charts=1`);
  await settle();
  const chartEngineUrl = await browser.evaluate(async () => {
    const url = new URL("bundle-report.json", location.href);
    const report = await (await fetch(url)).json();
    return new URL(report.customInspectorChartEngine.entry, url).href;
  });
  check(
    "custom charts stay unmounted until inspection",
    await browser.evaluate(
      (engineUrl) =>
        !document.querySelector("[data-chart-state]") &&
        !performance
          .getEntriesByType("resource")
          .some((entry) => entry.name === engineUrl),
      chartEngineUrl,
    ),
  );
  target = await point();
  await browser.move(target.x, target.y);
  await browser.wait(() =>
    document.querySelector(
      '[aria-label="Delivery cell details"] [data-chart-state="ready"] svg',
    ),
  );
  check(
    "the optional chart engine loads with its first mounted chart",
    await browser.evaluate(
      (engineUrl) =>
        performance
          .getEntriesByType("resource")
          .some((entry) => entry.name === engineUrl),
      chartEngineUrl,
    ),
  );
  await browser.evaluate(() =>
    document
      .querySelector('[aria-label="Delivery cell details"] select')
      .focus(),
  );
  check(
    "focusing a chart control pins the inspector and retains focus",
    await browser.evaluate(
      () =>
        document.activeElement.matches(
          '[aria-label="Delivery cell details"] select',
        ) &&
        document
          .querySelector('[aria-label="Delivery cell details"]')
          .textContent.includes("Selected cell"),
    ),
  );
  await browser.key(`${selector} section details > summary`, "Enter");
  check(
    "histogram preserves zero bins, boundary observations and exact counts",
    await browser.evaluate(() => {
      const rows = [
        ...document.querySelectorAll(
          '[aria-label="Delivery cell details"] tbody tr',
        ),
      ];
      return (
        rows.length === 6 &&
        rows.reduce((sum, row) => sum + Number(row.cells[1].textContent), 0) ===
          80 &&
        rows[2].cells[1].textContent === "43" &&
        rows[3].cells[1].textContent === "0" &&
        rows[5].cells[0].textContent.includes("inclusive") &&
        rows[5].cells[1].textContent === "6"
      );
    }),
  );
  await capture("cell-histogram-desktop");
  await scan("cell-histogram-desktop");
  await browser.select(`${selector} select`, "density");
  await browser.wait(() =>
    document.querySelector(
      '[aria-label="Delivery cell details"] [data-chart-state="ready"] svg',
    ),
  );
  check(
    "density is labeled as an estimate from supplied observations",
    await browser.evaluate(() => {
      const text = document.querySelector(
        '[aria-label="Delivery cell details"]',
      ).textContent;
      return (
        text.includes("Density estimate") &&
        text.includes("bandwidth: 12 minutes") &&
        text.includes("density, not counts")
      );
    }),
  );
  await capture("cell-density-desktop");
  await scan("cell-density-desktop");
  await browser.select(`${selector} select`, "history");
  await browser.wait(() =>
    document.querySelector('[aria-label="Delivery cell details"] figure'),
  );
  check(
    "the same inspector hosts an independent native time series",
    await browser.evaluate(
      () =>
        document
          .querySelector('[aria-label="Delivery cell details"] figure')
          .textContent.includes("Daily median delivery time") &&
        !document.querySelector(
          '[aria-label="Delivery cell details"] [data-chart-state]',
        ),
    ),
  );
  await capture("cell-history-desktop");
  await browser.clickNamed("button", "Toggle large text");
  await browser.resize(390, 850);
  await settle();
  target = await point();
  await browser.move(target.x, target.y);
  await browser.wait(isOpen);
  await browser.clickNamed("button", "Keep open");
  await browser.select(`${selector} select`, "density");
  await browser.wait(() =>
    document.querySelector(
      '[aria-label="Delivery cell details"] [data-chart-state="ready"] svg',
    ),
  );
  await browser.wait(contained);
  check(
    "embedded charts and controls adapt to large text in narrow inspectors",
    await browser.evaluate(() => {
      const card = document.querySelector(
        '[aria-label="Delivery cell details"]',
      );
      return (
        card.scrollWidth <= card.clientWidth + 1 &&
        parseFloat(getComputedStyle(card.querySelector("select")).fontSize) >=
          18
      );
    }),
  );
  await browser.evaluate(() =>
    document
      .querySelector('[aria-label="Delivery cell details"] [data-chart-state]')
      .scrollIntoView({ block: "center" }),
  );
  await capture("cell-density-mobile");
  await scan("cell-density-mobile");
  await browser.clickNamed("button", "Close cell details");
  target = await point(1);
  await browser.move(target.x, target.y);
  await browser.wait(isOpen);
  check(
    "cells without samples retain their summary without fabricated charts",
    await browser.evaluate(() => {
      const card = document.querySelector(
        '[aria-label="Delivery cell details"]',
      );
      return (
        card.textContent.includes("Distribution not supplied") &&
        !card.querySelector("[data-chart-state]")
      );
    }),
  );
  await browser.clickNamed("button", "Toggle surface visibility");
  await browser.key("[data-map-state] ~ details > summary", "Enter");
  await browser.key(
    '[aria-label$="delivery surface data"] tbody tr:first-child td details > summary',
    "Enter",
  );
  await browser.wait(() =>
    document.querySelector('td details[open] [data-chart-state="ready"] svg'),
  );
  check(
    "custom chart details remain keyboard-accessible when the map layer is hidden",
    true,
  );
  await scan("cell-charts-exact-data");
  await clean("cell-charts");
}
