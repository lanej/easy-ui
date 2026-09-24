import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { generateCompatibilityEntries } from "./generateCompatibilityEntries.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "easy-ui-compatibility-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, contents) => {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents);
  };
  write("dist/types.d.ts", 'export type Heading = "h1";\n');
  write("dist/style.css", ":root { --example: 1; }\n");
  write("dist/Card/index.d.ts", "export declare const Card: number;\n");
  write("dist/Card/index.mjs", "export const Card = 42;\n");
  write("dist/Card/index.js", "exports.Card = 42;\n");
  write(
    "dist/Default/index.d.ts",
    "declare const actual: number; export default actual;\n",
  );
  write("dist/Default/index.mjs", "export default 7;\n");
  write("dist/Default/index.js", "exports.default = 7;\n");
  return { root, write };
}

test("forwards real named/default exports and copies authored declarations", async (t) => {
  const { root, write } = fixture(t);
  write("src/Card/types.d.ts", "export type Label = string;\n");
  generateCompatibilityEntries(root);
  generateCompatibilityEntries(root); // Repeated builds remain safe.
  const card = await import(pathToFileURL(join(root, "Card/index.mjs")));
  assert.deepEqual(Object.keys(card), ["Card"]);
  assert.equal(card.Card, 42);
  assert.equal(
    (await import(pathToFileURL(join(root, "Default/index.mjs")))).default,
    7,
  );
  const require = createRequire(join(root, "consumer.cjs"));
  assert.deepEqual(require("./Card"), { Card: 42 });
  assert.deepEqual(require("./Default"), { default: 7 });
  assert.doesNotMatch(
    readFileSync(join(root, "Card/index.d.ts"), "utf8"),
    /default/,
  );
  assert.match(
    readFileSync(join(root, "Default/index.d.ts"), "utf8"),
    /export \{ default \}/,
  );
  assert.equal(
    readFileSync(join(root, "dist/Card/types.d.ts"), "utf8"),
    "export type Label = string;\n",
  );
  assert.match(
    readFileSync(join(root, "Card/types.d.ts"), "utf8"),
    /\.\.\/dist\/Card\/types\.js/,
  );
});

test("removes stale and clean outputs without deleting neighboring user files", (t) => {
  const { root, write } = fixture(t);
  generateCompatibilityEntries(root);
  write("Card/consumer-notes.txt", "keep me");
  rmSync(join(root, "dist/Card"), { recursive: true });
  generateCompatibilityEntries(root);
  assert.equal(existsSync(join(root, "Card/index.d.ts")), false);
  generateCompatibilityEntries(root, { clean: true });
  assert.equal(existsSync(join(root, "Default/index.mjs")), false);
  assert.equal(existsSync(join(root, ".compatibility-entries.json")), false);
  assert.equal(
    readFileSync(join(root, "Card/consumer-notes.txt"), "utf8"),
    "keep me",
  );
  assert.equal(existsSync(join(root, "dist/Default/index.mjs")), true);
});

test("refuses unowned and modified root outputs", (t) => {
  const { root, write } = fixture(t);
  write("Card/index.d.ts", "user file");
  assert.throws(
    () => generateCompatibilityEntries(root),
    /unowned compatibility file/,
  );
  assert.equal(
    readFileSync(join(root, "Card/index.d.ts"), "utf8"),
    "user file",
  );
  rmSync(join(root, "Card/index.d.ts"));
  generateCompatibilityEntries(root);
  write("Card/index.d.ts", "user edit");
  assert.throws(
    () => generateCompatibilityEntries(root, { clean: true }),
    /modified compatibility file/,
  );
  assert.equal(
    readFileSync(join(root, "Card/index.d.ts"), "utf8"),
    "user edit",
  );
});

test("rejects traversal in a recorded output before cleanup", (t) => {
  const { root, write } = fixture(t);
  write("src/keep.ts", "owned source");
  write(
    ".compatibility-entries.json",
    JSON.stringify({
      version: 1,
      files: [
        {
          path: "Card/../src/keep.ts",
          sha256: createHash("sha256").update("owned source").digest("hex"),
        },
      ],
    }),
  );
  assert.throws(
    () => generateCompatibilityEntries(root, { clean: true }),
    /Invalid compatibility output path/,
  );
  assert.equal(readFileSync(join(root, "src/keep.ts"), "utf8"), "owned source");
});
