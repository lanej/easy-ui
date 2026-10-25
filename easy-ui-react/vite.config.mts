/// <reference types="vitest/config" />

import react from "@vitejs/plugin-react";
import { glob } from "glob";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { cleanPkgJsonForDist } from "../scripts/copyDistFiles.mjs";

export default defineConfig({
  plugins: [
    react({ jsxRuntime: "automatic" }),
    viteStaticCopy({
      targets: [
        {
          src: "package.json",
          dest: ".",
          transform: (contents) =>
            cleanPkgJsonForDist(contents, { preserveExports: true }),
        },
        { src: "README.md", dest: "." },
        { src: "CHANGELOG.md", dest: "." },
        { src: "src/styles", dest: "." },
        { src: "skills", dest: "." },
        { src: "install-skill.mjs", dest: "." },
        {
          src: [
            "src/NetworkMap/maplibre-gl.css",
            "src/NetworkMap/maplibre-gl-worker.mjs",
          ],
          dest: "NetworkMap",
        },
      ],
    }),
  ],
  css: {
    modules: {
      globalModulePaths: [/global\.s?css$/],
    },
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ["legacy-js-api"],
      },
    },
  },
  build: {
    emptyOutDir: false,
    target: "es2015",
    minify: false,
    lib: {
      entry: buildEntryObject([
        ...glob.sync("src/**/index.ts"),
        ...glob.sync("src/utilities/*.ts", {
          ignore: ["**/*.test.ts"],
        }),
      ]),
      cssFileName: "style",
    },
    rollupOptions: {
      external: (id) =>
        [
          "react",
          // Keep WorkspaceTabs' legacy ID context shared with the application's
          // React Aria SSRProvider rather than bundling a second private copy.
          "react-aria/useId",
          "echarts",
          "@dagrejs/dagre",
          "maplibre-gl",
          "react-dom",
          "vitest",
          "@testing-library/react",
          "@testing-library/user-event",
        ].some((pkg) => id === pkg || id.startsWith(`${pkg}/`)),
      output: [
        {
          format: "cjs",
          entryFileNames: "[name].js",
          chunkFileNames: "__chunks__/[name]-[hash].js",
        },
        {
          format: "esm",
          entryFileNames: "[name].mjs",
          chunkFileNames: "__chunks__/[name]-[hash].mjs",
        },
      ],
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    css: true,
    setupFiles: "./vitest.setup.ts",
    exclude: ["**/node_modules/**", "src/utilities/test.ts"],
  },
});

// Maps entry filenames to entries with proper aliases:
//
// src/Icon/index.ts -> Icon/index
// src/utilities/css.ts -> utilities/css
function buildEntryObject(entries: string[]) {
  return entries.reduce((o, entry) => {
    const alias = entry.replace(/^src\//, "").replace(/.ts$/, "");
    return { ...o, [alias]: entry };
  }, {});
}
