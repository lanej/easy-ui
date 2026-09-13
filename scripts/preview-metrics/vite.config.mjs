import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { defineConfig } from "vite";

const local = (path) => fileURLToPath(new URL(path, import.meta.url));

export function previewConfig(engine = "full", outDir = "dist") {
  if (!["full", "portfolio"].includes(engine))
    throw new Error(`Unknown chart engine preset: ${engine}`);
  return defineConfig({
    // Use a relative base only for the GitHub Pages copy. Review artifacts keep
    // their existing root-served paths by default.
    base: process.env.EASY_UI_PREVIEW_BASE || "/",
    // Substitute only the private preview's loader. Production Chart keeps its
    // full-engine default; native components still never import a chart engine.
    plugins: [
      ...(process.env.EASY_UI_GUIDE_ONLY
        ? [
            {
              name: "guide-attribution",
              generateBundle() {
                const notices = new Map();
                notices.set(
                  "Easy UI",
                  readFileSync(local("../../LICENSE"), "utf8"),
                );
                notices.set(
                  "Poppins",
                  readFileSync(
                    local("../../.storybook/public/fonts/poppins/OFL.txt"),
                    "utf8",
                  ),
                );
                for (const id of this.getModuleIds()) {
                  if (
                    !id.startsWith("/") ||
                    !id.includes("/node_modules/") ||
                    !this.getModuleInfo(id)?.isIncluded
                  )
                    continue;
                  let dir = dirname(id.split("?")[0]);
                  while (
                    !existsSync(join(dir, "package.json")) &&
                    dirname(dir) !== dir
                  )
                    dir = dirname(dir);
                  const pkg = JSON.parse(
                    readFileSync(join(dir, "package.json"), "utf8"),
                  );
                  if (notices.has(pkg.name)) continue;
                  if (pkg.name === "@easypost/easy-ui-tokens") {
                    notices.set(pkg.name, notices.get("Easy UI"));
                    continue;
                  }
                  const license = readdirSync(dir).find((file) =>
                    /^licen[cs]e(?:\.|$)/i.test(file),
                  );
                  if (!license)
                    throw new Error(
                      `Missing redistribution license for ${pkg.name}`,
                    );
                  notices.set(
                    pkg.name,
                    `${pkg.name}@${pkg.version}\n${readFileSync(join(dir, license), "utf8")}`,
                  );
                }
                this.emitFile({
                  type: "asset",
                  fileName: "NOTICE.txt",
                  source: [...notices.entries()]
                    .sort()
                    .map(([name, license]) => `${name}\n${license}`)
                    .join("\n\n"),
                });
              },
            },
          ]
        : []),
      ...(engine === "portfolio"
        ? [
            {
              name: "modular-chart-preview",
              enforce: "pre",
              load(id) {
                if (id === local("../../easy-ui-react/src/Chart/engine.ts"))
                  return `export function loadChartEngine() { return import(${JSON.stringify(local("./modular/portfolio.mjs"))}); }`;
              },
            },
          ]
        : []),
    ],
    publicDir: process.env.EASY_UI_GUIDE_ONLY
      ? false
      : local("../../.storybook/public"),
    // Keep this review harness independent of the monorepo's install/build.
    esbuild: {
      tsconfigRaw: JSON.stringify({ compilerOptions: { jsx: "react-jsx" } }),
    },
    resolve: {
      alias: {
        "overlayscrollbars/overlayscrollbars.css": local(
          "./node_modules/overlayscrollbars/styles/overlayscrollbars.css",
        ),
        ...Object.fromEntries(
          [
            "react-aria",
            "@react-aria/utils",
            "react",
            "react-dom",
            "lodash",
            "@easypost/easy-ui-tokens",
            "echarts",
          ].map((name) => [name, local(`./node_modules/${name}`)]),
        ),
      },
    },
    css: {
      preprocessorOptions: { scss: { silenceDeprecations: ["legacy-js-api"] } },
    },
    build: {
      manifest: true,
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        input: process.env.EASY_UI_GUIDE_ONLY
          ? {
              pricing: local("./pricing.html"),
              encodings: local("./encodings.html"),
            }
          : {
              pricing: local("./pricing.html"),
              encodings: local("./encodings.html"),
              gallery: local("./index.html"),
              states: local("./audit.html"),
              layout: local("./layout.html"),
            },
      },
    },
  });
}

export default previewConfig(
  process.env.EASY_UI_CHART_ENGINE,
  process.env.EASY_UI_PREVIEW_OUT_DIR,
);
