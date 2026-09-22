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
}
