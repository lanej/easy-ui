import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  fingerprint,
  findProof,
  reusable,
  componentInputPaths,
  producerFingerprint,
} from "./browser-proof.mjs";

test("manual runs, reruns, and unavailable evidence execute fresh checks", async () => {
  const root = await mkdtemp(join(tmpdir(), "easy-ui-proof-cli-"));
  try {
    await mkdir(join(root, "dist"));
    await writeFile(join(root, "dist/index.html"), "preview");
    await writeFile(
      join(root, "event.json"),
      JSON.stringify({
        pull_request: {
          number: 1,
          head: { repo: { full_name: "lanej/easy-ui" } },
        },
      }),
    );
    for (const [event, attempt, suite] of [
      ["workflow_dispatch", "1", "maps-chrome"],
      ["pull_request", "2", "maps-chrome"],
      ["pull_request", "1", "maps-chrome"],
      ["workflow_dispatch", "1", "event-timeline"],
    ]) {
      const output = join(root, `${event}-${attempt}-${suite}.out`);
      const { stderr } = await promisify(execFile)(
        process.execPath,
        [fileURLToPath(new URL("./browser-proof.mjs", import.meta.url))],
        {
          env: {
            ...process.env,
            PROOF_MODE: "check",
            PROOF_SUITE: suite,
            PROOF_BUILT: join(root, "dist"),
            GH_TOKEN: "fixture",
            GITHUB_API_URL: "http://127.0.0.1:1",
            GITHUB_EVENT_PATH: join(root, "event.json"),
            GITHUB_EVENT_NAME: event,
            GITHUB_RUN_ATTEMPT: attempt,
            GITHUB_REPOSITORY: "lanej/easy-ui",
            GITHUB_REF: "refs/pull/1/merge",
            GITHUB_REF_NAME: "1/merge",
            GITHUB_WORKFLOW_REF:
              "lanej/easy-ui/.github/workflows/network-map-examples.yml@refs/pull/1/merge",
            GITHUB_OUTPUT: output,
            GITHUB_STEP_SUMMARY: join(root, "summary.md"),
          },
        },
      );
      assert.match(await readFile(output, "utf8"), /^reuse=false\n/);
      assert.equal(
        stderr.includes("Previous evidence unavailable"),
        event === "pull_request" && attempt === "1",
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("browser reuse follows built dependencies, test inputs, and runtime", async () => {
  const root = await mkdtemp(join(tmpdir(), "easy-ui-browser-proof-"));
  try {
    await mkdir(join(root, "dist"));
    await writeFile(
      join(root, "dist/index.html"),
      "<script src='shared.js'></script>",
    );
    await writeFile(join(root, "dist/shared.js"), "shared component v1");
    await writeFile(join(root, "checks.mjs"), "check hover");
    const hash = (runtime = "node24") =>
      fingerprint(root, "dist", ["checks.mjs"], { runtime });
    const original = await hash();
    await writeFile(join(root, "unrelated-component.tsx"), "unrelated change");
    await writeFile(
      join(root, "dist/bundle-report.json"),
      '{"source":"new-head"}',
    );
    assert.equal(
      await hash(),
      original,
      "unrelated source and report SHA do not invalidate browser evidence",
    );
    await writeFile(join(root, "dist/shared.js"), "shared component v2");
    assert.notEqual(
      await hash(),
      original,
      "rendered shared dependencies invalidate evidence",
    );
    await writeFile(join(root, "dist/shared.js"), "shared component v1");
    await writeFile(join(root, "checks.mjs"), "check hover and pin");
    assert.notEqual(
      await hash(),
      original,
      "changed assertions invalidate evidence",
    );
    await writeFile(join(root, "checks.mjs"), "check hover");
    assert.notEqual(
      await hash("node25"),
      original,
      "runtime changes invalidate evidence",
    );
    await rm(join(root, "dist/index.html"));
    await assert.rejects(hash(), /actual preview build/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

const now = Date.now();
const artifact = {
  name: "proof",
  created_at: new Date(now - 1000).toISOString(),
  expired: false,
  workflow_run: { id: 42 },
};
const context = {
  workflow: ".github/workflows/maps.yml",
  event: "pull_request",
  headRepository: "lanej/easy-ui",
  pr: 1,
};
const run = {
  path: context.workflow,
  event: context.event,
  status: "completed",
  conclusion: "success",
  head_repository: { full_name: context.headRepository },
  pull_requests: [{ number: 1 }],
  html_url: "https://github.com/lanej/easy-ui/actions/runs/42",
};

test("only recent completed successes on the same workflow and PR qualify", () => {
  assert.equal(reusable(artifact, run, context, now), true);
  for (const change of [
    { status: "in_progress" },
    { status: "queued" },
    { conclusion: "failure" },
    { conclusion: "cancelled" },
    { conclusion: null },
    { path: ".github/workflows/other.yml" },
    { event: "push" },
    { head_repository: { full_name: "other/easy-ui" } },
    { pull_requests: [{ number: 2 }] },
  ])
    assert.equal(
      reusable(artifact, { ...run, ...change }, context, now),
      false,
    );
  assert.equal(
    reusable({ ...artifact, expired: true }, run, context, now),
    false,
  );
  assert.equal(
    reusable({ ...artifact, created_at: "invalid" }, run, context, now),
    false,
  );
  assert.equal(reusable(artifact, run, context, now + 7 * 86400000), false);
  assert.equal(
    reusable(artifact, run, { ...context, baseSha: "c".repeat(40) }, now),
    false,
    "missing producer base is not trusted",
  );
  assert.equal(
    reusable(
      artifact,
      { ...run, pull_requests: [{ number: 1, base: { sha: "d".repeat(40) } }] },
      { ...context, baseSha: "c".repeat(40) },
      now,
    ),
    false,
    "changed base invalidates producer",
  );
  const push = { ...context, event: "push", branch: "feat/maps" };
  assert.equal(
    reusable(
      artifact,
      { ...run, event: "push", head_branch: "feat/maps" },
      push,
      now,
    ),
    true,
  );
  assert.equal(
    reusable(
      artifact,
      { ...run, event: "push", head_branch: "main" },
      push,
      now,
    ),
    false,
  );
});

test("lookup requires the exact evidence key and ignores failed runs", async () => {
  const previous = await findProof("proof", context, async (path) => {
    if (path.startsWith("/actions/artifacts?"))
      return {
        artifacts: [
          { ...artifact, name: "different-inputs" },
          { ...artifact, workflow_run: { id: 41 } },
          artifact,
        ],
      };
    if (path.endsWith("/41")) return { ...run, conclusion: "failure" };
    assert.equal(path, "/actions/runs/42");
    return run;
  });
  assert.equal(previous, run.html_url);
  await assert.rejects(
    findProof("proof", context, async () => {
      throw new Error("unavailable");
    }),
    /unavailable/,
  );
});

test("component proof covers nested harnesses, raw docs and dependency inputs", () => {
  const inputs = execFileSync(
    "git",
    ["ls-files", "-z", ...componentInputPaths(".github/workflows/ci.yml")],
    { encoding: "utf8" },
  ).split("\0");
  for (const path of [
    "scripts/check-dependency-graph.mjs",
    "scripts/check-dependency-graph-source.mjs",
    "scripts/check-dependency-graph-appearance.mjs",
    "scripts/check-dependency-graph-heading-routing.mjs",
    "scripts/check-dependency-graph-responsive.mjs",
    "scripts/check-dependency-graph-fullscreen.mjs",
    "scripts/check-dependency-graph-card-layout.mjs",
    "scripts/check-meter-bar.mjs",
    "scripts/browser-proof.mjs",
    "scripts/preview-metrics/package-lock.json",
    "package.json",
    "package-lock.json",
    "easy-ui-react/package.json",
    "easy-ui-icons/package.json",
    "easy-ui-tokens/package.json",
    "easy-ui-react/src/Theme/Theme.mdx",
    ".storybook/preview.tsx",
    ".github/workflows/ci.yml",
    ".github/actions/browser-proof/action.yml",
    ".nvmrc",
  ])
    assert.ok(inputs.includes(path), path);
  assert.ok(!inputs.some((path) => path.startsWith(".ui-review/pr-")));
});

test("component proof hashes every built package plus source-level contracts", async () => {
  const root = await mkdtemp(join(tmpdir(), "easy-ui-component-proof-"));
  try {
    const builds = [
      "storybook-static",
      "easy-ui-react/dist",
      "easy-ui-icons/dist",
      "easy-ui-tokens/dist",
    ];
    for (const directory of builds) {
      await mkdir(join(root, directory), { recursive: true });
      await writeFile(join(root, directory, "runtime.js"), "initial");
    }
    await writeFile(join(root, "storybook-static/index.html"), "preview");
    const inputs = [
      "check-helper.mjs",
      "Component.mdx",
      "package-lock.json",
      "workflow.yml",
    ];
    for (const path of inputs) await writeFile(join(root, path), "initial");
    const hash = (runtime = "node24") =>
      fingerprint(root, builds, inputs, { runtime });
    const initial = await hash();
    await writeFile(join(root, "evidence.png"), "new screenshot");
    assert.equal(
      await hash(),
      initial,
      "unconsumed evidence does not invalidate checks",
    );
    for (const path of [
      ...builds.map((directory) => `${directory}/runtime.js`),
      ...inputs,
    ]) {
      await writeFile(join(root, path), "changed");
      assert.notEqual(await hash(), initial, `${path} invalidates proof`);
      await writeFile(join(root, path), "initial");
    }
    assert.notEqual(await hash("node25"), initial);
    await rm(join(root, "easy-ui-icons/dist"), { recursive: true });
    await assert.rejects(hash(), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("component CLI reuses unchanged successful inputs but fails closed", async () => {
  const root = await mkdtemp(join(tmpdir(), "easy-ui-component-cli-"));
  let storedName,
    requests = 0,
    unavailable = false,
    producerTree = [],
    forgedProducer = false,
    truncatedProducer = false;
  const server = createServer((request, response) => {
    requests++;
    response.setHeader("Content-Type", "application/json");
    if (unavailable) {
      response.writeHead(503);
      response.end("{}");
      return;
    }
    const url = new URL(request.url, "http://localhost");
    if (url.pathname.includes("/git/trees/")) {
      const tree = producerTree.map((entry) =>
        forgedProducer && entry.path === ".github/workflows/ci.yml"
          ? { ...entry, sha: "b".repeat(40) }
          : entry,
      );
      response.end(JSON.stringify({ truncated: truncatedProducer, tree }));
    } else if (url.pathname.endsWith("/artifacts")) {
      const name = url.searchParams.get("name");
      response.end(
        JSON.stringify({
          artifacts:
            name === storedName
              ? [
                  {
                    name,
                    expired: false,
                    created_at: new Date().toISOString(),
                    workflow_run: { id: 42 },
                  },
                ]
              : [],
        }),
      );
    } else
      response.end(
        JSON.stringify({
          status: "completed",
          conclusion: "success",
          head_sha: "a".repeat(40),
          path: ".github/workflows/ci.yml",
          event: "pull_request",
          head_repository: { full_name: "lanej/easy-ui" },
          pull_requests: [{ number: 75, base: { sha: "c".repeat(40) } }],
          html_url: "https://github.com/lanej/easy-ui/actions/runs/42",
        }),
      );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    for (const directory of [
      "storybook-static",
      "easy-ui-react/dist",
      "easy-ui-icons/dist",
      "easy-ui-tokens/dist",
      "scripts",
      ".github/workflows",
      ".ui-review/pr-75",
    ])
      await mkdir(join(root, directory), { recursive: true });
    for (const path of [
      "storybook-static/index.html",
      "easy-ui-react/dist/index.js",
      "easy-ui-icons/dist/index.js",
      "easy-ui-tokens/dist/index.js",
      "scripts/helper.mjs",
      ".github/workflows/ci.yml",
      "package.json",
      "package-lock.json",
    ])
      await writeFile(join(root, path), "fixture");
    execFileSync("git", ["init", "--quiet", root]);
    execFileSync("git", ["-C", root, "add", "."]);
    execFileSync("git", [
      "-C",
      root,
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      "fixture",
    ]);
    producerTree = execFileSync(
      "git",
      ["-C", root, "ls-tree", "-r", "-z", "HEAD"],
      { encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf("\t");
        const [mode, type, sha] = entry.slice(0, separator).split(" ");
        return { path: entry.slice(separator + 1), mode, type, sha };
      });
    const eventPath = join(root, "event.json");
    await writeFile(
      eventPath,
      JSON.stringify({
        pull_request: {
          number: 75,
          base: { sha: "c".repeat(40) },
          head: { repo: { full_name: "lanej/easy-ui" } },
        },
      }),
    );
    const output = join(root, "output");
    const check = async (overrides = {}) => {
      await writeFile(output, "");
      const result = await promisify(execFile)(
        process.execPath,
        [fileURLToPath(new URL("./browser-proof.mjs", import.meta.url))],
        {
          cwd: root,
          env: {
            ...process.env,
            PROOF_MODE: "check",
            PROOF_SUITE: "components-graphs",
            PROOF_BUILT: "storybook-static",
            GH_TOKEN: "fixture",
            GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
            GITHUB_EVENT_PATH: eventPath,
            GITHUB_EVENT_NAME: "pull_request",
            GITHUB_RUN_ATTEMPT: "1",
            GITHUB_REPOSITORY: "lanej/easy-ui",
            GITHUB_REF: "refs/pull/75/merge",
            GITHUB_REF_NAME: "75/merge",
            GITHUB_WORKFLOW_REF:
              "lanej/easy-ui/.github/workflows/ci.yml@refs/pull/75/merge",
            GITHUB_OUTPUT: output,
            GITHUB_STEP_SUMMARY: join(root, "summary.md"),
            ...overrides,
          },
        },
      );
      const values = Object.fromEntries(
        (await readFile(output, "utf8"))
          .trim()
          .split("\n")
          .map((line) => {
            const index = line.indexOf("=");
            return [line.slice(0, index), line.slice(index + 1)];
          }),
      );
      return { ...values, stderr: result.stderr };
    };
    const first = await check();
    assert.equal(first.reuse, "false");
    storedName = first.name;
    assert.equal((await check()).reuse, "true");
    forgedProducer = true;
    assert.equal(
      (await check()).reuse,
      "false",
      "matching artifact name from altered producer is rejected",
    );
    forgedProducer = false;
    truncatedProducer = true;
    assert.equal(
      (await check()).reuse,
      "false",
      "incomplete producer tree runs fresh",
    );
    truncatedProducer = false;
    await writeFile(
      eventPath,
      JSON.stringify({
        pull_request: {
          number: 75,
          base: { sha: "c".repeat(40) },
          head: { repo: { full_name: "untrusted/easy-ui" } },
        },
      }),
    );
    const beforeFork = requests;
    assert.equal((await check()).reuse, "false", "fork PR always runs fresh");
    assert.equal(requests, beforeFork, "fork PR never queries shared proofs");
    await writeFile(
      eventPath,
      JSON.stringify({
        pull_request: {
          number: 75,
          base: { sha: "c".repeat(40) },
          head: { repo: { full_name: "lanej/easy-ui" } },
        },
      }),
    );
    await writeFile(join(root, ".ui-review/pr-75/new.png"), "screenshot");
    execFileSync("git", ["-C", root, "add", ".ui-review"]);
    assert.equal(
      (await check()).reuse,
      "true",
      "screenshot-only update keeps matching proof",
    );
    await writeFile(join(root, "scripts/helper.mjs"), "changed");
    assert.equal(
      (await check()).reuse,
      "false",
      "harness helper changes run fresh",
    );
    await writeFile(join(root, "scripts/helper.mjs"), "fixture");
    for (const overrides of [
      { GITHUB_EVENT_NAME: "workflow_dispatch" },
      { GITHUB_RUN_ATTEMPT: "2" },
    ]) {
      const before = requests;
      assert.equal((await check(overrides)).reuse, "false");
      assert.equal(
        requests,
        before,
        "manual and rerun checks do not query prior proofs",
      );
    }
    unavailable = true;
    const failedLookup = await check();
    assert.equal(failedLookup.reuse, "false");
    assert.match(failedLookup.stderr, /Previous evidence unavailable/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test("producer authentication ignores only recognized regular evidence files", () => {
  const entry = (path, mode = "100644", sha = "a".repeat(40)) => ({
    path,
    mode,
    type: "blob",
    sha,
  });
  const original = [
    entry("scripts/checks.mjs"),
    entry("easy-ui-react/src/Theme/Theme.tsx"),
  ];
  const expected = producerFingerprint(original);
  for (const path of [
    ".ui-review/pr-75/revision/view.png",
    ".ui-review/pr-75/revision/report.json",
    ".ui-review/pr-75/revision/provenance.json",
    ".ui-review/ci-optimization/revision/checks.log",
  ]) {
    assert.equal(producerFingerprint([...original, entry(path)]), expected);
    assert.notEqual(
      producerFingerprint([...original, entry(path, "120000")]),
      expected,
      "symlinks are source inputs",
    );
    assert.notEqual(
      producerFingerprint([...original, entry(path, "100755")]),
      expected,
      "executable files are source inputs",
    );
  }
  for (const path of [
    ".github/workflows/ci.yml",
    ".ui-review/pr-75/revision/check.mjs",
    ".ui-review/config.json",
    "scripts/preview-metrics/package-lock.json",
    "documentation/CI.md",
  ])
    assert.notEqual(
      producerFingerprint([...original, entry(path)]),
      expected,
      path,
    );
  assert.notEqual(
    producerFingerprint([
      entry("scripts/checks.mjs", "100644", "b".repeat(40)),
      original[1],
    ]),
    expected,
  );
});

test("a divergent base/merge producer conservatively invalidates branch-head proof", () => {
  const head = [
    {
      path: "scripts/check.mjs",
      mode: "100644",
      type: "blob",
      sha: "a".repeat(40),
    },
  ];
  const merge = [
    ...head,
    {
      path: "easy-ui-react/src/Shared.tsx",
      mode: "100644",
      type: "blob",
      sha: "b".repeat(40),
    },
  ];
  assert.notEqual(producerFingerprint(head), producerFingerprint(merge));
});
