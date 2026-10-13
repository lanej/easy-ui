import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const baseUrl = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9078";
const output = resolve(
  process.env.TOKEN_BROWSER_REPORT_DIR ?? "/tmp/easy-ui-token-browser",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const checks = [],
  errors = [];
try {
  for (const scheme of ["light", "dark"]) {
    const context = await browser.newContext({ colorScheme: scheme });
    await context.addInitScript((value) => {
      try {
        localStorage.setItem("easy-ui-storybook-color-scheme", value);
      } catch {
        /* Initial blank document has no origin. */
      }
    }, scheme);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(
        `${baseUrl}/iframe.html?id=foundations-design-tokens--docs&viewMode=docs`,
      );
      const search = page.getByRole("searchbox", { name: "Find a token" });
      await search.waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(
        await page.getByRole("region").count(),
        10,
        "all ten token groups render",
      );
      const card = (name) =>
        page
          .getByRole("listitem")
          .filter({ has: page.getByText(name, { exact: true }) });
      assert.equal(
        await card("space.0.125")
          .locator("[aria-hidden] > span")
          .evaluate((element) => element.getBoundingClientRect().width),
        1,
        "fractional spacing applies generated CSS",
      );
      assert.equal(
        await card("space.2")
          .locator("[aria-hidden] > span")
          .evaluate((element) => element.getBoundingClientRect().width),
        16,
        "spacing renders at actual size",
      );
      assert.equal(
        await card("size.icon.md")
          .locator("[aria-hidden] > span")
          .evaluate((element) => element.getBoundingClientRect().width),
        24,
        "icon size renders at actual size",
      );
      assert.equal(
        await card("shape.border_radius.xl")
          .locator("[aria-hidden] > span")
          .evaluate((element) => getComputedStyle(element).borderRadius),
        "16px",
        "radius renders from CSS",
      );
      assert.equal(
        await card("opacity.underlay")
          .locator("[aria-hidden] > span > span")
          .evaluate((element) => getComputedStyle(element).opacity),
        "0.4",
        "opacity renders from CSS",
      );
      assert.equal(
        await card("font.weight.bold")
          .locator("[aria-hidden] > span")
          .evaluate((element) => getComputedStyle(element).fontWeight),
        "700",
        "font weight renders from CSS",
      );
      assert.equal(
        await card("font.size.17_5")
          .locator("[aria-hidden] > span")
          .evaluate((element) => getComputedStyle(element).fontSize),
        "9px",
        "underscore token resolves correctly",
      );
      assert.notEqual(
        await card("shadow.modal")
          .locator("[aria-hidden] > span")
          .evaluate((element) => getComputedStyle(element).boxShadow),
        "none",
        "shadow is visible",
      );
      assert.equal(
        await card("z-index.notification")
          .locator("[aria-hidden] > span > span")
          .last()
          .evaluate((element) => getComputedStyle(element).zIndex),
        "999999",
        "layer uses declared z-index",
      );
      const neutral = card("color.neutral.000");
      assert.deepEqual(
        await neutral
          .locator("span[style]")
          .evaluateAll((elements) =>
            elements.map(
              (element) => getComputedStyle(element).backgroundColor,
            ),
          ),
        ["rgb(255, 255, 255)", "rgb(19, 27, 42)"],
        "theme samples retain their distinct light/dark values",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "page fits viewport",
      );
      await audit(page);
      await page.screenshot({
        path: `${output}/tokens-${scheme}-${width}.png`,
      });
      await page.getByRole("button", { name: /Token group/ }).click();
      await page
        .getByRole("option", { name: "Theme tokens", exact: true })
        .click();
      await page.screenshot({ path: `${output}/theme-${scheme}-${width}.png` });
      await search.fill("#6e93ff");
      assert.equal(
        await page.getByRole("listitem").count(),
        1,
        "dark values are searchable",
      );
      await search.fill("no-such-token");
      await page.getByText("No tokens match these filters.").waitFor();
      await search.fill("");
      await page.getByRole("button", { name: /Token group/ }).focus();
      await page.keyboard.press("Enter");
      await page.getByRole("option", { name: "Shapes", exact: true }).click();
      assert.equal(
        await page.getByRole("listitem").count(),
        5,
        "group filter recovers after no results",
      );
      await page.screenshot({
        path: `${output}/shapes-${scheme}-${width}.png`,
      });
      await audit(page);
      // A larger root font scales the same CSS-variable-backed dimension.
      await page.getByRole("button", { name: /Token group/ }).click();
      await page.getByRole("option", { name: "Spacing", exact: true }).click();
      await page.addStyleTag({
        content: "html { font-size: 32px !important; }",
      });
      assert.equal(
        await card("space.2")
          .locator("[aria-hidden] > span")
          .evaluate((element) => element.getBoundingClientRect().width),
        32,
        "rem samples respect enlarged root font size",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "large text fits viewport",
      );
      checks.push({ scheme, width });
    }
    // Exercise the actual MDX link, including navigation out of the docs iframe.
    await page.getByRole("link", { name: "Colors", exact: true }).click();
    await page.waitForURL(`${baseUrl}/?path=/docs/foundations-colors--docs`);
    let docs = page.frameLocator("#storybook-preview-iframe");
    await docs.getByRole("searchbox", { name: "Filter colors" }).waitFor();
    assert.ok(
      (await docs.getByRole("button", { name: /^Copy #/ }).count()) > 50,
      "Colors gallery renders inside the existing docs provider",
    );
    await page.screenshot({ path: `${output}/colors-${scheme}-390.png` });
    await page.goto(`${baseUrl}/?path=/docs/foundations-icons--docs`);
    docs = page.frameLocator("#storybook-preview-iframe");
    await docs.getByRole("searchbox", { name: "Filter icons" }).waitFor();
    assert.ok(
      (await docs.getByRole("button", { name: /^Copy import/ }).count()) > 100,
      "Icons gallery renders inside the existing docs provider",
    );
    await page.screenshot({ path: `${output}/icons-${scheme}-390.png` });
    checks.push({ scheme, foundations: ["Colors", "Icons"] });
  }
  assert.deepEqual(errors, [], "no runtime errors");
  console.log(
    "Token browser rendering, filters, themes, accessibility, and large text passed at desktop and mobile widths.",
  );
} finally {
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}

async function audit(page) {
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const violations = await page.evaluate(async () =>
    (
      await axe.run(document.querySelector(".sbdocs-content"), {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      })
    ).violations.map(({ id, impact }) => ({ id, impact })),
  );
  assert.deepEqual(violations, [], "token documentation accessibility");
}
