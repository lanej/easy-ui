/** Reuse only a recent successful run of identical browser inputs on this PR/ref. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const maxAge = 7 * 24 * 60 * 60 * 1000;
const digest = (value) => createHash("sha256").update(value).digest("hex");

export async function fingerprint(root, built, inputs, environment) {
  const entries = [];
  async function visit(directory, prefix = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = `${prefix}${entry.name}`;
      if (entry.isDirectory())
        await visit(`${directory}/${entry.name}`, `${name}/`);
      // Measurement reports contain the current source SHA. The assets they
      // describe and their measurement scripts are hashed independently.
      else if (!/^(?:.*\/)?bundle-(?:report|sizes)\.json$/.test(name))
        entries.push([
          `built/${name}`,
          await readFile(`${directory}/${entry.name}`),
        ]);
    }
  }
  await visit(resolve(root, built));
  if (!entries.some(([name]) => name.endsWith(".html")))
    throw new Error("Browser reuse requires an actual preview build");
  for (const file of inputs)
    entries.push([`input/${file}`, await readFile(resolve(root, file))]);
  const hash = createHash("sha256");
  hash.update(JSON.stringify(environment));
  for (const [name, bytes] of entries.sort(([a], [b]) => a.localeCompare(b))) {
    hash.update(`${name}\0${bytes.length}\0`);
    hash.update(bytes);
  }
  return hash.digest("hex");
}

export function reusable(artifact, run, context, now = Date.now()) {
  const created = Date.parse(artifact.created_at);
  return (
    !artifact.expired &&
    Number.isFinite(created) &&
    created <= now &&
    now - created < maxAge &&
    run.conclusion === "success" &&
    run.path === context.workflow &&
    run.event === context.event &&
    run.head_repository?.full_name === context.headRepository &&
    (context.event === "pull_request"
      ? run.pull_requests?.some((pr) => pr.number === context.pr)
      : run.head_branch === context.branch)
  );
}

export async function findProof(name, context, request) {
  const { artifacts } = await request(
    `/actions/artifacts?name=${encodeURIComponent(name)}&per_page=100`,
  );
  for (const artifact of artifacts ?? []) {
    if (
      artifact.name !== name ||
      artifact.expired ||
      Date.now() - Date.parse(artifact.created_at) >= maxAge
    )
      continue;
    const run = await request(`/actions/runs/${artifact.workflow_run.id}`);
    if (reusable(artifact, run, context)) return run.html_url;
  }
}

async function main() {
  const env = process.env;
  const { PROOF_MODE: mode, PROOF_SUITE: suite, PROOF_BUILT: built } = env;
  if (
    !/^(?:maps|charts)-(?:chrome|firefox|safari|screenshots|layout)$|^hosted-maps$/.test(
      suite ?? "",
    )
  )
    throw new Error(`Unknown browser suite: ${suite}`);
  if (!["check", "record"].includes(mode))
    throw new Error(`Unknown proof mode: ${mode}`);
  const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, "utf8"));
  const workflow = env.GITHUB_WORKFLOW_REF.split("/")
    .slice(2)
    .join("/")
    .split("@")[0];
  const context = {
    workflow,
    event: env.GITHUB_EVENT_NAME,
    headRepository:
      event.pull_request?.head.repo.full_name ?? env.GITHUB_REPOSITORY,
    pr: event.pull_request?.number,
    branch: env.GITHUB_REF_NAME,
  };
  let key = env.PROOF_DIGEST;
  if (mode === "check") {
    const preview = suite.startsWith("charts-")
      ? "scripts/preview-metrics"
      : "scripts/preview-maps";
    const inputs = execFileSync(
      "git",
      [
        "ls-files",
        "-z",
        preview,
        workflow,
        ".nvmrc",
        "scripts/browser-proof.mjs",
        ".github/actions/browser-proof",
        ...(suite === "charts-layout" ? [".ui-review"] : []),
        ...(suite === "maps-layout" ? [".ui-review/maps"] : []),
        ...(suite === "hosted-maps" ? ["scripts/build-docs.mjs"] : []),
      ],
      { encoding: "utf8" },
    )
      .split("\0")
      .filter(
        (file) =>
          file &&
          !file.endsWith(".md") &&
          // Rendered preview files are represented by the build, including their
          // transitive component, Sass, token and asset dependencies.
          !/\.(?:tsx?|s?css|html)$/.test(file) &&
          !(suite === "charts-layout" && file.startsWith(".ui-review/maps/")),
      );
    key = await fingerprint(process.cwd(), built, inputs, {
      suite,
      node: process.version,
      os: env.RUNNER_OS,
      image: env.ImageOS,
      imageVersion: env.ImageVersion,
    });
  }
  if (!/^[a-f0-9]{64}$/.test(key ?? ""))
    throw new Error("Missing browser input digest");
  const name = `browser-proof-v1-${suite}-${digest(env.GITHUB_REF).slice(0, 12)}-${key}`;
  const directory = `.browser-proof/${suite}`;
  let previous;
  if (
    mode === "check" &&
    env.GITHUB_EVENT_NAME !== "workflow_dispatch" &&
    Number(env.GITHUB_RUN_ATTEMPT) === 1
  ) {
    try {
      previous = await findProof(name, context, async (path) => {
        const response = await fetch(
          `${env.GITHUB_API_URL}/repos/${env.GITHUB_REPOSITORY}${path}`,
          {
            headers: {
              Authorization: `Bearer ${env.GH_TOKEN}`,
              Accept: "application/vnd.github+json",
            },
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!response.ok)
          throw new Error(`GitHub proof lookup returned ${response.status}`);
        return response.json();
      });
    } catch (error) {
      console.warn(
        `Previous evidence unavailable; running browser checks. ${error.message}`,
      );
    }
  }
  if (mode === "record") {
    await mkdir(directory, { recursive: true });
    await writeFile(
      `${directory}/proof.json`,
      JSON.stringify(
        {
          suite,
          digest: key,
          source: env.GITHUB_SHA,
          run: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
          recordedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  }
  await appendFile(
    env.GITHUB_OUTPUT,
    `reuse=${Boolean(previous)}\ndigest=${key}\nname=${name}\npath=${directory}/proof.json\n`,
  );
  if (mode === "check")
    await appendFile(
      env.GITHUB_STEP_SUMMARY,
      `### ${suite}\n\n${previous ? `Reusing [successful browser evidence](${previous}) for identical preview assets and test inputs.` : "Running fresh browser checks; no eligible matching success was reused."}\n\nInput digest: \`${key}\`. Evidence expires after seven days; manual runs and reruns always execute checks.\n`,
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
