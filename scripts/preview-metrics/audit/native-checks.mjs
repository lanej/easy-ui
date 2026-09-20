import assert from "node:assert/strict";

const close = (actual, expected, description, tolerance = 0.35) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${description}: expected ${expected}, received ${actual}`,
  );

// Real CSS-pixel measurements, shared by Chrome, Firefox, and native Safari.
async function geometry(driver) {
  await driver.wait(() =>
    [...document.querySelectorAll(".native-review svg")].every(
      (svg) =>
        Math.abs(
          svg.viewBox.baseVal.width - svg.getBoundingClientRect().width,
        ) < 0.1,
    ),
  );
  return driver.evaluate(() => {
    const center = (element) => {
      const rect = element.getBoundingClientRect();
      return rect.x + rect.width / 2;
    };
    const markers = [
      ...document.querySelectorAll("[data-native-sparkline-width]"),
    ].map((container) => ({
      requestedWidth: Number(container.dataset.nativeSparklineWidth),
      expectedWidth: Math.min(
        Number(container.dataset.nativeSparklineWidth),
        container.parentElement.getBoundingClientRect().width,
      ),
      plots: [...container.querySelectorAll("svg")].map((svg) => ({
        width: svg.getBoundingClientRect().width,
        paths: svg.querySelectorAll("polyline").length,
        circles: [...svg.querySelectorAll("circle")].map((circle) => {
          const box = circle.getBoundingClientRect();
          return {
            width: box.width,
            height: box.height,
            centerOffset: center(circle) - center(svg),
          };
        }),
      })),
    }));
    const singleton = document.querySelector('[data-native-case="singleton"]');
    const tick = singleton.querySelector("[data-chart-time-axis] span");
    const explicit = document.querySelector(
      '[data-native-case="explicit-time"] svg',
    );
    return {
      markers,
      singleton: {
        ticks: singleton.querySelectorAll("[data-chart-time-axis] span").length,
        offsets: [...singleton.querySelectorAll("circle")].map(
          (point) => center(point) - center(tick),
        ),
      },
      explicit: {
        ratio:
          (Number(explicit.querySelector("circle").getAttribute("cx")) - 6) /
          (explicit.viewBox.baseVal.width - 12),
        ticks: document.querySelectorAll(
          '[data-native-case="explicit-time"] [data-chart-time-axis] span',
        ).length,
      },
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
}

function assertGeometry(measurements) {
  assert.equal(measurements.markers.length, 3);
  for (const item of measurements.markers) {
    assert.equal(item.plots.length, 2);
    for (const plot of item.plots) {
      close(plot.width, item.expectedWidth, "Requested Sparkline width");
      for (const point of plot.circles) {
        close(point.width, 4, "Sparkline marker CSS width");
        close(point.height, 4, "Sparkline marker CSS height");
      }
    }
    assert.equal(item.plots[0].paths, 2, "Missing buckets split segments");
    assert.equal(item.plots[0].circles.length, 4);
    assert.equal(item.plots[1].circles.length, 1);
    close(item.plots[1].circles[0].centerOffset, 0, "Singleton is centered");
  }
  assert.equal(measurements.singleton.ticks, 1);
  assert.equal(measurements.singleton.offsets.length, 2);
  for (const offset of measurements.singleton.offsets)
    close(offset, 0, "Singleton time label aligns with every series");
  close(
    measurements.explicit.ratio,
    0.25,
    "Explicit elapsed time position",
    0.001,
  );
  assert.equal(measurements.explicit.ticks, 2);
  assert.ok(
    measurements.pageOverflow <= 1,
    "Native fixture must not widen page",
  );
}

async function exactTableLines(driver) {
  const cells = await driver.evaluate(() =>
    [
      ...document.querySelectorAll(
        '[data-native-case="precision"] th, [data-native-case="precision"] td',
      ),
    ].map((cell) => {
      const range = document.createRange();
      range.selectNodeContents(cell);
      return {
        text: cell.textContent,
        lines: [...range.getClientRects()].filter(
          (rect) => rect.width > 0 && rect.height > 0,
        ).length,
      };
    }),
  );
  assert.ok(cells.length >= 6, "Exact table cells are exposed");
  assert.ok(
    cells.every((cell) => cell.lines === 1),
    `Exact table observations stay on one line: ${JSON.stringify(cells)}`,
  );
  assert.ok(cells.some((cell) => cell.text === "$1234.56"));
  assert.ok(cells.some((cell) => cell.text === "2026-09-20T09:00:00.000Z"));
  return cells;
}

async function mobileBounds(driver) {
  return driver.evaluate(() => {
    const main = document.querySelector(".native-review");
    const mainBox = main.getBoundingClientRect();
    const overflow = [];
    const fragments = [];
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const tolerance = 1.5;
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim()) continue;
      const parent = node.parentElement;
      // Exact tables intentionally scroll within a named, keyboard-accessible region.
      if (parent.closest('details [role="region"] table')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height) continue;
        const text = node.textContent.trim().slice(0, 80);
        if (
          rect.left < mainBox.left - tolerance ||
          rect.right > mainBox.right + tolerance
        )
          overflow.push({ text, reason: "text outside constrained fixture" });
        for (
          let ancestor = parent;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          const style = getComputedStyle(ancestor);
          const box = ancestor.getBoundingClientRect();
          const clipsX = /hidden|clip|auto|scroll/.test(style.overflowX);
          const clipsY = /hidden|clip|auto|scroll/.test(style.overflowY);
          if (
            (clipsX &&
              (rect.left < box.left - tolerance ||
                rect.right > box.right + tolerance)) ||
            (clipsY &&
              (rect.top < box.top - tolerance ||
                rect.bottom > box.bottom + tolerance))
          )
            overflow.push({ text, reason: "text clipped by ancestor" });
          if (ancestor === main) break;
        }
        fragments.push({ node, text, rect });
      }
    }
    const overlaps = [];
    for (let i = 0; i < fragments.length; i++) {
      for (let j = i + 1; j < fragments.length; j++) {
        const a = fragments[i];
        const b = fragments[j];
        if (a.node === b.node) continue;
        if (
          Math.min(a.rect.right, b.rect.right) -
            Math.max(a.rect.left, b.rect.left) >
            tolerance &&
          Math.min(a.rect.bottom, b.rect.bottom) -
            Math.max(a.rect.top, b.rect.top) >
            tolerance
        )
          overlaps.push([a.text, b.text]);
      }
    }
    const frames = [
      ...main.querySelectorAll(
        '.native-grid > *, figure, summary, svg, ul, details [role="region"]',
      ),
    ].map((element) => {
      const box = element.getBoundingClientRect();
      return {
        tag: element.tagName,
        width: box.width,
        outside:
          box.width > 0 &&
          (box.left < mainBox.left - tolerance ||
            box.right > mainBox.right + tolerance),
      };
    });
    return {
      viewport: { width: innerWidth, height: innerHeight },
      mainWidth: mainBox.width,
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
      stress: main.dataset.nativeStress,
      size: main.dataset.nativeSize,
      typography: {
        title: parseFloat(
          getComputedStyle(
            main.querySelector(
              '[data-native-case="range-overflow"] figcaption strong',
            ),
          ).fontSize,
        ),
        control: parseFloat(
          getComputedStyle(
            main.querySelector('[data-native-case="precision"] summary'),
          ).fontSize,
        ),
        metric: parseFloat(
          getComputedStyle(
            main.querySelector('[data-native-case="unframed"] strong'),
          ).fontSize,
        ),
      },
      textFragments: fragments.length,
      overflow,
      overlaps,
      frames,
      plotHeights: [
        ...main.querySelectorAll('[data-native-case="time"] svg'),
      ].map((svg) => svg.getBoundingClientRect().height),
      tables: [...main.querySelectorAll('details[open] [role="region"]')].map(
        (region) => ({
          tabIndex: region.tabIndex,
          overflow: getComputedStyle(region).overflow,
          width: region.getBoundingClientRect().width,
          height: region.getBoundingClientRect().height,
          scrollWidth: region.scrollWidth,
          clientWidth: region.clientWidth,
        }),
      ),
    };
  });
}

export async function auditNativeRegressions(
  driver,
  site,
  outputDir,
  { scan, diagnostics },
) {
  await driver.open(`${site}/native-regressions.html`);
  await driver.wait(() => document.querySelector("[data-native-ready]"));
  await driver.evaluate(() => document.fonts.ready.then(() => true));
  const defaultGeometry = await geometry(driver);
  assertGeometry(defaultGeometry);
  await driver.screenshot(`${outputDir}/native-markers.png`);

  await driver.key('[data-native-case="precision"] summary', "Enter");
  const defaultTableLines = await exactTableLines(driver);
  const data = await driver.evaluate(() => {
    const precision = document.querySelector('[data-native-case="precision"]');
    const range = document.querySelector('[data-native-case="range-overflow"]');
    const bullet = document.querySelector(
      '[data-native-case="bullet-overflow"]',
    );
    const barTrack = bullet.querySelector('[role="img"]');
    const omitted = bullet.querySelector('[data-native-case="bullet-omitted"]');
    const omittedTrack = omitted.querySelector('[role="img"]');
    const bars = [
      ...document.querySelectorAll('[data-native-case="shared-bars"] li'),
    ].map((row) => {
      const track = row.querySelector('[aria-hidden="true"]');
      const mark = track.firstElementChild;
      return {
        text: row.textContent,
        width: mark?.getBoundingClientRect().width ?? null,
        ratio: mark
          ? mark.getBoundingClientRect().width /
            track.getBoundingClientRect().width
          : null,
        state: row.querySelector("[data-value-state]").dataset.valueState,
      };
    });
    const metric = document.querySelector('[data-native-case="unframed"]');
    return {
      precision: {
        open: precision.querySelector("details").open,
        table: precision.querySelector("tbody").textContent,
        timeAxis: precision.querySelector("[data-chart-time-axis]").textContent,
        valueAxis: [
          ...precision.querySelectorAll("[data-chart-value-axis] span"),
        ].map((element) => element.textContent),
      },
      range: {
        values: [...range.querySelectorAll("[data-value-state]")].map(
          (element) => ({
            state: element.dataset.valueState,
            text: element.textContent,
          }),
        ),
        overflowMarks: range.querySelectorAll('[data-overflow="true"]').length,
        totalMarks: range.querySelectorAll('[aria-hidden="true"] > span')
          .length,
      },
      bullet: {
        values: [...bullet.querySelectorAll("[data-value-state]")].map(
          (element) => element.textContent,
        ),
        ariaLabel: barTrack.getAttribute("aria-label"),
        ratio:
          barTrack.firstElementChild.getBoundingClientRect().width /
          barTrack.getBoundingClientRect().width,
        axes: bullet.querySelector('[aria-hidden="true"]').textContent,
        omitted: {
          marks: omittedTrack.children.length,
          targetPosition: omittedTrack.firstElementChild.style.left,
          measureWidth: omittedTrack.firstElementChild.style.width,
          axes: omitted.querySelector('[aria-hidden="true"]').textContent,
        },
      },
      bars,
      metric: {
        sections: metric.querySelectorAll("section").length,
        text: metric.textContent,
        trends: metric.querySelectorAll("svg").length,
      },
    };
  });
  assert.equal(data.precision.open, true);
  assert.ok(data.precision.table.includes("2026-09-20T09:00:00.000Z"));
  assert.ok(data.precision.table.includes("$1234.56"));
  assert.equal(data.precision.timeAxis, "Sep 20");
  assert.deepEqual(data.precision.valueAxis, ["0k", "1k", "2k"]);
  assert.deepEqual(data.range.values, [
    { state: "out-of-domain", text: "-10–3 · Outside scale" },
    { state: "out-of-domain", text: "-8 · Outside scale" },
    { state: "valid", text: "0" },
    { state: "out-of-domain", text: "8 · Outside scale" },
    { state: "missing", text: "No data" },
    { state: "invalid", text: "Invalid value" },
  ]);
  assert.equal(data.range.overflowMarks, 3);
  assert.equal(data.range.totalMarks, 4);
  assert.deepEqual(data.bullet.values, [
    "14,500 · Outside scale",
    "No data",
    "Invalid value",
    "120 · Outside scale",
  ]);
  assert.deepEqual(data.bullet.omitted, {
    marks: 1,
    targetPosition: "80%",
    measureWidth: "",
    axes: "0100",
  });
  assert.ok(data.bullet.ariaLabel.includes("14,500 · Outside scale"));
  assert.ok(data.bullet.ariaLabel.includes("12,000"));
  assert.equal(data.bullet.axes, "0k13k");
  close(data.bullet.ratio, 1, "Explicitly clamped measure", 0.001);
  assert.equal(data.bars.length, 7);
  const expectedRatios = [1, 0.5, 0, null, 0.5, 0.1, 1];
  data.bars.forEach((bar, index) => {
    if (expectedRatios[index] === null) assert.equal(bar.ratio, null);
    else
      close(
        bar.ratio,
        expectedRatios[index],
        `Shared-scale bar ${index}`,
        0.001,
      );
  });
  close(
    data.bars[1].width,
    data.bars[4].width,
    "Equal magnitudes on shared scales",
  );
  assert.equal(data.bars[2].state, "valid", "Zero is an observation");
  assert.equal(data.bars[3].state, "missing");
  assert.equal(data.bars[6].state, "out-of-domain");
  assert.ok(data.bars[6].text.includes("120 · Outside scale"));
  assert.equal(data.metric.sections, 1, "Only caller-owned framing is present");
  assert.ok(data.metric.text.includes("$5.20"));
  assert.ok(data.metric.text.includes("4.2% lower"));
  assert.ok(data.metric.text.includes("vs previous 30 days"));
  assert.equal(data.metric.trends, 1);
  await scan("native-exact-data");
  await diagnostics("native-exact-data");
  await driver.evaluate(() =>
    document.querySelector('[data-native-case="comparison"]').scrollIntoView(),
  );
  await driver.screenshot(`${outputDir}/native-data.png`);

  await driver.click('.native-review header input[type="checkbox"]');
  await driver.wait(() => document.querySelector('[data-native-size="large"]'));
  const largeGeometry = await geometry(driver);
  assertGeometry(largeGeometry);
  const largeTableLines = await exactTableLines(driver);
  const textSizes = await driver.evaluate(() => {
    const size = (selector) =>
      parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    return {
      title: size('[data-native-case="range-overflow"] figcaption strong'),
      description: size('[data-native-case="range-overflow"] figcaption p'),
      label: size('[data-native-case="precision"] [data-chart-time-axis]'),
      control: size('[data-native-case="precision"] summary'),
      legend: size('[data-native-case="precision"] ul'),
      detail: size('[data-native-case="precision"] tbody td'),
      metric: size('[data-native-case="unframed"] strong'),
      comparison: size('[data-native-case="unframed"] span[data-sentiment]'),
    };
  });
  assert.deepEqual(textSizes, {
    title: 24,
    description: 18,
    label: 16,
    control: 18,
    legend: 16,
    detail: 16,
    metric: 36,
    comparison: 16,
  });
  await scan("native-larger-text");
  await diagnostics("native-larger-text");
  await driver.evaluate(() =>
    document.querySelector('[data-native-case="time"]').scrollIntoView(),
  );
  await driver.screenshot(`${outputDir}/native-typography.png`);

  // Safari can enforce a minimum browser window width. The fixture also constrains
  // its real layout to 320px, and the report records both viewport and layout width.
  await driver.resize(320, 640);
  await driver.open(`${site}/native-regressions.html?large=1&stress=1`);
  await driver.wait(() => document.querySelector('[data-native-size="large"]'));
  await driver.evaluate(() => document.fonts.ready.then(() => true));
  await driver.key('[data-native-case="precision"] summary', "Enter");
  const mobileTableLines = await exactTableLines(driver);
  const mobileGeometry = await geometry(driver);
  assertGeometry(mobileGeometry);
  const mobile = await mobileBounds(driver);
  assert.ok(mobile.mainWidth <= 320, "Native stress layout is at most 320px");
  assert.equal(mobile.stress, "long-labels");
  assert.equal(mobile.size, "large");
  assert.deepEqual(mobile.typography, { title: 24, control: 18, metric: 36 });
  assert.ok(mobile.textFragments > 80, "Long native labels are rendered");
  assert.ok(mobile.pageOverflow <= 1, "Mobile native page must not overflow");
  assert.deepEqual(mobile.overflow, [], "Native text is not clipped");
  assert.deepEqual(mobile.overlaps, [], "Native text does not overlap");
  assert.ok(
    mobile.frames.every((frame) => !frame.outside),
    "Native companions fit",
  );
  assert.deepEqual(mobile.plotHeights, [140, 140, 140]);
  assert.equal(mobile.tables.length, 1);
  assert.equal(mobile.tables[0].tabIndex, 0);
  assert.equal(mobile.tables[0].overflow, "auto");
  assert.ok(mobile.tables[0].height <= 221, "Exact data scrolls locally");
  if (mobile.tables[0].scrollWidth > mobile.tables[0].clientWidth) {
    await driver.key(
      '[data-native-case="precision"] [role="region"]',
      "ArrowRight",
    );
    await driver.wait(
      () =>
        document.querySelector('[data-native-case="precision"] [role="region"]')
          .scrollLeft > 0,
    );
    assert.equal(await driver.evaluate(() => window.scrollX), 0);
  }
  await scan("native-mobile-larger-text");
  await diagnostics("native-mobile-larger-text");
  for (const [name, selector] of [
    ["markers", '[data-native-case="markers"]'],
    ["time", '[data-native-case="time"]'],
    ["exact", '[data-native-case="precision"]'],
    ["range", '[data-native-case="range-overflow"]'],
    ["bullet", '[data-native-case="bullet-overflow"]'],
    ["bars", '[data-native-case="shared-bars"]'],
    ["metric", '[data-native-case="unframed"]'],
  ]) {
    if (name === "exact")
      await driver.evaluate(() => {
        const region = document.querySelector(
          '[data-native-case="precision"] [role="region"]',
        );
        region.scrollLeft = region.scrollWidth;
      });
    await driver.evaluate(
      (target) => document.querySelector(target).scrollIntoView(),
      selector,
    );
    await driver.wait((target) => {
      const box = document.querySelector(target).getBoundingClientRect();
      return box.top < innerHeight && box.bottom > 0;
    }, selector);
    // Safari screenshots can precede the paint following a programmatic scroll.
    await driver.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve(true)),
          ),
        ),
    );
    await driver.screenshot(`${outputDir}/native-mobile-${name}.png`);
  }
  await driver.resize(1440, 1000);
  return {
    checks: [
      "4 px circular markers at 80/160/480 px widths",
      "singleton label and shared timestamp alignment",
      "explicit elapsed time positions",
      "abbreviated axes preserve exact observations",
      "missing, invalid, zero and out-of-domain states",
      "shared BarList scales and explicit clamping",
      "caller-owned metric composition",
      "independent native typography roles",
      "320px native long labels and larger text without clipping or overlap",
      "140px time plots and keyboard-accessible local exact data scrolling",
      "exact table values and timestamps remain on one line at every text size",
    ],
    measurements: {
      defaultGeometry,
      largeGeometry,
      mobileGeometry,
      mobile,
      data,
      textSizes,
      tableLines: {
        default: defaultTableLines,
        large: largeTableLines,
        mobile: mobileTableLines,
      },
    },
  };
}
