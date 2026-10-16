import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.STORYBOOK_URL ?? "http://127.0.0.1:9018";
const output = resolve(
  process.env.FACILITY_REPORT_DIR ?? "/tmp/easy-ui-metrics",
  "dependency-graph-appearance",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE_PATH,
  args: JSON.parse(process.env.BROWSER_LAUNCH_ARGS ?? "[]"),
});
const page = await browser.newPage();
const errors = [];
const checks = [];
page.on("pageerror", (error) => errors.push(error.message));
async function appearance(surface) {
  return surface.evaluate((element) => {
    const style = getComputedStyle(element);
    const token = (name) => {
      const probe = document.createElement("span");
      probe.style.color = `var(--ezui-color-${name})`;
      element.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    return {
      background: style.backgroundColor,
      border: style.borderTopColor,
      shadow: style.boxShadow,
      warningBackground: token("warning-050"),
      warningBorder: token("warning-600"),
      negativeBorder: token("negative-600"),
      selection: token("primary-500"),
    };
  });
}
try {
  for (const theme of ["light", "dark"]) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(
        `${base}/iframe.html?id=components-dependencygraph--risk-annotations&viewMode=story&globals=colorScheme:${theme}`,
      );
      await page.locator('[data-graph-resource-card="worker"]').waitFor();
      await page.evaluate(() => document.fonts.ready);
      for (const presentation of ["graph", "tree"]) {
        if (presentation === "tree") {
          await page
            .getByRole("button", { name: "Tree", exact: true })
            .press("Enter");
          await page.getByRole("treegrid", { name: "Resource tree" }).waitFor();
        }
        const selector =
          presentation === "graph"
            ? "data-graph-resource-card"
            : "data-tree-node";
        const worker = page.locator(`[${selector}="worker"]`);
        const api = page.locator(`[${selector}="api"]`);
        const plain = page.locator(`[${selector}="network"]`);
        const before = await appearance(worker);
        assert.equal(before.background, before.warningBackground);
        assert.equal(before.border, before.warningBorder);
        const outlined = await appearance(api);
        assert.equal(outlined.border, outlined.negativeBorder);
        assert.equal(
          outlined.background,
          (await appearance(plain)).background,
          "Outline-only emphasis retains the default background",
        );
        // Reuse rendered surfaces to exercise CSS inheritance at a nested graph boundary.
        assert.ok(
          await worker.evaluate((host, selector) => {
            const outer = host.closest("[data-dependency-graph]");
            const original = outer.querySelector(`[${selector}="network"]`);
            const before = getComputedStyle(original);
            const expected = [before.backgroundColor, before.borderTopColor];
            const nested = outer.cloneNode(false);
            const card = original.cloneNode(true);
            nested.append(card);
            host.append(nested);
            const actual = getComputedStyle(card);
            const isolated =
              actual.backgroundColor === expected[0] &&
              actual.borderTopColor === expected[1];
            nested.remove();
            return isolated;
          }, selector),
          "Nested graphs do not inherit the containing resource's emphasis",
        );
        const control =
          presentation === "graph"
            ? worker.locator("[data-graph-node]")
            : worker;
        await control.focus();
        if (
          !(await worker.evaluate((element) =>
            element.hasAttribute("data-selected"),
          ))
        )
          await control.press("Enter");
        await page.waitForFunction(
          (selector) =>
            document
              .querySelector(`[${selector}="worker"]`)
              .hasAttribute("data-selected"),
          selector,
        );
        const selected = await appearance(worker);
        assert.equal(selected.background, before.background);
        assert.equal(selected.border, before.border);
        assert.ok(
          selected.shadow.includes(selected.selection),
          "Selection remains distinct from the caller's outline",
        );
        assert.ok((await worker.innerText()).includes("Medium risk"));
        assert.ok((await api.innerText()).includes("High risk"));
        if (presentation === "graph")
          assert.notEqual(await control.getAttribute("aria-describedby"), null);
        await page.addScriptTag({
          path: require.resolve("axe-core/axe.min.js"),
        });
        let violations;
        for (let attempt = 0; ; attempt++) {
          try {
            violations = await page.evaluate(async () =>
              (
                await window.axe.run(
                  document.querySelector("[data-dependency-graph]"),
                  {
                    runOnly: {
                      type: "tag",
                      values: ["wcag2a", "wcag2aa", "wcag21aa"],
                    },
                  },
                )
              ).violations.map(({ id, nodes }) => ({
                id,
                targets: nodes.map(({ target }) => target),
              })),
            );
            break;
          } catch (error) {
            if (!String(error).includes("already running") || attempt === 59)
              throw error;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        }
        assert.deepEqual(violations, []);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        await page.locator("[data-dependency-graph]").screenshot({
          path: resolve(output, `${presentation}-${theme}-${width}.png`),
        });
        if (theme === "light" && width === 1440) {
          await page.emulateMedia({ forcedColors: "active" });
          const forced = await appearance(worker);
          assert.equal(
            forced.background,
            (await appearance(plain)).background,
            "Forced colors use the system canvas",
          );
          assert.ok(
            await worker.evaluate(
              (element) => getComputedStyle(element).outlineStyle !== "none",
            ),
            "Selection remains visible in forced colors",
          );
          await page.emulateMedia({ forcedColors: "none" });
        }
        checks.push({ name: `${presentation}-${theme}-${width}` });
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    `DependencyGraph appearance: ${checks.length} browser cases passed.`,
  );
} catch (error) {
  errors.push(error.stack ?? String(error));
  throw error;
} finally {
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}
