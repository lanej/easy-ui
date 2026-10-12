import assert from "node:assert/strict";

const cameraState = () => {
  const map = window.journeyMaps.overview;
  return { center: map.getCenter().toArray(), zoom: map.getZoom() };
};
const ready = () =>
  window.journeyMaps &&
  Object.keys(window.journeyMaps).length === 1 &&
  window.journeyMaps.overview.loaded() &&
  !window.journeyMaps.overview.isMoving() &&
  document.querySelector('[data-map-state="ready"]');
const section = (id) => `[data-map-zoom-section="${id}"] button`;
const fitsSection = (id) => {
  const map = window.journeyMaps.overview;
  const points =
    id === "origin"
      ? [
          [-122.24, 37.79],
          [-122.222, 37.764],
          [-122.212, 37.741],
        ]
      : [
          [-83.18, 42.37],
          [-83.215, 42.307],
          [-83.276, 42.296],
        ];
  const { clientWidth: width, clientHeight: height } = map.getContainer();
  return points.every((coordinate) => {
    const point = map.project(coordinate);
    return point.x > 0 && point.x < width && point.y > 0 && point.y < height;
  });
};

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
      const name = `${theme}/${width}`;
      await browser.resize(width, 1100);
      await browser.open(`${base}/journey.html?theme=${theme}`);
      await browser.wait(ready);
      const initial = await browser.evaluate(cameraState);
      check(
        `${name}: one canvas with section controls in the map frame`,
        await browser.evaluate(
          () =>
            document.querySelectorAll(".maplibregl-map").length === 1 &&
            document.querySelectorAll(
              "[data-map-frame] [data-map-zoom-section]",
            ).length === 2 &&
            document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await capture(`journey-sections-${theme}-${width}`);
      await scan(`journey-sections-${theme}-${width}`);
      await browser.evaluate(() => {
        window.journeyBefore = window.journeyMaps.overview;
      });
      await browser.key(section("origin"), "Enter");
      await browser.wait(ready);
      const origin = await browser.evaluate(cameraState);
      check(
        `${name}: keyboard origin focus enlarges and fits all local handoffs`,
        origin.zoom > initial.zoom + 5 &&
          (await browser.evaluate(fitsSection, "origin")),
      );
      check(
        `${name}: focusing does not change the selected tracking record`,
        await browser.evaluate(
          () =>
            document.querySelector('.maplibregl-marker[data-selected="true"]')
              .title === "Dearborn distribution",
        ),
      );
      await browser.key(
        '.maplibregl-marker[title="Oakland acceptance"]',
        "Enter",
      );
      await browser.wait(() =>
        document.querySelector(
          '.maplibregl-marker[data-selected="true"][title="Oakland acceptance"]',
        ),
      );
      assert.deepEqual(
        await browser.evaluate(cameraState),
        origin,
        "Marker selection preserves the camera",
      );
      await browser.clickNamed("button", "Refresh records");
      await browser.wait(() => document.body.innerText.includes("Updated"));
      await browser.wait(ready);
      assert.deepEqual(
        await browser.evaluate(cameraState),
        origin,
        "Immutable record refresh preserves the camera",
      );
      check(
        `${name}: selection and refreshed records keep the same map instance`,
        await browser.evaluate(
          () => window.journeyBefore === window.journeyMaps.overview,
        ),
      );
      await browser.clickNamed("checkbox", "Facility risk");
      check(
        `${name}: risk remains available across focus views`,
        await browser.evaluate(() =>
          [...document.querySelectorAll(".maplibregl-marker")].some(
            (marker) => marker.dataset.risk === "elevated",
          ),
        ),
      );
      assert.deepEqual(
        await browser.evaluate(cameraState),
        origin,
        "Layer updates preserve the camera",
      );
      await browser.click(".maplibregl-ctrl-zoom-in");
      await browser.wait(ready);
      check(
        `${name}: free zoom remains available in a section`,
        (await browser.evaluate(cameraState)).zoom > origin.zoom,
      );
      await browser.key(section("origin"), "Enter");
      await browser.wait(ready);
      const refit = await browser.evaluate(cameraState);
      check(
        `${name}: reselecting the section restores its fitted view`,
        Math.abs(refit.zoom - origin.zoom) < 0.001,
      );
      await browser.click(".maplibregl-ctrl-zoom-in");
      await browser.wait(ready);
      await browser.clickNamed("button", "Refit active section");
      await browser.wait(ready);
      check(
        `${name}: explicit revision refits the active section`,
        Math.abs((await browser.evaluate(cameraState)).zoom - origin.zoom) <
          0.001,
      );
      await capture(`journey-origin-${theme}-${width}`);
      await scan(`journey-origin-${theme}-${width}`);
      await browser.key(section("destination"), "Enter");
      await browser.wait(ready);
      check(
        `${name}: destination focus enlarges and fits its handoffs`,
        (await browser.evaluate(cameraState)).zoom > initial.zoom + 4 &&
          (await browser.evaluate(fitsSection, "destination")),
      );
      check(
        `${name}: every view retains the complete route and planned evidence`,
        await browser.evaluate(async () => {
          const features = (
            await window.journeyMaps.overview
              .getSource("easy-ui-transfers")
              .getData()
          ).features;
          return (
            features.length === 7 &&
            features.some(
              (feature) =>
                feature.properties.id === "dbn-dst" &&
                feature.properties.evidence === "planned",
            )
          );
        }),
      );
      check(
        `${name}: one selection detail with no raw data disclosure`,
        await browser.evaluate(
          () =>
            document.querySelectorAll("table").length === 0 &&
            document.querySelectorAll("details:not(.maplibregl-ctrl-attrib)")
              .length === 0 &&
            document.querySelectorAll(
              '.maplibregl-marker[data-selected="true"]',
            ).length === 1,
        ),
      );
      await capture(`journey-destination-${theme}-${width}`);
      await scan(`journey-destination-${theme}-${width}`);
      await browser.clickNamed("button", "Entire journey");
      await browser.wait(ready);
      const full = await browser.evaluate(cameraState);
      check(
        `${name}: returning to the journey restores the full-route fit`,
        Math.abs(full.zoom - initial.zoom) < 0.001 &&
          full.center.every(
            (value, index) => Math.abs(value - initial.center[index]) < 0.001,
          ),
      );
      if (clean) await clean(`journey-sections-${theme}-${width}`);
    }
  }
  await browser.resize(390, 1100);
  await browser.open(`${base}/journey.html?theme=dark&large=1&empty=1`);
  await browser.wait(ready);
  check(
    "Unmapped handoff has a disabled control and an explicit message on the same map",
    await browser.evaluate(
      () =>
        document.body.innerText.includes(
          "No mapped locations in this section.",
        ) &&
        document.querySelector('[data-map-zoom-section="missing"] button')
          .disabled &&
        document.querySelectorAll(".maplibregl-map").length === 1,
    ),
  );
  await browser.key(section("origin"), "Enter");
  await browser.wait(ready);
  check(
    "Large text focus controls and local handoffs fit a mobile container",
    (await browser.evaluate(fitsSection, "origin")) &&
      (await browser.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      )),
  );
  await capture("journey-sections-large-text-empty-mobile");
  await scan("journey-sections-large-text-empty-mobile");
}
