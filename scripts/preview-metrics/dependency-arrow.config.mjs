import { fileURLToPath } from "node:url";
import { previewConfig } from "./vite.config.mjs";

// Use the same native component, tokens, fonts, and dependency aliases as the
// other browser previews; no root Storybook installation is needed.
const config = previewConfig("full", "dist-dependency-arrow");
config.build.rollupOptions.input = fileURLToPath(
  new URL("./dependency-arrow.html", import.meta.url),
);
export default config;
