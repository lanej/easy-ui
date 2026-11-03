import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ?? "./preview-metrics/node_modules/playwright",
);
const baseUrl = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9018";
const output = resolve(
  process.env.CODE_SYNTAX_REPORT_DIR ?? "/tmp/easy-ui-code-syntax",
);
const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const dirtyPaths = execFileSync(
  "git",
  ["status", "--porcelain", "--untracked-files=no"],
  { encoding: "utf8" },
).trim();
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const results = [];
const screenshots = [];
const errors = [];

function contrast(foreground, background) {
  const luminance = (rgb) => {
    const channels = rgb
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((value) => {
        value /= 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(foreground), luminance(background)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

async function open(page, component, story, scheme = "light") {
  await page.goto(
    `${baseUrl}/iframe.html?id=components-code-${component}--${story}&viewMode=story&globals=colorScheme:${scheme}`,
  );
  await page.locator("#storybook-root code").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}

async function inspect(page, name) {
  const measured = await page
    .locator("#storybook-root code")
    .evaluateAll((elements) =>
      elements.map((code) => {
        let surface = code;
        while (
          surface &&
          ["rgba(0, 0, 0, 0)", "transparent"].includes(
            getComputedStyle(surface).backgroundColor,
          )
        )
          surface = surface.parentElement;
        const background = surface
          ? getComputedStyle(surface).backgroundColor
          : "rgb(255, 255, 255)";
        return {
          background,
          foreground: getComputedStyle(code).color,
          colors: [
            ...new Set(
              [code, ...code.querySelectorAll("span")]
                .filter((el) => el.textContent.trim())
                .map((el) => getComputedStyle(el).color),
            ),
          ],
          text: code.textContent,
        };
      }),
    );
  for (const code of measured) {
    for (const color of code.colors)
      assert.ok(
        contrast(color, code.background) >= 4.5,
        `${name}: ${color} on ${code.background}`,
      );
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  assert.ok(overflow <= 1, `${name}: page overflow ${overflow}`);
  results.push({ name, measured, overflow });
  return measured;
}

async function capture(page, name, theme) {
  const file = `${name}.png`;
  await page.screenshot({ path: resolve(output, file), fullPage: true });
  screenshots.push({
    file,
    theme,
    viewport: page.viewportSize(),
    url: page.url(),
  });
}

try {
  for (const scheme of ["light", "dark"]) {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 650 },
        colorScheme: scheme,
        permissions: ["clipboard-read", "clipboard-write"],
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await open(page, "codesnippet", "syntax-colors", scheme);
      const snippets = await inspect(page, `snippets-${scheme}-${width}`);
      assert.ok(
        snippets[0].colors.length >= 3,
        "JSON has distinct token colors",
      );
      assert.ok(
        snippets[1].colors.length >= 5,
        "JavaScript has distinct syntax roles",
      );
      await capture(page, `snippets-${scheme}-${width}`, scheme);

      await open(page, "inlinecode", "syntax-colors", scheme);
      const inline = await inspect(page, `inline-${scheme}-${width}`);
      assert.ok(
        inline.some((code) => code.colors.length >= 4),
        "inline code is highlighted",
      );
      assert.equal(await page.locator("#storybook-root pre").count(), 0);
      assert.equal(await page.locator("code code").count(), 0);
      const geometry = await page
        .locator("#storybook-root code")
        .evaluateAll((elements) =>
          elements.map((code) => ({
            display: getComputedStyle(code).display,
            fontSize: getComputedStyle(code).fontSize,
            parentFontSize: getComputedStyle(code.parentElement).fontSize,
          })),
        );
      for (const item of geometry) {
        assert.equal(item.display, "inline");
        assert.equal(item.fontSize, item.parentFontSize);
      }
      await capture(page, `inline-${scheme}-${width}`, scheme);

      await open(page, "codeblock", "syntax-colors", scheme);
      await inspect(page, `block-${scheme}-${width}`);
      const pre = page.locator("pre");
      assert.equal(
        await pre.evaluate((el) => getComputedStyle(el).webkitLineClamp),
        "4",
      );
      assert.ok(
        await pre.evaluate((el) => el.scrollHeight > el.clientHeight),
        "maxLines keeps content scrollable",
      );
      await pre.focus();
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(
        () => document.querySelector("pre").scrollTop > 0,
      );
      await page.getByRole("button", { name: "Node.js", exact: true }).click();
      await page.getByRole("menuitem", { name: "JSON", exact: true }).click();
      await page.locator("code.language-json").waitFor();
      await inspect(page, `block-json-${scheme}-${width}`);
      await page
        .getByRole("button", { name: "Copy code", exact: true })
        .click();
      assert.equal(
        await page.evaluate(() => navigator.clipboard.readText()),
        '{\n  "label": "Sample package",\n  "count": 3,\n  "ready": true,\n  "destination": null\n}',
      );
      await page.getByRole("button", { name: "JSON", exact: true }).click();
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("menu").count(), 0);
      await page.getByRole("button", { name: "JSON", exact: true }).click();
      await page
        .getByRole("menuitem", { name: "Node.js", exact: true })
        .click();
      await page.locator("code.language-javascript").waitFor();
      await capture(page, `block-${scheme}-${width}`, scheme);
      await context.close();
    }
  }

  for (const [component, scope] of [
    ["codesnippet", "syntax"],
    ["inlinecode", "inline"],
  ]) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 650 },
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await open(page, component, "theme-scopes");
    const active = page.locator(`[data-${scope}-scope="active"]`);
    const initial = await active.evaluate(
      (el) =>
        getComputedStyle(el.matches("code") ? el : el.querySelector("code"))
          .color,
    );
    const mounted = await active.elementHandle();
    await inspect(page, `${component}-scopes-light`);
    await capture(
      page,
      `${component}-scopes-light`,
      "light with inverted dark scope",
    );
    await page
      .getByRole("button", { name: "Switch to dark mode", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Switch to light mode", exact: true })
      .waitFor();
    assert.ok(
      await mounted.evaluate((el) => el.isConnected),
      "theme change retains mounted code",
    );
    assert.notEqual(
      await active.evaluate(
        (el) =>
          getComputedStyle(el.matches("code") ? el : el.querySelector("code"))
            .color,
      ),
      initial,
    );
    await inspect(page, `${component}-scopes-dark`);
    await capture(
      page,
      `${component}-scopes-dark`,
      "dark with inverted light scope",
    );
    await page
      .getByRole("button", { name: "Switch to light mode", exact: true })
      .press("Space");
    await page
      .getByRole("button", { name: "Switch to dark mode", exact: true })
      .waitFor();
    assert.equal(
      await active.evaluate(
        (el) =>
          getComputedStyle(el.matches("code") ? el : el.querySelector("code"))
            .color,
      ),
      initial,
    );
    await page.close();

    for (const scheme of ["light", "dark"]) {
      const customPage = await browser.newPage();
      await open(customPage, component, "custom-theme", scheme);
      const custom = customPage
        .locator(
          `[data-${scope}-scope="custom"] span[style*="--ezui-color-positive-700"]`,
        )
        .first();
      assert.equal(
        await custom.evaluate((el) => getComputedStyle(el).color),
        scheme === "light" ? "rgb(110, 59, 189)" : "rgb(196, 167, 255)",
      );
      await inspect(customPage, `${component}-custom-${scheme}`);
      await customPage.close();
    }

    const system = await browser.newPage({ colorScheme: "light" });
    await open(system, component, "syntax-colors", "system");
    const first = await system
      .locator("code")
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    await system.emulateMedia({ colorScheme: "dark" });
    await system.waitForFunction(
      (value) =>
        getComputedStyle(document.querySelector("code")).color !== value,
      first,
    );
    await inspect(system, `${component}-system-dark`);
    await system.emulateMedia({ colorScheme: "light" });
    await system.waitForFunction(
      (value) =>
        getComputedStyle(document.querySelector("code")).color === value,
      first,
    );
    await system.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    `Code syntax browser checks passed (${results.length} states, ${screenshots.length} screenshots).`,
  );
} finally {
  await writeFile(
    resolve(output, "manifest.json"),
    JSON.stringify(
      {
        sourceRevision,
        dirtyPaths,
        browser: await browser.version(),
        command: "node scripts/check-code-syntax.mjs",
        screenshots,
        results,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
