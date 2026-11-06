import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const output = resolve(
  process.env.INVESTIGATION_REPORT_DIR ?? "/tmp/easy-ui-investigation",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    ...JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
  ],
});
const page = await browser.newPage({
  viewport: { width: 1200, height: 1100 },
  deviceScaleFactor: 1.5,
});
const errors = [],
  checks = [];
page.on("pageerror", (error) => {
  console.log(`Browser error: ${error.message}`);
  errors.push(error.message);
});
const base = process.env.STORYBOOK_URL ?? "http://localhost:9019";
const ledgerOnly = process.env.INVESTIGATION_LEDGER_ONLY === "1";
const mapHandle = ledgerOnly ? "ledgerMap" : "investigationMap";
const root = () =>
  page.getByRole("region", { name: "Event investigation", exact: true });
const details = () =>
  page.getByRole("region", { name: "Selection details", exact: true });
const timeline = () =>
  page.getByRole("list", {
    name: ledgerOnly ? "Event history" : "Events",
    exact: true,
  });
async function open(story, theme = "light", width = 1200, height = 1100) {
  await page.setViewportSize({ width, height });
  await page.goto(
    `${base}/iframe.html?id=organisms-investigation-investigationworkspace--${story}&viewMode=story&globals=colorScheme:${theme}`,
  );
  console.log(`Open ${story} ${theme} ${width}`);
  await root().waitFor();
  await page.waitForSelector('[data-map-state="ready"]', {
    timeout: 30000,
    state: "attached",
  });
  await waitForResponsiveLayout();
  if ((await root().getAttribute("data-narrow")) !== "true") await waitForMap();
  await page.waitForFunction(
    (key) => document.fonts.status === "loaded" && window[key]?.isStyleLoaded(),
    mapHandle,
  );
}
async function waitForResponsiveLayout() {
  await page.waitForFunction(() => {
    const workspace = document.querySelector(
      '[aria-label="Event investigation"]',
    );
    return (
      workspace?.getAttribute("data-narrow") ===
      String(
        workspace.getBoundingClientRect().width <=
          (workspace.dataset.variant === "ledger" ? 640 : 740),
      )
    );
  });
}
async function waitForMap() {
  await page.waitForFunction((key) => {
    const map = window[key];
    const element = map?.getContainer();
    return (
      element?.clientWidth > 0 &&
      element.dataset.initialViewReady === "true" &&
      element.dataset.mapIdle === "true" &&
      !map.isMoving() &&
      map.getCanvas().clientWidth === element.clientWidth &&
      map.getCanvas().clientHeight === element.clientHeight
    );
  }, mapHandle);
}
async function showMap() {
  const tab = page.getByRole("tab", { name: "Map", exact: true });
  if (await tab.count()) await tab.click();
  await waitForMap();
}
async function audit(name) {
  // setViewportSize can resolve before ResizeObserver commits the mobile view.
  await waitForResponsiveLayout();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `${name}: page overflow`,
  );
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  let result;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      result = await page.evaluate(() =>
        window.axe.run(document.querySelector("#storybook-root"), {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        }),
      );
      break;
    } catch (error) {
      if (!String(error).includes("already running") || attempt === 39)
        throw error;
      await page.waitForTimeout(50);
    }
  }
  assert.deepEqual(
    result.violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map(({ target }) => target),
    })),
    [],
    `${name}: accessibility`,
  );
  if ((await root().getAttribute("data-narrow")) === "true") {
    assert.equal(
      await root().locator("[data-view-panel]:visible").count(),
      1,
      `${name}: only the active tab panel is visible`,
    );
  } else {
    const map = await root().locator('[data-view-panel="map"]').boundingBox();
    const inspector = await details().boundingBox();
    const rowGap = await root()
      .locator('[data-view-panel="map"]')
      .evaluate((panel) =>
        parseFloat(getComputedStyle(panel.parentElement).rowGap),
      );
    const events = await root()
      .locator('[data-view-panel="events"]')
      .boundingBox();
    assert(
      Math.abs(events.y - map.y) <= 1 &&
        Math.abs(events.y + events.height - inspector.y - inspector.height) <=
          1,
      `${name}: both columns share top and bottom boundaries`,
    );
    assert(
      Math.abs(inspector.y - map.y - map.height - rowGap) <= 1,
      `${name}: short inspectors stay directly below the map`,
    );
  }
  if (ledgerOnly) {
    const panel = root().locator('[data-view-panel="events"]');
    if (await panel.isVisible()) {
      assert(
        await panel.evaluate((panel) => {
          const current = panel
            .querySelector('[aria-current="true"]')
            ?.closest("li");
          if (!current) return true;
          const row = current.getBoundingClientRect();
          const viewport = panel
            .querySelector("[data-timeline-scroll]")
            .getBoundingClientRect();
          const inspector = document
            .querySelector('[aria-label="Selection details"]')
            .getBoundingClientRect();
          const covered =
            row.bottom > inspector.top + 1 &&
            row.top < inspector.bottom - 1 &&
            row.right > inspector.left + 1 &&
            row.left < inspector.right - 1;
          return (
            row.top >= viewport.top - 1 &&
            row.bottom <= viewport.bottom + 1 &&
            !covered
          );
        }),
        `${name}: the selected row's event type, time and assessment remain visible`,
      );
    }
  }
  const headline = details().getByRole("group", {
    name: "Current dwell",
    exact: true,
  });
  if (await headline.isVisible()) {
    const label = await headline
      .getByText("Current dwell", { exact: true })
      .boundingBox();
    const value = await headline
      .getByRole("img", { name: "6 h", exact: true })
      .boundingBox();
    assert(
      Math.abs(label.y + label.height / 2 - value.y - value.height / 2) < 8,
      `${name}: label, status and value share one row`,
    );
    assert(label.width > 70, `${name}: headline has readable width`);
  }
  checks.push(name);
}
async function screenshot(name) {
  await page.mouse.move(0, 0);
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.activeElement?.blur());
  await page.locator("#storybook-root").screenshot({
    path: `${output}/${name}.png`,
    ...(ledgerOnly ? { scale: "css" } : {}),
  });
}
async function checkLedger() {
  const eventNames = {
    accepted: /^(?=.*Ludington, MI)(?=.*Accepted)/,
    "shared-transit": /Hammond, IN.*Oct 22.*12:23/,
    "a-transit": /Avondale, AZ.*Oct 23.*20:19/,
    "a-wellton": /Wellton, AZ.*Oct 24.*04:20/,
    "b-transit": /Wellton, AZ.*Oct 24.*07:56/,
    revisit: /^(?=.*Avondale, AZ)(?=.*Oct 24)(?=.*11:25)(?=.*Return visit)/,
    "out-for-delivery": /^(?=.*El Cajon, CA)(?=.*Out for delivery)/,
    delivered: /^(?=.*El Cajon, CA)(?=.*Delivered)/,
    "c-accepted": /^(?=.*Kansas City, KS)(?=.*Accepted)/,
    "c-delivered": /^(?=.*Ottawa, KS)(?=.*Delivered)/,
    "unassigned-delivery": /^(?=.*Santa Rosa, NM)(?=.*Oct 27)(?=.*13:42)/,
  };
  const eventIds = Object.keys(eventNames);
  const connections = [
    ["shared-link", "accepted", "shared-transit"],
    ["a-transfer-link", "shared-transit", "a-transit"],
    ["a-west-link", "a-transit", "a-wellton"],
    ["a-return-link", "a-wellton", "revisit"],
    ["a-out-link", "revisit", "out-for-delivery"],
    ["b-transfer-link", "shared-transit", "b-transit"],
    ["b-out-link", "b-transit", "out-for-delivery"],
    ["delivery-link", "out-for-delivery", "delivered"],
    ["c-delivery-link", "c-accepted", "c-delivered"],
  ];
  const connectionIds = connections.map(([id]) => id);
  const independentRoots = ["accepted", "c-accepted", "unassigned-delivery"];
  const historyA = [
    "accepted",
    "shared-transit",
    "a-transit",
    "a-wellton",
    "revisit",
    "out-for-delivery",
    "delivered",
  ];
  const historyAConnections = [
    "shared-link",
    "a-transfer-link",
    "a-west-link",
    "a-return-link",
    "a-out-link",
    "delivery-link",
  ];
  const referenceFixtures = {
    "a-transit": {
      minutes: 1916,
      label: "31 h 56 m",
      previous: "Hammond · Oct 22, 12:23 UTC",
      width: 4,
      counts: [4, 9, 18, 30, 42, 45, 40, 29, 17, 10, 6, 2],
    },
    revisit: {
      minutes: 425,
      label: "7 h 05 m",
      previous: "Wellton · Oct 24, 04:20 UTC",
      width: 2,
      counts: [6, 18, 32, 44, 36, 24, 16, 10, 6, 4, 2, 2],
    },
  };
  const graph = () => root().locator("[data-connection-graph]");
  const eventButton = (id) =>
    timeline().getByRole("button", { name: eventNames[id] });
  const eventRow = (id) => eventButton(id).locator("xpath=ancestor::li[1]");
  const histories = () =>
    root().getByRole("group", { name: "Histories", exact: true });
  const camera = () =>
    page.evaluate(
      (key) => ({
        center: window[key].getCenter().toArray(),
        zoom: window[key].getZoom(),
      }),
      mapHandle,
    );
  const selectedMapSegments = () =>
    page.evaluate((key) => {
      const sources = window[key].getStyle().sources;
      const source = Object.entries(sources).find(([id]) =>
        decodeURIComponent(id).endsWith("-investigation-connections"),
      )?.[1];
      return source?.data.features
        .filter((feature) => feature.properties.selected)
        .map((feature) => feature.id)
        .sort();
    }, mapHandle);

  async function expectGraph(nodes, edges, roots) {
    // Row histograms change row height. Each rail must retain its location
    // headline anchor after those changes, filtering and responsive wrapping.
    await page.waitForFunction(
      ({ nodeCount, edgeCount }) => {
        const graph = document.querySelector("[data-connection-graph]");
        const circles = graph?.querySelectorAll("[data-event-id]");
        const buttons = document.querySelectorAll(
          'ol[aria-label="Event history"] button',
        );
        return (
          circles?.length === nodeCount &&
          buttons.length === nodeCount &&
          graph.querySelectorAll("[data-connection-id]").length === edgeCount &&
          [...circles].every((circle, index) => {
            const node = circle.getBoundingClientRect();
            const button = buttons[index].getBoundingClientRect();
            return (
              Math.abs(
                node.y + node.height / 2 - button.y - button.height / 2,
              ) < 1.5
            );
          })
        );
      },
      { nodeCount: nodes.length, edgeCount: edges.length },
    );
    assert.deepEqual(
      await graph()
        .locator("[data-event-id]")
        .evaluateAll((nodes) => nodes.map((node) => node.dataset.eventId)),
      nodes,
      "Every canonical observation has one row and one graph node",
    );
    assert.deepEqual(
      await graph()
        .locator("[data-connection-id]")
        .evaluateAll((edges) =>
          edges.map((edge) => edge.dataset.connectionId).sort(),
        ),
      [...edges].sort(),
      "Only supplied connections with both endpoints in this view are drawn",
    );
    if (roots)
      assert.deepEqual(
        await graph()
          .locator('[data-event-id][data-root="true"]')
          .evaluateAll((nodes) => nodes.map((node) => node.dataset.eventId)),
        roots,
        "Independent origins and unassigned observations retain separate roots",
      );
    const geometry = await graph().evaluate(
      (svg, expected) =>
        expected.map(([id, fromId, toId]) => {
          const path = svg.querySelector(`[data-connection-id="${id}"] path`);
          const from = svg.querySelector(`[data-event-id="${fromId}"]`);
          const to = svg.querySelector(`[data-event-id="${toId}"]`);
          const start = path.getPointAtLength(0);
          const end = path.getPointAtLength(path.getTotalLength());
          const distance = (point, node) =>
            Math.hypot(
              point.x - Number(node.getAttribute("cx")),
              point.y - Number(node.getAttribute("cy")),
            );
          return {
            id,
            startDistance: distance(start, from),
            endDistance: distance(end, to),
          };
        }),
      connections.filter(([id]) => edges.includes(id)),
    );
    assert(
      geometry.every(
        ({ startDistance, endDistance }) =>
          startDistance < 0.1 && endDistance < 0.1,
      ),
      `Forks, rejoin and disconnected histories preserve supplied endpoints: ${JSON.stringify(geometry)}`,
    );
  }

  async function expectEvidence(id, expanded = true) {
    const fixture = referenceFixtures[id];
    const row = eventRow(id);
    const rowPlot = row.locator('[data-visualization="histogram"]');
    const bins = fixture.counts.map((count, index) => ({
      from: index * fixture.width,
      to: (index + 1) * fixture.width,
      count,
    }));
    const readBins = (plot) =>
      plot.locator("[data-bin-from]").evaluateAll((bins) =>
        bins.map((bin) => ({
          from: Number(bin.dataset.binFrom),
          to: Number(bin.dataset.binTo),
          count: Number(bin.dataset.binCount),
        })),
      );
    assert(
      await row
        .getByText(`A · Scan interval ${fixture.label}`, { exact: true })
        .isVisible(),
    );
    assert.deepEqual(
      await readBins(rowPlot),
      bins,
      `${id}: row shows the supplied count histogram`,
    );
    const plotBox = await rowPlot.getByRole("img").boundingBox();
    assert(
      plotBox.height >= 31 && plotBox.height <= 33,
      `${id}: row plot stays compact`,
    );
    const expectedOffset =
      (fixture.minutes / 60 / (fixture.width * fixture.counts.length)) * 100;
    assert(
      Math.abs(
        (await rowPlot
          .locator("[data-current-assessment]")
          .evaluate((marker) => parseFloat(marker.style.left))) -
          expectedOffset,
      ) < 0.01,
      `${id}: current marker uses the explicit candidate interval`,
    );
    if (!expanded) return;
    const selectedPlot = details().locator('[data-visualization="histogram"]');
    assert.deepEqual(
      await readBins(selectedPlot),
      bins,
      `${id}: inspector retains the same bins as its row`,
    );
    assert(
      await details().getByText(fixture.previous, { exact: false }).isVisible(),
    );
    assert(
      await details()
        .getByText(
          `Sep 3–Oct 21, 2026 · UTC · n=${fixture.counts.reduce((total, count) => total + count, 0)} reported intervals`,
          { exact: true },
        )
        .isVisible(),
    );
    assert(await selectedPlot.getByText(`0 h`, { exact: true }).isVisible());
    assert(
      await selectedPlot
        .getByText(`${fixture.width * fixture.counts.length} h`, {
          exact: true,
        })
        .isVisible(),
    );
    assert(
      await selectedPlot.getByText("Intervals", { exact: true }).isVisible(),
    );
    const selectedBox = await selectedPlot.getByRole("img").boundingBox();
    assert(
      selectedBox.height >= 99,
      `${id}: expanded reference has a readable count plot`,
    );
    assert.equal(
      await selectedPlot
        .locator('[data-current-assessment="unassessed"]')
        .count(),
      1,
      `${id}: the observation marker does not infer health or event risk`,
    );
  }

  async function expectCompactLayout(width) {
    const header = page
      .getByRole("heading", { name: "Parcel history", exact: true })
      .locator("xpath=ancestor::header[1]");
    const box = await header.boundingBox();
    const pane = await root()
      .locator('[data-view-panel="events"]')
      .boundingBox();
    assert(
      box.height <= (width === 390 ? 96 : 72),
      "The parcel header remains compact",
    );
    assert(
      pane.y - box.y <= (width === 390 ? 180 : 128),
      "Header and history controls do not consume the event pane",
    );
    if (width !== 390) {
      const workspace = await root().boundingBox();
      const map = await root().locator('[data-view-panel="map"]').boundingBox();
      assert(
        Math.abs(pane.width - map.width) <=
          Math.max(pane.width, map.width) * 0.12,
        "The ledger gives its two columns comparable width",
      );
      const canvas = await page.locator(".maplibregl-canvas").boundingBox();
      assert(
        canvas.height >= 223 && canvas.height <= 227,
        "The quiet map stays at its 225px reference height",
      );
      if (width === 800) {
        assert(
          Math.abs(workspace.width - 768) <= 2,
          "The approval comparison uses a 768px-wide component",
        );
        const viewport = await root()
          .locator("[data-timeline-scroll]")
          .boundingBox();
        const last = await eventRow("unassigned-delivery").boundingBox();
        assert(
          last.y + last.height <= viewport.y + viewport.height + 1,
          "All eleven observations fit in the primary comparison capture",
        );
        console.log(
          JSON.stringify({
            ledgerGeometry: {
              surfaceWidth: workspace.width,
              headerHeight: box.height,
              headerToEvents: pane.y - box.y,
              eventColumnWidth: pane.width,
              mapColumnWidth: map.width,
              mapHeight: canvas.height,
              ordinaryRowHeight: (await eventRow("accepted").boundingBox())
                .height,
              transitEvidenceRowHeight: (
                await eventRow("a-transit").boundingBox()
              ).height,
              revisitEvidenceRowHeight: (
                await eventRow("revisit").boundingBox()
              ).height,
              finalRowVisible:
                last.y + last.height <= viewport.y + viewport.height + 1,
            },
          }),
        );
      }
    }
    assert.equal(
      await root()
        .locator(
          "button button, button a[href], button input, button select, button textarea, button summary, summary button",
        )
        .count(),
      0,
      "Selection, chart disclosures and other controls are never nested in buttons",
    );
    assert.equal(
      await timeline().locator('[data-visualization="histogram"]').count(),
      2,
      "Only observations with supplied reference data add row histograms",
    );
    assert.equal(
      await timeline().locator("[data-inline-metrics]").count(),
      2,
      "Unmeasured observations do not retain empty metric wrappers or extra row spacing",
    );
    assert.equal(
      await timeline().getByText("Unassessed", { exact: true }).count(),
      0,
      "Unassessed observations do not add repeated row badges",
    );
  }

  async function expectPathColors(theme) {
    const palette =
      theme === "dark"
        ? { a: "#83a8ff", b: "#c4a1ff", c: "#5fd3c6" }
        : { a: "#2563eb", b: "#7c3aed", c: "#087f8c" };
    for (const [id, color] of Object.entries(palette)) {
      const stripes = graph().locator(`path[data-path-id="${id}"]`);
      assert(
        (await stripes.count()) > 0,
        `History ${id} has a visible graph color`,
      );
      const rgb = `rgb(${[1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16)).join(", ")})`;
      assert.deepEqual(
        [
          ...new Set(
            await stripes.evaluateAll((items) =>
              items.map((item) => getComputedStyle(item).stroke),
            ),
          ),
        ],
        [rgb],
        "Selection preserves the history's graph color",
      );
      assert.equal(
        await histories()
          .locator(`[data-path-id="${id}"]`)
          .getAttribute("data-path-color"),
        color,
      );
      const mapColors = await page.evaluate(
        ({ key, id }) =>
          window[key]
            .getStyle()
            .layers.filter((layer) => layer.id.endsWith(`/path-${id}-dashed`))
            .map((layer) => layer.paint["line-color"]),
        { key: mapHandle, id },
      );
      assert.deepEqual(
        mapColors,
        [color],
        "Graph, history control and map use the same candidate color",
      );
    }
    assert.deepEqual(
      await graph()
        .locator('[data-connection-id="shared-link"] path[data-path-id]')
        .evaluateAll((items) =>
          items.map((item) => item.dataset.pathId).sort(),
        ),
      ["a", "b"],
      "A shared graph connection visibly retains both candidate colors",
    );
  }

  // Keep a limited visual matrix and capture the exact 768px design-comparison
  // width as well as the existing wide and mobile representatives.
  const reviewOnly = process.env.INVESTIGATION_LEDGER_REVIEW_ONLY === "1";
  for (const theme of reviewOnly ? ["light"] : ["light", "dark"]) {
    for (const width of reviewOnly ? [800] : [800, 1200, 390]) {
      await open(
        "branching-histories",
        theme,
        width,
        width === 800 ? 1200 : 1100,
      );
      if (reviewOnly) await screenshot(`branching-histories-${theme}-${width}`);
      await expectGraph(eventIds, connectionIds, independentRoots);
      await expectCompactLayout(width);
      await expectEvidence("revisit", width !== 390);
      await expectPathColors(theme);
      await audit(`branching-histories-${theme}-${width}`);
      if (width !== 390 || theme === "light")
        await screenshot(`branching-histories-${theme}-${width}`);
      if (width === 390) {
        await details()
          .getByRole("button", { name: "Show details", exact: true })
          .click();
        await expectEvidence("revisit");
        await audit(`branching-histories-${theme}-${width}-expanded`);
        if (theme === "light")
          await screenshot("branching-histories-light-390-expanded");
        await showMap();
        await audit(`branching-histories-${theme}-${width}-map`);
        if (theme === "light")
          await screenshot("branching-histories-light-390-map");
      }
    }
  }
  if (reviewOnly) return;

  await open("branching-histories");
  const originalCamera = await camera();
  assert.deepEqual(
    await selectedMapSegments(),
    ["a-out", "a-return"],
    "The map highlights both supplied connections incident to the revisit",
  );
  assert(
    await page.evaluate(
      (key) =>
        window[key]
          .getStyle()
          .layers.some(
            (layer) =>
              layer.id.endsWith("/candidate-selection") &&
              layer.paint?.["line-dasharray"]?.length > 0,
          ),
      mapHandle,
    ),
    "Candidate map highlights remain dashed",
  );
  assert(
    await details()
      .getByRole("heading", { name: "Avondale, AZ", exact: true })
      .isVisible(),
  );
  assert(await details().getByText("Moderate", { exact: true }).isVisible());
  assert(
    await details()
      .getByText("Oct 24 · 11:41 UTC", { exact: true })
      .isVisible(),
  );
  assert.equal(
    await timeline()
      .getByRole("button", { name: /Avondale, AZ/ })
      .count(),
    2,
    "A revisit is a distinct observation at the same location",
  );
  await expectEvidence("revisit");
  assert.equal(
    await eventRow("revisit")
      .getByText(/3 h 29 m/)
      .count(),
    0,
    "The A interval does not use B's preceding chronological observation",
  );

  // Exact bins remain reachable by native keyboard disclosure, independently of
  // event selection; a subsequent event replaces the complete reference.
  const referenceValues = details().getByText("Reference values", {
    exact: true,
  });
  await referenceValues.focus();
  await page.keyboard.press("Enter");
  assert(
    await referenceValues.evaluate((node) => node.closest("details").open),
  );
  assert.equal(
    await eventButton("revisit").getAttribute("aria-current"),
    "true",
  );
  await page.keyboard.press("Enter");
  await eventButton("a-transit").click();
  await expectEvidence("a-transit");
  assert(await details().getByText("Unassessed", { exact: true }).isVisible());
  await eventButton("out-for-delivery").click();
  assert.equal(
    await details().locator('[data-visualization="histogram"]').count(),
    0,
    "A shared multi-parent rejoin does not invent an interval reference",
  );
  assert.deepEqual(
    await graph()
      .locator('[data-connection-id][data-selected="true"]')
      .evaluateAll((edges) =>
        edges.map((edge) => edge.dataset.connectionId).sort(),
      ),
    ["a-out-link", "b-out-link", "delivery-link"],
    "The shared rejoin retains both candidate parents and its one shared delivery continuation",
  );
  await eventButton("accepted").click();
  assert(await details().getByText("Unassessed", { exact: true }).isVisible());
  checks.push("ledger-explicit-candidate-intervals-and-shared-reference-bins");

  await histories().getByRole("button", { name: "B", exact: true }).click();
  assert.equal(
    await timeline().getByRole("button").count(),
    11,
    "Selecting a history preserves canonical observations",
  );
  await root()
    .getByRole("checkbox", { name: "Related only", exact: true })
    .check();
  await expectGraph(
    [
      "accepted",
      "shared-transit",
      "b-transit",
      "out-for-delivery",
      "delivered",
    ],
    ["shared-link", "b-transfer-link", "b-out-link", "delivery-link"],
    ["accepted"],
  );
  await histories().getByRole("button", { name: "A", exact: true }).click();
  await expectGraph(historyA, historyAConnections, ["accepted"]);
  await histories().getByRole("button", { name: "C", exact: true }).click();
  await expectGraph(
    ["c-accepted", "c-delivered"],
    ["c-delivery-link"],
    ["c-accepted"],
  );
  await histories().getByRole("button", { name: "All", exact: true }).click();
  await expectGraph(eventIds, connectionIds, independentRoots);

  // The two Avondale observations are not adjacent on a supplied connection.
  // Filtering to their location must retain two isolated nodes, never a bridge.
  await page
    .getByRole("button", { name: "Select Avondale, AZ", exact: true })
    .click();
  assert(
    await details()
      .getByText("Location · 2 events", { exact: true })
      .isVisible(),
  );
  await expectGraph(["a-transit", "revisit"], [], ["a-transit", "revisit"]);
  // Dismiss the map's independent inspection card before using the persistent
  // inspector underneath it. Escape must not clear the selected location.
  await page.keyboard.press("Escape");
  await page
    .getByRole("region", { name: "Facility details", exact: true })
    .waitFor({ state: "hidden" });
  assert(
    await details()
      .getByText("Location · 2 events", { exact: true })
      .isVisible(),
    "Dismissing the map inspection card retains the selected location",
  );
  for (let i = 0; i < 2; i++)
    await details()
      .getByRole("button", { name: "Next event", exact: true })
      .click();
  assert(
    await details()
      .getByText("Oct 24 · 11:25 UTC", { exact: true })
      .isVisible(),
  );
  await expectEvidence("revisit");
  await histories().getByRole("button", { name: "All", exact: true }).click();
  await expectGraph(eventIds, connectionIds, independentRoots);

  const relationships = root().getByText("9 candidate relationships", {
    exact: true,
  });
  await relationships.focus();
  await page.keyboard.press("Enter");
  const relationshipList = root().getByRole("list", {
    name: "Candidate relationships",
    exact: true,
  });
  assert(await relationshipList.isVisible());
  assert.equal(await relationshipList.getByRole("listitem").count(), 9);
  assert(
    await relationships.evaluate((node) => node === document.activeElement),
  );
  await page.keyboard.press("Enter");

  await eventButton("accepted").focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await eventButton("shared-transit").getAttribute("aria-current"),
    "true",
  );
  assert(
    await eventButton("shared-transit").evaluate(
      (node) => node === document.activeElement,
    ),
    "Arrow navigation follows the focused row",
  );
  await page.keyboard.press("End");
  assert.equal(
    await eventButton("unassigned-delivery").getAttribute("aria-current"),
    "true",
  );
  assert.equal(
    await graph().locator('[data-connection-id][data-selected="true"]').count(),
    0,
  );
  assert(await details().getByText("High risk", { exact: true }).isVisible());
  assert(
    await details()
      .getByText(/No candidate history assigned\./)
      .isVisible(),
  );
  assert.deepEqual(
    await selectedMapSegments(),
    [],
    "An unassigned high-risk observation does not select an unrelated map connection",
  );
  assert.deepEqual(
    await camera(),
    originalCamera,
    "Event, path and location selections preserve the camera",
  );
  checks.push("ledger-fork-rejoin-disjoint-selection-filter-and-keyboard");

  const revisit = eventButton("revisit");
  await revisit.focus();
  await page.keyboard.press("Enter");
  await page.evaluate(() => {
    window.savedLedgerMap = window.ledgerMap;
  });
  await page.setViewportSize({ width: 390, height: 1100 });
  await waitForResponsiveLayout();
  assert(
    await revisit.evaluate((node) => node === document.activeElement),
    "Narrowing retains event focus",
  );
  const eventsTab = page.getByRole("tab", {
    name: "Event history",
    exact: true,
  });
  assert.equal(await eventsTab.getAttribute("aria-selected"), "true");
  await eventsTab.focus();
  await page.keyboard.press("ArrowRight");
  const mapTab = page.getByRole("tab", { name: "Map", exact: true });
  assert(await mapTab.evaluate((node) => node === document.activeElement));
  await waitForMap();
  assert(
    await page.evaluate(() => window.savedLedgerMap === window.ledgerMap),
    "Responsive layout preserves the map instance",
  );
  assert(
    await details()
      .getByText("Oct 24 · 11:25 UTC", { exact: true })
      .isVisible(),
  );
  const narrowCamera = await camera();
  await eventsTab.click();
  assert.equal(await revisit.getAttribute("aria-current"), "true");
  await mapTab.click();
  await waitForMap();
  assert.deepEqual(
    await camera(),
    narrowCamera,
    "Event history/Map switching retains the camera",
  );
  await audit("ledger-mobile-selection-camera-and-focus");

  await open("branching-histories", "light", 390, 640);
  for (const expanded of [false, true]) {
    if (expanded)
      await details()
        .getByRole("button", { name: "Show details", exact: true })
        .click();
    // Normal page flow must keep the inspector reachable without covering the
    // selected event's identity, timestamp or supplied reference strip.
    await details().scrollIntoViewIfNeeded();
    assert(
      await details().evaluate((inspector) => {
        const box = inspector.getBoundingClientRect();
        return box.top >= -1 && box.bottom <= innerHeight + 1;
      }),
      "The short-screen inspector is reachable by normal page scrolling",
    );
    await audit(
      `branching-histories-light-390x640${expanded ? "-expanded" : ""}`,
    );
  }
  await screenshot("branching-histories-light-390x640-expanded");

  await open("compact-ledger");
  await expectGraph(historyA, historyAConnections, ["accepted"]);
  await expectEvidence("a-transit");
  await audit("compact-ledger-light-1200");
  await open("branching-histories-narrow");
  assert.equal(
    await root().getAttribute("data-narrow"),
    "true",
    "The container width controls the narrow layout",
  );
  await expectGraph(eventIds, connectionIds, independentRoots);
  await audit("branching-histories-narrow-light-1200");
  await open("unassigned-delivery");
  await expectGraph(eventIds, connectionIds, independentRoots);
  assert.equal(
    await graph().locator('[data-connection-id][data-selected="true"]').count(),
    0,
  );
  assert(await details().getByText("High risk", { exact: true }).isVisible());
  assert.equal(
    await details().locator('[data-visualization="histogram"]').count(),
    0,
    "A missing reference stays missing independently of event risk",
  );
  await audit("unassigned-delivery-light-1200");
  await screenshot("unassigned-delivery-light-1200");

  for (const theme of ["light", "dark"]) {
    await open("predicted-path-comparison", theme, 800, 1300);
    await expectGraph(eventIds, connectionIds, independentRoots);
    await expectPathColors(theme);
    const comparison = root().getByRole("region", {
      name: "Predicted path comparison",
      exact: true,
    });
    const south = comparison.getByRole("checkbox", {
      name: "Via Santa Rosa",
      exact: true,
    });
    const central = comparison.getByRole("checkbox", {
      name: "Via Kansas City",
      exact: true,
    });
    assert((await south.isChecked()) && (await central.isChecked()));
    const before = await camera();
    const forecasts = () =>
      page.evaluate(
        (key) =>
          window[key]
            .getStyle()
            .layers.filter(
              (layer) =>
                layer.id.includes("forecast-a-") &&
                layer.id.endsWith("/forecast"),
            )
            .map((layer) => ({
              id: layer.id,
              visible: layer.layout?.visibility !== "none",
              dash: layer.paint["line-dasharray"],
            })),
        mapHandle,
      );
    let layers = await forecasts();
    assert.equal(
      layers.filter((layer) => layer.visible).length,
      2,
      "Both supplied predictions can be overlaid together",
    );
    assert.notDeepEqual(
      layers[0].dash,
      layers[1].dash,
      "Alternative predictions retain distinct patterns",
    );
    await root()
      .getByRole("checkbox", { name: "Related only", exact: true })
      .check();
    await expectGraph(historyA, historyAConnections, ["accepted"]);
    await audit(`predicted-path-comparison-${theme}-800`);
    await screenshot(`predicted-path-comparison-${theme}-800`);
    await root()
      .locator('[data-view-panel="map"]')
      .screenshot({
        path: `${output}/predicted-path-map-${theme}-800.png`,
        scale: "css",
      });
    await root()
      .getByRole("checkbox", { name: "Related only", exact: true })
      .uncheck();
    await south.focus();
    await page.keyboard.press("Space");
    await waitForMap();
    layers = await forecasts();
    assert.equal(
      layers.filter((layer) => layer.visible).length,
      1,
      "Forecast visibility controls are independent",
    );
    assert.equal(
      await timeline().getByRole("button").count(),
      11,
      "Predictions do not fabricate timeline observations",
    );
    await details()
      .getByRole("button", { name: "Next event", exact: true })
      .click();
    assert(
      await comparison.isVisible(),
      "Stepping within a focused candidate retains its comparison",
    );
    assert(!(await south.isChecked()) && (await central.isChecked()));
    await histories().getByRole("button", { name: "B", exact: true }).click();
    assert.equal(
      await comparison.count(),
      0,
      "A's predictions are hidden while inspecting B",
    );
    await waitForMap();
    assert.equal(
      (await forecasts()).filter((layer) => layer.visible).length,
      0,
    );
    await histories().getByRole("button", { name: "A", exact: true }).click();
    assert(
      !(await south.isChecked()) && (await central.isChecked()),
      "Returning to A retains the user's overlay choices",
    );
    await histories().getByRole("button", { name: "All", exact: true }).click();
    await waitForMap();
    assert.equal(
      await comparison.count(),
      0,
      "All-history overview has no forecast comparison controls",
    );
    assert.equal(
      (await forecasts()).filter((layer) => layer.visible).length,
      0,
    );
    assert.deepEqual(
      await camera(),
      before,
      "Prediction toggles and focused comparison do not reset the camera",
    );
    await expectGraph(eventIds, connectionIds, independentRoots);
    checks.push(`focused-predictions-${theme}-scope-visibility-camera`);
  }
  await open("predicted-path-comparison-narrow", "light", 390, 900);
  await showMap();
  const narrowComparison = root().getByRole("region", {
    name: "Predicted path comparison",
    exact: true,
  });
  assert(await narrowComparison.isVisible());
  const narrowBefore = await camera();
  await narrowComparison
    .getByRole("checkbox", { name: "Via Santa Rosa", exact: true })
    .uncheck();
  await page.getByRole("tab", { name: "Event history", exact: true }).click();
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  await waitForMap();
  assert(
    !(await narrowComparison
      .getByRole("checkbox", { name: "Via Santa Rosa", exact: true })
      .isChecked()),
  );
  assert.deepEqual(
    await camera(),
    narrowBefore,
    "Narrow prediction controls preserve overlay choice and camera across views",
  );
  await audit("predicted-path-comparison-narrow-map");
  await screenshot("predicted-path-comparison-light-390-map");
  await open("branching-histories", "light", 800, 1200);
  await page.emulateMedia({ forcedColors: "active" });
  const forced = await graph().evaluate((svg) => {
    const systemColor = (name) => {
      const probe = document.createElement("span");
      probe.style.color = name;
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    return {
      shared: getComputedStyle(svg.querySelector('[data-event-id="accepted"]'))
        .stroke,
      selected: getComputedStyle(svg.querySelector('[data-event-id="revisit"]'))
        .stroke,
      text: systemColor("CanvasText"),
      highlight: systemColor("Highlight"),
    };
  });
  assert.equal(
    forced.shared,
    forced.text,
    "Unselected shared nodes use system text in forced colors",
  );
  assert.equal(
    forced.selected,
    forced.highlight,
    "Selected colored nodes use system highlight in forced colors",
  );
  await page.emulateMedia({ forcedColors: "none" });
  checks.push("candidate-colors-forced-color-equivalent");
}

