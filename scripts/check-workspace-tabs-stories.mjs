/** Exercise the actual Storybook compositions, not a safer substitute fixture. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(
  new URL("./preview-metrics/package.json", import.meta.url),
);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const baseUrl = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9018";
const output = resolve(
  process.env.WORKSPACE_TABS_STORIES_REPORT_DIR ??
    join(root, ".local-artifacts/workspace-tabs-stories"),
);
const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const provenance = {
  sourceCommit:
    process.env.WORKSPACE_TABS_SOURCE_COMMIT ?? git("rev-parse", "HEAD"),
  sourceDirty: Boolean(git("status", "--porcelain", "--untracked-files=no")),
  storybookUrl: baseUrl,
};
await mkdir(output, { recursive: true });
const results = [];
let activePage;
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  args: ["--no-sandbox"],
});

async function assertPageFits(page) {
  const bounds = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    scrollX,
  }));
  assert.ok(bounds.document <= bounds.viewport + 1, JSON.stringify(bounds));
  assert.equal(
    bounds.scrollX,
    0,
    "Keyboard reveal must not scroll the page horizontally",
  );
  const panels = await page.getByRole("tabpanel").evaluateAll((nodes) =>
    nodes.map((node) => {
      const { left, right } = node.getBoundingClientRect();
      return { left, right, viewport: innerWidth };
    }),
  );
  for (const panel of panels)
    assert.ok(
      panel.left >= -1 && panel.right <= panel.viewport + 1,
      "Application-owned panels must fit the same viewport as the bar",
    );
  return bounds;
}

async function assertBarFits(bar) {
  const bounds = await bar.evaluate((node) => {
    const { left, right, width } = node.getBoundingClientRect();
    return { left, right, width, viewport: innerWidth };
  });
  assert.ok(bounds.width > 0);
  assert.ok(
    bounds.left >= -1 && bounds.right <= bounds.viewport + 1,
    JSON.stringify(bounds),
  );
  const action = await bar
    .getByRole("button", { name: "Open order", exact: true })
    .boundingBox();
  assert.ok(
    action &&
      action.x >= bounds.left - 1 &&
      action.x + action.width <= bounds.right + 1,
    "The trailing action must stay inside the workspace and viewport",
  );
}

async function assertRevealed(tab, strip, focused = true) {
  if (focused)
    assert.equal(
      await tab.evaluate((node) => node === document.activeElement),
      true,
    );
  const item = await tab.locator("..").boundingBox();
  const viewport = await strip.boundingBox();
  assert.ok(
    item &&
      viewport &&
      item.x >= viewport.x - 2 &&
      item.x + item.width <= viewport.x + viewport.width + 2,
    "Keyboard focus and the separate close control must be revealed inside the local strip",
  );
}

async function exerciseBar(page, list, narrow) {
  // Tabs and their separate close controls are siblings of the semantic tablist.
  const strip = list.locator("..");
  const bar = strip.locator("..");
  await assertBarFits(bar);
  const overview = bar.getByRole("tab", { name: "Overview 12", exact: true });
  const order = bar.getByRole("tab", { name: /^Order B/ });
  await overview.focus();
  await page.keyboard.press("End");
  await assertRevealed(order, strip);
  assert.equal(
    await overview.getAttribute("aria-selected"),
    "true",
    "End changes only focus",
  );
  const overflow = await strip.evaluate((node) => ({
    client: node.clientWidth,
    content: node.scrollWidth,
    offset: node.scrollLeft,
  }));
  if (narrow) {
    assert.ok(
      overflow.content > overflow.client + 1,
      "Long tabs must overflow the internal strip",
    );
    assert.ok(
      overflow.offset > 0,
      "End must scroll the internal strip, not its document",
    );
  }
  await page.keyboard.press("Enter");
  assert.equal(await order.getAttribute("aria-selected"), "true");
  await page.keyboard.press("Tab");
  const close = bar.getByRole("button", { name: /^Close Order B/ });
  assert.equal(
    await close.evaluate((node) => node === document.activeElement),
    true,
  );
  await page.keyboard.press("Tab");
  const action = bar.getByRole("button", { name: "Open order", exact: true });
  assert.equal(
    await action.evaluate((node) => node === document.activeElement),
    true,
  );
  await assertBarFits(bar);
  await assertPageFits(page);
  await order.focus();
  await page.keyboard.press("Home");
  await assertRevealed(overview, strip);
  assert.equal(
    await order.getAttribute("aria-selected"),
    "true",
    "Home changes only focus",
  );
  await assertPageFits(page);
  return overflow;
}

async function openStory(page, story, theme, errors) {
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    `${baseUrl}/iframe.html?id=organisms-navigation-workspacetabs--${story}&viewMode=story&globals=colorScheme:${theme}`,
  );
  await page
    .getByRole("tab", { name: "Overview 12", exact: true })
    .first()
    .waitFor();
  await page.evaluate(() => document.fonts.ready);
  const appliedTheme = await page.evaluate(
    () => getComputedStyle(document.documentElement).colorScheme,
  );
  assert.equal(
    appliedTheme,
    theme,
    "The requested Storybook theme must actually be applied",
  );
  // The Default play function removes Order A and finishes by focusing Order B.
  // Wait for that known outcome before beginning independent keyboard checks.
  if (story === "default") {
    await page
      .getByRole("tab", { name: "Order A 3", exact: true })
      .waitFor({ state: "detached" });
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute("role") === "tab" &&
        document.activeElement.textContent.startsWith("Order B"),
    );
  }
}

try {
  for (const theme of ["light", "dark"]) {
    for (const story of [
      "default",
      "narrow",
      "presentation",
      "isolated-workspaces",
      "width-transition",
    ]) {
      for (const width of [
        "presentation",
        "isolated-workspaces",
        "width-transition",
      ].includes(story)
        ? [320, 375, 1280]
        : [320, 375]) {
        const page = (activePage = await browser.newPage({
          viewport: { width, height: 720 },
          // Deliberately oppose the requested theme so a system-default fallback cannot pass.
          colorScheme: theme === "dark" ? "light" : "dark",
          reducedMotion: "reduce",
        }));
        const errors = [];
        try {
          await openStory(page, story, theme, errors);
          const lists = page.getByRole("tablist", {
            name: "Workspace views",
            exact: true,
          });
          assert.equal(
            await lists.count(),
            ["presentation", "isolated-workspaces"].includes(story) ? 2 : 1,
          );
          const before = await assertPageFits(page);
          // Retain the real initial composition before keyboard tests change selection.
          const screenshot = `${story}-${width}-${theme}.png`;
          await page.screenshot({
            path: join(output, screenshot),
            fullPage: true,
          });
          let deliberateScroll;
          if (story === "width-transition") {
            const strip = lists.first().locator("..");
            const update = page.getByRole("button", {
              name: "Unrelated parent update",
              exact: true,
            });
            await update.focus();
            await strip.hover();
            await page.mouse.wheel(500, 0);
            await page.waitForFunction(
              (node) => node.scrollLeft > 0,
              await strip.elementHandle(),
            );
            deliberateScroll = await strip.evaluate(
              (node) =>
                new Promise((done, reject) => {
                  let previous = node.scrollLeft;
                  let stableFrames = 0;
                  const deadline = performance.now() + 5000;
                  function settle() {
                    const current = node.scrollLeft;
                    stableFrames = current === previous ? stableFrames + 1 : 0;
                    previous = current;
                    if (stableFrames >= 3) done(current);
                    else if (performance.now() > deadline)
                      reject(new Error("Strip scrolling did not settle"));
                    else requestAnimationFrame(settle);
                  }
                  requestAnimationFrame(settle);
                }),
            );
            assert.ok(
              deliberateScroll > 0,
              "The settled baseline must retain deliberate strip scrolling",
            );
            for (let revision = 1; revision <= 3; revision++) {
              await update.click();
              assert.equal(
                await page.getByLabel("Parent revision").textContent(),
                String(revision),
              );
              await page.evaluate(
                () =>
                  new Promise((done) =>
                    requestAnimationFrame(() => requestAnimationFrame(done)),
                  ),
              );
              assert.ok(
                Math.abs(
                  (await strip.evaluate((node) => node.scrollLeft)) -
                    deliberateScroll,
                ) <= 1,
                "Equivalent parent updates must not undo deliberate strip scrolling with focus outside",
              );
              assert.equal(
                await update.evaluate(
                  (node) => node === document.activeElement,
                ),
                true,
              );
            }
            await assertPageFits(page);
          }
          const strips = [];
          for (const list of await lists.all())
            strips.push(await exerciseBar(page, list, width < 1280));
          const transitions = [];
          if (story === "width-transition") {
            const slider = page.getByRole("slider", {
              name: "Workspace width",
            });
            const list = lists.first();
            const strip = list.locator("..");
            const order = strip.getByRole("tab", { name: /^Order B/ });
            const bar = strip.locator("..");
            const overview = bar.getByRole("tab", {
              name: "Overview 12",
              exact: true,
            });
            for (const control of [
              order,
              bar.getByRole("button", { name: /^Close Order B/ }),
            ]) {
              await order.focus();
              await page.keyboard.press("Enter");
              assert.equal(await order.getAttribute("aria-selected"), "true");
              await control.focus();
              const before = await overview.boundingBox();
              const viewport = await strip.boundingBox();
              assert.ok(
                before && viewport && before.x < viewport.x - 2,
                "Overview must be outside the scrollport before the external selection",
              );
              const focusedItem = await control.locator("..").boundingBox();
              const overviewItem = await overview.locator("..").boundingBox();
              assert.ok(
                focusedItem &&
                  overviewItem &&
                  focusedItem.x + focusedItem.width - overviewItem.x >
                    viewport.width + 2,
                "The focused item and Overview must not fit together in this strip",
              );
              await page.keyboard.press("F2"); // Parent UI changes selection without moving focus.
              await page.waitForFunction(
                (node) => node.getAttribute("aria-selected") === "true",
                await overview.elementHandle(),
              );
              // Never refocus after F2: that would repair and mask the regression.
              await assertRevealed(control, strip);
              await assertPageFits(page);
            }
            await order.focus();
            await page.keyboard.press("Enter");
            const select = page.getByRole("button", {
              name: "Select overview (F2)",
              exact: true,
            });
            await select.click();
            await page.waitForFunction(
              (node) => node.getAttribute("aria-selected") === "true",
              await overview.elementHandle(),
            );
            assert.equal(
              await select.evaluate((node) => node === document.activeElement),
              true,
            );
            await assertRevealed(overview, strip, false);
            await order.focus();
            // Drive the real controlled input without moving focus. Refocusing the
            // tab after a resize would call onFocus/reveal and mask a resize regression.
            for (const requested of ["240", "1000"]) {
              await slider.evaluate((node, value) => {
                Object.getOwnPropertyDescriptor(
                  HTMLInputElement.prototype,
                  "value",
                ).set.call(node, value);
                node.dispatchEvent(new Event("input", { bubbles: true }));
              }, requested);
              assert.equal(await slider.inputValue(), requested);
              // The story declares a 300ms width transition. Inspect after it settles.
              await page.waitForTimeout(350);
              await assertRevealed(order, strip);
              const bar = strip.locator("..");
              await assertBarFits(bar);
              const layout = await bar.evaluate((node) => {
                const host = node.parentElement.parentElement;
                const style = getComputedStyle(host);
                return {
                  width: node.getBoundingClientRect().width,
                  available:
                    host.clientWidth -
                    parseFloat(style.paddingLeft) -
                    parseFloat(style.paddingRight),
                };
              });
              assert.ok(
                Math.abs(
                  layout.width - Math.min(Number(requested), layout.available),
                ) <= 1,
                `The controlled width must actually resize the workspace: ${JSON.stringify(layout)}`,
              );
              transitions.push({
                requested,
                ...layout,
                stripWidth: await strip.evaluate((node) => node.clientWidth),
                ...(await assertPageFits(page)),
              });
            }
          }
          assert.deepEqual(errors, []);
          results.push({
            story,
            theme,
            width,
            before,
            strips,
            deliberateScroll,
            transitions,
            externalSelectionFocusPriority: story === "width-transition",
            screenshot,
            keyboard: true,
          });
        } catch (error) {
          await page
            .screenshot({ path: join(output, "failure.png"), fullPage: true })
            .catch(() => {});
          throw error;
        } finally {
          await page.close();
        }
      }
    }
  }
  await writeFile(
    join(output, "results.json"),
    JSON.stringify(
      { ...provenance, browserVersion: browser.version(), results },
      null,
      2,
    ),
  );
  console.log(
    `Actual WorkspaceTabs Storybook layout and keyboard checks passed. Evidence: ${output}`,
  );
} catch (error) {
  await writeFile(
    join(output, "failure.json"),
    JSON.stringify(
      {
        ...provenance,
        url: activePage?.url(),
        completed: results,
        error: String(error),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
