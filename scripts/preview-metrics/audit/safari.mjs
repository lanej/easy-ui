import { writeFile } from "node:fs/promises";
import { Builder, By, Key } from "selenium-webdriver";
import { preview } from "vite";
import { auditBrowser } from "./checks.mjs";

// Run on macOS against the installed Safari browser and Apple safaridriver.
// Playwright WebKit is intentionally not used as a substitute for Safari.
const server = await preview({
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
});
let driver;
try {
  driver = await new Builder().forBrowser("safari").build();
  await driver
    .manage()
    .setTimeouts({ implicit: 0, pageLoad: 60000, script: 60000 });
  await driver.manage().window().setRect({ width: 1440, height: 1000 });
  const capabilities = await driver.getCapabilities();
  await auditBrowser(
    {
      open: (url) => driver.get(url),
      resize: async (width, height) => {
        // Read the browser chrome from one settled frame, before changing the
        // window. Mixing a new native outer rect with stale JS innerWidth can
        // produce a negative second resize request after a large contraction.
        const insets = await driver.executeAsyncScript((done) => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              done({
                width: Math.max(0, outerWidth - innerWidth),
                height: Math.max(0, outerHeight - innerHeight),
              }),
            ),
          );
        });
        await driver
          .manage()
          .window()
          .setRect({
            width: width + insets.width,
            height: height + insets.height,
          });
        await driver.executeAsyncScript((done) => {
          requestAnimationFrame(() => requestAnimationFrame(() => done(true)));
        });
      },
      evaluate: (fn, ...args) => driver.executeScript(fn, ...args),
      wait: (fn, ...args) =>
        driver.wait(
          () => driver.executeScript(fn, ...args),
          30000,
          `Browser condition did not become true: ${fn}`,
        ),
      script: (source) => driver.executeScript(source),
      key: async (selector, key) => {
        const element = await driver.findElement(By.css(selector));
        await driver.executeScript("arguments[0].focus()", element);
        // Match Playwright's keyboard transport: send native input to the
        // focused element. Safari's Element.sendKeys rejects table rows as
        // non-interactable even when their tabindex allows keyboard focus.
        await driver
          .actions()
          .sendKeys(
            {
              Enter: Key.ENTER,
              Space: Key.SPACE,
              Tab: Key.TAB,
              ArrowRight: Key.ARROW_RIGHT,
            }[key] ?? key,
          )
          .perform();
      },
      hover: async (selector) =>
        driver
          .actions()
          .move({ origin: await driver.findElement(By.css(selector)) })
          .perform(),
      click: async (selector) =>
        (await driver.findElement(By.css(selector))).click(),
      screenshot: async (path) =>
        writeFile(path, Buffer.from(await driver.takeScreenshot(), "base64")),
    },
    {
      name: capabilities.get("browserName"),
      version: capabilities.get("browserVersion"),
      platform: capabilities.get("platformName"),
    },
    "http://127.0.0.1:4173",
    `screenshots/audit/safari-${process.env.EASY_UI_CHART_ENGINE ?? "full"}`,
  );
} finally {
  await driver?.quit();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
