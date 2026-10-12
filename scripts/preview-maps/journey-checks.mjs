import assert from "node:assert/strict";

const cameraState = () =>
  Object.fromEntries(
    Object.entries(window.journeyMaps).map(([id, map]) => [
      id,
      { center: map.getCenter().toArray(), zoom: map.getZoom() },
    ]),
  );
const ready = () =>
  window.journeyMaps &&
  Object.keys(window.journeyMaps).length === 3 &&
  Object.values(window.journeyMaps).every(
    (map) => map.loaded() && !map.isMoving(),
  ) &&
  !document.querySelector('[data-map-state="loading"]');
const section = (id) => `[data-map-zoom-section="${id}"]`;

export async function checkJourneySections({
  browser,
  base,
  check,
  capture,
  scan,
  clean,
}) {
  for (const theme of ["light", "dark"]) {
    for (const width of [1440, 390]) {
      await browser.resize(width, 1100);
      await browser.open(`${base}/journey.html?theme=${theme}`);
      await browser.wait(ready);
      const initial = await browser.evaluate(cameraState);
      check(
        `${theme}/${width}: local transitions have independent enlarged scales`,
        initial.origin.zoom > initial.overview.zoom + 5 &&
          initial.destination.zoom > initial.overview.zoom + 4,
      );
      check(
        `${theme}/${width}: local handoffs exclude long transfers and preserve planned evidence`,
        await browser.evaluate(async () => {
          const records = Object.fromEntries(
            await Promise.all(
              Object.entries(window.journeyMaps).map(async ([id, map]) => [
                id,
                (await map.getSource("easy-ui-transfers").getData()).features,
              ]),
            ),
          );
          const ids = (id) =>
            records[id].map((feature) => feature.properties.id).sort();
          const destination = records.destination;
          return (
            ids("overview").length === 7 &&
            JSON.stringify(ids("origin")) ===
              JSON.stringify(["acceptance-origin-sort", "oak-acceptance"]) &&
            JSON.stringify(ids("destination")) ===
              JSON.stringify(["dbn-dst", "dtw-dbn"]) &&
            destination.some(
              (feature) => feature.properties.evidence === "planned",
            )
          );
        }),
      );
      check(
        `${theme}/${width}: detail maps fit their container without page overflow`,
        await browser.evaluate(() => {
          const sections = [
            ...document.querySelectorAll("[data-map-zoom-section]"),
          ].map((element) => element.getBoundingClientRect());
          return (
            document.documentElement.scrollWidth <= innerWidth + 1 &&
            (innerWidth > 1000
              ? Math.abs(sections[0].top - sections[1].top) < 1
              : sections[1].top >= sections[0].bottom)
          );
        }),
      );
      check(
        `${theme}/${width}: one shared selection detail and no raw data disclosure`,
        await browser.evaluate(
          () =>
            document.querySelectorAll("[data-map-zoom-sections] table")
              .length === 0 &&
            document.querySelectorAll("details:not(.maplibregl-ctrl-attrib)")
              .length === 0 &&
            [...document.querySelectorAll("[data-map-zoom-section]")].every(
              (element) =>
                !element.textContent.includes("Last observed location"),
            ),
        ),
      );
      await browser.evaluate(() => {
        window.journeyBefore = { ...window.journeyMaps };
      });
      await browser.key(
        `${section("origin")} .maplibregl-marker[title="Oakland acceptance"]`,
        "Enter",
      );
      await browser.wait(
        () =>
          document.querySelectorAll(
            '.maplibregl-marker[data-selected="true"][title="Oakland acceptance"]',
          ).length === 2,
      );
      assert.deepEqual(
        await browser.evaluate(cameraState),
        initial,
        "Selecting a local facility preserves every camera",
      );
      await browser.clickNamed("button", "Refresh records");
      await browser.wait(() => document.body.innerText.includes("Updated"));
      assert.deepEqual(
        await browser.evaluate(cameraState),
        initial,
        "Immutable records preserve independent cameras",
      );
      check(
        `${theme}/${width}: shared selection and data updates keep all map instances`,
        await browser.evaluate(() =>
          Object.entries(window.journeyMaps).every(
            ([id, map]) => window.journeyBefore[id] === map,
          ),
        ),
      );
      await browser.clickNamed("checkbox", "Facility risk");
      check(
        `${theme}/${width}: parent risk treatment propagates into destination detail`,
        await browser.evaluate(() =>
          [
            ...document.querySelectorAll(
              '[data-map-zoom-section="destination"] .maplibregl-marker',
            ),
          ].some((marker) => marker.dataset.risk === "elevated"),
        ),
      );
      assert.deepEqual(
        await browser.evaluate(cameraState),
        initial,
        "Layer updates preserve cameras",
      );
      await browser.click(`${section("origin")} .maplibregl-ctrl-zoom-in`);
      await browser.wait(ready);
      const zoomed = await browser.evaluate(cameraState);
      check(
        `${theme}/${width}: local zoom leaves overview and other section unchanged`,
        zoomed.origin.zoom > initial.origin.zoom &&
          JSON.stringify(zoomed.overview) ===
            JSON.stringify(initial.overview) &&
          JSON.stringify(zoomed.destination) ===
            JSON.stringify(initial.destination),
      );
      await browser.evaluate(() =>
        document
          .querySelector(
            '[data-map-zoom-section="origin"] [aria-label$="camera and layers"] button',
          )
          .focus(),
      );
      await browser.key("button:focus", "Enter");
      await browser.wait(ready);
      const reset = await browser.evaluate(cameraState);
      check(
        `${theme}/${width}: keyboard Fit section restores only that detail camera`,
        Math.abs(reset.origin.zoom - initial.origin.zoom) < 0.001 &&
          JSON.stringify(reset.overview) === JSON.stringify(initial.overview) &&
          JSON.stringify(reset.destination) ===
            JSON.stringify(initial.destination),
      );
      await capture(`journey-sections-${theme}-${width}`);
      await scan(`journey-sections-${theme}-${width}`);
      if (clean) await clean(`journey-sections-${theme}-${width}`);
    }
  }
  await browser.resize(390, 1100);
  await browser.open(`${base}/journey.html?theme=dark&large=1&empty=1`);
  await browser.wait(ready);
  check(
    "Unmapped handoff has an explicit empty state and no extra map",
    await browser.evaluate(
      () =>
        document.body.innerText.includes(
          "No mapped locations in this section.",
        ) && document.querySelectorAll(".maplibregl-map").length === 3,
    ),
  );
  check(
    "Large text journey sections remain within a mobile container",
    await browser.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await capture("journey-sections-large-text-empty-mobile");
  await scan("journey-sections-large-text-empty-mobile");
}