async function checkDefault() {
  const stories = [
    "linked-selection",
    "shared-connection",
    "conflicting-histories",
    "multiple-events-at-location",
    "unlocated-event",
    "location-without-events",
    "narrow",
    "selection-without-charts",
    "external-selection",
    "empty-events",
    "scoped-event",
  ];
  for (const theme of process.env.INVESTIGATION_INTERACTIONS_ONLY
    ? []
    : ["light", "dark"]) {
    for (const width of [1200, 390]) {
      for (const story of stories) {
        await open(story, theme, width);
        await audit(`${story}-${theme}-${width}`);
        if (
          [
            "linked-selection",
            "shared-connection",
            "unlocated-event",
            "scoped-event",
            "selection-without-charts",
          ].includes(story)
        )
          await screenshot(`${story}-${theme}-${width}`);
        if ((await root().getAttribute("data-narrow")) === "true") {
          await showMap();
          await audit(`${story}-${theme}-${width}-map`);
          assert(
            await page.evaluate(() => {
              const map = window.investigationMap;
              const box = map.getCanvas();
              return [
                [-3, 0],
                [-0.8, 0],
                [1, 1],
                [1, -1],
                [3, 0],
                [-2, 1.3],
              ].every((coordinate) => {
                const point = map.project(coordinate);
                return (
                  point.x >= 12 &&
                  point.x <= box.clientWidth - 12 &&
                  point.y >= 12 &&
                  point.y <= box.clientHeight - 12
                );
              });
            }),
            `${story}: initial map frame contains every location`,
          );
          assert(
            await page.evaluate(() => {
              const markers = [
                ...document.querySelectorAll(".maplibregl-marker"),
              ];
              const labels = markers
                .map((marker) => marker.lastElementChild)
                .filter(
                  (label) => getComputedStyle(label).visibility === "visible",
                );
              return labels.every((label) => {
                const box = label.getBoundingClientRect();
                return markers.every((marker) => {
                  if (marker === label.parentElement) return true;
                  const pin = marker.firstElementChild.getBoundingClientRect();
                  return (
                    box.right <= pin.left ||
                    box.left >= pin.right ||
                    box.bottom <= pin.top ||
                    box.top >= pin.bottom
                  );
                });
              });
            }),
            `${story}: map labels do not cover location markers`,
          );
          if (story === "linked-selection") {
            await screenshot(`${story}-${theme}-${width}-map`);
            await details()
              .getByRole("button", { name: "Show details", exact: true })
              .click();
            await audit(`${story}-${theme}-${width}-expanded`);
            await screenshot(`${story}-${theme}-${width}-expanded`);
          }
        }
      }
    }
  }
  await open("linked-selection", "light", 820);
  await audit("linked-selection-tablet");
  await open("linked-selection");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await audit("linked-selection-desktop-large-text");
  await screenshot("linked-selection-desktop-large-text");
  await open("linked-selection");
  const originalCamera = await page.evaluate(() => ({
    center: window.investigationMap.getCenter().toArray(),
    zoom: window.investigationMap.getZoom(),
  }));
  await timeline()
    .getByRole("button", { name: /Processed at North Gate/ })
    .click();
  assert(
    await details()
      .getByRole("heading", { name: "Processed at North Gate" })
      .isVisible(),
  );
  assert.equal(
    await page
      .locator('.maplibregl-marker[aria-pressed="true"]')
      .getAttribute("aria-label"),
    "Select North Gate",
  );
  // Hover a different marker without changing persistent selection.
  await page
    .locator(".maplibregl-marker")
    .filter({ hasText: "" })
    .first()
    .hover();
  assert(
    await details()
      .getByRole("heading", { name: "Processed at North Gate" })
      .isVisible(),
  );
  await page
    .getByRole("button", { name: "Select Central Exchange", exact: true })
    .click();
  assert(await details().getByText("Location · 3 events").isVisible());
  await page
    .getByRole("region", { name: "Facility details", exact: true })
    .waitFor({
      state: "hidden",
    });
  await details()
    .getByRole("button", { name: "Next event", exact: true })
    .click();
  assert(await details().getByText("10:34", { exact: true }).isVisible());
  await details()
    .getByRole("button", { name: "Next event", exact: true })
    .click();
  assert(await details().getByText("11:05", { exact: true }).isVisible());
  // Select the physical midpoint of the shared connection through the map hit layer.
  await page.keyboard.press("Escape");
  await page.locator(".maplibregl-canvas").scrollIntoViewIfNeeded();
  await waitForMap();
  const point = await page.evaluate(() => {
    const map = window.investigationMap;
    const point = map.project([-1.9, 0]);
    const box = map.getCanvas().getBoundingClientRect();
    return { x: point.x + box.x, y: point.y + box.y };
  });
  await page.mouse.click(point.x, point.y);
  await details()
    .getByRole("heading", {
      name: "North Harbor → Central Exchange",
      exact: true,
    })
    .waitFor();
  assert(
    await details()
      .getByRole("heading", {
        name: "North Harbor → Central Exchange",
        exact: true,
      })
      .isVisible(),
  );
  assert(
    await root()
      .getByRole("button", { name: "Via North Gate", exact: true })
      .isVisible(),
  );
  assert(
    await root()
      .getByRole("button", { name: "Via South Gate", exact: true })
      .isVisible(),
  );
  await root()
    .getByRole("button", { name: "Via South Gate", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await timeline()
    .getByRole("button", { name: /Location not reported/ })
    .focus();
  await page.keyboard.press("Enter");
  assert(
    await details().getByText("Not supplied", { exact: true }).isVisible(),
  );
  assert.equal(
    await page.locator('.maplibregl-marker[aria-pressed="true"]').count(),
    0,
  );
  const currentCamera = await page.evaluate(() => ({
    center: window.investigationMap.getCenter().toArray(),
    zoom: window.investigationMap.getZoom(),
  }));
  assert.deepEqual(
    currentCamera,
    originalCamera,
    "Selection must not reset camera",
  );
  // Responsive layout changes preserve the same mounted map and selection.
  await page.evaluate(() => {
    window.savedInvestigationMap = window.investigationMap;
  });
  await page.setViewportSize({ width: 390, height: 1100 });
  await page.getByRole("tab", { name: "Events", exact: true }).waitFor();
  await page.getByRole("tab", { name: "Events", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  assert(
    await page
      .getByRole("tab", { name: "Map", exact: true })
      .evaluate((tab) => tab === document.activeElement),
  );
  await waitForMap();
  assert(
    await details()
      .getByRole("heading", { name: "Location not reported" })
      .isVisible(),
  );
  assert(
    await page.evaluate(
      () => window.savedInvestigationMap === window.investigationMap,
    ),
  );
  await page
    .getByText("Browse locations and connections", { exact: true })
    .click();
  await page.getByRole("button", { name: "West Annex", exact: true }).focus();
  await page.keyboard.press("Enter");
  assert(await details().getByText("Location · 0 events").isVisible());
  const retainedCamera = await page.evaluate(() => ({
    center: window.investigationMap.getCenter().toArray(),
    zoom: window.investigationMap.getZoom(),
  }));
  await page.getByRole("tab", { name: "Events", exact: true }).click();
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  await waitForMap();
  assert.deepEqual(
    await page.evaluate(() => ({
      center: window.investigationMap.getCenter().toArray(),
      zoom: window.investigationMap.getZoom(),
    })),
    retainedCamera,
    "Tab switching preserves camera",
  );
  await audit("linked-keyboard-pointer-and-resize");
  await open("scoped-event");
  assert(
    await details()
      .getByText("Via North Gate · Event 2 of 4", { exact: true })
      .isVisible(),
  );
  assert.equal(await timeline().locator('[data-related="true"]').count(), 4);
  await page.getByRole("checkbox", { name: "Related only" }).check();
  assert.equal(await timeline().getByRole("button").count(), 4);
  await details()
    .getByRole("button", { name: "Next event", exact: true })
    .click();
  assert(
    await details()
      .getByText("Via North Gate · Event 3 of 4", { exact: true })
      .isVisible(),
  );
  await details()
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  assert.equal(await timeline().getByRole("button").count(), 7);
  await audit("scoped-timeline-filter-and-stepping");
  await open("external-selection");
  await page
    .getByRole("button", { name: "Select unlocated event externally" })
    .click();
  await page.getByRole("button", { name: "Refresh records" }).click();
  assert(
    await details()
      .getByRole("heading", { name: "Location not reported" })
      .isVisible(),
  );
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page.setViewportSize({ width: 390, height: 1100 });
  await audit("external-selection-refresh-large-text");
  await open("control-placement");
  await page.evaluate(() => {
    window.savedInvestigationMap = window.investigationMap;
    window.savedInvestigationCanvas = window.investigationMap.getCanvas();
    window.investigationMap.jumpTo({ center: [0.4, 0.3], zoom: 5 });
  });
  await waitForMap();
  const chosenCamera = await page.evaluate(() => ({
    center: window.investigationMap.getCenter().toArray(),
    zoom: window.investigationMap.getZoom(),
  }));
  for (const placement of ["toolbar", "map"]) {
    await page
      .getByRole("button", {
        name: `Move controls to ${placement}`,
        exact: true,
      })
      .click();
    await waitForMap();
    assert(
      await page.evaluate(
        () =>
          window.savedInvestigationMap === window.investigationMap &&
          window.savedInvestigationCanvas ===
            window.investigationMap.getCanvas(),
      ),
      "Control placement preserves the map and canvas",
    );
    assert.deepEqual(
      await page.evaluate(() => ({
        center: window.investigationMap.getCenter().toArray(),
        zoom: window.investigationMap.getZoom(),
      })),
      chosenCamera,
      "Control placement preserves the chosen camera",
    );
    await audit(`control-placement-${placement}`);
  }

  await open("linked-selection");
  const marker = page.getByRole("button", {
    name: "Select Central Exchange",
    exact: true,
  });
  await marker.focus();
  await page.setViewportSize({ width: 390, height: 1100 });
  await waitForResponsiveLayout();
  await waitForMap();
  assert.equal(
    await page
      .getByRole("tab", { name: "Map", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  assert(
    await marker.evaluate((node) => node === document.activeElement),
    "Narrowing keeps the focused map marker visible",
  );
  await page.getByRole("tab", { name: "Map", exact: true }).focus();
  await page.setViewportSize({ width: 1200, height: 1100 });
  await waitForResponsiveLayout();
  assert(
    await root()
      .locator('[data-view-panel="map"]')
      .evaluate((node) => node === document.activeElement),
    "Widening moves map-tab focus to its panel",
  );
  const eventButton = timeline().getByRole("button", {
    name: /08:00.*Accepted/,
  });
  await eventButton.focus();
  await page.setViewportSize({ width: 390, height: 1100 });
  await waitForResponsiveLayout();
  assert.equal(
    await page
      .getByRole("tab", { name: "Events", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  assert(
    await eventButton.evaluate((node) => node === document.activeElement),
    "Narrowing keeps the focused event visible",
  );
  await page.getByRole("tab", { name: "Events", exact: true }).focus();
  await page.setViewportSize({ width: 1200, height: 1100 });
  await waitForResponsiveLayout();
  assert(
    await root()
      .locator('[data-view-panel="events"]')
      .evaluate((node) => node === document.activeElement),
    "Widening moves events-tab focus to its panel",
  );
  await audit("responsive-focus-preservation");

  await open("external-selection");
  const outsideButton = page.getByRole("button", {
    name: "Refresh records",
    exact: true,
  });
  await outsideButton.focus();
  for (const width of [390, 1200]) {
    await page.setViewportSize({ width, height: 1100 });
    await waitForResponsiveLayout();
    assert(
      await outsideButton.evaluate((node) => node === document.activeElement),
      "Responsive layout does not steal outside focus",
    );
  }
  await audit("responsive-outside-focus");
}

try {
  if (ledgerOnly) await checkLedger();
  else await checkDefault();
  assert.deepEqual(errors, [], "Browser runtime errors");
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ checks, errors, violations: 0 }, null, 2),
  );
  console.log(JSON.stringify({ checks: checks.length, violations: 0 }));
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  throw error;
} finally {
  await browser.close();
}
