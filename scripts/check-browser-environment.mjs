import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function verifyBrowserEnvironment(image, manifest, lock) {
  const version = image?.match(
    /^mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-noble@sha256:[a-f0-9]{64}$/,
  )?.[1];
  assert.ok(version, "Use an immutable official Playwright Noble image");
  for (const [name, actual] of [
    ["package.json", manifest.devDependencies?.playwright],
    ["playwright", lock.packages?.["node_modules/playwright"]?.version],
    [
      "playwright-core",
      lock.packages?.["node_modules/playwright-core"]?.version,
    ],
  ])
    assert.equal(actual, version, `${name} must match the browser image`);
  return version;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const directory = resolve(process.argv[2] ?? "scripts/preview-metrics");
  const read = async (file) =>
    JSON.parse(await readFile(resolve(directory, file)));
  const version = verifyBrowserEnvironment(
    process.env.PROOF_BROWSER_ENVIRONMENT,
    await read("package.json"),
    await read("package-lock.json"),
  );
  console.log(`Playwright ${version} matches the pinned browser environment.`);
}
