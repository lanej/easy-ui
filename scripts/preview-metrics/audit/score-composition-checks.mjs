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

  const signalStatuses = () =>
    driver.evaluate(() =>
      [
        ...document.querySelectorAll(
          '[data-score-node="signal"] [data-sentiment]',
        ),
      ].map((node) => ({
        sentiment: node.dataset.sentiment,
        value: node.querySelector("strong").textContent,
        status: node.querySelector("[data-score-status-label]")?.textContent,
        color: getComputedStyle(node).color,
        background: getComputedStyle(node).backgroundColor,
      })),
    );
  const initialStatuses = await signalStatuses();
  assert.deepEqual(
    initialStatuses.map(({ sentiment }) => sentiment),
    ["negative", "warning", "warning"],
  );
  assert.deepEqual(
    initialStatuses.map(({ status }) => status),
    ["Flagged", "Elevated", "Elevated"],
  );
  assert.notEqual(initialStatuses[0].color, initialStatuses[1].color);
  assert.notEqual(initialStatuses[0].background, initialStatuses[1].background);
  measurements.push({ name: "signal-statuses", signals: initialStatuses });

  const contributionFills = () =>
    driver.evaluate(() =>
      [
        ...document.querySelectorAll(
          '[data-score-node="contribution"] > [data-fill-state]',
        ),
      ].map((node) => {
        const meter = node.querySelector('[role="meter"]');
        const fill = meter.firstElementChild;
        return {
          state: node.dataset.fillState,
          sentiment: node.dataset.sentiment,
          label: node
            .querySelector("[data-score-fill-label]")
            .textContent.replace(/\s+/g, " ")
            .trim(),
          width:
            fill.getBoundingClientRect().width /
            meter.getBoundingClientRect().width,
          color: getComputedStyle(fill).backgroundColor,
        };
      }),
    );
  const fills = await contributionFills();
  assert.deepEqual(
    fills.map(({ state }) => state),
    ["full", "partial"],
  );
  assert.deepEqual(
    fills.map(({ sentiment }) => sentiment),
    ["negative", "warning"],
  );
  assert.deepEqual(
    fills.map(({ label }) => label),
    ["Full · 100%", "Partial · 50%"],
  );
  assert.ok(Math.abs(fills[0].width - 1) < 0.01);
  assert.ok(Math.abs(fills[1].width - 0.5) < 0.01);
  assert.notEqual(
    fills[0].color,
    fills[1].color,
    "Full and partial contributions have distinct colors",
  );
  measurements.push({ name: "contribution-fullness", contributions: fills });

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
      const bounds = svg.getBoundingClientRect();
      const sx = bounds.width / svg.viewBox.baseVal.width;
      const sy = bounds.height / svg.viewBox.baseVal.height;
      const textRects = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const text = walker.currentNode;
        if (
          !text.textContent.trim() ||
          !text.parentElement.closest("[data-score-node]")
        )
          continue;
        let hidden = false;
        for (
          let parent = text.parentElement;
          parent && parent !== root;
          parent = parent.parentElement
        ) {
          const style = getComputedStyle(parent);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            style.clipPath !== "none"
          )
            hidden = true;
        }
        if (hidden) continue;
        const range = document.createRange();
        range.selectNodeContents(text);
        for (const rect of range.getClientRects()) {
          if (rect.width && rect.height)
            textRects.push({
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              text: text.textContent,
            });
        }
      }
      const collisions = [];
      for (const path of svg.querySelectorAll("path")) {
        for (let i = 0; i <= 100; i++) {
          const point = path.getPointAtLength(
            (path.getTotalLength() * i) / 100,
          );
          const x = bounds.left + point.x * sx;
          const y = bounds.top + point.y * sy;
          const text = textRects.find(
            (rect) =>
              x >= rect.left - 4 &&
              x <= rect.right + 4 &&
              y >= rect.top - 4 &&
              y <= rect.bottom + 4,
          );
          if (text) {
            collisions.push(text.text);
            break;
          }
        }
      }
      return {
        width: root.getBoundingClientRect().width,
        paths: [...svg.querySelectorAll("path")].map((path) =>
          path.getAttribute("d"),
        ),
        decorative: svg.getAttribute("aria-hidden"),
        pointerEvents: getComputedStyle(svg).pointerEvents,
        overflow: root.scrollWidth - root.clientWidth,
        collisions,
        signals: [
          ...root.querySelectorAll('[data-score-node="signal"] > div'),
        ].map((node) => {
          const style = getComputedStyle(node);
          return {
            border: parseFloat(style.borderLeftWidth),
            paddingStart: parseFloat(style.paddingInlineStart),
            paddingEnd: parseFloat(style.paddingInlineEnd),
          };
        }),
      };
    });
    assert.equal(geometry.decorative, "true");
    assert.equal(geometry.pointerEvents, "none");
    assert.ok(geometry.overflow <= 1);
    assert.deepEqual(
      geometry.collisions,
      [],
      "Connectors must remain clear of visible node text",
    );
    assert.ok(
      geometry.signals.every(
        (signal) =>
          signal.border >= 1 &&
          signal.paddingStart >= 12 &&
          signal.paddingEnd >= 12,
      ),
      "Signal boxes must reserve space between text and edge attachments",
    );
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
  const emptyFills = await contributionFills();
  assert.deepEqual(
    emptyFills.map(({ state }) => state),
    ["none", "none"],
  );
  assert.deepEqual(
    emptyFills.map(({ sentiment }) => sentiment),
    ["neutral", "neutral"],
  );
  assert.deepEqual(
    emptyFills.map(({ label }) => label),
    ["None · 0%", "None · 0%"],
  );
  assert.deepEqual(
    emptyFills.map(({ width }) => width),
    [0, 0],
  );
  measurements.push({
    name: "refreshed-contribution-fullness",
    contributions: emptyFills,
  });
  const refreshedStatuses = await signalStatuses();
  assert.deepEqual(
    refreshedStatuses.map(({ sentiment }) => sentiment),
    ["positive", "positive", "positive"],
  );
  assert.deepEqual(
    refreshedStatuses.map(({ value }) => value),
    ["0", "0", "No"],
  );
  assert.deepEqual(
    refreshedStatuses.map(({ status }) => status),
    ["Clear", "Clear", "Clear"],
  );
  assert.notEqual(
    refreshedStatuses[0].background,
    initialStatuses[0].background,
  );
  measurements.push({
    name: "refreshed-signal-statuses",
    signals: refreshedStatuses,
  });
  await scan("score-positive");
  await driver.screenshot(`${outputDir}/score-positive.png`);
  await driver.click("#refresh-data");
  await driver.key(explanation, "Enter");
  await driver.click("#rtl-layout");
  await endpoints("rtl");
  await driver.click("#rtl-layout");
  await driver.click("#large-text");
  await endpoints("large-text");
  await driver.click("#large-text");
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
      "contributions show full and partial ratios with matching colors and exact meter widths",
      "explicit signal colors retain exact values and visible status labels",
      "score connectors follow DOM geometry and disclosure",
      "score keyboard disclosure and refreshed records",
      "score RTL geometry",
      "score container responsiveness and large text",
      "score dark-theme and mobile accessibility",
    ],
    measurements,
  };
}
