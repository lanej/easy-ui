import assert from "node:assert/strict";
const cameras = () =>
  Object.fromEntries(
    Object.entries(window.journeyMaps).map(([id, map]) => [
      id,
      { center: map.getCenter().toArray(), zoom: map.getZoom() },
    ]),
  );
const overviewReady = () =>
  window.journeyMaps &&
  Object.keys(window.journeyMaps).length === 1 &&
  Object.values(window.journeyMaps).every(
    (map) => map.loaded() && !map.isMoving(),
  ) &&
  document.querySelectorAll('[data-map-state="ready"]').length === 1;
const insetReady = () =>
  window.journeyMaps &&
  Object.keys(window.journeyMaps).length === 2 &&
  Object.values(window.journeyMaps).every(
    (map) => map.loaded() && !map.isMoving(),
  ) &&
  document.querySelectorAll('[data-map-state="ready"]').length === 2;
const marker = (id) =>
  `[data-map-geography] > [data-map-state] [data-map-facility-id="${id}"]`;
const section = (id) => `[data-map-zoom-section="${id}"]`;
const bounded = () => {
  const frame = document
    .querySelector("[data-map-geography]")
    .getBoundingClientRect();
  const card = document
    .querySelector("[data-map-zoom-section]")
    ?.getBoundingClientRect();
  return (
    document.documentElement.scrollWidth <= innerWidth + 1 &&
    card &&
    card.left >= frame.left &&
    card.right <= frame.right &&
    card.top >= frame.top &&
    card.bottom <= frame.bottom
  );
};
export async function checkJourneySections({
  browser,
  base,
  check,
  capture,
  scan,
  clean,
}) {
  for (const theme of ["light", "dark"])
    for (const width of [1440, 390]) {
      const name = `${theme}/${width}`;
      await browser.resize(width, 1100);
      await browser.open(`${base}/journey.html?local=1&theme=${theme}`);
      await browser.wait(overviewReady);
      const initial = await browser.evaluate(cameras);
      check(
        `${name}: zoomed-out journey starts with one map and no inset`,
        await browser.evaluate(
          () =>
            !document.querySelector("[data-map-zoom-section]") &&
            document.querySelectorAll(".maplibregl-map").length === 1,
        ),
      );
      check(
        `${name}: crowded stops advertise nearby locations without opening anything`,
        await browser.evaluate(
          () =>
            [...document.querySelectorAll("[data-map-inset-count]")].length ===
              2 &&
            [...document.querySelectorAll("[data-map-inset-count]")].every(
              (node) =>
                node.dataset.mapInsetCount === "2" &&
                node.getAttribute("aria-label").includes("Close-up available"),
            ),
        ),
      );
      await capture(`journey-sections-${theme}-${width}`);
      await scan(`journey-sections-${theme}-${width}`);
      await browser.key(marker("slc"), "Enter");
      await browser.wait(overviewReady);
      check(
        `${name}: ordinary stop selection keeps the overview clean`,
        await browser.evaluate(
          () => !document.querySelector("[data-map-zoom-section]"),
        ),
      );
      assert.deepEqual(
        await browser.evaluate(cameras),
        initial,
        "Selection does not change the overview camera",
      );
      await browser.key(marker("oak"), "Enter");
      await browser.wait(insetReady);
      const opened = await browser.evaluate(cameras);
      check(
        `${name}: clicking a crowded node opens one bounded origin close-up`,
        (await browser.evaluate(bounded)) &&
          (await browser.evaluate(
            () =>
              document.querySelectorAll("[data-map-zoom-section]").length ===
                1 && document.querySelector('[data-map-zoom-section="origin"]'),
          )),
      );
      check(
        `${name}: the close-up enlarges local handoffs without moving the journey`,
        opened.origin.zoom > initial.overview.zoom + 4 &&
          JSON.stringify(opened.overview) === JSON.stringify(initial.overview),
      );
      check(
        `${name}: origin retains local evidence and its outbound journey connection`,
        await browser.evaluate(async () => {
          const data = await window.journeyMaps.origin
            .getSource("easy-ui-transfers")
            .getData();
          return (
            data.features.length === 3 &&
            data.features.every((f) => f.properties.evidence === "transfer") &&
            data.features.some((f) => f.properties.id === "origin-sort-slc")
          );
        }),
      );
      check(
        `${name}: local labels and a geographic leader remain visible`,
        await browser.evaluate(
          () =>
            document.querySelectorAll("[data-map-inset-leader]").length === 1 &&
            [
              ...document.querySelectorAll(
                '[data-map-zoom-section] [data-map-label="true"]',
              ),
            ].length === 3 &&
            [
              ...document.querySelectorAll(
                '[data-map-zoom-section] [data-map-label="true"]',
              ),
            ].every((n) => n.style.visibility === "visible"),
        ),
      );
      check(
        `${name}: the outbound continuation names the next off-inset facility`,
        await browser.evaluate(() => {
          const link = document.querySelector('[data-map-journey-link="slc"]');
          return (
            link?.textContent.includes("To Salt Lake City hub") &&
            link.dataset.mapJourneyDirection === "to" &&
            !document.querySelector(
              '[data-map-zoom-section] [data-map-facility-id="slc"]',
            )
          );
        }),
      );
      await browser.key('[data-map-journey-link="slc"]', "Enter");
      await browser.wait(() =>
        Boolean(
          document.querySelector(
            '[data-map-geography] > [data-map-state] [data-map-facility-id="slc"][data-selected="true"]',
          ),
        ),
      );
      check(
        `${name}: selecting the continuation preserves the requested inset and both cameras`,
        JSON.stringify(await browser.evaluate(cameras)) ===
          JSON.stringify(opened),
      );
      await browser.evaluate(() => {
        window.journeyBefore = { ...window.journeyMaps };
      });
      await browser.key(
        `${section("origin")} [data-map-facility-id="acceptance"]`,
        "Enter",
      );
      await browser.wait(
        () =>
          document.querySelectorAll(
            '[data-map-facility-id="acceptance"][data-selected="true"]',
          ).length === 2,
      );
      assert.deepEqual(
        await browser.evaluate(cameras),
        opened,
        "Shared selection preserves both cameras",
      );
      await browser.clickNamed("button", "Refresh records");
      await browser.wait(() => document.body.innerText.includes("Updated"));
      await browser.wait(insetReady);
      check(
        `${name}: record refresh preserves the requested inset, selection and both map instances`,
        await browser.evaluate(() =>
          Object.entries(window.journeyMaps).every(
            ([id, map]) => window.journeyBefore[id] === map,
          ),
        ),
      );
      assert.deepEqual(
        await browser.evaluate(cameras),
        opened,
        "Refresh preserves cameras",
      );
      await browser.click(`${section("origin")} .maplibregl-ctrl-zoom-in`);
      await browser.wait(insetReady);
      const zoomed = await browser.evaluate(cameras);
      check(
        `${name}: inset navigation leaves the main map unchanged`,
        zoomed.origin.zoom > opened.origin.zoom &&
          JSON.stringify(zoomed.overview) === JSON.stringify(initial.overview),
      );
      await browser.key(
        `${section("origin")} header button:not([aria-label])`,
        "Enter",
      );
      await browser.wait(insetReady);
      check(
        `${name}: local Fit restores the close-up without moving the journey`,
        Math.abs(
          (await browser.evaluate(cameras)).origin.zoom - opened.origin.zoom,
        ) < 0.001,
      );
      await capture(`journey-origin-${theme}-${width}`);
      await scan(`journey-origin-${theme}-${width}`);
      await browser.key(
        `${section("origin")} header button:not([aria-label])`,
        "Escape",
      );
      await browser.wait(overviewReady);
      check(
        `${name}: Escape dismisses and returns focus to its source stop`,
        await browser.evaluate(
          () =>
            !document.querySelector("[data-map-zoom-section]") &&
            document.activeElement.dataset.mapFacilityId === "oak",
        ),
      );
      await browser.key(marker("dbn"), "Enter");
      await browser.wait(insetReady);
      check(
        `${name}: another crowded stop opens only its destination close-up`,
        (await browser.evaluate(bounded)) &&
          (await browser.evaluate(
            () =>
              Object.keys(window.journeyMaps).join(",") ===
                "overview,destination" &&
              document.querySelectorAll("[data-map-zoom-section]").length === 1,
          )),
      );
      check(
        `${name}: destination preserves planned evidence`,
        await browser.evaluate(async () => {
          const data = await window.journeyMaps.destination
            .getSource("easy-ui-transfers")
            .getData();
          return (
            data.features.length === 3 &&
            data.features.some((f) => f.properties.evidence === "planned") &&
            data.features.some((f) => f.properties.id === "chi-dtw")
          );
        }),
      );
      check(
        `${name}: the destination names its incoming off-inset facility`,
        await browser.evaluate(() => {
          const link = document.querySelector('[data-map-journey-link="chi"]');
          return (
            link?.textContent.includes("From Chicago sort hub") &&
            link.dataset.mapJourneyDirection === "from"
          );
        }),
      );
      await browser.clickNamed("checkbox", "Facility risk");
      await browser.wait(insetReady);
      check(
        `${name}: facility risk stays shared with the requested inset`,
        await browser.evaluate(() =>
          [
            ...document.querySelectorAll(
              "[data-map-zoom-section] [data-map-facility-id]",
            ),
          ].every((node) => {
            const main = [
              ...document.querySelectorAll(
                "[data-map-geography] > [data-map-state] [data-map-facility-id]",
              ),
            ].find(
              (item) =>
                item.dataset.mapFacilityId === node.dataset.mapFacilityId,
            );
            return main && main.dataset.risk === node.dataset.risk;
          }),
        ),
      );
      await capture(`journey-destination-${theme}-${width}`);
      await scan(`journey-destination-${theme}-${width}`);
      await browser.clickNamed("button", "Close close-up");
      await browser.wait(overviewReady);
      check(
        `${name}: Close returns to the same journey with availability still indicated`,
        (await browser.evaluate(
          () =>
            !document.querySelector("[data-map-zoom-section]") &&
            document.querySelectorAll("[data-map-inset-count]").length === 2,
        )) &&
          JSON.stringify((await browser.evaluate(cameras)).overview) ===
            JSON.stringify(initial.overview),
      );
      await browser.key(marker("oak"), "Enter");
      await browser.wait(insetReady);
      await browser.clickNamed("button", "Entire journey");
      await browser.wait(overviewReady);
      check(
        `${name}: Entire journey dismisses even when the overview is already at its full-route fit`,
        await browser.evaluate(
          () => !document.querySelector("[data-map-zoom-section]"),
        ),
      );
      await browser.key(marker("oak"), "Enter");
      await browser.wait(insetReady);
      await browser.evaluate(() => {
        window.journeyMaps.overview.fitBounds(
          [
            [-122.24, 37.741],
            [-122.212, 37.79],
          ],
          { padding: 80, maxZoom: 13, duration: 0 },
        );
      });
      await browser.wait(overviewReady);
      check(
        `${name}: zooming the main view to readable local stops removes the inset and indicator`,
        await browser.evaluate(
          () =>
            !document.querySelector("[data-map-zoom-section]") &&
            [...document.querySelectorAll("[data-map-inset-available]")].filter(
              (n) =>
                ["oak", "acceptance", "origin-sort"].includes(
                  n.dataset.mapFacilityId,
                ),
            ).length === 0,
        ),
      );
      await browser.key(marker("acceptance"), "Enter");
      await browser.wait(overviewReady);
      check(
        `${name}: readable local nodes do not reopen a redundant inset`,
        await browser.evaluate(
          () => !document.querySelector("[data-map-zoom-section]"),
        ),
      );
      await browser.clickNamed("button", "Entire journey");
      await browser.wait(overviewReady);
      check(
        `${name}: returning to the fully zoomed-out journey advertises availability without reopening`,
        await browser.evaluate(
          () =>
            !document.querySelector("[data-map-zoom-section]") &&
            document.querySelectorAll("[data-map-inset-count]").length === 2,
        ),
      );
      await browser.key(marker("dbn"), "Enter");
      await browser.wait(insetReady);
      await browser.click(
        "[data-map-geography] > [data-map-state] .maplibregl-ctrl-zoom-out",
      );
      await browser.wait(overviewReady);
      check(
        `${name}: zooming out dismisses the requested inset`,
        await browser.evaluate(
          () => !document.querySelector("[data-map-zoom-section]"),
        ),
      );
      if (clean) await clean(`journey-sections-${theme}-${width}`);
    }
  await browser.resize(390, 1100);
  await browser.open(`${base}/journey.html?local=1&theme=dark&large=1&empty=1`);
  await browser.wait(overviewReady);
  check(
    "Unmapped groups have no misleading close-up indicator or world-map inset",
    await browser.evaluate(
      () =>
        !document.querySelector('[data-map-inset-available="missing"]') &&
        !document.querySelector("[data-map-zoom-section]"),
    ),
  );
  await browser.key(marker("oak"), "Enter");
  await browser.wait(insetReady);
  check(
    "Large text close-up remains bounded and leaves native overview navigation accessible",
    await browser.evaluate(() => {
      const frame = document
          .querySelector("[data-map-geography]")
          .getBoundingClientRect(),
        card = document
          .querySelector("[data-map-zoom-section]")
          .getBoundingClientRect(),
        nav = document
          .querySelector(
            "[data-map-geography] > [data-map-state] .maplibregl-ctrl-zoom-in",
          )
          .getBoundingClientRect();
      return (
        document.documentElement.scrollWidth <= innerWidth + 1 &&
        card.left >= frame.left &&
        card.right <= frame.right &&
        card.top >= frame.top &&
        card.bottom <= frame.bottom &&
        (nav.bottom <= card.top ||
          nav.top >= card.bottom ||
          nav.right <= card.left ||
          nav.left >= card.right)
      );
    }),
  );
  await capture("journey-sections-large-text-empty-mobile");
  await scan("journey-sections-large-text-empty-mobile");
  for (const width of [1440, 390]) {
    await browser.resize(width, 1100);
    await browser.open(`${base}/journey.html?local=1&tall=1&weighted=1`);
    await browser.wait(overviewReady);
    await browser.key(marker("oak"), "Enter");
    await browser.wait(insetReady);
    check(
      `Custom-height close-up stays inside the ${width}px journey frame`,
      (await browser.evaluate(bounded)) &&
        (await browser.evaluate(() => {
          const card = document
            .querySelector("[data-map-zoom-section]")
            .getBoundingClientRect();
          const navigation = document
            .querySelector(
              "[data-map-geography] > [data-map-state] .maplibregl-ctrl-group",
            )
            .getBoundingClientRect();
          return (
            window.journeyMaps.origin.getContainer().clientHeight < 1000 &&
            (navigation.bottom <= card.top ||
              navigation.top >= card.bottom ||
              navigation.right <= card.left ||
              navigation.left >= card.right)
          );
        })),
    );
    const widthsMatch = async () => {
      const main = await window.journeyMaps.overview
        .getSource("easy-ui-transfers")
        .getData();
      const local = await window.journeyMaps.origin
        .getSource("easy-ui-transfers")
        .getData();
      return (
        local.features.length === 3 &&
        local.features.every(
          (feature) =>
            feature.properties.width ===
            main.features.find((other) => other.id === feature.id)?.properties
              .width,
        )
      );
    };
    check(
      `Local flow widths share the overview scale at ${width}px`,
      await browser.evaluate(widthsMatch),
    );
    const before = await browser.evaluate(cameras);
    const initialWidth = await browser.evaluate(async () => {
      window.journeyBefore = { ...window.journeyMaps };
      const data = await window.journeyMaps.origin
        .getSource("easy-ui-transfers")
        .getData();
      return data.features[0].properties.width;
    });
    await browser.clickNamed("button", "Refresh records");
    await browser.wait(() =>
      document
        .querySelector(
          '[data-map-zoom-section] [data-map-facility-id="acceptance"]',
        )
        ?.getAttribute("aria-label")
        ?.includes("Updated"),
    );
    await browser.wait(insetReady);
    check(
      `Off-inset flow changes update the shared width scale at ${width}px`,
      (await browser.evaluate(widthsMatch)) &&
        (await browser.evaluate(async (previous) => {
          const data = await window.journeyMaps.origin
            .getSource("easy-ui-transfers")
            .getData();
          return data.features[0].properties.width < previous;
        }, initialWidth)),
    );
    check(
      `Flow refresh preserves both maps and cameras at ${width}px`,
      JSON.stringify(await browser.evaluate(cameras)) ===
        JSON.stringify(before) &&
        (await browser.evaluate(() =>
          Object.entries(window.journeyMaps).every(
            ([id, map]) => window.journeyBefore[id] === map,
          ),
        )),
    );
  }
  for (const width of [1440, 390]) {
    await browser.resize(width, 1100);
    await browser.open(`${base}/journey.html?local=1&metrics=1`);
    await browser.wait(overviewReady);
    await browser.clickNamed("radio", "Delivery-time spread");
    await browser.key(marker("oak"), "Enter");
    await browser.wait(insetReady);
    const before = await browser.evaluate(cameras);
    await browser.evaluate(() => {
      window.journeyBefore = { ...window.journeyMaps };
    });
    const paintsMatch = (field) => {
      const maps = Object.values(window.journeyMaps);
      const paints = maps.map((map) =>
        JSON.stringify(
          map.getPaintProperty("easy-ui-delivery-surface-fill", "fill-color"),
        ),
      );
      const filters = maps.map((map) =>
        JSON.stringify(map.getFilter("easy-ui-delivery-surface-fill")),
      );
      return (
        maps.length === 2 &&
        paints[0] === paints[1] &&
        paints[0].includes(JSON.stringify(["get", field])) &&
        filters[0] === filters[1]
      );
    };
    check(
      `Opening a close-up inherits the selected spread metric at ${width}px`,
      await browser.evaluate(paintsMatch, "iqrMinutes"),
    );
    check(
      `The shared legend describes spread at ${width}px`,
      await browser.evaluate(() =>
        document
          .querySelector('[aria-label="Delivery time surface legend"]')
          .textContent.includes("Delivery-time spread:"),
      ),
    );
    await capture(`journey-metrics-spread-${width}`);
    await scan(`journey-metrics-spread-${width}`);
    for (const [label, field] of [
      ["Observations", "n"],
      ["Median delivery time", "medianMinutes"],
      ["Delivery-time spread", "iqrMinutes"],
    ]) {
      await browser.clickNamed("radio", label);
      await browser.wait(insetReady);
      check(
        `Switching to ${label} updates both surfaces at ${width}px`,
        await browser.evaluate(paintsMatch, field),
      );
    }
    await browser.clickNamed("button", "Refresh records");
    await browser.wait(() =>
      document
        .querySelector(
          '[data-map-zoom-section] [data-map-facility-id="acceptance"]',
        )
        ?.getAttribute("aria-label")
        ?.includes("Updated"),
    );
    await browser.wait(insetReady);
    check(
      `Refreshed metric definitions stay synchronized at ${width}px`,
      await browser.evaluate(paintsMatch, "iqrMinutes"),
    );
    check(
      `Metric switches and refreshes preserve both cameras and map instances at ${width}px`,
      JSON.stringify(await browser.evaluate(cameras)) ===
        JSON.stringify(before) &&
        (await browser.evaluate(() =>
          Object.entries(window.journeyMaps).every(
            ([id, map]) => window.journeyBefore[id] === map,
          ),
        )),
    );
    if (clean) await clean(`journey-metrics-${width}`);
  }
  await browser.resize(1440, 1100);
  await browser.open(`${base}/journey.html?local=1&clustered=1`);
  await browser.wait(overviewReady);
  const clusteredCamera = await browser.evaluate(cameras);
  const clusterPoint = () => {
    const map = window.journeyMaps.overview;
    const feature = map
      .queryRenderedFeatures({ layers: ["easy-ui-facility-cluster-circles"] })
      .find((item) => item.geometry.coordinates[0] < -120);
    if (!feature) throw new Error("Origin cluster is unavailable");
    const point = map.project(feature.geometry.coordinates);
    const canvas = map.getCanvas(),
      rect = canvas.getBoundingClientRect();
    return { x: point.x + rect.left, y: point.y + rect.top };
  };
  const clickCluster = async () => {
    const { x, y } = await browser.evaluate(clusterPoint);
    await browser.clickPoint(x, y);
  };
  await clickCluster();
  await browser.wait(insetReady);
  check(
    "A native cluster contained in a local journey group opens one inset without zooming the overview",
    JSON.stringify((await browser.evaluate(cameras)).overview) ===
      JSON.stringify(clusteredCamera.overview),
  );
  await browser.clickNamed("button", "Close close-up");
  await browser.wait(overviewReady);
  await browser.evaluate(() => {
    const source = window.journeyMaps.overview.getSource(
      "easy-ui-facility-clusters",
    );
    const original = source.getClusterLeaves.bind(source);
    source.getClusterLeaves = (...args) =>
      new Promise((resolve) => {
        window.resolveJourneyLeaves = async () =>
          resolve(await original(...args));
      });
  });
  await clickCluster();
  await browser.wait(() => Boolean(window.resolveJourneyLeaves));
  await browser.clickNamed("button", "Entire journey");
  await browser.wait(overviewReady);
  await browser.evaluate(async () => {
    await window.resolveJourneyLeaves();
  });
  check(
    "A delayed native-cluster result cannot reopen an inset after returning to the whole journey",
    await browser.evaluate(
      () => !document.querySelector("[data-map-zoom-section]"),
    ),
  );
}
