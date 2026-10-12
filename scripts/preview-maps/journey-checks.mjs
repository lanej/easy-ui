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
  document.querySelectorAll('[data-map-state="ready"]').length === 3;
const section = (id) => `[data-map-zoom-section="${id}"]`;
const layout = () => {
  const frame = document
    .querySelector("[data-map-geography]")
    .getBoundingClientRect();
  const insets = document
    .querySelector("[data-map-zoom-sections]")
    .getBoundingClientRect();
  const cards = [
    ...document.querySelectorAll("[data-map-zoom-section]"),
  ].filter((node) => getComputedStyle(node).visibility === "visible");
  return (
    document.documentElement.scrollWidth <= innerWidth + 1 &&
    cards.every((node) => {
      const rect = node.getBoundingClientRect();
      return (
        rect.left >= frame.left &&
        rect.right <= frame.right &&
        rect.top > frame.top &&
        rect.bottom < frame.bottom
      );
    }) &&
    (innerWidth > 1000 ? cards.length === 2 : cards.length === 1) &&
    window.journeyMaps.overview.getContainer().clientHeight >= 560 &&
    insets.top > frame.top + 180
  );
};
const clearOverview = () => {
  const map = window.journeyMaps.overview;
  const element = map.getContainer();
  const top =
    document.querySelector("[data-map-zoom-sections]").getBoundingClientRect()
      .top - element.getBoundingClientRect().top;
  return [
    [-122.24, 37.79],
    [-111.96, 40.76],
    [-87.66, 41.81],
    [-83.18, 42.37],
    [-83.276, 42.296],
  ].every((coordinate) => {
    const point = map.project(coordinate);
    return (
      point.x >= 24 &&
      point.x <= element.clientWidth - 24 &&
      point.y >= 24 &&
      point.y < top - 14
    );
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
        `${name}: overview and enlarged insets use independent geographic scales`,
        initial.origin.zoom > initial.overview.zoom + 5 &&
          initial.destination.zoom > initial.overview.zoom + 4,
      );
      check(
        `${name}: both close-ups are embedded in one responsive map frame`,
        await browser.evaluate(layout),
      );
      check(
        `${name}: fitting the journey keeps all route stops above the insets`,
        await browser.evaluate(clearOverview),
      );
      check(
        `${name}: projected leaders connect the visible insets to their geographic sections`,
        await browser.evaluate(
          () =>
            document.querySelectorAll("[data-map-inset-leader]").length ===
            (innerWidth > 1000 ? 2 : 1),
        ),
      );
      check(
        `${name}: overview retains the whole route while insets retain local evidence`,
        await browser.evaluate(async () => {
          const records = Object.fromEntries(
            await Promise.all(
              Object.entries(window.journeyMaps).map(async ([id, map]) => [
                id,
                (await map.getSource("easy-ui-transfers").getData()).features,
              ]),
            ),
          );
          return (
            records.overview.length === 7 &&
            records.origin.length === 2 &&
            records.destination.length === 2 &&
            records.destination.some(
              (feature) => feature.properties.evidence === "planned",
            )
          );
        }),
      );
      check(
        `${name}: inset markers keep all three local location labels available`,
        await browser.evaluate(() =>
          [
            ...document.querySelectorAll(
              '[data-map-zoom-section] .maplibregl-marker [data-map-label="true"]',
            ),
          ].every((label) => label.style.visibility === "visible"),
        ),
      );
      await capture(`journey-sections-${theme}-${width}`);
      await scan(`journey-sections-${theme}-${width}`);
      if (width < 1000) {
        await browser.clickNamed("button", "Origin");
        check(
          `${name}: mobile inset switching preserves all cameras and overview context`,
          (await browser.evaluate(
            () =>
              document
                .querySelector('[data-map-zoom-section="origin"]')
                .getAttribute("aria-hidden") !== "true",
          )) && (await browser.evaluate(clearOverview)),
        );
        assert.deepEqual(
          await browser.evaluate(cameraState),
          initial,
          "Choosing an inset preserves all cameras",
        );
      }
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
        "Shared selection preserves every camera",
      );
      await browser.clickNamed("button", "Refresh records");
      await browser.wait(() => document.body.innerText.includes("Updated"));
      await browser.wait(ready);
      assert.deepEqual(
        await browser.evaluate(cameraState),
        initial,
        "Immutable refresh preserves every camera",
      );
      check(
        `${name}: linked selection and refresh keep every map instance`,
        await browser.evaluate(() =>
          Object.entries(window.journeyMaps).every(
            ([id, map]) => window.journeyBefore[id] === map,
          ),
        ),
      );
      await browser.clickNamed("checkbox", "Facility risk");
      check(
        `${name}: shared risk visibility reaches both overview and destination inset`,
        await browser.evaluate(
          () =>
            [
              ...document.querySelectorAll(
                '.maplibregl-marker[data-risk="elevated"]',
              ),
            ].length >= 2,
        ),
      );
      assert.deepEqual(
        await browser.evaluate(cameraState),
        initial,
        "Layer changes preserve cameras",
      );
      await browser.click(`${section("origin")} .maplibregl-ctrl-zoom-in`);
      await browser.wait(ready);
      const zoomed = await browser.evaluate(cameraState);
      check(
        `${name}: zooming an inset leaves the journey and other inset unchanged`,
        zoomed.origin.zoom > initial.origin.zoom &&
          JSON.stringify(zoomed.overview) ===
            JSON.stringify(initial.overview) &&
          JSON.stringify(zoomed.destination) ===
            JSON.stringify(initial.destination),
      );
      await browser.key(`${section("origin")} header button`, "Enter");
      await browser.wait(ready);
      const fitted = await browser.evaluate(cameraState);
      check(
        `${name}: keyboard Fit section resets only that inset`,
        Math.abs(fitted.origin.zoom - initial.origin.zoom) < 0.001 &&
          JSON.stringify(fitted.overview) ===
            JSON.stringify(initial.overview) &&
          JSON.stringify(fitted.destination) ===
            JSON.stringify(initial.destination),
      );
      await capture(`journey-origin-${theme}-${width}`);
      await scan(`journey-origin-${theme}-${width}`);
      if (width < 1000) await browser.clickNamed("button", "Destination");
      await capture(`journey-destination-${theme}-${width}`);
      await scan(`journey-destination-${theme}-${width}`);
      if (width < 1000) await browser.clickNamed("button", "Origin");
      await browser.click(`${section("origin")} .maplibregl-ctrl-zoom-in`);
      await browser.wait(ready);
      await browser.clickNamed("button", "Refit insets");
      await browser.wait(ready);
      check(
        `${name}: explicit inset refits preserve the overview camera`,
        JSON.stringify((await browser.evaluate(cameraState)).overview) ===
          JSON.stringify(initial.overview),
      );
      const beforeLeader = await browser.evaluate(
        () =>
          document
            .querySelector("[data-map-inset-leader] polyline")
            ?.getAttribute("points") ?? "",
      );
      await browser.click(
        "[data-map-geography] > [data-map-state] .maplibregl-ctrl-zoom-out",
      );
      await browser.wait(ready);
      check(
        `${name}: leader lines track the overview camera`,
        beforeLeader !==
          (await browser.evaluate(
            () =>
              document
                .querySelector("[data-map-inset-leader] polyline")
                ?.getAttribute("points") ?? "",
          )),
      );
      await browser.clickNamed("button", "Entire journey");
      await browser.wait(ready);
      check(
        `${name}: returning to the journey fits the route clear of the insets`,
        await browser.evaluate(clearOverview),
      );
      if (clean) await clean(`journey-sections-${theme}-${width}`);
    }
  }
  await browser.resize(390, 1100);
  await browser.open(`${base}/journey.html?theme=dark&large=1&empty=1`);
  await browser.wait(ready);
  await browser.clickNamed("button", "Unmapped handoff");
  check(
    "Unmapped inset has an explicit empty state and no unrelated world map",
    await browser.evaluate(
      () =>
        document
          .querySelector('[data-map-zoom-section="missing"]')
          .textContent.includes("No mapped locations in this section.") &&
        document.querySelectorAll(".maplibregl-map").length === 3,
    ),
  );
  check(
    "Large text inset layout preserves the overview and mobile bounds",
    (await browser.evaluate(clearOverview)) &&
      (await browser.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      )),
  );
  await capture("journey-sections-large-text-empty-mobile");
  await scan("journey-sections-large-text-empty-mobile");
}
