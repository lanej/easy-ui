/** Shared rich-inspection acceptance checks for Chrome, Firefox and Safari adapters. */
export async function checkRichInspection({
  browser,
  base,
  check,
  settle,
  capture,
  scan,
  clean,
  widths = [1440],
}) {
  const facility = '[aria-label="Facility details"]',
    overlay = '[aria-label="Overlay feature details"]';
  const openFacility = () =>
    Boolean(document.querySelector('[aria-label="Facility details"]'));
  const openOverlay = () =>
    Boolean(document.querySelector('[aria-label="Overlay feature details"]'));
  const closed = () =>
    !document.querySelector(
      '[aria-label="Facility details"], [aria-label="Overlay feature details"]',
    );
  const contained = () => {
    const card = document
      .querySelector(
        '[aria-label="Facility details"], [aria-label="Overlay feature details"]',
      )
      .getBoundingClientRect();
    return (
      card.left >= 7 &&
      card.top >= 7 &&
      card.right <= document.documentElement.clientWidth - 7 &&
      card.bottom <= window.innerHeight - 7 &&
      document.documentElement.scrollWidth <= window.innerWidth
    );
  };
  const point = async (coordinate) => {
    await browser.evaluate(() =>
      window.__richInspectionMap
        .getCanvas()
        .scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await browser.wait(() => {
      const map = window.__richInspectionMap;
      const canvas = map?.getCanvas(),
        parent = map?.getContainer();
      return (
        map?.loaded() &&
        !map.isMoving() &&
        Math.abs(canvas.width - parent.clientWidth * map.getPixelRatio()) <= 1
      );
    });
    return browser.evaluate((coordinate) => {
      const map = window.__richInspectionMap,
        box = map.getCanvas().getBoundingClientRect(),
        p = map.project(coordinate);
      return { x: box.left + p.x, y: box.top + p.y };
    }, coordinate);
  };
  for (const theme of ["light", "dark"]) {
    for (const width of widths) {
      await browser.resize(width, width === 390 ? 844 : 1100);
      await browser.open(`${base}/rich-inspection.html?theme=${theme}`);
      await settle();
      const action = async (name) => {
        if (width !== 390) return browser.clickNamed("button", name);
        await browser.evaluate(
          (name) =>
            Array.from(document.querySelectorAll("button"))
              .find((button) => button.textContent.trim() === name)
              .focus(),
          name,
        );
        await browser.key("button:focus", "Enter");
      };
      // Use a real marker pointer event, followed by pointer-to-card handoff.
      let p = await point([0, 1]);
      await browser.move(p.x, p.y);
      await browser.wait(openFacility);
      check(
        `${theme}/${width}: facility reference and shared memberships`,
        await browser.evaluate(() =>
          document
            .querySelector('[aria-label="Facility details"]')
            .textContent.includes("Route A · Route B"),
        ),
      );
      const card = await browser.evaluate(() => {
        const b = document
          .querySelector('[aria-label="Facility details"]')
          .getBoundingClientRect();
        return { x: b.left + 8, y: b.top + 8 };
      });
      await browser.move(card.x, card.y);
      await browser.wait(openFacility);
      // Escape must suppress reopening until the pointer leaves, then focus supplies the same content.
      await browser.key(facility, "Escape");
      await browser.wait(closed);
      await browser.move(1, 1);
      await browser.evaluate(() =>
        Array.from(document.querySelectorAll("button"))
          .find((b) => b.textContent.trim() === "Inspect shared facility")
          .focus(),
      );
      await browser.wait(openFacility);
      check(
        `${theme}/${width}: keyboard trigger described by its inspector`,
        await browser.evaluate(() => {
          const button = document.activeElement;
          return !!document.getElementById(
            button.getAttribute("aria-describedby"),
          );
        }),
      );
      await browser.key("button:focus", "Enter");
      await browser.wait(
        () =>
          document.activeElement?.getAttribute("aria-label") ===
          "Close facility details",
      );
      check(
        `${theme}/${width}: Enter preserves the application's press action`,
        await browser.evaluate(
          () =>
            document.querySelector("[data-inspection-presses]").textContent ===
            "1",
        ),
      );
      check(
        `${theme}/${width}: click pins and moves keyboard focus`,
        await browser.evaluate(
          () =>
            !Array.from(
              document
                .querySelector('[aria-label="Facility details"]')
                .querySelectorAll("button"),
            ).some((b) => b.textContent.trim() === "Keep open"),
        ),
      );
      check(
        `${theme}/${width}: pinned facility card contained`,
        await browser.evaluate(contained),
      );
      const colors = await browser.evaluate(() => {
        const css = getComputedStyle(
          document.querySelector('[aria-label="Facility details"]'),
        );
        return { background: css.backgroundColor, color: css.color };
      });
      check(
        `${theme}/${width}: nested theme propagated into portal`,
        theme === "dark"
          ? colors.background !== "rgb(255, 255, 255)" &&
              colors.color !== "rgb(17, 17, 17)"
          : colors.background === "rgb(255, 255, 255)",
      );
      await capture(`rich-facility-${theme}-${width}`);
      await scan(`rich-facility-${theme}-${width}`);
      await action("Toggle theme");
      await browser.wait(
        theme === "light"
          ? () =>
              getComputedStyle(
                document.querySelector('[aria-label="Facility details"]'),
              ).backgroundColor !== "rgb(255, 255, 255)"
          : () =>
              getComputedStyle(
                document.querySelector('[aria-label="Facility details"]'),
              ).backgroundColor === "rgb(255, 255, 255)",
      );
      check(
        `${theme}/${width}: pinned stable content follows live theme`,
        await browser.evaluate(openFacility),
      );
      await action("Toggle theme");
      await browser.evaluate(() =>
        document.querySelector('[aria-label="Close facility details"]').focus(),
      );
      await browser.key(facility, "Escape");
      await browser.wait(closed);
      check(
        `${theme}/${width}: dismissal returns focus`,
        await browser.evaluate(
          () =>
            document.activeElement.textContent.trim() ===
            "Inspect shared facility",
        ),
      );
      await browser.key("button:focus", " ");
      await browser.wait(
        () =>
          document.activeElement?.getAttribute("aria-label") ===
          "Close facility details",
      );
      check(
        `${theme}/${width}: Space pins press controls after dismissal`,
        true,
      );
      check(
        `${theme}/${width}: Space preserves the application's press action`,
        await browser.evaluate(
          () =>
            document.querySelector("[data-inspection-presses]").textContent ===
            "2",
        ),
      );
      await browser.key(facility, "Escape");
      await browser.wait(closed);
      // A held activation survives unrelated key releases; focus/window loss
      // must also recover pointer pinning if the matching keyup never arrives.
      await browser.evaluate(() => {
        const button = Array.from(document.querySelectorAll("button")).find(
          (button) => button.textContent.trim() === "Inspect lifecycle",
        );
        button.focus();
        button.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        button.dispatchEvent(
          new KeyboardEvent("keyup", { key: "Shift", bubbles: true }),
        );
        button.click();
      });
      await settle();
      check(
        `${theme}/${width}: unrelated release does not prematurely pin`,
        await browser.evaluate(
          () =>
            document.activeElement.textContent.trim() === "Inspect lifecycle",
        ),
      );
      await browser.evaluate(() => document.activeElement.blur());
      await action("Inspect lifecycle");
      await browser.wait(
        () =>
          document.activeElement?.getAttribute("aria-label") ===
          "Close facility details",
      );
      check(
        `${theme}/${width}: pointer pin recovers after lost focus keyup`,
        true,
      );
      await browser.key(facility, "Escape");
      await browser.wait(closed);
      await browser.evaluate(() => {
        document.activeElement.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        window.dispatchEvent(new Event("blur"));
      });
      await action("Inspect lifecycle");
      await browser.wait(
        () =>
          document.activeElement?.getAttribute("aria-label") ===
          "Close facility details",
      );
      check(
        `${theme}/${width}: pointer pin recovers after lost window keyup`,
        true,
      );
      await browser.key(facility, "Escape");
      await browser.wait(closed);
      // Move focus away before testing route pointer overlap.
      await browser.evaluate(() => document.activeElement.blur());
      p = await point([0, 0]);
      await browser.move(p.x, p.y);
      await browser.wait(openOverlay);
      check(
        `${theme}/${width}: shared connection has each original route once`,
        await browser.evaluate(() => {
          const articles = document.querySelectorAll(
            '[aria-label="Overlay feature details"] article',
          );
          return (
            articles.length === 2 &&
            [...articles].some((a) => a.textContent.includes("Route A")) &&
            [...articles].some((a) => a.textContent.includes("Route B"))
          );
        }),
      );
      await browser.clickPoint(p.x, p.y);
      await browser.wait(
        () =>
          document.activeElement?.getAttribute("aria-label") ===
          "Close overlay details",
      );
      check(
        `${theme}/${width}: shared route card contained`,
        await browser.evaluate(contained),
      );
      await capture(`rich-overlap-${theme}-${width}`);
      await scan(`rich-overlap-${theme}-${width}`);
      await action("Refresh records");
      await browser.wait(() =>
        document
          .querySelector('[aria-label="Overlay feature details"]')
          ?.textContent.includes("Generation 1"),
      );
      check(
        `${theme}/${width}: pinned original IDs resolve immutable refresh`,
        await browser.evaluate(
          () =>
            document.querySelectorAll(
              '[aria-label="Overlay feature details"] article',
            ).length === 2,
        ),
      );
      await action("Toggle routes");
      await browser.wait(closed);
      await action("Toggle routes");
      await browser.evaluate(() =>
        Array.from(document.querySelectorAll("button"))
          .find((b) => b.textContent.trim() === "Inspect route A")
          .focus(),
      );
      await browser.wait(openOverlay);
      await browser.evaluate(() =>
        Array.from(document.querySelectorAll("button"))
          .find((b) => b.textContent.trim() === "Next context")
          .focus(),
      );
      await browser.key("button:focus", "Enter");
      await browser.wait(closed);
      check(
        `${theme}/${width}: hidden routes and context changes dismiss`,
        true,
      );
      // Native group must contain each actual zoom button.
      check(
        `${theme}/${width}: native zoom controls contained`,
        await browser.evaluate(() => {
          const group = document
            .querySelector(".maplibregl-ctrl-group")
            .getBoundingClientRect();
          return [
            ...document.querySelectorAll(".maplibregl-ctrl-group button"),
          ].every((b) => {
            const r = b.getBoundingClientRect();
            return (
              r.left >= group.left - 1 &&
              r.right <= group.right + 1 &&
              r.top >= group.top - 1 &&
              r.bottom <= group.bottom + 1
            );
          });
        }),
      );
      await browser.evaluate(() => {
        document.documentElement.style.fontSize = "24px";
        Array.from(document.querySelectorAll("button"))
          .find((b) => b.textContent.trim() === "Inspect route A")
          .focus();
      });
      await browser.wait(openOverlay);
      check(
        `${theme}/${width}: large text card contained`,
        await browser.evaluate(contained),
      );
      await browser.key(overlay, "Escape");
      await browser.wait(closed);
      await browser.evaluate(() => document.activeElement.blur());
      p = await point([0, 0]);
      await browser.move(p.x, p.y);
      await browser.wait(openOverlay);
      await browser.evaluate(() => {
        window.__richInspectionMap.easeTo({ zoom: 5.2, duration: 0 });
      });
      await browser.wait(closed);
      check(`${theme}/${width}: map movement dismisses hover`, true);
      if (clean) await clean(`rich-${theme}-${width}`);
    }
  }
}
