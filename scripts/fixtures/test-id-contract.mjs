// Copied into each isolated npm-tarball consumer by check-style-package.mjs.
// Resolve every dependency and public entry there, without source aliases.
import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { relative } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import React from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
for (const name of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLButtonElement",
  "Element",
  "Node",
  "SVGElement",
  "MutationObserver",
  "getComputedStyle",
]) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: name === "window" ? dom.window : dom.window[name],
  });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { cleanup, fireEvent, render } = await import("@testing-library/react");
after(() => dom.window.close());

const require = createRequire(import.meta.url);
for (const format of [
  {
    name: "CommonJS",
    load: require,
    resolve: require.resolve,
    extension: ".js",
  },
  {
    name: "ESM",
    load: (specifier) => import(specifier),
    resolve: (specifier) => fileURLToPath(import.meta.resolve(specifier)),
    extension: ".mjs",
  },
]) {
  async function load(component, suffix = "") {
    const specifier = "@easypost/easy-ui/" + component + suffix;
    const resolved = realpathSync(format.resolve(specifier));
    assert.ok(
      !relative(process.cwd(), resolved).startsWith(".."),
      "Import escaped the isolated consumer: " + resolved,
    );
    assert.ok(resolved.endsWith(format.extension), specifier);
    return (await format.load(specifier))[component];
  }

  // Exercise conditional exports, /index aliases, and explicit file exports.
  for (const suffix of ["", "/index", "/index" + format.extension]) {
    const CardListItem = await load("CardListItem", suffix);
    for (const interactive of [false, true]) {
      for (const hasTestId of [false, true]) {
        await test(`${format.name} CardListItem${suffix}: interactive=${interactive}, testId=${hasTestId}`, (t) => {
          t.after(cleanup);
          let selections = 0;
          const view = render(
            React.createElement(
              "ul",
              null,
              React.createElement(
                CardListItem,
                {
                  ...(hasTestId ? { testId: "packed-card" } : {}),
                  ...(interactive ? { onSelect: () => selections++ } : {}),
                },
                "Packed card",
              ),
            ),
          );
          const surface = hasTestId
            ? view.getByTestId("packed-card")
            : view.getByText("Packed card");
          assert.equal(surface.tagName, interactive ? "BUTTON" : "DIV");
          assert.equal(surface.hasAttribute("data-testid"), hasTestId);
          assert.equal(
            view.getByRole("listitem").hasAttribute("data-testid"),
            false,
          );
          fireEvent.click(surface);
          assert.equal(selections, interactive ? 1 : 0);
        });
      }
    }
  }

  // The package-wide policy must also preserve forwarded and built-in IDs.
  for (const name of ["Button", "UnstyledButton", "Card"]) {
    const Component = await load(name);
    await test(`${format.name} ${name}: caller data-testid`, (t) => {
      t.after(cleanup);
      const view = render(
        React.createElement(
          Component,
          { "data-testid": "caller-id" },
          "Content",
        ),
      );
      assert.equal(view.getByTestId("caller-id").textContent, "Content");
    });
  }
  const Card = await load("Card");
  await test(`${format.name} Card: built-in IDs`, (t) => {
    t.after(cleanup);
    const view = render(React.createElement(Card, null, "Content"));
    assert.ok(view.getByTestId("container").contains(view.getByTestId("area")));
  });
  const Badge = await load("Badge");
  await test(`${format.name} Badge: built-in ID`, (t) => {
    t.after(cleanup);
    const view = render(React.createElement(Badge, null, "Status"));
    assert.equal(view.getByTestId("root").tagName, "SPAN");
  });
}
