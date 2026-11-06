import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { runSuite, suites } from "./run-browser-ci.mjs";

const originalScripts = [
  "check-waffle-chart",
  "check-map-primary-insets",
  "check-metric-card",
  "check-facility-summary",
  "check-chart-catalog",
  "check-proportion-bar",
  "check-meter-bar-comparison",
  "check-dependency-graph",
  "check-dependency-graph-arrowheads",
  "check-dependency-graph-groups",
  "check-dependency-tree",
  "check-storybook-docs",
  "check-token-browser",
  "check-notifications",
  "check-theme-toggle",
  "check-drawer-placement",
  "check-evidence-typography",
];
const workflow = await readFile(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);

test("every original browser script runs exactly once", async () => {
  const scripts = Object.values(suites).flat();
  assert.deepEqual(scripts.toSorted(), originalScripts.toSorted());
  assert.equal(new Set(scripts).size, scripts.length);
  for (const script of scripts)
    await access(new URL(`./${script}.mjs`, import.meta.url));
});

test("the workflow matrix includes all suites", () => {
  const matrix = workflow.match(/suite: \[([^\]]+)\]/)?.[1];
  assert.ok(matrix);
  assert.deepEqual(
    matrix.split(",").map((name) => name.trim()),
    Object.keys(suites),
  );
  assert.match(workflow, /fail-fast: false/);
});

test("runs each script sequentially with inherited dependencies and environment", () => {
  const calls = [],
    logs = [];
  let time = 0;
  runSuite("charts", {
    run: (...args) => {
      calls.push(args);
      return { status: 0 };
    },
    log: (line) => logs.push(line),
    now: () => (time += 1000),
  });
  assert.deepEqual(
    calls.map(([binary, args, options]) => {
      assert.equal(binary, process.execPath);
      assert.equal(options.stdio, "inherit");
      assert.equal(options.env, process.env);
      return args;
    }),
    suites.charts.map((script) => [`scripts/${script}.mjs`]),
  );
  assert.equal(logs.filter((line) => line.startsWith("::group::")).length, 3);
  assert.equal(logs.filter((line) => line.endsWith(": 1.0s")).length, 3);
  assert.equal(logs.filter((line) => line === "::endgroup::").length, 3);
});

for (const [label, result, expected] of [
  ["nonzero exit", { status: 3 }, /exit 3/],
  ["signal", { status: null, signal: "SIGTERM" }, /SIGTERM/],
  ["spawn failure", { error: new Error("cannot spawn") }, /cannot spawn/],
])
  test(`propagates ${label}, closes logging, and stops the shard`, () => {
    let calls = 0;
    const logs = [];
    assert.throws(
      () =>
        runSuite("charts", {
          run: () => {
            calls++;
            return result;
          },
          log: (line) => logs.push(line),
        }),
      expected,
    );
    assert.equal(calls, 1);
    assert.equal(logs.at(-1), "::endgroup::");
  });

test("rejects missing, unknown, and inherited suite names before spawning", () => {
  for (const name of [undefined, "typo", "toString", "__proto__"])
    assert.throws(
      () => runSuite(name, { run: () => assert.fail("must not spawn") }),
      /Unknown browser CI suite/,
    );
  const result = spawnSync(process.execPath, [
    new URL("./run-browser-ci.mjs", import.meta.url).pathname,
    "unknown",
  ]);
  assert.notEqual(result.status, 0);
});

test("stable build gate waits for every job, including failure or skip", () => {
  assert.match(
    workflow,
    /  build:\n    name: build\n    if: always\(\)\n    needs: \[checks, storybook, browser\]/,
  );
  // Exercise the actual gate program rather than a second implementation.
  const source = workflow.match(
    /python3 - <<'PY'\n([\s\S]*?)\n          PY/,
  )?.[1];
  assert.ok(source);
  const program = source
    .split("\n")
    .map((line) => line.slice(10))
    .join("\n");
  const names = ["checks", "storybook", "browser"];
  const gate = (overrides = {}) =>
    spawnSync("python3", ["-c", program], {
      env: {
        ...process.env,
        RESULTS: JSON.stringify(
          Object.fromEntries(
            names.map((name) => [
              name,
              { result: overrides[name] ?? "success" },
            ]),
          ),
        ),
      },
    });
  assert.equal(gate().status, 0);
  for (const name of names)
    for (const result of ["failure", "cancelled", "skipped"])
      assert.equal(gate({ [name]: result }).status, 1, `${name}: ${result}`);
});

test("uses same-run artifacts and read-only permissions without path skipping", () => {
  assert.match(
    workflow.slice(workflow.indexOf("  browser:")),
    /npm ci --ignore-scripts --no-audit --no-fund/,
  );
  assert.match(workflow, /permissions:\n  contents: read\n/);
  assert.doesNotMatch(
    workflow,
    /pull_request_target|paths-ignore:|github-token:|run-id:|repository:/,
  );
  assert.match(
    workflow,
    /cancel-in-progress: \$\{\{ github.event_name == 'pull_request' \}\}/,
  );
  for (const directory of [
    "storybook-static",
    "easy-ui-react",
    "easy-ui-icons",
    "easy-ui-tokens",
  ])
    assert.ok(
      workflow.includes(
        directory === "storybook-static"
          ? `${directory}/`
          : `${directory}/dist/`,
      ),
    );
});

test("component shards always execute instead of trusting prior proof", () => {
  const browser = workflow.slice(
    workflow.indexOf("  browser:"),
    workflow.indexOf("  # Preserve"),
  );
  assert.doesNotMatch(
    browser.replace("if: always()", ""),
    /browser-proof|steps\.proof|reuse|if:/,
  );
  assert.match(
    browser,
    /node scripts\/run-browser-ci\.mjs "\$BROWSER_CI_SUITE"/,
  );
});
