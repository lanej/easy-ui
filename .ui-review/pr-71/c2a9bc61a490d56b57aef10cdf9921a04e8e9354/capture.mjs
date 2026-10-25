import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import chromiumBinary from "@sparticuz/chromium";

const fixture = dirname(fileURLToPath(import.meta.url));
const output = process.env.CAPTURE_OUTPUT || fixture;
const url = process.env.CAPTURE_URL || "http://127.0.0.1:4177";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE || (await chromiumBinary.executablePath()),
  args: chromiumBinary.args,
  headless: true,
});
const captures = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1040, height: 680 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(`${url}/?theme=${theme}`, { waitUntil: "networkidle" });
    const button = page.getByTestId("selectable-card");
    const plain = page.getByTestId("read-only-card");
    assert.equal(await button.evaluate((el) => el.tagName), "BUTTON");
    assert.equal(await plain.evaluate((el) => el.tagName), "DIV");
    await button.click();
    await page
      .getByRole("status")
      .filter({ hasText: "Selection callback fired: 1" })
      .waitFor();
    await page
      .locator("pre")
      .filter({ hasText: 'data-testid="selectable-card"' })
      .waitFor();
    await page
      .locator("pre")
      .filter({ hasText: 'data-testid="read-only-card"' })
      .waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.deepEqual(errors, []);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const file = `card-list-item-${theme}.png`;
    await page.screenshot({ path: join(output, file) });
    captures.push({
      file,
      theme,
      viewport: { width: 1040, height: 680 },
      deviceScaleFactor: 1,
      callbackCount: 1,
      surfaces: { "selectable-card": "BUTTON", "read-only-card": "DIV" },
      pageErrors: errors,
    });
  }
  const packageFile = "easypost-easy-ui-1.0.0-alpha.137.tgz";
  const tarball = await readFile(join(fixture, packageFile));
  const manifest = {
    sourceRevision: "c2a9bc61a490d56b57aef10cdf9921a04e8e9354",
    capturedAt: new Date().toISOString(),
    artifact: {
      file: packageFile,
      sha256: createHash("sha256").update(tarball).digest("hex"),
      integrity:
        "sha512-" + createHash("sha512").update(tarball).digest("base64"),
    },
    publicImport: "@easypost/easy-ui/CardListItem (ESM)",
    browser: await browser.version(),
    captureCommand: "npm run dev (separate process); npm run capture",
    preparation:
      "At sourceRevision, run npm ci --ignore-scripts and npm run build:react. Pack easy-ui-react/dist and easy-ui-icons/dist into this fixture directory, then run npm install --ignore-scripts --package-lock=false.",
    scope:
      "Actual installed npm tarball; synthetic content. DOM snippets are read from mounted elements. These images supplement the automated CommonJS/ESM artifact tests; they do not independently prove all package contracts.",
    captures,
  };
  await writeFile(
    join(output, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(JSON.stringify(manifest));
} finally {
  await browser.close();
}
