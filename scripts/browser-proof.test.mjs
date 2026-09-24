import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { fingerprint, findProof, reusable } from "./browser-proof.mjs";

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
    for (const [event, attempt] of [
      ["workflow_dispatch", "1"],
      ["pull_request", "2"],
      ["pull_request", "1"],
    ]) {
      const output = join(root, `${event}-${attempt}.out`);
      const { stderr } = await promisify(execFile)(
        process.execPath,
        [fileURLToPath(new URL("./browser-proof.mjs", import.meta.url))],
        {
          env: {
            ...process.env,
            PROOF_MODE: "check",
            PROOF_SUITE: "maps-chrome",
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
  conclusion: "success",
  head_repository: { full_name: context.headRepository },
  pull_requests: [{ number: 1 }],
  html_url: "https://github.com/lanej/easy-ui/actions/runs/42",
};

test("only recent completed successes on the same workflow and PR qualify", () => {
  assert.equal(reusable(artifact, run, context, now), true);
  for (const change of [
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
