import assert from "node:assert/strict";

/** Shared browser assertions, including the native Safari transport in CI. */
export async function auditScoreComposition(
  driver,
  site,
  outputDir,
  { scan, diagnostics },
) {
  const measurements = [];
  await driver.resize(1440, 1100);
  await driver.open(`${site}/score-composition.html`);
  await driver.wait(
    () =>
      document.querySelectorAll("[data-score-example] svg path").length === 5,
  );
  await driver.evaluate(() => document.fonts.ready.then(() => true));

  const endpoints = async (name) => {
    // Wait for ResizeObserver to apply the latest DOM geometry, not a fixed delay.
    await driver.wait(() => {
      const root = document.querySelector("[data-score-example]");
      const svg = root.querySelector("svg");
      if (!svg) return false;
      const paths = [...svg.querySelectorAll("path")];
      const nodes = [...root.querySelectorAll("[data-score-node]")];
      const bounds = svg.getBoundingClientRect();
      const sx = bounds.width / svg.viewBox.baseVal.width;
      const sy = bounds.height / svg.viewBox.baseVal.height;
      const attached = (point, start) =>
        nodes.some((node) => {
          const rect = node.getBoundingClientRect();
          const rtl = getComputedStyle(node).direction === "rtl";
          const x = start !== rtl ? rect.right : rect.left;
          return (
            Math.abs(bounds.left + point.x * sx - x) < 1 &&
            Math.abs(bounds.top + point.y * sy - rect.top - rect.height / 2) < 1
          );
        });
      return (
        paths.length === 5 &&
        paths.every(
          (path) =>
            attached(path.getPointAtLength(0), true) &&
            attached(path.getPointAtLength(path.getTotalLength()), false),
        )
      );
    });
    const geometry = await driver.evaluate(() => {
      const root = document.querySelector("[data-score-example]");
      const svg = root.querySelector("svg");
      return {
        width: root.getBoundingClientRect().width,
        paths: [...svg.querySelectorAll("path")].map((path) =>
          path.getAttribute("d"),
        ),
        decorative: svg.getAttribute("aria-hidden"),
        pointerEvents: getComputedStyle(svg).pointerEvents,
        overflow: root.scrollWidth - root.clientWidth,
      };
    });
    assert.equal(geometry.decorative, "true");
    assert.equal(geometry.pointerEvents, "none");
    assert.ok(geometry.overflow <= 1);
    measurements.push({ name, ...geometry });
  };
  await endpoints("desktop");
  await scan("score-desktop");
  await driver.screenshot(`${outputDir}/score-desktop.png`);
  const explanation =
    '[data-score-example] button[aria-label="Explanation: Underdeclaration"]';
  await driver.key(explanation, "Enter");
  assert.equal(
    await driver.evaluate(
      (selector) =>
        document.querySelector(selector).getAttribute("aria-expanded"),
      explanation,
    ),
    "true",
  );
  await endpoints("expanded");
  await driver.click("#refresh-data");
  assert.equal(
    await driver.evaluate(
      (selector) =>
        document.querySelector(selector).getAttribute("aria-expanded"),
      explanation,
    ),
    "true",
  );
  assert.deepEqual(
    await driver.evaluate(() =>
      [...document.querySelectorAll('[data-score-example] [role="meter"]')].map(
        (node) => node.getAttribute("aria-valuenow"),
      ),
    ),
    ["0", "0"],
  );
  await endpoints("refreshed");
  await driver.click("#refresh-data");
  await driver.key(explanation, "Enter");
  await driver.click("#rtl-layout");
  await endpoints("rtl");
  await driver.click("#rtl-layout");
  const lightBackground = await driver.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  await driver.click("#dark-theme");
  await driver.wait(
    (light) => getComputedStyle(document.body).backgroundColor !== light,
    lightBackground,
  );
  await scan("score-dark");
  await driver.screenshot(`${outputDir}/score-dark.png`);
  await driver.click("#dark-theme");
  await driver.click("#narrow-container");
  await driver.wait(
    () =>
      !document.querySelector("[data-score-example] svg") ||
      getComputedStyle(document.querySelector("[data-score-example] svg"))
        .display === "none",
  );
  measurements.push({
    name: "narrow-container",
    width: await driver.evaluate(
      () =>
        document.querySelector("[data-score-example]").getBoundingClientRect()
          .width,
    ),
  });
  assert.equal(measurements.at(-1).width, 360);
  await driver.click("#narrow-container");
  for (const width of [390, 320]) {
    await driver.resize(width, 1100);
    // Safari's native minimum window width must not weaken the container check.
    await driver.evaluate((width) => {
      document.querySelector("main").style.width = `${width}px`;
    }, width);
    if (width === 320) await driver.click("#large-text");
    await driver.wait(
      () =>
        !document.querySelector("[data-score-example] svg") ||
        getComputedStyle(document.querySelector("[data-score-example] svg"))
          .display === "none",
    );
    const data = await driver.evaluate(() => {
      const root = document.querySelector("[data-score-example]");
      const lists = [...root.querySelectorAll("[data-score-node]")].map(
        (node) => {
          const rect = node.getBoundingClientRect();
          return {
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
          };
        },
      );
      return {
        container: document.querySelector("main").getBoundingClientRect().width,
        overflow: root.scrollWidth - root.clientWidth,
        pageOverflow: document.documentElement.scrollWidth - innerWidth,
        nodes: lists,
        targets: [...root.querySelectorAll("button")].map(
          (button) => button.getBoundingClientRect().height,
        ),
        sources: root.querySelector('[data-score-node="contribution"]')
          .textContent,
      };
    });
    assert.equal(data.container, width);
    assert.ok(
      data.overflow <= 1 && data.pageOverflow <= 1,
      "No horizontal overflow",
    );
    assert.ok(
      data.nodes.every((node, i) => !i || node.top >= data.nodes[i - 1].bottom),
      "Stacked nodes must not overlap",
    );
    assert.ok(
      data.targets.every((height) => height >= 44),
      "Explanations retain touch targets",
    );
    assert.match(data.sources, /Missing package dimensions/);
    await driver.key(explanation, "Enter");
    await scan(`score-${width}`);
    await driver.screenshot(`${outputDir}/score-${width}.png`);
    await driver.key(explanation, "Enter");
    measurements.push({ name: `mobile-${width}`, ...data });
  }
  await diagnostics("score-composition");
  return {
    checks: [
      "score connectors follow DOM geometry and disclosure",
      "score keyboard disclosure and refreshed records",
      "score RTL geometry",
      "score container responsiveness and large text",
      "score dark-theme and mobile accessibility",
    ],
    measurements,
  };
}
