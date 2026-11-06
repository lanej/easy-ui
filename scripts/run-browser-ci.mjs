/** Keep the complete browser suite, partitioned across independent CI runners. */
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

export const suites = {
  graphs: ["check-dependency-graph"],
  charts: [
    "check-waffle-chart",
    "check-map-primary-insets",
    "check-chart-catalog",
  ],
  metrics: [
    "check-metric-card",
    "check-facility-summary",
    "check-proportion-bar",
    "check-meter-bar-comparison",
  ],
  catalog: [
    "check-dependency-graph-arrowheads",
    "check-dependency-graph-groups",
    "check-dependency-tree",
    "check-storybook-docs",
    "check-token-browser",
    "check-evidence-typography",
  ],
  overlays: [
    "check-notifications",
    "check-theme-toggle",
    "check-drawer-placement",
  ],
};

export function runSuite(
  name,
  { run = spawnSync, log = console.log, now = () => performance.now() } = {},
) {
  if (!Object.hasOwn(suites, name))
    throw new Error(`Unknown browser CI suite: ${name}`);
  for (const script of suites[name]) {
    const start = now();
    log(`::group::${script}`);
    let result;
    try {
      result = run(process.execPath, [`scripts/${script}.mjs`], {
        stdio: "inherit",
        env: process.env,
      });
      if (result.error) throw result.error;
      if (result.status !== 0)
        throw new Error(
          `${script} failed (${result.signal ?? `exit ${result.status}`})`,
        );
    } finally {
      log(`${script}: ${((now() - start) / 1000).toFixed(1)}s`);
      log("::endgroup::");
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  runSuite(process.argv[2]);
