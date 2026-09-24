import assert from "node:assert/strict";
import { auditScoreCharts } from "./score-chart-checks.mjs";

// The warning meter keeps its gold interior; measure its contrasting inset edge.
function markContrast(mark, track) {
  const luminance = (color) => {
    const rgb = color
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number);
    const linear = rgb.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const a = luminance(mark);
  const b = luminance(track);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

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
      document.querySelectorAll(
        "[data-score-example] [data-score-layout] > svg path",
      ).length === 6,
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
    ["negative", "positive", "warning", "warning"],
  );
  assert.deepEqual(
    initialStatuses.map(({ status }) => status),
    ["Flagged", "Clear", "Elevated", "Elevated"],
  );
  assert.deepEqual(
    initialStatuses.map(({ value }) => value),
    ["Yes", "No", "0.26", "3"],
  );
  assert.notEqual(initialStatuses[0].color, initialStatuses[1].color);
  assert.notEqual(initialStatuses[0].background, initialStatuses[1].background);
  assert.notEqual(initialStatuses[1].background, initialStatuses[2].background);
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
          edge: getComputedStyle(fill).boxShadow.match(/rgba?\([^)]+\)/)?.[0],
          track: getComputedStyle(meter).backgroundColor,
        };
      }),
    );
  const checkMeterContrast = (fills) => {
    for (const fill of fills) {
      if (!fill.width) continue;
      fill.contrast = markContrast(fill.edge ?? fill.color, fill.track);
      assert.ok(
        fill.contrast >= 3,
        "Meter boundary must contrast with its track at 3:1",
      );
    }
  };
  const fills = await contributionFills();
  checkMeterContrast(fills);
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

  const resultOutcome = () =>
    driver.evaluate(() => {
      const node = document.querySelector('[data-score-node="result"] > div');
      const strong = [...node.querySelectorAll("strong")];
      const icon = node.querySelector("svg");
      return {
        sentiment: node.dataset.sentiment,
        decision: strong[0].textContent,
        score: strong[1].textContent,
        iconHidden: icon.getAttribute("aria-hidden"),
        decisionColor: getComputedStyle(strong[0]).color,
        accentColor: getComputedStyle(node).borderTopColor,
        background: getComputedStyle(node).backgroundColor,
      };
    });
  const initialOutcome = await resultOutcome();
  assert.equal(initialOutcome.sentiment, "negative");
  assert.equal(initialOutcome.decision, "Disable");
  assert.equal(initialOutcome.score, "2.00");
  assert.equal(initialOutcome.iconHidden, "true");
  assert.equal(initialOutcome.decisionColor, initialOutcome.accentColor);
  measurements.push({ name: "negative-outcome", ...initialOutcome });

  const endpoints = async (name, expectedPaths = 6) => {
    // Wait for ResizeObserver to apply the latest DOM geometry, not a fixed delay.
    await driver.wait((expectedPaths) => {
      const root = document.querySelector("[data-score-example]");
      const svg = root.querySelector("[data-score-layout] > svg");
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
        paths.length === expectedPaths &&
        paths.every(
          (path) =>
            attached(path.getPointAtLength(0), true) &&
            attached(path.getPointAtLength(path.getTotalLength()), false),
        )
      );
    }, expectedPaths);
    const geometry = await driver.evaluate(() => {
      const root = document.querySelector("[data-score-example]");
      const svg = root.querySelector("[data-score-layout] > svg");
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
  const connections = () =>
    driver.evaluate(() =>
      [
        ...document.querySelectorAll(
          "[data-score-example] [data-score-layout] > svg path",
        ),
      ].map((path) => ({
        inactive: path.dataset.inactive === "true",
        highlighted: path.dataset.highlighted === "true",
        stroke: getComputedStyle(path).stroke,
        width: parseFloat(getComputedStyle(path).strokeWidth),
        dash: getComputedStyle(path).strokeDasharray,
      })),
    );
  const initialConnections = await connections();
  assert.deepEqual(
    initialConnections.map(({ inactive }) => inactive),
    [false, true, false, false, false, false],
  );
  assert.equal(initialConnections[0].dash, "none");
  assert.notEqual(initialConnections[1].dash, "none");
  assert.notEqual(initialConnections[0].stroke, initialConnections[1].stroke);
  assert.equal(
    await driver.evaluate(
      (selector) => document.querySelector(selector).textContent.trim(),
      explanation,
    ),
    "Underdeclaration",
  );
  await driver.hover(explanation);
  const hoveredConnections = await connections();
  assert.deepEqual(
    hoveredConnections.map(({ highlighted }) => highlighted),
    [true, true, true, false, false, false],
  );
  assert.ok(hoveredConnections[0].width > initialConnections[0].width);
  assert.notEqual(hoveredConnections[0].stroke, initialConnections[0].stroke);
  assert.equal(hoveredConnections[1].dash, initialConnections[1].dash);
  await driver.screenshot(`${outputDir}/score-traced.png`);
  await driver.hover("h1");
  assert.ok((await connections()).every(({ highlighted }) => !highlighted));
  measurements.push({
    name: "connection-tracing",
    initialConnections,
    hoveredConnections,
  });
  const signalExplanation =
    '[data-score-example] button[aria-label="Explanation: Missing package dimensions"]';
  const expanded = (selector) =>
    driver.evaluate(
      (selector) =>
        document.querySelector(selector).getAttribute("aria-expanded"),
      selector,
    );
  const signalsColumn =
    '[data-score-example] [data-score-column="signals"] > div > button';
  const contributionsColumn =
    '[data-score-example] [data-score-column="contributions"] > div > button';
  await driver.key("#refresh-data", "Tab");
  assert.equal(
    await driver.evaluate(
      (selector) => document.activeElement === document.querySelector(selector),
      signalsColumn,
    ),
    true,
  );
  await driver.key(signalsColumn, "Tab");
  assert.equal(
    await driver.evaluate(
      (selector) => document.activeElement === document.querySelector(selector),
      signalExplanation,
    ),
    true,
    "Tab reaches the first signal before its contributions",
  );
  assert.equal(await expanded(signalExplanation), "false");
  const description = await driver.evaluate((selector) => {
    const button = document.querySelector(selector);
    return document.getElementById(button.getAttribute("aria-describedby"))
      .textContent;
  }, signalExplanation);
  assert.match(description, /Yes.*Flagged/);
  const signalHeight = () =>
    driver.evaluate(
      () =>
        document
          .querySelector('[data-score-id="dimensions"]')
          .getBoundingClientRect().height,
    );
  const closedHeight = await signalHeight();
  await driver.key(signalExplanation, "Enter");
  assert.equal(await expanded(signalExplanation), "true");
  assert.ok(
    (await signalHeight()) > closedHeight,
    "The signal grows to fit its description",
  );
  await endpoints("signal-expanded");
  await scan("score-signal-expanded");
  await driver.screenshot(`${outputDir}/score-signal-expanded.png`);
  await driver.key(signalExplanation, "Space");
  assert.equal(await expanded(signalExplanation), "false");
  await driver.key(signalExplanation, "Enter");
  // Signal controls follow DOM order, then continue into the contributions.
  for (const id of ["dimensions", "weight", "ratio", "burst"]) {
    await driver.key(`[data-score-id="${id}"] button`, "Tab");
  }
  assert.equal(
    await driver.evaluate(
      (selector) => document.activeElement === document.querySelector(selector),
      contributionsColumn,
    ),
    true,
  );
  await driver.key(contributionsColumn, "Tab");
  assert.equal(
    await driver.evaluate(
      (selector) => document.activeElement === document.querySelector(selector),
      explanation,
    ),
    true,
    "Tab continues from the signal controls through the column header to the first contribution",
  );
  assert.deepEqual(
    (await connections()).map(({ highlighted }) => highlighted),
    [true, true, true, false, false, false],
  );
  await driver.hover('[data-score-id="international"] button');
  assert.deepEqual(
    (await connections()).map(({ highlighted }) => highlighted),
    [true, true, true, false, false, false],
    "Keyboard focus keeps its trace when the pointer crosses another card",
  );
  await driver.key(explanation, "Tab");
  assert.deepEqual(
    (await connections()).map(({ highlighted }) => highlighted),
    [false, false, false, true, true, true],
  );
  await driver.hover("h1");
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
  const columnState = () =>
    driver.evaluate(() => {
      const root = document.querySelector("[data-score-example]");
      const visible = (node) =>
        node.getBoundingClientRect().width > 0 &&
        node.getBoundingClientRect().height > 0;
      const contributions = root.querySelector(
        '[data-score-column="contributions"]',
      );
      const result = root.querySelector('[data-score-node="result"]');
      const source = root.querySelector('[data-score-node="contribution"] ul');
      return {
        nodes: [...root.querySelectorAll("[data-score-node]")]
          .filter(visible)
          .map((node) => node.dataset.scoreNode),
        paths: root.querySelectorAll("[data-score-layout] > svg path").length,
        contributionWidth: contributions.getBoundingClientRect().width,
        resultWidth: result.getBoundingClientRect().width,
        sourceVisible:
          visible(source) &&
          getComputedStyle(source.parentElement).clipPath === "none",
        overflow: root.scrollWidth - root.clientWidth,
        targets: [...root.querySelectorAll("button")]
          .filter(visible)
          .map((node) => node.getBoundingClientRect().height),
      };
    });
  const allColumns = await columnState();
  await driver.key(signalsColumn, "Enter");
  assert.equal(await expanded(signalsColumn), "false");
  await endpoints("signals-collapsed", 2);
  const signalsCollapsed = await columnState();
  assert.deepEqual(signalsCollapsed.nodes, [
    "contribution",
    "contribution",
    "result",
  ]);
  assert.equal(signalsCollapsed.sourceVisible, true);
  assert.ok(signalsCollapsed.contributionWidth > allColumns.contributionWidth);
  await driver.key(signalsColumn, "Tab");
  assert.equal(
    await driver.evaluate(
      (selector) => document.activeElement === document.querySelector(selector),
      contributionsColumn,
    ),
    true,
    "Closed signals are skipped by Tab",
  );
  await scan("score-signals-collapsed");
  await driver.screenshot(`${outputDir}/score-signals-collapsed.png`);
  await driver.key(contributionsColumn, "Space");
  const resultFocus = await columnState();
  assert.deepEqual(resultFocus.nodes, ["result"]);
  assert.equal(resultFocus.paths, 0);
  assert.ok(resultFocus.resultWidth > signalsCollapsed.resultWidth);
  await driver.key(contributionsColumn, "Tab");
  assert.equal(
    await driver.evaluate(
      () => document.activeElement.closest("[data-score-example]") === null,
    ),
    true,
    "Both closed columns leave no hidden tab stops",
  );
  await scan("score-result-focus");
  await driver.screenshot(`${outputDir}/score-result-focus.png`);
  await driver.key(signalsColumn, "Enter");
  const contributionsCollapsed = await columnState();
  assert.deepEqual(contributionsCollapsed.nodes, [
    "signal",
    "signal",
    "signal",
    "signal",
    "result",
  ]);
  assert.equal(
    contributionsCollapsed.paths,
    0,
    "No fabricated signal → result edges",
  );
  assert.equal(await expanded(signalExplanation), "true");
  await scan("score-contributions-collapsed");
  await driver.screenshot(`${outputDir}/score-contributions-collapsed.png`);
  await driver.key(contributionsColumn, "Enter");
  assert.equal(await expanded(explanation), "true");
  await endpoints("columns-restored");
  assert.ok((await connections()).every(({ highlighted }) => !highlighted));
  for (const state of [signalsCollapsed, contributionsCollapsed, resultFocus]) {
    assert.ok(state.overflow <= 1);
    assert.ok(state.targets.every((height) => height >= 44));
  }
  measurements.push({
    name: "column-collapse",
    signalsCollapsed,
    contributionsCollapsed,
    resultFocus,
  });
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
  assert.equal(
    await expanded(signalExplanation),
    "true",
    "The signal keeps its disclosure state through refresh and reordering",
  );
  assert.equal(
    (await connections()).filter(({ inactive }) => inactive).length,
    4,
  );
  assert.ok((await connections()).every(({ highlighted }) => !highlighted));
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
    ["positive", "positive", "positive", "positive"],
  );
  assert.deepEqual(
    refreshedStatuses.map(({ value }) => value),
    ["0", "0", "No", "No"],
  );
  assert.deepEqual(
    refreshedStatuses.map(({ status }) => status),
    ["Clear", "Clear", "Clear", "Clear"],
  );
  assert.notEqual(
    refreshedStatuses[0].background,
    initialStatuses[0].background,
  );
  measurements.push({
    name: "refreshed-signal-statuses",
    signals: refreshedStatuses,
  });
  const positiveOutcome = await resultOutcome();
  assert.equal(positiveOutcome.sentiment, "positive");
  assert.equal(positiveOutcome.decision, "Review complete");
  assert.equal(positiveOutcome.score, "0.00");
  assert.equal(positiveOutcome.iconHidden, "true");
  assert.notEqual(positiveOutcome.accentColor, initialOutcome.accentColor);
  measurements.push({ name: "positive-outcome", ...positiveOutcome });
  await scan("score-positive");
  await driver.screenshot(`${outputDir}/score-positive.png`);
  await driver.click("#refresh-data");
  await driver.key(explanation, "Enter");
  await driver.key(signalExplanation, "Space");
  await driver.click("#rtl-layout");
  await endpoints("rtl");
  await driver.click(signalsColumn);
  await endpoints("rtl-signals-collapsed", 2);
  await driver.click(signalsColumn);
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
  const darkFills = await contributionFills();
  checkMeterContrast(darkFills);
  measurements.push({
    name: "dark-contribution-contrast",
    contributions: darkFills,
  });
  await scan("score-dark");
  await driver.screenshot(`${outputDir}/score-dark.png`);
  await driver.click(signalsColumn);
  await endpoints("dark-signals-collapsed", 2);
  await scan("score-dark-collapsed");
  await driver.screenshot(`${outputDir}/score-dark-collapsed.png`);
  await driver.click(signalsColumn);
  await driver.click("#dark-theme");
  await driver.click("#narrow-container");
  await driver.wait(
    () =>
      !document.querySelector(
        "[data-score-example] [data-score-layout] > svg",
      ) ||
      getComputedStyle(
        document.querySelector(
          "[data-score-example] [data-score-layout] > svg",
        ),
      ).display === "none",
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
        !document.querySelector(
          "[data-score-example] [data-score-layout] > svg",
        ) ||
        getComputedStyle(
          document.querySelector(
            "[data-score-example] [data-score-layout] > svg",
          ),
        ).display === "none",
    );
    await driver.key(explanation, "Enter");
    await driver.key(signalExplanation, "Enter");
    assert.equal(await expanded(signalExplanation), "true");
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
    assert.match(data.sources, /Declared weight mismatch/);
    await scan(`score-${width}`);
    await driver.screenshot(`${outputDir}/score-${width}.png`);
    await driver.key(signalsColumn, "Enter");
    await driver.key(contributionsColumn, "Space");
    const collapsed = await columnState();
    assert.deepEqual(collapsed.nodes, ["result"]);
    assert.equal(collapsed.paths, 0);
    assert.ok(collapsed.overflow <= 1);
    assert.ok(collapsed.targets.every((height) => height >= 44));
    await scan(`score-${width}-collapsed`);
    await driver.screenshot(`${outputDir}/score-${width}-collapsed.png`);
    await driver.key(signalsColumn, "Enter");
    await driver.key(contributionsColumn, "Enter");
    assert.equal(await expanded(signalExplanation), "true");
    assert.equal(await expanded(explanation), "true");
    await driver.key(explanation, "Enter");
    await driver.key(signalExplanation, "Space");
    measurements.push({ name: `mobile-${width}`, ...data });
  }
  await diagnostics("score-composition");
  const charts = await auditScoreCharts(driver, site, outputDir, {
    scan,
    diagnostics,
    endpoints,
  });
  measurements.push(...charts.measurements);
  return {
    checks: [
      "result leads with an explicit decision, decorative status icon, and matching sentiment accent",
      "contributions show full and partial ratios with matching colors, contrasting boundaries, and exact meter widths",
      "explicit signal colors retain exact values and visible status labels",
      "score connectors follow DOM geometry and disclosure",
      "signal and contribution title disclosures preserve observations and expanded state through refresh",
      "hover and keyboard trace incoming/outgoing connections; untriggered sources keep dashed edges",
      "supporting columns collapse independently, preserve nested details, skip hidden tab stops, and reclaim width without fabricated edges",
      "score RTL geometry",
      "score container responsiveness and large text",
      "score dark-theme and mobile accessibility",
      ...charts.checks,
    ],
    measurements,
  };
}
