/** Verify actual packed React 16/17 client rendering, SSR and hydration. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(
  process.env.WORKSPACE_TABS_LEGACY_REPORT_DIR ??
    join(root, ".local-artifacts/workspace-tabs-legacy"),
);
await mkdir(output, { recursive: true });
const workspace = await mkdtemp(join(tmpdir(), "workspace-tabs-legacy-"));
const run = (command, args, cwd = workspace) =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, NODE_ENV: "development" },
  });
const pack = (directory) => {
  const packed = JSON.parse(
    run(
      "npm",
      ["pack", "--ignore-scripts", "--json", "--pack-destination", workspace],
      directory,
    ),
  )[0];
  return { ...packed, path: join(workspace, packed.filename) };
};
const packed = pack(join(root, "easy-ui-react/dist"));
const icons = pack(join(root, "easy-ui-icons/dist"));
const sourceCommit = run("git", ["rev-parse", "HEAD"], root).trim();
const sourceDirty = Boolean(
  run("git", ["status", "--porcelain", "--untracked-files=no"], root).trim(),
);
// CI uses Chromium. Explicit jsdom mode supports packed hydration checks in
// environments that cannot launch browsers or listen on local sockets.
const renderer = process.env.WORKSPACE_TABS_LEGACY_RENDERER ?? "chromium";
assert.ok(["chromium", "jsdom"].includes(renderer));
let browser;
const results = [];
try {
  for (const version of ["16.14.0", "17.0.2"]) {
    const consumer = join(workspace, version);
    await mkdir(consumer);
    await writeFile(
      join(consumer, "package.json"),
      JSON.stringify({
        private: true,
        type: "module",
        dependencies: {
          "@easypost/easy-ui": `file:${packed.path}`,
          "@easypost/easy-ui-icons": `file:${icons.path}`,
          react: version,
          "react-dom": version,
          // react-is has no 16.14 release; 17 satisfies Easy UI's existing peer.
          "react-is": "17.0.2",
          "react-aria": "3.51.0",
          vite: "6.3.5",
        },
      }),
    );
    await writeFile(
      join(output, `react-${version}-install.log`),
      run(
        "npm",
        [
          "install",
          "--legacy-peer-deps",
          "--ignore-scripts",
          "--no-audit",
          "--no-fund",
        ],
        consumer,
      ),
    );
    await writeFile(
      join(consumer, "fixture.mjs"),
      await readFile(join(root, "scripts/workspace-tabs-legacy-consumer.mjs")),
    );
    // React 16/17 predate package exports, so Node alone cannot resolve their
    // extensionless JSX-runtime subpath. Exercise ESM through a real consumer
    // SSR bundle, without rewriting installed dependencies or package output.
    await writeFile(
      join(consumer, "esm-api.mjs"),
      'export { WorkspaceTabs, useWorkspaceTabIds } from "@easypost/easy-ui/WorkspaceTabs";\nexport { SSRProvider } from "react-aria";\n',
    );
    const { build: bundle } = await import(
      pathToFileURL(join(consumer, "node_modules/esbuild/lib/main.js"))
    );
    const bundled = await bundle({
      absWorkingDir: consumer,
      entryPoints: ["esm-api.mjs"],
      outfile: "esm-api.bundle.mjs",
      bundle: true,
      format: "esm",
      platform: "node",
      metafile: true,
      banner: {
        js: 'import { createRequire as createSSRRequire } from "node:module"; const require = createSSRRequire(import.meta.url);',
      },
      plugins: [
        {
          name: "external-react-runtime",
          setup(build) {
            build.onResolve(
              { filter: /^react$|^react-dom(?:\/.*)?$/ },
              (args) => ({
                path: args.path,
                external: true,
              }),
            );
          },
        },
      ],
    });
    const inputs = Object.keys(bundled.metafile.inputs);
    assert.ok(
      inputs.some((file) =>
        file.endsWith("node_modules/@easypost/easy-ui/WorkspaceTabs/index.mjs"),
      ),
      "SSR bundle must consume the installed packed ESM entry",
    );
    assert.ok(
      inputs.some((file) =>
        file.endsWith("react-aria/dist/private/ssr/SSRProvider.mjs"),
      ),
      "SSR bundle must use the ESM provider graph",
    );
    await writeFile(
      join(output, `react-${version}-esm-bundle.json`),
      JSON.stringify(
        {
          format: "bundled-esm",
          entry: "@easypost/easy-ui/WorkspaceTabs",
          packedInput: inputs.filter((file) =>
            file.includes("/WorkspaceTabs/"),
          ),
          externalImports:
            bundled.metafile.outputs["esm-api.bundle.mjs"].imports,
        },
        null,
        2,
      ),
    );
    await writeFile(
      join(consumer, "ssr.mjs"),
      `import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import React from "react";
import ReactDOMServer from "react-dom/server.js";
import { createApp } from "./fixture.mjs";
const require = createRequire(import.meta.url);
const { renderToString } = ReactDOMServer;
assert.equal(React.version, ${JSON.stringify(version)});
assert.equal(typeof React.useId, "undefined");
assert.ok(require.resolve("@easypost/easy-ui/WorkspaceTabs").startsWith(${JSON.stringify(consumer)}));
const warnings = [];
console.warn = console.error = (...args) => warnings.push(args.join(" "));
for (const format of ["cjs", "esm"]) {
  const api = format === "cjs" ? require("@easypost/easy-ui/WorkspaceTabs") : await import("./esm-api.bundle.mjs");
  const { SSRProvider } = format === "cjs" ? require("react-aria") : api;
  const App = createApp(React, api, SSRProvider);
  const firstRequest = renderToString(React.createElement(App));
  const secondRequest = renderToString(React.createElement(App));
  assert.equal(firstRequest, secondRequest, format + " SSR IDs must reset per request");
  await writeFile(format + ".html", '<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Workspace compatibility</title></head><body><div id="root">' + firstRequest + '</div><script type="module" src="/main.mjs"></script></body></html>');
}
assert.deepEqual(warnings, [], "Server rendering must not emit warnings");
console.log("React " + React.version + " packed direct-CJS/bundled-ESM SSR passed without warnings");
`,
    );
    await writeFile(
      join(output, `react-${version}-ssr.log`),
      run(process.execPath, ["ssr.mjs"], consumer),
    );
    await writeFile(
      join(consumer, "client.html"),
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Workspace compatibility</title></head><body><div id="root"></div><script type="module" src="/main.mjs"></script></body></html>',
    );
    if (renderer === "jsdom") {
      await writeFile(
        join(consumer, "hydrate.mjs"),
        `import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { JSDOM } from ${JSON.stringify(pathToFileURL(join(root, "node_modules/jsdom/lib/api.js")).href)};
import { createApp } from "./fixture.mjs";
const mode = process.argv[2];
const dom = new JSDOM(await readFile(mode + ".html", "utf8"), { pretendToBeVisual: true, url: "https://example.test/" });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Document", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
}
const require = createRequire(import.meta.url);
const React = require("react");
const ReactDOM = require("react-dom");
const api = mode === "cjs" ? require("@easypost/easy-ui/WorkspaceTabs") : await import("./esm-api.bundle.mjs");
const { SSRProvider } = mode === "cjs" ? require("react-aria") : api;
const root = document.getElementById("root");
const getIds = () => [...root.querySelectorAll("[id]")].map(node => node.id);
const serverIds = getIds();
const warnings = [];
console.warn = console.error = (...args) => warnings.push(args.join(" "));
const App = createApp(React, api, SSRProvider);
ReactDOM[mode === "client" ? "render" : "hydrate"](React.createElement(App, { withProvider: mode !== "client" }), root);
await new Promise(resolve => setTimeout(resolve, 20));
const before = getIds();
assert.equal(new Set(before).size, before.length, "Collision-safe, per-instance IDs");
if (mode !== "client") assert.deepEqual(before, serverIds, "Hydration preserves SSR IDs");
const tabs = [...root.querySelectorAll("[role=tab]")];
assert.equal(tabs.length, 42);
for (const tab of tabs) {
  const panel = document.getElementById(tab.getAttribute("aria-controls"));
  assert.ok(panel, "External panel exists");
  if (!panel.hasAttribute("aria-label")) assert.equal(panel.getAttribute("aria-labelledby"), tab.id);
  assert.ok(tab.closest("section").querySelector("[role=tablist]").getAttribute("aria-owns").split(" ").includes(tab.id));
}
const region = root.querySelector('section[aria-label="shared-1"]');
const second = region.querySelectorAll("[role=tab]")[1];
second.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
assert.equal(second.getAttribute("aria-selected"), "true");
assert.equal(region.querySelector('[role=tabpanel]:not([hidden])').textContent, "shared-1 View 2");
root.querySelector("main > button").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
assert.equal(root.querySelector("output").textContent, "1");
await new Promise(resolve => setTimeout(resolve, 20));
assert.deepEqual(getIds(), before, "Stable IDs after selection and parent rerenders");
ReactDOM.unmountComponentAtNode(root);
assert.deepEqual(warnings, [], "No hydration, layout-effect or ID-provider warnings");
dom.window.close();
console.log(JSON.stringify({ version: React.version, mode, ssrFormat: mode === "client" ? null : mode === "cjs" ? "direct-cjs" : "bundled-esm", renderer: "jsdom", uniqueIds: before.length, warnings }));
// Legacy React's scheduler can retain a MessageChannel after jsdom closes.
// This isolated process has finished every assertion and owns no further work.
process.exit(0);
`,
      );
      for (const mode of ["cjs", "esm", "client"]) {
        const result = run(process.execPath, ["hydrate.mjs", mode], consumer);
        await writeFile(
          join(output, `react-${version}-${mode}-jsdom.log`),
          result,
        );
        results.push(JSON.parse(result));
      }
      continue;
    }
    const { chromium } = await import(
      pathToFileURL(
        resolve(
          process.env.PLAYWRIGHT_MODULE ??
            join(
              root,
              "scripts/preview-metrics/node_modules/playwright/index.mjs",
            ),
        ),
      )
    );
    browser ??= await chromium.launch({
      ...(process.env.CHROMIUM_PATH
        ? { executablePath: process.env.CHROMIUM_PATH }
        : {}),
      args: ["--no-sandbox"],
    });
    await writeFile(
      join(consumer, "main.mjs"),
      `import React from "react";
import ReactDOM from "react-dom";
import * as api from "@easypost/easy-ui/WorkspaceTabs";
import { SSRProvider } from "react-aria";
import { createApp } from "./fixture.mjs";
const root = document.getElementById("root");
window.serverIds = [...root.querySelectorAll("[id]")].map(node => node.id);
const hydrate = root.hasChildNodes();
const App = createApp(React, api, SSRProvider);
ReactDOM[hydrate ? "hydrate" : "render"](React.createElement(App, { withProvider: hydrate }), root, () => {
  window.workspaceTabsReady = true;
});
`,
    );
    const { build, preview } = await import(
      pathToFileURL(join(consumer, "node_modules/vite/dist/node/index.js"))
    );
    await build({
      root: consumer,
      configFile: false,
      logLevel: "error",
      // Exercise development diagnostics instead of suppressing hydration errors.
      define: { "process.env.NODE_ENV": JSON.stringify("development") },
      build: {
        rollupOptions: {
          input: ["cjs", "esm", "client"].map((name) =>
            join(consumer, `${name}.html`),
          ),
        },
      },
    });
    const server = await preview({
      root: consumer,
      configFile: false,
      logLevel: "error",
      preview: { host: "127.0.0.1", port: 0 },
    });
    try {
      const address = server.httpServer.address();
      for (const mode of ["cjs", "esm", "client"]) {
        const page = await browser.newPage();
        const warnings = [];
        page.on("pageerror", (error) => warnings.push(error.message));
        page.on("console", (message) => {
          if (["warning", "error"].includes(message.type()))
            warnings.push(message.text());
        });
        try {
          await page.goto(`http://127.0.0.1:${address.port}/${mode}.html`);
          await page.waitForFunction(() => window.workspaceTabsReady);
          const before = await page
            .locator("#root [id]")
            .evaluateAll((nodes) => nodes.map((node) => node.id));
          assert.equal(
            new Set(before).size,
            before.length,
            "Opaque keys and all workspace instances must have unique IDs",
          );
          if (mode !== "client") {
            assert.deepEqual(
              before,
              await page.evaluate(() => window.serverIds),
              "Hydration must preserve server-rendered IDs",
            );
          }
          assert.equal(await page.getByRole("tab").count(), 42);
          assert.equal(
            await page.getByRole("tab").evaluateAll((tabs) =>
              tabs.every((tab) => {
                const panel = document.getElementById(
                  tab.getAttribute("aria-controls"),
                );
                const list = tab
                  .closest("section")
                  .querySelector("[role=tablist]");
                return (
                  panel &&
                  list.getAttribute("aria-owns").split(" ").includes(tab.id) &&
                  (panel.hasAttribute("aria-label") ||
                    panel.getAttribute("aria-labelledby") === tab.id)
                );
              }),
            ),
            true,
            "External panels and tablist ownership must resolve to their own tabs",
          );
          const workspace = page.getByRole("region", {
            name: "shared-1",
            exact: true,
          });
          await workspace
            .getByRole("tab", { name: "View 2", exact: true })
            .click();
          assert.equal(
            await workspace
              .getByRole("tab", { name: "View 2", exact: true })
              .getAttribute("aria-selected"),
            "true",
          );
          assert.equal(
            await workspace.getByRole("tabpanel").textContent(),
            "shared-1 View 2",
          );
          await page
            .getByRole("button", { name: "Rerender", exact: true })
            .click();
          assert.equal(await page.getByLabel("Revision").textContent(), "1");
          assert.deepEqual(
            await page
              .locator("#root [id]")
              .evaluateAll((nodes) => nodes.map((node) => node.id)),
            before,
            "IDs must remain stable after selection and parent rerenders",
          );
          assert.deepEqual(
            warnings,
            [],
            "Client rendering/hydration must not emit errors or warnings",
          );
          results.push({
            version,
            mode,
            ssrFormat:
              mode === "client"
                ? null
                : mode === "cjs"
                  ? "direct-cjs"
                  : "bundled-esm",
            renderer,
            uniqueIds: before.length,
            warnings,
          });
        } finally {
          await page.close();
        }
      }
    } finally {
      await new Promise((done) => server.httpServer.close(done));
    }
  }
  await writeFile(
    join(output, "results.json"),
    JSON.stringify(
      {
        sourceCommit,
        sourceDirty,
        workspace,
        tarball: packed.filename,
        integrity: packed.integrity,
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    `Packed React 16/17 SSR, hydration and client rendering passed (${renderer}). Evidence: ${output}`,
  );
} finally {
  await browser?.close();
}
