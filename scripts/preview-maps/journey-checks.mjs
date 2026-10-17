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
export async function checkJourneySizing({
  browser,
  base,
  check,
  capture,
  scan,
}) {
  const compactReady = () =>
    window.journeyMaps &&
    Object.keys(window.journeyMaps).length === 1 &&
    document.querySelector('[data-map-inset-compact="true"]') &&
    !window.journeyMaps.overview.isMoving();
  for (const theme of ["light", "dark"])
    for (const width of [1440, 390]) {
      const name = `sizing/${theme}/${width}`;
      await browser.resize(width, 1000);
      await browser.open(
        `${base}/journey.html?local=1&height=300&theme=${theme}`,
      );
      await browser.wait(overviewReady);
      const initial = await browser.evaluate(cameras);
      check(
        `${name}: close-ups honor a 300px geographic height`,
        await browser.evaluate(
          () =>
            Math.abs(
              document
                .querySelector("[data-map-geography]")
                .getBoundingClientRect().height - 300,
            ) <= 1,
        ),
      );
      if (width === 390) {
        await browser.key(marker("oak"), "Enter");
        await browser.wait(insetReady);
        const opened = await browser.evaluate(cameras);
        check(
          `${name}: narrow close-up replaces the overview without changing its camera`,
          JSON.stringify(opened.overview) ===
            JSON.stringify(initial.overview) &&
            (await browser.evaluate(
              () =>
                getComputedStyle(
                  document.querySelector(
                    "[data-map-geography] > [data-map-state]",
                  ),
                ).visibility === "hidden",
            )),
        );
        check(
          `${name}: narrow close-up has one bounded local map`,
          await browser.evaluate(bounded),
        );
        await browser.key(
          `${section("origin")} [data-map-facility-id="acceptance"]`,
          "Enter",
        );
        await capture(`journey-drill-in-${theme}-${width}`);
        await scan(`journey-drill-in-${theme}-${width}`);
        await browser.clickNamed("button", "Back to overview");
        await browser.wait(overviewReady);
        check(
          `${name}: Back restores source focus and camera`,
          (await browser.evaluate(
            () => document.activeElement?.dataset.mapFacilityId === "oak",
          )) &&
            JSON.stringify((await browser.evaluate(cameras)).overview) ===
              JSON.stringify(initial.overview),
        );
        await browser.open(
          `${base}/journey.html?local=1&height=fill&theme=${theme}`,
        );
        await browser.wait(overviewReady);
        await browser.evaluate(() => {
          document.querySelector("[data-journey-zoom-example]").style.height =
            "900px";
        });
        await browser.wait(
          () => window.journeyMaps.overview.getContainer().clientHeight > 450,
        );
        await browser.key(marker("oak"), "Enter");
        await browser.wait(insetReady);
        await browser.evaluate(() => {
          const parent = document.querySelector("[data-journey-zoom-example]");
          const frame = document.querySelector("[data-map-geography]");
          parent.style.height = `${parent.getBoundingClientRect().height - frame.getBoundingClientRect().height + 300}px`;
        });
        await browser.wait(() => {
          const frame = document
            .querySelector("[data-map-geography]")
            .getBoundingClientRect();
          const card = document
            .querySelector("[data-map-zoom-section]")
            .getBoundingClientRect();
          return frame.height < 400 && card.bottom <= frame.bottom + 1;
        });
        check(
          `${name}: fill close-up remains bounded after shrinking`,
          await browser.evaluate(bounded),
        );
        await browser.evaluate(() => {
          const parent = document.querySelector("[data-journey-zoom-example]");
          const frame = document.querySelector("[data-map-geography]");
          parent.style.height = `${parent.getBoundingClientRect().height - frame.getBoundingClientRect().height + 220}px`;
        });
        await browser.wait(compactReady);
        check(
          `${name}: compact fill fallback scrolls content and keeps its return header reachable`,
          await browser.evaluate(() => {
            const card = document.querySelector("[data-map-zoom-section]");
            const header = card.querySelector("[data-map-inset-header]");
            card.scrollTop = card.scrollHeight;
            return (
              getComputedStyle(card).overflowY === "auto" &&
              getComputedStyle(header).position === "sticky" &&
              header.getBoundingClientRect().top >=
                card.getBoundingClientRect().top
            );
          }),
        );
        await browser.evaluate(() => {
          document.querySelector("[data-journey-zoom-example]").style.height =
            "900px";
        });
        await browser.wait(insetReady);
        await browser.clickNamed("button", "Back to overview");
        await browser.wait(overviewReady);
        continue;
      }
      await browser.key(marker("oak"), "Enter");
      await browser.wait(compactReady);
      check(
        `${name}: compact stop list stays inside the frame`,
        await browser.evaluate(bounded),
      );
      await browser.clickNamed("button", "Oakland acceptance");
      check(
        `${name}: compact selection preserves the overview camera`,
        JSON.stringify((await browser.evaluate(cameras)).overview) ===
          JSON.stringify(initial.overview) &&
          (await browser.evaluate(
            () =>
              document.querySelector(
                '[aria-label="Locations in close-up"] [aria-pressed="true"]',
              )?.textContent === "Oakland acceptance",
          )),
      );
      await capture(`journey-compact-${theme}-${width}`);
      await scan(`journey-compact-${theme}-${width}`);
      await browser.key(
        "[data-map-inset-header] > div:first-child > div > button:first-child",
        "Enter",
      );
      await browser.wait(overviewReady);
      check(
        `${name}: keyboard Zoom to area closes the compact list and focuses the map`,
        await browser.evaluate(
          () =>
            !document.querySelector("[data-map-zoom-section]") &&
            document.activeElement === window.journeyMaps.overview.getCanvas(),
        ),
      );

      await browser.open(
        `${base}/journey.html?local=1&height=500&theme=${theme}`,
      );
      await browser.wait(overviewReady);
      await browser.key(marker("oak"), "Enter");
      await browser.wait(insetReady);
      check(
        `${name}: a 500px map fits a full close-up without growing`,
        (await browser.evaluate(
          () =>
            Math.abs(
              document
                .querySelector("[data-map-geography]")
                .getBoundingClientRect().height - 500,
            ) <= 1 && !document.querySelector("[data-map-inset-compact]"),
        )) && (await browser.evaluate(bounded)),
      );
      await capture(`journey-fixed-${theme}-${width}`);

      await browser.open(
        `${base}/journey.html?local=1&height=fill&theme=${theme}`,
      );
      await browser.wait(overviewReady);
      await browser.evaluate(() => {
        window.journeySizingOverview = window.journeyMaps.overview;
        document.querySelector("[data-journey-zoom-example]").style.height =
          "900px";
      });
      await browser.wait(
        () => window.journeyMaps.overview.getContainer().clientHeight > 450,
      );
      const before = await browser.evaluate(cameras);
      await browser.key(marker("oak"), "Enter");
      await browser.wait(insetReady);
      await browser.evaluate(() => {
        const parent = document.querySelector("[data-journey-zoom-example]");
        const frame = document.querySelector("[data-map-geography]");
        const companions =
          parent.getBoundingClientRect().height -
          frame.getBoundingClientRect().height;
        parent.style.height = `${companions + 300}px`;
      });
      await browser.wait(compactReady);
      check(
        `${name}: filling parent can shrink below 700px with the close-up open`,
        await browser.evaluate(bounded),
      );
      check(
        `${name}: filling map stays within its parent`,
        await browser.evaluate(() => {
          const parent = document
            .querySelector("[data-journey-zoom-example]")
            .getBoundingClientRect();
          const frame = document
            .querySelector("[data-map-geography]")
            .getBoundingClientRect();
          return (
            frame.bottom <= parent.bottom &&
            document
              .querySelector("[data-journey-zoom-example]")
              .lastElementChild.getBoundingClientRect().bottom <=
              parent.bottom &&
            frame.height >= 220 &&
            frame.height < 400
          );
        }),
      );
      await browser.clickNamed("button", "Oakland acceptance");
      await browser.evaluate(() => {
        document.querySelector("[data-journey-zoom-example]").style.height =
          "900px";
      });
      await browser.wait(insetReady);
      check(
        `${name}: growing restores a local map without replacing or moving the overview`,
        JSON.stringify((await browser.evaluate(cameras)).overview) ===
          JSON.stringify(before.overview) &&
          (await browser.evaluate(
            () => window.journeyMaps.overview === window.journeySizingOverview,
          )) &&
          (await browser.evaluate(bounded)),
      );
      check(
        `${name}: resizing retains visible keyboard focus`,
        await browser.evaluate(() => {
          const card = document.querySelector("[data-map-zoom-section]");
          return (
            card
              .querySelector("[data-map-inset-header]")
              .contains(document.activeElement) && card.scrollTop === 0
          );
        }),
      );
      await browser.key(":focus", "Escape");
      await browser.wait(overviewReady);
      check(
        `${name}: Escape restores focus to the source stop`,
        await browser.evaluate(
          () =>
            document.activeElement?.getAttribute("data-map-facility-id") ===
            "oak",
        ),
      );
    }
  await browser.resize(390, 1000);
  await browser.open(`${base}/journey.html?local=1&height=220&large=1`);
  await browser.wait(overviewReady);
  await browser.key(marker("oak"), "Enter");
  await browser.wait(insetReady);
  check(
    "Minimum-height numeric map with large text opens a bounded local drill-in",
    await browser.evaluate(bounded),
  );
  await browser.key(
    `${section("origin")} [data-map-facility-id="acceptance"]`,
    "Enter",
  );
  await browser.key(":focus", "Escape");
  await browser.wait(overviewReady);
  check(
    "Minimum-height close-up retains selectable stops and keyboard dismissal",
    await browser.evaluate(
      () =>
        document.activeElement?.getAttribute("data-map-facility-id") === "oak",
    ),
  );
}
export async function checkJourneySections({
  browser,
  base,
  check,
  capture,
  scan,
  clean,
}) {
  await checkJourneySizing({ browser, base, check, capture, scan });
  const selectMetric = async (label) => {
    await browser.click("[data-map-surface-metric] button");
    await browser.wait(() => document.querySelector('[role="option"]'));
    await browser.clickNamed("option", label);
  };
  const hoverSurface = async (mapId) => {
    const point = await browser.evaluate((id) => {
      const map = window.journeyMaps[id];
      const canvas = map.getCanvas();
      const rect = canvas.getBoundingClientRect();
      for (const longitude of [-122.245, -122.235, -122.22, -122.205]) {
        for (const latitude of [37.785, 37.775, 37.755, 37.745]) {
          const point = map.project([longitude, latitude]);
          const x = rect.left + point.x;
          const y = rect.top + point.y;
          if (
            document.elementFromPoint(x, y) !== canvas ||
            !map.queryRenderedFeatures(point, {
              layers: ["easy-ui-delivery-surface-fill"],
            }).length
          )
            continue;
          window.journeyHoveredMap = null;
          const hovered = () => {
            window.journeyHoveredMap = id;
            map.off("mousemove", "easy-ui-delivery-surface-fill", hovered);
          };
          map.on("mousemove", "easy-ui-delivery-surface-fill", hovered);
          return { x, y };
        }
      }
    }, mapId);
    check(
      `${mapId}: a visible surface cell is available for pointer inspection`,
      Boolean(point),
    );
    await browser.move(point.x, point.y);
    await browser.wait(() => window.journeyHoveredMap !== null);
    return point;
  };
  for (const theme of ["light", "dark"])
    for (const width of [1440, 390]) {
      const name = `${theme}/${width}`;
      await browser.resize(width, 1100);
      await browser.open(`${base}/journey.html?local=1&theme=${theme}`);
      await browser.wait(overviewReady);
      await browser.wait(() => document.fonts.status === "loaded");
      check(
        `${name}: the shared toolbar retains Select borders after loading map styles`,
        await browser.evaluate(() =>
          [
            ...document.querySelectorAll(
              '[aria-label$="camera and layers"] button[aria-haspopup="listbox"]',
            ),
          ].every((button) => {
            const styles = getComputedStyle(button);
            return (
              parseFloat(styles.borderTopWidth) > 0 &&
              styles.borderTopStyle !== "none" &&
              button.getBoundingClientRect().height >= 30
            );
          }),
        ),
      );
      const compactToolbar = await browser.evaluate(() => {
        const toolbars = document.querySelectorAll(
          '[aria-label$="camera and layers"]',
        );
        if (toolbars.length !== 1) return false;
        const toolbar = toolbars[0];
        const controls = [
          ...toolbar.querySelectorAll("button, input[type=checkbox]"),
        ];
        const rows = controls.map((control) => {
          const rect = (
            control.closest("label") ?? control
          ).getBoundingClientRect();
          return Math.round((rect.top + rect.bottom) / 2);
        });
        return (
          controls.length === 4 &&
          toolbar.textContent.includes("Refresh records") &&
          toolbar.textContent.includes("Facility risk") &&
          toolbar.textContent.includes("Entire journey") &&
          Math.max(...rows) - Math.min(...rows) <=
            (innerWidth > 800 ? 12 : 52) &&
          document.documentElement.scrollWidth <= innerWidth + 1
        );
      });
      if (!compactToolbar) {
        console.log(
          "Toolbar layout",
          await browser.evaluate(() => ({
            width: innerWidth,
            overflow: document.documentElement.scrollWidth - innerWidth,
            controls: [
              ...document.querySelectorAll(
                '[aria-label$="camera and layers"] button, [aria-label$="camera and layers"] input[type=checkbox]',
              ),
            ].map((element) => ({
              text: element.getAttribute("aria-label") ?? element.textContent,
              top: element.getBoundingClientRect().top,
              width: element.getBoundingClientRect().width,
            })),
          })),
        );
        await capture(`journey-toolbar-failure-${theme}-${width}`);
      }
      check(
        `${name}: filters and map actions share one compact wrapping toolbar`,
        compactToolbar,
      );
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
        `${name}: local labels remain visible, with a geographic leader on desktop`,
        await browser.evaluate(
          () =>
            (innerWidth <= 480 ||
              document.querySelectorAll("[data-map-inset-leader]").length ===
                1) &&
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
      await browser.click(`${section("origin")} .maplibregl-ctrl-zoom-out`);
      await browser.wait(insetReady);
      check(
        `${name}: native inset zoom can return to its original scale without moving the journey`,
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
      await browser.clickNamed(
        "button",
        width === 390 ? "Back to overview" : "Close close-up",
      );
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
      await browser.key(
        `${section("origin")} header button:not([aria-label])`,
        "Enter",
      );
      await browser.wait(overviewReady);
      check(
        `${name}: Zoom to area frames readable local stops, closes the inset and focuses the main canvas`,
        await browser.evaluate(
          () =>
            !document.querySelector("[data-map-zoom-section]") &&
            document.activeElement ===
              window.journeyMaps.overview.getCanvas() &&
            window.journeyMaps.overview.getZoom() > 10 &&
            window.journeyMaps.overview.getZoom() <= 13 &&
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
      if (width === 390) await browser.clickNamed("button", "Back to overview");
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
    "Large text drill-in remains bounded with local navigation available",
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
        getComputedStyle(
          document.querySelector("[data-map-geography] > [data-map-state]"),
        ).visibility === "hidden" &&
        document.querySelector('[aria-label="Back to overview"]')
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
            (getComputedStyle(
              document.querySelector("[data-map-geography] > [data-map-state]"),
            ).visibility === "hidden" ||
              navigation.bottom <= card.top ||
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
    await selectMetric("Delivery-time spread");
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
      await selectMetric(label);
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
    const hovered = await hoverSurface("origin");
    check(
      `Surface hover leaves the inset unobscured at ${width}px`,
      await browser.evaluate(
        () => !document.querySelector('[aria-label="Delivery cell details"]'),
      ),
    );
    await browser.clickPoint(hovered.x, hovered.y);
    check(
      `Surface click does not pin a covering card in the inset at ${width}px`,
      await browser.evaluate(
        () => !document.querySelector('[aria-label="Delivery cell details"]'),
      ),
    );
    await browser.key(
      `${section("origin")} header button:not([aria-label])`,
      "Enter",
    );
    await browser.wait(overviewReady);
    await hoverSurface("overview");
    await browser.wait(() =>
      document.querySelector('[aria-label="Delivery cell details"]'),
    );
    check(
      `Zoom to area makes full cell inspection available on the main map at ${width}px`,
      await browser.evaluate(
        () =>
          !document.querySelector("[data-map-zoom-section]") &&
          document.querySelector('[aria-label="Delivery cell details"]') &&
          window.journeyMaps.overview === window.journeyBefore.overview,
      ),
    );
    await capture(`journey-main-area-inspection-${width}`);
    await scan(`journey-main-area-inspection-${width}`);
    if (clean) await clean(`journey-metrics-${width}`);
  }
  for (const width of [1440, 390]) {
    await browser.resize(width, 1100);
    for (const heading of ["none", "title", "description"]) {
      await browser.open(
        `${base}/journey.html?local=1&metrics=1&heading=${heading}`,
      );
      await browser.wait(overviewReady);
      check(
        `Optional ${heading} heading retains working filters and map actions at ${width}px`,
        await browser.evaluate((heading) => {
          const example = document.querySelector("[data-journey-zoom-example]");
          const toolbar = example.querySelector(
            '[aria-label$="camera and layers"]',
          );
          const header = example.querySelector("[data-journey-heading]");
          return (
            Boolean(header?.querySelector("h1")) === (heading === "title") &&
            Boolean(header?.querySelector("p")) ===
              (heading === "description") &&
            Boolean(header) === (heading !== "none") &&
            toolbar.textContent.includes("Refresh records") &&
            toolbar.textContent.includes("Entire journey") &&
            toolbar.querySelector("[data-map-surface-metric]") &&
            document.documentElement.scrollWidth <= innerWidth + 1
          );
        }, heading),
      );
      await browser.clickNamed("button", "Entire journey");
      await browser.wait(overviewReady);
      if (heading === "none") {
        await capture(`journey-controls-only-${width}`);
        await scan(`journey-controls-only-${width}`);
      }
    }
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
