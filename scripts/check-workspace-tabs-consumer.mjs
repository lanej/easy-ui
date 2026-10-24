/** Verify the publish-directory tarball in an independently installed application. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(
  process.env.WORKSPACE_TABS_REPORT_DIR ??
    join(root, ".local-artifacts/workspace-tabs"),
);
const consumer = await mkdtemp(join(tmpdir(), "workspace-tabs-consumer-"));
await mkdir(output, { recursive: true });
const run = (cmd, args, cwd = consumer) =>
  execFileSync(cmd, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
const pack = (directory) => {
  const result = JSON.parse(
    run(
      "npm",
      ["pack", "--ignore-scripts", "--json", "--pack-destination", consumer],
      directory,
    ),
  )[0];
  return { ...result, path: join(consumer, result.filename) };
};
const sourceCommit =
  process.env.WORKSPACE_TABS_SOURCE_COMMIT ??
  run("git", ["rev-parse", "HEAD"], root).trim();
const packed = pack(join(root, "easy-ui-react/dist"));
const icons = pack(join(root, "easy-ui-icons/dist"));
for (const entry of [
  "WorkspaceTabs/index.js",
  "WorkspaceTabs/index.mjs",
  "WorkspaceTabs/index.d.ts",
  "WorkspaceTabs/WorkspaceTabs.d.ts",
  "style.css",
  "skills/easy-ui/SKILL.md",
]) {
  assert.ok(
    packed.files.some((file) => file.path === entry),
    `Missing packed entry: ${entry}`,
  );
}
await writeFile(
  join(consumer, "package.json"),
  JSON.stringify(
    {
      private: true,
      type: "module",
      dependencies: {
        "@easypost/easy-ui": `file:${packed.path}`,
        "@easypost/easy-ui-icons": `file:${icons.path}`,
        react: "19.0.0",
        "react-dom": "19.0.0",
        "react-is": "19.0.0",
        "@types/react": "19.2.14",
        "@types/react-dom": "19.2.3",
        typescript: "5.5.4",
        vite: "6.3.5",
      },
    },
    null,
    2,
  ),
);
await writeFile(
  join(output, "install.log"),
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"]),
);
await writeFile(
  join(consumer, "main.tsx"),
  await readFile(join(root, "scripts/workspace-tabs-consumer.tsx")),
);
await writeFile(
  join(consumer, "index.html"),
  '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Workspace tabs consumer</title><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>',
);
for (const mode of ["bundler", "node16", "node"]) {
  const module = mode === "node16" ? "Node16" : "ESNext";
  await writeFile(
    join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        lib: ["DOM", "ES2020"],
        module,
        moduleResolution: mode,
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        noEmit: true,
      },
      include: ["main.tsx"],
    }),
  );
  run(process.execPath, [
    join(consumer, "node_modules/typescript/bin/tsc"),
    "-p",
    "tsconfig.json",
  ]);
}
const require = createRequire(join(consumer, "package.json"));
const installed = require.resolve("@easypost/easy-ui/WorkspaceTabs");
assert.ok(
  installed.startsWith(consumer),
  "Public module must resolve from consumer, not source",
);
const cjs = require("@easypost/easy-ui/WorkspaceTabs");
assert.equal(typeof cjs.WorkspaceTabs, "function");
assert.equal(typeof cjs.useWorkspaceTabIds, "function");
const esm = await import(
  pathToFileURL(
    join(consumer, "node_modules/@easypost/easy-ui/WorkspaceTabs/index.mjs"),
  )
);
assert.equal(typeof esm.WorkspaceTabs, "function");
assert.equal(typeof esm.useWorkspaceTabIds, "function");
assert.match(
  await readFile(
    join(consumer, "node_modules/@easypost/easy-ui/style.css"),
    "utf8",
  ),
  /_workspace_[\w-]+/,
);
await writeFile(
  join(output, "package-results.json"),
  JSON.stringify(
    {
      sourceCommit,
      consumer,
      tarball: packed.filename,
      integrity: packed.integrity,
      installedModule: installed,
      types: ["bundler", "node16", "node"],
      exports: ["CJS", "ESM"],
      styles: true,
    },
    null,
    2,
  ),
);
const { build, preview } = await import(
  pathToFileURL(join(consumer, "node_modules/vite/dist/node/index.js"))
);
await build({ root: consumer, configFile: false, logLevel: "error" });
const server = await preview({
  root: consumer,
  configFile: false,
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 9025, strictPort: true },
});
const { chromium } = await import(
  pathToFileURL(
    resolve(
      process.env.PLAYWRIGHT_MODULE ??
        join(root, "scripts/preview-metrics/node_modules/playwright/index.mjs"),
    ),
  )
);
let browser;
const results = [];
try {
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    args: ["--no-sandbox"],
  });
  for (const theme of ["dark", "light"]) {
    for (const width of [1200, 390]) {
      const page = await browser.newPage({
        viewport: { width, height: 560 },
        reducedMotion: "reduce",
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(
        `http://127.0.0.1:9025/?theme=${theme}&selected=order_002fa`,
      );
      const entryRegion = page.getByRole("region", {
        name: "Primary workspace",
        exact: true,
      });
      const entryTab = entryRegion.getByRole("tab", {
        name: "Order B",
        exact: true,
      });
      await entryTab.waitFor();
      await page.keyboard.press("Tab");
      assert.equal(
        await entryTab.evaluate((node) => node === document.activeElement),
        true,
        "Initial Tab entry skips earlier close controls for a later selected tab",
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await entryRegion
          .getByRole("button", { name: "Close Order B tab" })
          .evaluate((node) => node === document.activeElement),
        true,
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await entryRegion
          .getByRole("button", { name: "Open order" })
          .evaluate((node) => node === document.activeElement),
        true,
        "Non-roving close controls are skipped when leaving the workspace bar",
      );
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("Tab");
      assert.equal(
        await entryRegion
          .getByRole("button", { name: "Close Order A tab" })
          .evaluate((node) => node === document.activeElement),
        true,
        "Arrowing to another tab makes its separate close control reachable",
      );
      assert.equal(await entryTab.getAttribute("aria-selected"), "true");
      assert.equal(
        await entryRegion.getByLabel("Activation count").textContent(),
        "0",
      );
      await page.goto(`http://127.0.0.1:9025/?theme=${theme}`);
      await page.getByRole("tab", { name: "Overview 12" }).first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const region = page.getByRole("region", {
        name: "Primary workspace",
        exact: true,
      });
      const strip = region
        .getByRole("tablist", { name: "Workspace views" })
        .locator("..");
      const update = region.getByRole("button", {
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
      const deliberateScroll = await strip.evaluate(
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
          await region.getByLabel("Parent revision").textContent(),
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
          "Unrelated parent renders with fresh arrays and callbacks must preserve deliberate scrolling",
        );
        assert.equal(
          await update.evaluate((node) => node === document.activeElement),
          true,
        );
      }
      const overview = region.getByRole("tab", { name: "Overview 12" });
      const selectedOrder = region.getByRole("tab", {
        name: /International replenishment/,
      });
      async function assertWithinStrip(control) {
        const item = await control.locator("..").boundingBox();
        const bounds = await strip.boundingBox();
        assert.ok(
          item &&
            bounds &&
            item.x >= bounds.x - 2 &&
            item.x + item.width <= bounds.x + bounds.width + 2,
          "Focused control must remain revealed across external selection changes",
        );
      }
      for (const control of [
        selectedOrder,
        region.getByRole("button", {
          name: /^Close International replenishment/,
        }),
      ]) {
        await selectedOrder.focus();
        await page.keyboard.press("Enter");
        assert.equal(await selectedOrder.getAttribute("aria-selected"), "true");
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
        await page.keyboard.press("F2"); // Real parent UI shortcut, no focus movement.
        await page.waitForFunction(
          (node) => node.getAttribute("aria-selected") === "true",
          await overview.elementHandle(),
        );
        assert.equal(
          await control.evaluate((node) => node === document.activeElement),
          true,
        );
        await assertWithinStrip(control); // No post-selection refocus that could mask the bug.
      }
      await selectedOrder.focus();
      await page.keyboard.press("Enter");
      const select = region.getByRole("button", {
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
      await assertWithinStrip(overview);
      // Restore a fresh fixture so all pre-existing activation/close assertions stay unchanged.
      await page.reload();
      await overview.waitFor();
      await page.evaluate(() => document.fonts.ready);
      await overview.focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(
        await region
          .getByRole("tab", { name: "Unassigned 0" })
          .evaluate((node) => node === document.activeElement),
        true,
      );
      assert.equal(await overview.getAttribute("aria-selected"), "true");
      await page.keyboard.press("ArrowRight");
      const order = region.getByRole("tab", { name: "Order A 3" });
      assert.equal(
        await order.evaluate((node) => node === document.activeElement),
        true,
        "Disabled pinned tab is skipped",
      );
      await page.keyboard.press("Enter");
      assert.equal(await order.getAttribute("aria-selected"), "true");
      assert.equal(
        await region.getByLabel("Activation count").textContent(),
        "1",
      );
      const ids = await page
        .locator("[role=tab], [role=tabpanel]")
        .evaluateAll((nodes) => nodes.map((node) => node.id));
      assert.equal(
        new Set(ids).size,
        ids.length,
        "Opaque keys and separate instances have unique IDs",
      );
      assert.equal(
        await order.evaluate(
          (node) =>
            document
              .getElementById(node.getAttribute("aria-controls"))
              .getAttribute("aria-labelledby") === node.id,
        ),
        true,
      );
      await region.getByRole("checkbox", { name: "Defer close" }).check();
      await region.getByRole("button", { name: "Close Order A tab" }).click();
      assert.equal(
        await order.count(),
        1,
        "Close request alone must not remove or select",
      );
      // Apply the controlled update without moving focus to its test control.
      await region
        .getByRole("button", { name: "Apply pending close" })
        .evaluate((node) => node.click());
      const orderB = region.getByRole("tab", { name: "Order B", exact: true });
      await orderB.waitFor();
      assert.equal(
        await orderB.evaluate((node) => node === document.activeElement),
        true,
        "Delayed close focus recovery",
      );
      assert.equal(
        await region.getByLabel("Activation count").textContent(),
        "1",
        "Close must not activate another tab",
      );
      await page.keyboard.press("End");
      const long = region.getByRole("tab", {
        name: /International replenishment/,
      });
      assert.equal(
        await long.evaluate((node) => node === document.activeElement),
        true,
        "End skips disabled endpoint",
      );
      await page.keyboard.press("Space");
      assert.equal(await long.getAttribute("aria-selected"), "true");
      const slider = region.getByRole("slider", { name: "Workspace width" });
      // Shrink while preserving actual focused tab, then let the transition finish.
      await slider.evaluate((node) => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        ).set.call(node, "200");
        node.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.waitForTimeout(350);
      const visible = await long.evaluate((node) => {
        const item = node.parentElement.getBoundingClientRect();
        const bar = node.parentElement.parentElement.getBoundingClientRect();
        return item.left >= bar.left - 2 && item.right <= bar.right + 2;
      });
      assert.equal(
        visible,
        true,
        "Focused selected tab is revealed after width transition",
      );
      await page.keyboard.press("Home");
      assert.equal(
        await overview.evaluate((node) => node === document.activeElement),
        true,
      );
      assert.equal(
        await long.getAttribute("aria-selected"),
        "true",
        "Home changes only focus",
      );
      await long.focus();
      await region
        .getByRole("button", { name: "Disable selected externally" })
        .evaluate((node) => node.click());
      assert.equal(
        await orderB.evaluate((node) => node === document.activeElement),
        true,
        "Disabled focused tab recovers focus without activation",
      );
      await region.getByRole("button", { name: "Close Order B tab" }).click();
      await region.getByText("Outside content", { exact: true }).click();
      await region
        .getByRole("button", { name: "Apply pending close" })
        .evaluate((node) => node.click());
      assert.equal(
        await page.evaluate(() => document.activeElement === document.body),
        true,
        "Delayed removal must not steal focus after an outside-text click",
      );
      await page.addScriptTag({
        path: join(
          root,
          "scripts/preview-metrics/node_modules/axe-core/axe.min.js",
        ),
      });
      const accessibility = await page.evaluate(async () =>
        (
          await window.axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
          })
        ).violations.map(({ id, nodes }) => ({
          id,
          targets: nodes.map((node) => node.target),
        })),
      );
      assert.deepEqual(accessibility, [], "WCAG A/AA accessibility checks");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        "No page overflow",
      );
      assert.deepEqual(errors, []);
      // Capture a clean initial presentation, not an intermediate test state.
      await page.reload();
      await page.getByRole("tab", { name: "Overview 12" }).first().waitFor();
      await page
        .locator("[data-test-controls]")
        .evaluateAll((nodes) =>
          nodes.forEach((node) => (node.style.display = "none")),
        );
      if (width === 390) {
        await page
          .getByRole("region", { name: "Primary workspace", exact: true })
          .getByRole("tab", { name: "Order A 3" })
          .click();
      }
      const screenshot = `workspace-tabs-${width === 390 ? "mobile" : "desktop"}-${theme}.png`;
      await page.screenshot({ path: join(output, screenshot), fullPage: true });
      results.push({
        theme,
        width,
        screenshot,
        keyboard: true,
        controlledClose: true,
        resize: true,
        unrelatedUpdatesPreserveScroll: true,
        externalSelectionFocusPriority: true,
      });
      await page.close();
    }
  }
  await writeFile(
    join(output, "results.json"),
    JSON.stringify(
      {
        sourceCommit,
        consumer,
        tarball: packed.filename,
        integrity: packed.integrity,
        installedModule: installed,
        types: ["bundler", "node16", "node"],
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    `Packed exports/types/styles and isolated consumer acceptance passed. Evidence: ${output}`,
  );
} finally {
  await browser?.close();
  await new Promise((done) => server.httpServer.close(done));
}
