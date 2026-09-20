/** Actual-browser acceptance cases for independently composed map parts. */
export async function checkMapComposition({
  browser,
  base,
  check,
  settle,
  capture,
  scan,
  clean,
}) {
  async function settleComposition() {
    await settle();
    // Observe an engine frame after React effects, resizing, and worker updates.
    await browser.evaluate(
      () =>
        new Promise((resolve) => {
          const map = window.__mapComposition;
          map.once("idle", () => resolve(true));
          map.triggerRepaint();
        }),
    );
  }
  await browser.resize(1200, 1000);
  await browser.open(`${base}/composition.html`);
  await settleComposition();
  check(
    "map surface is named by its external heading",
    await browser.evaluate(
      () =>
        document
          .querySelector("[data-map-state]")
          .getAttribute("aria-labelledby") === "external-map-heading",
    ),
  );
  check(
    "externally placed data is associated with the surface",
    await browser.evaluate(
      () =>
        document
          .querySelector("[data-map-state]")
          .getAttribute("aria-describedby") === "external-map-data",
    ),
  );
  check(
    "dateline source has short segments on either side of the world edge",
    await browser.evaluate(() => {
      const features =
        window.__mapComposition.querySourceFeatures("easy-ui-transfers");
      return (
        features.length > 0 &&
        features.every((feature) => {
          const paths =
            feature.geometry.type === "MultiLineString"
              ? feature.geometry.coordinates
              : [feature.geometry.coordinates];
          return paths.every((points) =>
            points.every(
              (point, index) =>
                index === 0 || Math.abs(point[0] - points[index - 1][0]) < 3,
            ),
          );
        })
      );
    }),
  );
  for (const evidence of ["transfer", "measured", "planned", "inferred"]) {
    await browser.clickNamed("button", `Select ${evidence} route`);
    await settleComposition();
    await browser.wait(
      () =>
        window.__mapComposition.queryRenderedFeatures({
          layers: ["easy-ui-selection"],
        }).length > 0,
    );
    check(
      `${evidence} selection has a rendered halo while custom paint survives`,
      await browser.evaluate((expected) => {
        const map = window.__mapComposition;
        const filter = map.getFilter("easy-ui-selection");
        const features = map.queryRenderedFeatures({
          layers: ["easy-ui-selection"],
        });
        return (
          filter[2] === expected &&
          features.length > 0 &&
          features.every((feature) => feature.properties.id === expected) &&
          map.getPaintProperty("easy-ui-observed", "line-color") === "#ff0099"
        );
      }, evidence),
    );
  }
  await browser.clickNamed("button", "Toggle marker interaction");
  await settleComposition();
  check(
    "callback-only changes disable map markers",
    await browser.evaluate(() =>
      [...document.querySelectorAll(".maplibregl-marker")].every(
        (marker) => marker.disabled,
      ),
    ),
  );
  await browser.clickNamed("button", "Toggle marker interaction");
  await settleComposition();
  check(
    "callback-only changes re-enable map markers",
    await browser.evaluate(() =>
      [...document.querySelectorAll(".maplibregl-marker")].every(
        (marker) => !marker.disabled,
      ),
    ),
  );
  await capture("composition-desktop");
  await scan("composition-desktop");
  await browser.resize(390, 760);
  await browser.clickNamed("button", "Toggle large text");
  await settleComposition();
  check(
    "large text does not overflow the page or cover the viewport",
    await browser.evaluate(() => {
      const viewport = document
        .querySelector("[data-map-state]")
        .getBoundingClientRect();
      const details = document
        .querySelector("#external-selection")
        .getBoundingClientRect();
      return (
        details.top >= viewport.bottom &&
        document.documentElement.scrollWidth <= window.innerWidth
      );
    }),
  );
  check(
    "engine markers receive configured label sizes and measured nonoverlapping layout",
    await browser.evaluate(() => {
      const viewport = document
        .querySelector("[data-map-state]")
        .getBoundingClientRect();
      const labels = [
        ...document.querySelectorAll(
          '.maplibregl-marker span[aria-hidden="true"]',
        ),
      ].filter(
        (label) =>
          label.textContent.includes("island") &&
          getComputedStyle(label).visibility !== "hidden",
      );
      if (!labels.length) return false;
      return labels.every((label, index) => {
        const rect = label.getBoundingClientRect();
        return (
          parseFloat(getComputedStyle(label).fontSize) === 24 &&
          rect.left >= viewport.left &&
          rect.right <= viewport.right &&
          rect.top >= viewport.top &&
          rect.bottom <= viewport.bottom &&
          labels.slice(index + 1).every((other) => {
            const b = other.getBoundingClientRect();
            return (
              rect.right <= b.left ||
              b.right <= rect.left ||
              rect.bottom <= b.top ||
              b.bottom <= rect.top
            );
          })
        );
      });
    }),
  );
  await capture("composition-mobile-large-text");
  await scan("composition-mobile-large-text");
  await browser.clickNamed("button", "Toggle surface-only mode");
  await settleComposition();
  check(
    "surface-only map has exact uncertainty and provenance without logistics placeholders",
    await browser.evaluate(() => {
      const data = document.querySelector("#external-map-data").textContent;
      return (
        data.includes("Synthetic delivery model") &&
        data.includes("2026-09-20") &&
        data.includes("IQR") &&
        data.includes("Unavailable") &&
        !document.body.innerText.includes("Observed transfer") &&
        !document.body.innerText.includes("Locations and exact data")
      );
    }),
  );
  await capture("composition-surface-only");
  await scan("composition-surface-only");
  await clean("composition");
}
