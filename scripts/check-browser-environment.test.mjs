import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { verifyBrowserEnvironment } from "./check-browser-environment.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const ci = await read(".github/workflows/ci.yml");
const maps = await read(".github/workflows/network-map-examples.yml");
const capture = await read("scripts/preview-maps/capture.mjs");
const image = ci.match(/      image: (\S+)/)?.[1];

test("all Linux browser images are immutable and match both preview lockfiles", async () => {
  assert.ok(image);
  const images = [
    ...(ci + maps).matchAll(/mcr\.microsoft\.com\/playwright:\S+/g),
  ];
  assert.equal(images.length, 4);
  for (const match of images) assert.equal(match[0], image);
  for (const name of ["metrics", "maps"])
    assert.equal(
      verifyBrowserEnvironment(
        image,
        JSON.parse(await read(`scripts/preview-${name}/package.json`)),
        JSON.parse(await read(`scripts/preview-${name}/package-lock.json`)),
      ),
      "1.63.0",
    );
});

test("rejects mutable images and dependency/image version drift", () => {
  const manifest = { devDependencies: { playwright: "1.63.0" } };
  const lock = {
    packages: {
      "node_modules/playwright": { version: "1.63.0" },
      "node_modules/playwright-core": { version: "1.63.0" },
    },
  };
  assert.throws(() =>
    verifyBrowserEnvironment(image.split("@")[0], manifest, lock),
  );
  assert.throws(() => verifyBrowserEnvironment(image, {}, lock));
  for (const name of ["playwright", "playwright-core"])
    assert.throws(() =>
      verifyBrowserEnvironment(image, manifest, {
        packages: {
          ...lock.packages,
          [`node_modules/${name}`]: { version: "1.62.0" },
        },
      }),
    );
});

test("preserves real browser coverage without repeated Linux font installation", () => {
  const browser = ci.slice(
    ci.indexOf("  browser:"),
    ci.indexOf("  # Preserve"),
  );
  assert.match(browser, /shell: bash/);
  assert.match(browser, /appType: "mpa"/);
  assert.doesNotMatch(browser, /python3|playwright install|runner\.temp/);
  assert.match(browser, /mkdir -p \.browser-ci-reports/);
  assert.match(
    browser,
    /path: \.browser-ci-reports\/\n          include-hidden-files: true/,
  );
  const mapBrowser = maps.slice(
    maps.indexOf("  browser:"),
    maps.indexOf("  layout:"),
  );
  assert.match(mapBrowser, /container: \$\{\{ matrix.container \|\| '' \}\}/);
  assert.match(
    mapBrowser,
    /browser: safari\n            os: macos-15\n    runs-on:/,
  );
  assert.match(mapBrowser, /shell: bash/);
  assert.match(mapBrowser, /xvfb-run -a npm run capture/);
  assert.match(mapBrowser, /MOZ_WEBRENDER: "1"/);
  assert.match(mapBrowser, /npm run audit:safari/);
  assert.doesNotMatch(mapBrowser, /--with-deps/);
  assert.ok(
    mapBrowser.indexOf("npx playwright install chrome") <
      mapBrowser.indexOf("- id: proof"),
  );
  assert.match(
    mapBrowser,
    /PROOF_BROWSER_VERSION=\$\(google-chrome --version\)/,
  );
  assert.match(capture, /channel: "chrome"/);
});
