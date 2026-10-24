import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(
  new URL("./preview-metrics/package.json", import.meta.url),
);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseUrl = process.env.STORYBOOK_URL ?? "http://localhost:9013";
const output = resolve(
  process.env.NOTIFICATION_REPORT_DIR ?? "/tmp/easy-ui-notifications-browser",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || undefined,
  executablePath: process.env.BROWSER_EXECUTABLE || undefined,
});
const results = [];
let activePage;
let activeCase;
let activeErrors;
async function assertStatusIcons(page) {
  const icons = await page
    .locator('[role="status"] > span, [role="alert"] > span')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const bounds = element.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      }),
    );
  assert.ok(icons.length > 0, "notification status icons are present");
  for (const icon of icons) {
    assert.ok(
      icon.height >= 20 && icon.width >= icon.height - 1,
      "status icons retain their size under long text and narrow placements",
    );
  }
}
async function activate(page, name) {
  // The notification overlay can cover demo triggers on narrow screens. Real
  // keyboard activation keeps those controls operable without a forced click.
  await page.getByRole("button", { name, exact: true }).focus();
  await page.keyboard.press("Enter");
}
// Virtual time controls timeout accounting, not CSS/IntersectionObserver delivery.
// Wait for real presentation before charging visible time.
async function settlePresentation(page) {
  await page.clock.runFor(200);
  await page.waitForTimeout(200);
}
async function checkPresentationEdges(mode, width) {
  const page = await browser.newPage({ viewport: { width, height: 720 } });
  const errors = [];
  activePage = page;
  activeCase = `${mode}-${width}-presentation-edges`;
  activeErrors = errors;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    `${baseUrl}/iframe.html?id=components-notification--stacked-presentation-timing&viewMode=story&globals=colorScheme:${mode}`,
  );
  await page
    .getByRole("button", { name: "Show short-lived burst", exact: true })
    .waitFor();
  // Observe real CSS and real timers together. Virtual time can complete RTG's
  // fallback timeout before the browser has rendered the opacity transition.
  await page.evaluate(() => {
    const timings = {};
    window.notificationPresentationTimings = timings;
    const observer = new MutationObserver(() => {
      for (const element of document.querySelectorAll(
        "[data-notification-key]",
      )) {
        const message = element.textContent;
        if (
          !message.includes("Short lower update") &&
          !message.includes("Short upper update")
        )
          continue;
        const record = (timings[message] ??= { mounted: performance.now() });
        const style = getComputedStyle(element);
        const entering = /(?:appear|enter)Active/.test(element.className);
        if (
          !entering &&
          style.opacity === "1" &&
          !element.hasAttribute("aria-hidden")
        )
          record.presented ??= performance.now();
        if (element.getAttribute("aria-hidden") === "true")
          record.closed ??= performance.now();
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    window.notificationPresentationObserver = observer;
  });
  await activate(page, "Show short-lived burst");
  await page.waitForFunction(() => {
    const entries = Object.values(window.notificationPresentationTimings);
    return (
      entries.length === 2 && entries.every((entry) => entry.closed != null)
    );
  });
  const timings = await page.evaluate(() => {
    window.notificationPresentationObserver.disconnect();
    return window.notificationPresentationTimings;
  });
  for (const timing of Object.values(timings)) {
    assert.ok(
      timing.presented != null,
      "a short stacked item reaches full opacity before closing",
    );
    assert.ok(
      timing.presented - timing.mounted >= 125,
      "each item completes its own 150ms entrance",
    );
    assert.ok(
      timing.closed - timing.presented >= 75,
      "each short item receives its full 80ms after entrance",
    );
  }
  await writeFile(
    resolve(output, `${mode}-${width}-short-timing.json`),
    JSON.stringify(timings, null, 2),
  );
  await activate(page, "Clear timing examples");
  await page.waitForTimeout(200);
  const clockStart = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time: clockStart });
  await page.clock.pauseAt(new Date(clockStart.getTime() + 1000));
  for (const axis of ["height", "width"]) {
    await activate(page, "Show edge-sized update");
    await settlePresentation(page);
    const item = page.getByRole("alertdialog");
    await item.evaluate((element, axis) => {
      const region = element.parentElement;
      Object.assign(region.style, {
        width: "100px",
        height: "100px",
        maxHeight: "100px",
        overflow: "auto",
      });
      Object.assign(element.style, {
        width: axis === "width" ? "101px" : "100px",
        height: axis === "height" ? "101px" : "100px",
        minHeight: axis === "height" ? "101px" : "100px",
        maxWidth: "none",
        flexShrink: "0",
      });
    }, axis);
    const close = page.getByRole("button", {
      name: "Dismiss One-pixel presentation edge",
      exact: true,
    });
    await close.waitFor();
    // ResizeObserver can offer the fallback before IntersectionObserver has
    // delivered the new clipping state. Let real IO settle before virtual time.
    await item.evaluate(
      (element) =>
        new Promise((resolve) => {
          const observer = new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.intersectionRatio < 0.999)) {
                observer.disconnect();
                resolve();
              }
            },
            { threshold: [0, 0.999, 1] },
          );
          observer.observe(element);
        }),
    );
    const geometry = await item.evaluate((element) => ({
      item: element.getBoundingClientRect().toJSON(),
      region: element.parentElement.getBoundingClientRect().toJSON(),
      oversized: element.className.includes("oversized"),
    }));
    assert.ok(
      Math.abs(geometry.item[axis] - geometry.region[axis] - 1) < 0.1,
      `test exercises exactly one clipped pixel in ${axis}`,
    );
    assert.equal(geometry.oversized, true);
    await page.clock.runFor(6000);
    assert.equal(
      await item.count(),
      1,
      "a one-pixel-clipped timed item cannot expire unseen",
    );
    await close.focus();
    const focusedFallback = await close.elementHandle();
    await item.evaluate((element) =>
      Object.assign(element.style, {
        width: "100px",
        height: "100px",
        minHeight: "100px",
      }),
    );
    await page.waitForFunction(
      () =>
        !document
          .querySelector("[data-notification-key]")
          .className.includes("oversized"),
    );
    await page.clock.runFor(10000);
    assert.ok(
      await focusedFallback.evaluate(
        (element) => element.isConnected && element === document.activeElement,
      ),
      "one-pixel fallback survives shrink and preserves focus",
    );
    await page.screenshot({
      path: resolve(output, `${mode}-${width}-one-pixel-${axis}.png`),
    });
    await activate(page, "Clear timing examples");
    await settlePresentation(page);
  }
  assert.deepEqual(errors, []);
  results.push({ mode, width, case: "presentation-edges", passed: true });
  await page.close();
}

try {
  for (const mode of ["light", "dark"]) {
    for (const width of [1280, 320]) {
      await checkPresentationEdges(mode, width);
      const page = await browser.newPage({ viewport: { width, height: 720 } });
      const errors = [];
      activePage = page;
      activeCase = `${mode}-${width}`;
      activeErrors = errors;
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(
        `${baseUrl}/iframe.html?id=components-notification--stacked-notifications&viewMode=story&globals=colorScheme:${mode}`,
      );
      await page
        .locator('[data-notification-interactions="complete"]')
        .waitFor();
      await page.waitForTimeout(200); // finish the story's exit transitions
      const clockStart = new Date("2026-01-01T00:00:00Z");
      await page.clock.install({ time: clockStart });
      await page.clock.pauseAt(new Date(clockStart.getTime() + 1000));
      await activate(page, "Save two orders");
      await settlePresentation(page);
      const closeA = page.getByRole("button", {
        name: "Dismiss Order A saved",
        exact: true,
      });
      const closeB = page.getByRole("button", {
        name: "Dismiss Order B saved",
        exact: true,
      });
      assert.equal(await page.getByRole("alertdialog").count(), 3);
      assert.equal(await page.getByRole("status").count(), 2);
      assert.equal(await page.getByRole("alert").count(), 1);
      assert.equal(
        await page.getByRole("region").getAttribute("aria-live"),
        null,
      );
      for (const button of [closeA, closeB])
        assert.ok(await button.isVisible());
      await activate(page, "Show long update");
      await settlePresentation(page);
      for (const item of await page.getByRole("alertdialog").all()) {
        const rect = await item.boundingBox();
        assert.ok(
          rect.x >= 0 && rect.x + rect.width <= width + 1,
          `notification fits ${width}`,
        );
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await assertStatusIcons(page);
      await page.screenshot({
        path: resolve(output, `${mode}-${width}-stack.png`),
      });
      await closeA.click();
      await settlePresentation(page);
      assert.equal(await closeA.count(), 0);
      assert.ok(await closeB.isVisible());
      // A pointer dismissal can recover keyboard focus to a surviving item.
      // Explicitly leave both interaction modalities before accruing duration.
      await page.mouse.move(0, 0);
      await page
        .getByRole("button", { name: "Save two orders", exact: true })
        .focus();
      await page.clock.runFor(1600);
      await closeB.hover();
      await closeB.focus();
      await page.clock.runFor(10000);
      await page.mouse.move(0, 0);
      await page.clock.runFor(10000); // keyboard focus must continue the pause
      assert.ok(await closeB.isVisible());
      await page
        .getByRole("button", { name: "Repeat identical message", exact: true })
        .focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      assert.equal(
        await page
          .getByRole("button", { name: "Dismiss Order saved", exact: true })
          .count(),
        2,
      );
      await activate(page, "Dismiss last repeated message");
      await settlePresentation(page);
      assert.equal(
        await page
          .getByRole("button", { name: "Dismiss Order saved", exact: true })
          .count(),
        1,
      );
      await page.clock.runFor(1000);
      assert.ok(await closeB.isVisible());
      // Combined pre-pause and resumed presentation exceeds five seconds, but
      // resumed duration alone remains below five: a restart would fail here.
      await page.clock.runFor(2400);
      assert.equal(await closeB.count(), 0);
      assert.equal(
        await page
          .getByRole("button", { name: "Dismiss Order saved", exact: true })
          .count(),
        1,
      );
      await page.clock.runFor(2500);
      assert.equal(await page.getByRole("status").count(), 0);
      await activate(page, "Repeat identical message");
      const newestClose = page.getByRole("button", {
        name: "Dismiss Order saved",
        exact: true,
      });
      await newestClose.focus();
      await page.keyboard.press("Enter");
      await settlePresentation(page);
      assert.ok(
        await page
          .getByRole("alertdialog")
          .evaluate((element) => element === document.activeElement),
      );
      const alertClose = page.getByRole("button", {
        name: "Dismiss Address review required",
        exact: true,
      });
      assert.ok(await alertClose.isVisible());
      await alertClose.focus();
      await page.keyboard.press("Enter");
      assert.equal(
        await page
          .getByRole("region")
          .evaluate((element) => getComputedStyle(element).pointerEvents),
        "none",
        "empty exit region cannot intercept clicks",
      );
      await settlePresentation(page);
      assert.equal(await page.getByRole("alertdialog").count(), 0);

      // Prepending multiple items must not make another item's removal steal
      // focus from the surviving item a keyboard user is still reading.
      const repeat = page.getByRole("button", {
        name: "Repeat identical message",
        exact: true,
      });
      const dismissLast = page.getByRole("button", {
        name: "Dismiss last repeated message",
        exact: true,
      });
      await activate(page, "Repeat identical message");
      await settlePresentation(page);
      const originalClose = await page
        .getByRole("button", {
          name: "Dismiss Order saved",
          exact: true,
        })
        .elementHandle();
      await originalClose.focus();
      await repeat.evaluate((element) => element.click());
      await repeat.evaluate((element) => element.click());
      assert.equal(await page.getByRole("status").count(), 3);
      await dismissLast.evaluate((element) => element.click());
      await settlePresentation(page);
      assert.ok(
        await originalClose.evaluate(
          (element) => element === document.activeElement,
        ),
      );
      await originalClose.press("Enter");
      await settlePresentation(page);
      await page
        .getByRole("button", { name: "Dismiss Order saved", exact: true })
        .click();
      await settlePresentation(page);

      // Removing the final hovered region cannot leave the next region's
      // timers permanently paused after that old region has unmounted.
      await activate(page, "Repeat identical message");
      await settlePresentation(page);
      await page
        .getByRole("button", { name: "Dismiss Order saved", exact: true })
        .hover();
      await dismissLast.evaluate((element) => element.click());
      await settlePresentation(page);
      assert.equal(await page.getByRole("region").count(), 0);
      // Leave while no region exists: entering/leaving the new region would
      // accidentally repair the leaked global pause this sequence must catch.
      await page.mouse.move(0, 0);
      await activate(page, "Repeat identical message");
      await repeat.focus();
      await settlePresentation(page);
      const remountPresentation = await page
        .getByRole("alertdialog")
        .evaluate((element) => {
          const region = element.parentElement;
          return {
            bounds: element.getBoundingClientRect().toJSON(),
            regionBounds: region.getBoundingClientRect().toJSON(),
            viewport: { width: innerWidth, height: innerHeight },
            opacity: getComputedStyle(element).opacity,
            transform: getComputedStyle(element).transform,
            regionHovered: region.matches(":hover"),
            regionFocused: region.contains(document.activeElement),
            activeElement: document.activeElement?.outerHTML,
          };
        });
      await writeFile(
        resolve(output, `${mode}-${width}-remount-presentation.json`),
        JSON.stringify(remountPresentation, null, 2),
      );
      assert.equal(
        remountPresentation.opacity,
        "1",
        "new region is fully rendered before charging visible time",
      );
      assert.equal(remountPresentation.regionHovered, false);
      assert.equal(remountPresentation.regionFocused, false);
      assert.ok(
        remountPresentation.bounds.y >= remountPresentation.regionBounds.y - 1,
      );
      assert.ok(
        remountPresentation.bounds.bottom <=
          remountPresentation.regionBounds.bottom + 1,
      );
      await page.clock.runFor(5200);
      assert.equal(await page.getByRole("status").count(), 0);

      await activate(page, "Show oversized update");
      await page.mouse.move(0, 0);
      await page
        .getByRole("button", { name: "Save two orders", exact: true })
        .focus();
      await settlePresentation(page);
      const oversizedClose = page.getByRole("button", {
        name: "Dismiss notification",
        exact: true,
      });
      assert.equal(
        await oversizedClose.count(),
        1,
        "oversized timed item gets a dismissal fallback",
      );
      const closeBounds = await oversizedClose.boundingBox();
      assert.ok(
        closeBounds.y >= 0 && closeBounds.y + closeBounds.height <= 720,
        "oversized close stays reachable",
      );
      await page.clock.runFor(10000);
      assert.equal(await oversizedClose.count(), 1);
      await assertStatusIcons(page);
      await page.screenshot({
        path: resolve(output, `${mode}-${width}-oversized.png`),
      });
      // A responsive resize can make the same timed item fully presentable.
      // Its fallback control must survive, retain focus, and keep time paused.
      await oversizedClose.focus();
      const focusedFallback = await oversizedClose.elementHandle();
      const oversizedBounds = await page.getByRole("alertdialog").boundingBox();
      await page.setViewportSize({
        width,
        height: Math.ceil(oversizedBounds.height + 64),
      });
      await settlePresentation(page);
      assert.ok(
        await focusedFallback.evaluate(
          (element) =>
            element.isConnected && element === document.activeElement,
        ),
        "resizing a fitting toast retains its focused fallback control",
      );
      const fittingGeometry = await page
        .getByRole("alertdialog")
        .evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          const region = element.parentElement.getBoundingClientRect();
          return {
            fits:
              bounds.height <= region.height + 1 &&
              bounds.width <= region.width + 1,
            isOversized: element.className.includes("oversized"),
          };
        });
      assert.equal(
        fittingGeometry.fits,
        true,
        "resize actually makes the item fit",
      );
      assert.equal(
        fittingGeometry.isOversized,
        false,
        "oversized styling updates after resize",
      );
      await page.clock.runFor(10000);
      assert.ok(
        await oversizedClose.isVisible(),
        "focus still pauses the now-fitting item",
      );
      await page.setViewportSize({ width, height: 720 });
      await settlePresentation(page);
      assert.ok(
        await focusedFallback.evaluate(
          (element) => element === document.activeElement,
        ),
        "shrinking again retains fallback focus",
      );
      await oversizedClose.click();
      await settlePresentation(page);
      assert.equal(await page.getByRole("alertdialog").count(), 0);

      // A burst taller than the viewport must remain start-aligned and must not
      // spend the visible duration of clipped messages before they are read.
      await activate(page, "Show overflow burst");
      await page.mouse.move(0, 0);
      await page
        .getByRole("button", { name: "Save two orders", exact: true })
        .focus();
      await settlePresentation(page);
      const region = page.getByRole("region");
      assert.ok(
        await region.evaluate(
          (element) => element.scrollHeight > element.clientHeight,
        ),
      );
      const regionBounds = await region.boundingBox();
      const firstBounds = await page
        .getByRole("alertdialog")
        .first()
        .boundingBox();
      assert.ok(
        firstBounds.y >= regionBounds.y - 1,
        "leading notifications are reachable at scroll origin",
      );
      await assertStatusIcons(page);
      await page.screenshot({
        path: resolve(output, `${mode}-${width}-overflow.png`),
      });
      const oldest = page.getByRole("button", {
        name: "Dismiss Burst update 0: shipment saved for review",
        exact: true,
      });
      await page.clock.runFor(6000);
      assert.equal(
        await oldest.count(),
        1,
        "offviewport item cannot expire unseen",
      );
      const clippedBounds = await oldest.boundingBox();
      assert.ok(
        clippedBounds.y >= regionBounds.y + regionBounds.height,
        "oldest item remains clipped before it is revealed",
      );
      await region.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await settlePresentation(page);
      await page.clock.runFor(4500);
      assert.equal(
        await oldest.count(),
        1,
        "revealed item retains its own visible duration",
      );
      await page.clock.runFor(1000);
      assert.equal(
        await oldest.count(),
        0,
        "revealed item expires after its visible duration",
      );
      assert.deepEqual(errors, []);
      results.push({ mode, width, passed: true });
      await page.close();

      for (const placement of [
        "stacked-placement-offsets",
        "stacked-within-container",
        "stacked-default-placement",
        "stacked-auto-placement",
      ]) {
        const placementPage = await browser.newPage({
          viewport: { width, height: 720 },
        });
        const placementErrors = [];
        activePage = placementPage;
        activeCase = `${mode}-${width}-${placement}`;
        activeErrors = placementErrors;
        placementPage.on("pageerror", (error) =>
          placementErrors.push(error.message),
        );
        await placementPage.goto(
          `${baseUrl}/iframe.html?id=components-notification--${placement}&viewMode=story&globals=colorScheme:${mode}`,
        );
        await activate(placementPage, "Show overflow burst");
        await placementPage.mouse.move(0, 0);
        await placementPage.waitForTimeout(200);
        const placementRegion = placementPage.getByRole("region");
        if (placement === "stacked-auto-placement") {
          assert.deepEqual(
            await placementRegion.evaluate((element) => ({
              top: element.parentElement.style.top,
              left: element.parentElement.style.left,
              alignment: getComputedStyle(element.parentElement).justifyContent,
            })),
            { top: "auto", left: "auto", alignment: "flex-end" },
            "auto insets remain authored while stack alignment uses unset edges",
          );
        }
        const bounds =
          placement === "stacked-within-container"
            ? await placementPage
                .locator("#notification-placement-container")
                .boundingBox()
            : { x: 0, y: 0, width, height: 720 };
        const regionRect = await placementRegion.boundingBox();
        assert.ok(
          regionRect.x >= bounds.x && regionRect.y >= bounds.y,
          "large offsets cannot place leading content outside its containing block",
        );
        const standardMargin =
          placement === "stacked-default-placement" ||
          placement === "stacked-auto-placement";
        const reserved = standardMargin ? 15 : 79;
        assert.ok(
          regionRect.x + regionRect.width <= bounds.x + bounds.width - reserved,
          "right offset is reserved",
        );
        assert.ok(
          regionRect.y + regionRect.height <=
            bounds.y + bounds.height - reserved,
          "bottom offset is reserved",
        );
        assert.ok(
          regionRect.height <= bounds.height - (standardMargin ? 15 : 95),
          "scroll height accounts for placement offsets",
        );
        assert.ok(
          await placementRegion.evaluate(
            (element) => element.scrollHeight > element.clientHeight,
          ),
        );
        const first = await placementPage
          .getByRole("alertdialog")
          .first()
          .boundingBox();
        assert.ok(
          first.y >= regionRect.y - 1,
          "leading item remains reachable",
        );
        await placementRegion.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        await placementPage.waitForTimeout(50);
        const last = await placementPage
          .getByRole("button", {
            name: "Dismiss Burst update 0: shipment saved for review",
            exact: true,
          })
          .boundingBox();
        assert.ok(
          last.y >= regionRect.y &&
            last.y + last.height <= regionRect.y + regionRect.height + 1,
          "trailing close remains reachable",
        );
        await assertStatusIcons(placementPage);
        await placementPage.screenshot({
          path: resolve(output, `${mode}-${width}-${placement}.png`),
        });
        assert.deepEqual(placementErrors, []);
        await placementPage.close();
      }
    }
  }
} catch (error) {
  if (activePage) {
    await activePage
      .screenshot({ path: resolve(output, `${activeCase}-failure.png`) })
      .catch(() => {});
    await writeFile(
      resolve(output, "failure.json"),
      JSON.stringify(
        {
          case: activeCase,
          error: String(error),
          pageErrors: activeErrors,
          dom: await activePage
            .evaluate(() => ({
              activeElement: document.activeElement?.outerHTML,
              items: Array.from(
                document.querySelectorAll("[data-notification-key]"),
              ).map((element) => ({
                key: element.getAttribute("data-notification-key"),
                role: element.getAttribute("role"),
                classes: element.className,
                opacity: getComputedStyle(element).opacity,
                transform: getComputedStyle(element).transform,
                regionHovered: element.parentElement?.matches(":hover"),
                regionBounds: element.parentElement
                  ?.getBoundingClientRect()
                  .toJSON(),
                bounds: element.getBoundingClientRect().toJSON(),
              })),
            }))
            .catch(() => null),
          body: await activePage
            .locator("body")
            .innerText()
            .catch(() => ""),
        },
        null,
        2,
      ),
    );
  }
  throw error;
} finally {
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify({ output, results }, null, 2));
