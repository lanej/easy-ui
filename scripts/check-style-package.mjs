import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cleanPkgJsonForDist } from "./copyDistFiles.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(repository, "easy-ui-react");
const distribution = join(source, "dist");
const scratch = await mkdtemp(join(tmpdir(), "easy-ui-style-package-"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (command, args, cwd) =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
const cache =
  process.env.npm_config_cache ??
  process.env.NPM_CONFIG_CACHE ??
  run(npm, ["config", "get", "cache"], repository).trim();
const supportsAllowScripts =
  run(npm, ["config", "get", "allow-scripts"], repository).trim() !==
  "undefined";

const packedIcons = JSON.parse(
  run(
    npm,
    ["pack", "--ignore-scripts", "--json", "--pack-destination", scratch],
    join(repository, "easy-ui-icons/dist"),
  ),
)[0];

async function checkSkillInstallerLifecycle(packageDirectory, folder) {
  // Run the packed installer through actual npm global lifecycle hooks without
  // writing to the real user's agent directories or installing library dependencies.
  const fixture = join(folder, "global-skill-fixture");
  const userDirectory = join(folder, "global-skill-user");
  await mkdir(userDirectory, { recursive: true });
  // Resolve macOS's /var -> /private/var alias before computing relative links.
  const user = await realpath(userDirectory);
  await mkdir(join(fixture, "skills/easy-ui"), { recursive: true });
  await writeFile(
    join(fixture, "install-skill.mjs"),
    await readFile(join(packageDirectory, "install-skill.mjs")),
  );
  await writeFile(
    join(fixture, "skills/easy-ui/SKILL.md"),
    await readFile(join(packageDirectory, "skills/easy-ui/SKILL.md")),
  );
  await writeFile(
    join(fixture, "package.json"),
    JSON.stringify({
      name: "@easypost/easy-ui",
      version: "0.0.0-installer-fixture",
      files: ["install-skill.mjs", "skills"],
      scripts: { postinstall: "node install-skill.mjs" },
    }),
  );
  const boundary = join(folder, "skill-user-boundary.mjs");
  await writeFile(
    boundary,
    "import os from 'node:os'; import { syncBuiltinESMExports } from 'node:module'; " +
      "os.homedir = () => " +
      JSON.stringify(user) +
      "; syncBuiltinESMExports();",
  );
  const pack = JSON.parse(
    run(
      npm,
      ["pack", "--ignore-scripts", "--json", "--pack-destination", fixture],
      fixture,
    ),
  )[0];
  const runGlobal = (args) =>
    execFileSync(
      npm,
      [
        ...args,
        "--offline",
        "--no-audit",
        "--no-fund",
        ...(supportsAllowScripts
          ? ["--allow-scripts=file:" + join(fixture, pack.filename)]
          : []),
      ],
      {
        cwd: folder,
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
        env: {
          ...process.env,
          NODE_OPTIONS:
            (process.env.NODE_OPTIONS ?? "") +
            " --import=" +
            pathToFileURL(boundary).href,
        },
      },
    );
  const prefixes = [1, 2, 3, 4].map((index) =>
    join(folder, "global-prefix-" + index),
  );
  const packageSkill = (prefix) =>
    join(
      prefix,
      process.platform === "win32" ? "node_modules" : "lib/node_modules",
      "@easypost/easy-ui/skills/easy-ui",
    );
  const links = [".agents", ".claude"].map((name) =>
    join(user, name, "skills/easy-ui"),
  );
  const install = (prefix) =>
    runGlobal([
      "install",
      "--global",
      "--prefix",
      prefix,
      join(fixture, pack.filename),
    ]);
  let logs = "";
  for (const prefix of prefixes.slice(0, 2)) {
    logs += install(prefix);
    for (const link of links)
      assert.equal(await realpath(link), await realpath(packageSkill(prefix)));
  }
  logs += runGlobal([
    "uninstall",
    "--global",
    "--prefix",
    prefixes[1],
    "@easypost/easy-ui",
  ]);
  for (const link of links)
    await assert.rejects(realpath(link), { code: "ENOENT" });
  logs += install(prefixes[2]);
  for (const link of links)
    assert.equal(
      await realpath(link),
      await realpath(packageSkill(prefixes[2])),
    );

  const authored = join(folder, "authored-skill");
  await mkdir(authored);
  await writeFile(
    join(authored, "SKILL.md"),
    "Application-owned linked skill\n",
  );
  await unlink(links[1]);
  await symlink(
    authored,
    links[1],
    process.platform === "win32" ? "junction" : "dir",
  );
  logs += install(prefixes[3]);
  assert.equal(
    await realpath(links[0]),
    await realpath(packageSkill(prefixes[3])),
  );
  assert.equal(await realpath(links[1]), await realpath(authored));
  const missing = join(folder, "missing-authored-skill");
  await unlink(links[0]);
  await symlink(
    missing,
    links[0],
    process.platform === "win32" ? "junction" : "dir",
  );
  logs += runGlobal([
    "rebuild",
    "--global",
    "--prefix",
    prefixes[3],
    "@easypost/easy-ui",
  ]);
  assert.equal(resolve(await readlink(links[0])), missing);
  assert.equal(
    await readFile(join(links[1], "SKILL.md"), "utf8"),
    "Application-owned linked skill\n",
  );
  await writeFile(join(folder, "skill-global-lifecycle.log"), logs);
}
const sassFiles = (await readdir(join(source, "src/styles")))
  .filter((file) => file.endsWith(".scss"))
  .sort();
const componentNames = (
  await Promise.all(
    (await readdir(join(source, "src"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map(async ({ name }) => {
        try {
          await readFile(join(source, "src", name, "index.ts"));
          return name;
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
          return null;
        }
      }),
  )
)
  .filter(Boolean)
  .sort();
await readFile(join(distribution, "style.css")); // Run the package build first.

// Other workspaces keep their existing distribution metadata behavior.
const metadata = JSON.stringify({
  name: "other-workspace",
  files: ["dist"],
  scripts: {},
  devDependencies: {},
  publishConfig: { directory: "dist" },
  exports: { "./*": "./dist/*" },
});
assert.deepEqual(JSON.parse(cleanPkgJsonForDist(metadata)), {
  name: "other-workspace",
});
assert.deepEqual(
  JSON.parse(cleanPkgJsonForDist(metadata, { preserveExports: true })).exports,
  { "./*": "./*" },
);

const sassSource = `
@use "pkg:@easypost/easy-ui/styles/common" as ui;
@use "pkg:@easypost/easy-ui/styles/global";
@use "pkg:@easypost/easy-ui/styles/unstyled";
.sass-smoke {
  color: ui.design-token("color.blue.800");
  @include ui.component-token("sass.smoke", "font_size", 1rem);
  @include ui.font-style("body1");
  @include ui.breakpoint-sm-up { display: grid; }
  @include ui.responsive-prop("sass-smoke", "padding", "padding");
}
.sass-hidden { @include ui.visually-hidden; }
.sass-button { @include unstyled.button; }
`;

const typeSource = `
import EasyUIIcon from "@easypost/easy-ui-icons/EasyUI";
import { Provider } from "@easypost/easy-ui/Provider";
import { useNotification, type NotificationOptions } from "@easypost/easy-ui/Notification";
import { Chart, ChartLegend } from "@easypost/easy-ui/Chart";
import { LineChart } from "@easypost/easy-ui/LineChart";
import { BubbleChart, type BubbleChartSeries } from "@easypost/easy-ui/BubbleChart";
import { IntervalChart } from "@easypost/easy-ui/IntervalChart";
import { PredictionBandChart } from "@easypost/easy-ui/PredictionBandChart";
import { WaterfallChart } from "@easypost/easy-ui/WaterfallChart";
import { WaffleChart, type WaffleChartProps, type WaffleChartGroupAnchor, type WaffleChartItemOrder } from "@easypost/easy-ui/WaffleChart";
import { NetworkMapCellDetails, NetworkMapInspectionTrigger, type MapFacilityDetailsContext, type MapOverlayHoverDetailsContext, type MapInspectionTarget } from "@easypost/easy-ui/NetworkMap";
import { MetricCard, type MetricCardProps, type MetricContentProps } from "@easypost/easy-ui/MetricCard";
import { InvestigationDetails, resolveSelection, selectEvent, type InvestigationRecords, type InvestigationSelection, type InvestigationDetailsContext, type InvestigationDetailsProps, type InvestigationDetailsLabels } from "@easypost/easy-ui/InvestigationWorkspace";
import { ScoreComposition, ScoreSignal, ScoreContribution, ScoreConnector, ScoreResult, type ScoreCompositionProps, type ScoreCompositionColumn } from "@easypost/easy-ui/ScoreComposition";
import { Button } from "@easypost/easy-ui/Button";
import { DataGrid } from "@easypost/easy-ui/DataGrid";
import { DatePicker } from "@easypost/easy-ui/DatePicker";
import { DateRangePicker } from "@easypost/easy-ui/DateRangePicker";
import { DrawerTable, DrawerRow } from "@easypost/easy-ui/DrawerTable";
import { Drawer, DrawerContainer, type DrawerProps, type DrawerContainerProps, type DrawerTriggerProps, type DrawerLayoutProps } from "@easypost/easy-ui/Drawer";
import { FacilitySummary, type FacilitySummaryProps } from "@easypost/easy-ui/FacilitySummary";
import { DurationDistribution, DurationQuantileMetrics, type DurationDistributionProps } from "@easypost/easy-ui/DurationDistribution";
import { Select } from "@easypost/easy-ui/Select";
import { SelectField, type BaseSelectFieldProps, type SelectFieldSize } from "@easypost/easy-ui/Select/SelectField";
import type { KeyedSortDescriptor, MenuRowAction } from "@easypost/easy-ui/DataGrid/types";
import type { Heading, IconSymbol } from "@easypost/easy-ui/types";
import { classNames, type ResponsiveProp } from "@easypost/easy-ui/utilities/css";
${componentNames
  .map(
    (name, index) =>
      `import * as Component${index} from "@easypost/easy-ui/${name}";\nvoid Component${index};`,
  )
  .join("\n")}

const notificationDefaults: NotificationOptions = { stacking: true, timeout: 5000, isDismissable: true };
function PackedNotificationOptions() {
  const notification = useNotification();
  const key: string = notification.showSuccessToast({ message: "Packed notification", timeout: 5000, isDismissable: true });
  notification.closeNotification(key);
  const alertKey: string = notification.showWarningAlert({ message: "Packed alert", timeout: 0 });
  return <Provider notificationOptions={notificationDefaults} notificationPlacement={{ offset: { bottom: "16px", right: "16px" } }}><span>{alertKey}</span></Provider>;
}
void PackedNotificationOptions;

const sort: KeyedSortDescriptor<"cost"> = { column: "cost", direction: "ascending" };
// @ts-expect-error Generic column keys must retain their declared constraint.
const invalidSort: KeyedSortDescriptor<"cost"> = { column: "missing", direction: "ascending" };
const menu: MenuRowAction = { type: "menu", renderMenuOverlay: () => null };
const size: SelectFieldSize = "md";
const field: BaseSelectFieldProps = { size, validationState: "valid" };
const heading: Heading = "h2";
const icon: IconSymbol = EasyUIIcon;
const responsive: ResponsiveProp<string> = { sm: "1rem" };
const className: string = classNames("packed", false);
const metricCardWithoutTrend: "trend" extends keyof MetricCardProps ? false : true = true;
const metricContentWithoutTrend: "trend" extends keyof MetricContentProps ? false : true = true;
void [metricCardWithoutTrend, metricContentWithoutTrend];

// @ts-expect-error Bubble magnitude must have an explicit size mapping.
const invalidBubble: BubbleChartSeries = { data: [[1, 2, 3]] };
void invalidBubble;

const durationReference: DurationDistributionProps = { value: 6.125, unit: "hours", domain: [0, 30], quantiles: [{fraction: 0.5, value: 9}], bins: [{from: 0, to: 10, count: 3}], cumulative: [{value: 0, fraction: 0}, {value: 30, fraction: 1}] };

const facility: FacilitySummaryProps = { name: "Packed facility", observations: [{ id: "dwell", health: { assessment: "healthy" }, observation: { value: 6, unit: "h" }, reference: <DurationDistribution {...durationReference} /> }] };

const waffleOrder: WaffleChartItemOrder = "category";
// @ts-expect-error Ordering uses category identity rather than raw color values.
const invalidWaffleOrder: WaffleChartItemOrder = "color";
void invalidWaffleOrder;
const waffleProps: WaffleChartProps<{ externalId: number }> = {
  accessibilityLabel: "Packed resources",
  items: [{ id: "one", label: "Resource one", categoryId: "design", groupId: "shared", metadata: { externalId: 17 }, draft: true }],
  categories: [{ id: "design", label: "Design", color: "primary.600" }],
  groups: [{ id: "shared", label: "Shared group" }],
  itemOrder: waffleOrder,
  maxColumns: 7,
  cellSize: 16,
  gap: 2,
  selection: { type: "item", id: "one" },
  highlight: { itemIds: ["one"], groupIds: ["shared"], categoryIds: ["design"] },
  selectedCategoryId: "design",
  onCategorySelectionChange: (id) => { const next: string | null = id; void next; },
  onItemActivate: (item) => { const externalId: number | undefined = item.metadata?.externalId; void externalId; },
  renderDetails: (inspection) => inspection.item?.metadata?.externalId,
  onGroupAnchorsChange: (anchors) => { const anchor: WaffleChartGroupAnchor | undefined = anchors[0]; const left: number | undefined = anchor?.bounds.left; void left; },
};

export const example = <>
  <WaffleChart<{ externalId: number }> {...waffleProps} />
  <LineChart series={[{id: "line", data: [[0, 1], [1, null]]}]} option={{xAxis: {type: "value"}, yAxis: {type: "value"}}} onSelect={(selection) => { const name: string = selection.name; void name; }} />
  <BubbleChart series={[{id: "bubble", data: [[1, 2, 3]], symbolSize: (value: number[]) => Math.sqrt(value[2])}]} />
  <IntervalChart intervals={[{id: "span", row: "Lane", label: "Span", start: 0, end: null}]} />
  <PredictionBandChart points={[{id: "point", x: 0, observed: null, predicted: 0, lower: -1, upper: 1}]} />
  <WaterfallChart steps={[{id: "change", label: "Debit", change: -1}]} initialValue={0} />
  <FacilitySummary {...facility} />
  <DurationDistribution {...durationReference} />
  <DurationQuantileMetrics quantiles={[{fraction: 0.5, value: 9}]} unit="hours" />
  <DrawerTable aria-label="Packed drawers" rows={[{key: "one" as const, count: 1}]} expandedKey={null} onExpandedChange={(key) => { const next: "one" | null = key; void next; }} renderRow={(row) => <span>{row.count}</span>} renderExpandedRow={(row) => <span>{row.key}</span>} />
  <DrawerRow summary={<span>Packed row</span>}>Packed details</DrawerRow>
  <DrawerTable rows={[{key: "paged", count: 2}]} renderRow={(row) => <span>{row.count}</span>} renderExpandedRow={() => null} renderFooter={() => <DrawerTable.Pagination page={1} count={2} onChange={(page) => { const requested: number = page; void requested; }} />} />
  <DrawerTable.RowsPerPage rowsPerPage={3} options={[3, 6]} onChange={() => undefined} />
  <ScoreComposition signals={[{id: "a", label: "Observed", value: true}]} contributions={[{id: "b", label: "Contribution", score: 1, maxScore: 2, signals: ["a"]}]} result={{score: 1, disposition: "Review"}} />
  <ScoreSignal label="Observed" description={<span>Application-owned signal details.</span>} triggered={false} value={false} sentiment="positive" statusLabel="Clear" labels={{positiveSignal: "Favorable"}} />
  <ScoreContribution label="Contribution" score={0} maxScore={1} sentiment="warning" labels={{fullContribution: "Full"}} sourceLabels={["Observed"]} />
  <ScoreResult score={null} />
  <svg><ScoreConnector isInactive isHighlighted from={{x: 0, y: 0}} to={{x: 20, y: 10}} /></svg>
  <ChartLegend items={[{name: "Ground", color: "#007f86", selected: true, symbol: "bar"}]} onItemToggle={(name: string) => { void name; }} />
  <NetworkMapCellDetails cell={{latMin: 0, latMax: 1, lonMin: 0, lonMax: 1, medianMinutes: 20, iqrMinutes: 4, n: 80}} surface={{cells: [], source: "Packed sample", asOf: "2026-09-22T00:00:00Z"}}>
    <strong>Application chart</strong>
  </NetworkMapCellDetails>
  <Chart title="Packed chart" option={{ series: [{ type: "bar", data: [1] }] }} dataTable={{ columns: ["Count"], rows: [{ id: "one", values: [1] }], columnOptions: {0: {isNumeric: true, minWidth: 160, allowsSorting: true, getSortValue: (value) => value}}, maxHeight: "none", pinnedColumnCount: 1, stickyHeader: true, sortDescriptor: null, onSortChange: (next) => { const column: number | undefined = next?.column; void column; }, renderCell: (value, index, row) => typeof value === "number" ? <strong title={row.id + index}>{value.toFixed(2)}</strong> : null }} />
  <MetricCard label="Packed metric" value="1" />
  <Button onPress={() => undefined}>Packed button</Button>
  <DataGrid
    aria-label="Packed data"
    columns={[{ key: "cost", label: "Cost" }]}
    rows={[{ key: "one", cost: 1 }]}
    columnOptions={{ cost: { isNumeric: true, whiteSpace: "normal", minWidth: 100 } }}
    renderColumnCell={(column) => column.label}
    renderRowCell={(value) => String(value)}
  />
  <DatePicker label="Review date" name="reviewDate" isClearable clearLabel="Clear review date" description="Choose a date" isRequired validationBehavior="native" isReadOnly={false} value={null} onChange={(date) => { void date; }} />
  <DateRangePicker label="Review period" startName="startDate" endName="endDate" isClearable isRequired validationBehavior="native" value={null} onChange={(range) => { void range; }} />
</>;
void [Select, SelectField, sort, invalidSort, menu, field, heading, icon, responsive, className];
const drawerLayout: DrawerLayoutProps = { placement: "left", width: "280px" };
const drawerContainer: DrawerContainerProps = { ...drawerLayout, children: null, onDismiss: () => undefined };
const drawerTrigger: DrawerTriggerProps = { placement: "right", width: 440, isOpen: false, onOpenChange: () => undefined, children: [<Button>Open</Button>, <Drawer aria-label="Navigation"><Drawer.Body>Overview</Drawer.Body></Drawer>] };
const drawerNaming: DrawerProps = { children: null, "aria-label": "Workspace navigation", "aria-describedby": "help" };
const drawerComposition = <Drawer.Container {...drawerContainer}>{<Drawer {...drawerNaming} />}</Drawer.Container>;
const drawerAlias = <DrawerContainer {...drawerContainer} />;
// @ts-expect-error Drawer only supports physical left/right placement.
const invalidDrawerPlacement: DrawerLayoutProps = { placement: "top" };
// @ts-expect-error Width must be a CSS width, not a boolean.
const invalidDrawerWidth: DrawerLayoutProps = { width: true };
void [drawerTrigger, drawerComposition, drawerAlias, invalidDrawerPlacement, invalidDrawerWidth];
const collapsedColumns: ScoreCompositionColumn[] = ["signals"];
const investigationRecords: InvestigationRecords = { events: [{ id: "account", label: "Account updated" }] };
const investigationSelection: InvestigationSelection = { type: "event", eventId: "account" };
const investigationContext: InvestigationDetailsContext = resolveSelection(investigationRecords, investigationSelection);
const investigationLabels: Partial<InvestigationDetailsLabels> = { details: "Account details" };
const investigationProps: InvestigationDetailsProps = { context: investigationContext, labels: investigationLabels, chooseEvent: id => selectEvent(investigationContext, id), clear: () => undefined };
const investigationInspector = <InvestigationDetails {...investigationProps} />;
const scoreProps: ScoreCompositionProps = {signals: [], contributions: [], result: {score: null}, defaultCollapsedColumns: collapsedColumns, collapsedColumns, onCollapsedColumnsChange: columns => columns.includes("contributions")};
void scoreProps;
${["Chart", "MetricCard", "Button", "DataGrid"]
  .map(
    (name) =>
      `// @ts-expect-error ${name} exposes named exports, without a default export.\nComponent${componentNames.indexOf(name)}.default;`,
  )
  .join("\n")}
`;

// Write this runner inside each installed consumer: cwd alone does not isolate
// static imports or createRequire from the repository's dependencies.
const runner = String.raw`
import assert from "node:assert/strict";
import { readFileSync, realpathSync, readdirSync, lstatSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import { renderToString } from "react-dom/server";
import * as sass from "sass";
import { build } from "vite";
import ts from "typescript";

const require = createRequire(import.meta.url);
const insideConsumer = (file) => {
  const path = realpathSync(file);
  assert.ok(!relative(process.cwd(), path).startsWith(".."), "Dependency escaped isolated consumer: " + path);
  return path;
};
const iconSpecifier = "@easypost/easy-ui-icons/EasyUI";
insideConsumer(require.resolve(iconSpecifier));
insideConsumer(fileURLToPath(import.meta.resolve(iconSpecifier)));
for (const suffix of [".js", ".mjs"]) {
  insideConsumer(require.resolve(iconSpecifier + suffix));
  const explicit = await import(iconSpecifier + suffix);
  assert.equal(typeof explicit.default, "function", "Keep explicit icon file imports available");
}
assert.equal(require("@easypost/easy-ui-icons/package.json").name, "@easypost/easy-ui-icons");
for (const load of [require, (specifier) => import(specifier)]) {
  const exported = await load(iconSpecifier);
  const Symbol = exported.default ?? exported;
  assert.equal(typeof Symbol, "function", "Custom SVG must export a React component, not an asset URL");
  const { Icon } = await load("@easypost/easy-ui/Icon");
  const html = renderToString(React.createElement(Icon, { symbol: Symbol, accessibilityLabel: "Easy UI" }));
  assert.match(html, /viewBox="0 0 512 512"/);
  const sourceIcon = readFileSync("expected-icon.svg", "utf8");
  const originalPath = sourceIcon.match(/\bd="([^"]+)"/)[1];
  assert.ok(html.includes('d="' + originalPath + '"'), "The rendered icon must preserve the complete official symbol");
  assert.match(html, /fill="currentColor"/);
  assert.match(html, new RegExp("<title[^>]*>Easy UI</title>"));
  assert.doesNotMatch(html, /aria-hidden="true"/);
}
const rawIcon = insideConsumer(require.resolve("@easypost/easy-ui-icons/svg/EasyUI.svg"));
assert.equal(readFileSync(rawIcon, "utf8"), readFileSync("expected-icon.svg", "utf8"));
for (const subpath of ["Drawer", "Drawer/index", "Chart", "Chart/index", "MetricCard", "WaffleChart", "WaffleChart/index", "NetworkMap", "ScoreComposition", "InvestigationWorkspace", "utilities/css", "Notification", "Provider"]) {
  const specifier = "@easypost/easy-ui/" + subpath;
  insideConsumer(require.resolve(specifier));
  insideConsumer(fileURLToPath(import.meta.resolve(specifier)));
  const cjs = require(specifier);
  const esm = await import(specifier);
  assert.ok(Object.keys(cjs).length > 0);
  assert.ok(Object.keys(esm).length > 0);
}
for (const subpath of ["Chart/index.js", "Chart/index.mjs", "utilities/css.js", "utilities/css.mjs"]) {
  insideConsumer(require.resolve("@easypost/easy-ui/" + subpath));
  await import("@easypost/easy-ui/" + subpath);
}
for (const subpath of ["Sparkline", "Sparkline/index", "Sparkline/index.js", "Sparkline/index.mjs"]) {
  const specifier = "@easypost/easy-ui/" + subpath;
  assert.throws(() => require.resolve(specifier), { code: "MODULE_NOT_FOUND" });
  await assert.rejects(import(specifier), { code: "ERR_MODULE_NOT_FOUND" });
}
for (const load of [require, (specifier) => import(specifier)]) {
  const { WaffleChart } = await load("@easypost/easy-ui/WaffleChart");
  const waffleItems = [
    { id: "one", label: "Resource one", categoryId: "design", groupId: "shared", draft: true },
    { id: "two", label: "Resource two", categoryId: "missing", groupId: "shared" },
    { id: "three", label: "Resource three", categoryId: "design" },
  ];
  const waffleProps = {
    accessibilityLabel: "Packed resources", items: waffleItems,
    categories: [{ id: "design", label: "Design", color: "primary.600" }],
    groups: [{ id: "shared", label: "Shared group" }],
  };
  const waffle = renderToString(React.createElement(WaffleChart, waffleProps));
  assert.equal((waffle.match(/data-waffle-item=/g) ?? []).length, 3);
  assert.match(waffle, /3 items/);
  assert.match(waffle, /Unknown category: missing/);
  assert.match(waffle, /Shared group/);
  const ordered = renderToString(React.createElement(WaffleChart, { ...waffleProps, items: waffleItems.slice().reverse(), itemOrder: "category", selection: { type: "item", id: "one" } }));
  assert.deepEqual([...ordered.matchAll(/data-waffle-item="([^"]+)"/g)].map((match) => match[1]), ["one", "two", "three"]);
  assert.match(ordered, /aria-pressed="true"/);
  const compact = renderToString(React.createElement(WaffleChart, { ...waffleProps, variant: "compact", onItemActivate: () => {} }));
  assert.equal((compact.match(/data-waffle-item=/g) ?? []).length, 3);
  assert.match(compact, /Draft/);
  assert.doesNotMatch(compact, /<button/);
  const orderedCompact = renderToString(React.createElement(WaffleChart, { ...waffleProps, items: waffleItems.slice().reverse(), itemOrder: "category", variant: "compact" }));
  assert.deepEqual([...orderedCompact.matchAll(/data-waffle-item="([^"]+)"/g)].map((match) => match[1]), ["three", "one", "two"]);
}
for (const load of [require, (specifier) => import(specifier)]) {
  const { InvestigationDetails, resolveSelection, selectEvent } = await load("@easypost/easy-ui/InvestigationWorkspace");
  const accountContext = resolveSelection({events: [{id: "account", label: "Account updated"}]}, {type: "event", eventId: "account"});
  assert.equal(accountContext.isAvailable, true);
  assert.deepEqual(selectEvent(accountContext, "account"), {type: "event", eventId: "account"});
  const accountInspector = renderToString(React.createElement(InvestigationDetails, {
    context: accountContext, chooseEvent: () => {}, clear: () => {},
    renderDetails: () => React.createElement("strong", null, "Rich account detail"),
  }));
  assert.match(accountInspector, /Account updated/);
  assert.match(accountInspector, /Rich account detail/);
  assert.match(accountInspector, /Clear selection/);
  assert.doesNotMatch(accountInspector, /maplibregl/);
  const { ScoreComposition } = await load("@easypost/easy-ui/ScoreComposition");
  const score = renderToString(React.createElement(ScoreComposition, {
    signals: [{id: "a", label: "Observed input", value: false}],
    contributions: [{id: "b", label: "Contribution", score: 1, maxScore: 2, signals: ["a"]}],
    result: {score: 9, disposition: "Application decision"}
  }));
  assert.match(score, /Observed input/);
  assert.match(score, /9.00/);
  assert.match(score, /Application decision/);
  // The outcome and two column disclosure icons render; measured connector paths do not.
  assert.equal((score.match(/<svg/g) || []).length, 3);
  assert.doesNotMatch(score, /vector-effect="non-scaling-stroke"/);
  assert.match(score, /aria-label="Collapse: Signals \(1\)"/);
  assert.match(score, /<svg[^>]*aria-hidden="true"/);
  const { ThemeProvider } = await load("@easypost/easy-ui/Theme");
  const { Chart, ChartLegend } = await load("@easypost/easy-ui/Chart");
  const key = renderToString(React.createElement(ChartLegend, {
    items: [{ name: "Ground", color: "#007f86", selected: true }],
    onItemToggle: () => {},
  }));
  assert.match(key, /aria-pressed="true"/);
  assert.match(key, /Ground/);
  const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(Chart, {
    title: "Packed chart", option: { series: [{ type: "bar", data: [1] }] },
    dataTable: { columns: ["Count"], rows: [{ id: "one", values: [1] }] }
  })));
  assert.match(html, /Packed chart/);
  assert.match(html, /<td>1<\/td>/);
  const { ChartDataView } = await load("@easypost/easy-ui/Chart");
  const richData = renderToString(React.createElement(ChartDataView, {
    dataTable: { columns: ["Count"], rows: [{ id: "ten", values: [10] }, { id: "one", values: [1] }],
      columnOptions: { 0: { allowsSorting: true } }, defaultSortDescriptor: { column: 0, direction: "ascending" },
      renderCell: (value) => React.createElement("strong", null, value.toFixed(2)) }
  }));
  assert.match(richData, /<strong>1.00<\/strong>/);
  assert.ok(richData.indexOf("<strong>1.00") < richData.indexOf("<strong>10.00"));
  assert.match(richData, /aria-sort="ascending"/);
  const { NetworkMapCellDetails } = await load("@easypost/easy-ui/NetworkMap");
  const inspector = renderToString(React.createElement(NetworkMapCellDetails, {
    cell: {latMin: 0, latMax: 1, lonMin: 0, lonMax: 1, medianMinutes: 20, iqrMinutes: 4, n: 80},
    surface: {cells: [], source: "Packed sample", asOf: "2026-09-22T00:00:00Z"}
  }, React.createElement("strong", null, "Application chart")));
  assert.match(inspector, /Application chart/);
  assert.match(inspector, /Packed sample/);
  assert.doesNotMatch(inspector, /Distribution not supplied/);
  const { Drawer, DrawerContainer } = await load("@easypost/easy-ui/Drawer");
  assert.equal(Drawer.Container, DrawerContainer);
  assert.equal(typeof Drawer.Trigger, "function");
  const drawer = renderToString(React.createElement(ThemeProvider, null, React.createElement(Drawer, { "aria-label": "Packed navigation" }, React.createElement(Drawer.Body, null, "Overview"))));
  assert.match(drawer, /role="dialog"/);
  assert.match(drawer, /aria-label="Packed navigation"/);
  const drawerCss = readFileSync(require.resolve("@easypost/easy-ui/style.css"), "utf8");
  assert.match(drawerCss, /data-placement=.?left/);
  assert.match(drawerCss, /--ezui-c-drawer-width/);
  assert.match(drawerCss, /max-width:\s*100%/);
  const { DrawerTable, DrawerRow } = await load("@easypost/easy-ui/DrawerTable");
  const drawers = renderToString(React.createElement(ThemeProvider, null, React.createElement(DrawerTable, {
    "aria-label": "Packed drawer rows",
    rows: [{key: "one", label: "Packed row"}],
    defaultExpandedKey: "one",
    renderRow: (row) => React.createElement("span", null, row.label),
    renderExpandedRow: () => React.createElement("strong", null, "Packed details"),
  })));
  assert.match(drawers, /aria-expanded="true"/);
  assert.match(drawers, /Packed details/);
  assert.match(drawers, /aria-label="Packed drawer rows"/);
  const paged = renderToString(React.createElement(ThemeProvider, null, React.createElement(DrawerTable, {
    rows: [],
    renderRow: () => null,
    renderExpandedRow: () => null,
    renderFooter: () => React.createElement(DrawerTable.Pagination, { page: 1, count: 2, onChange: () => undefined }),
  })));
  assert.match(paged, /Page 1 of 2/);
  assert.match(paged, /aria-label="Next"/);
  assert.equal(typeof DrawerTable.RowsPerPage, "function");
  const standalone = renderToString(React.createElement(ThemeProvider, null, React.createElement(DrawerRow, {
    summary: "Standalone row", defaultExpanded: true,
  }, "Standalone details")));
  assert.match(standalone, /Standalone details/);
}
const expected = JSON.parse(readFileSync("expected-styles.json", "utf8"));
for (const subpath of ["style.css", ...expected.map((name) => "styles/" + name)]) {
  const specifier = "@easypost/easy-ui/" + subpath;
  assert.equal(insideConsumer(require.resolve(specifier)), insideConsumer(fileURLToPath(import.meta.resolve(specifier))));
}
const skill = require.resolve("@easypost/easy-ui/skills/easy-ui/SKILL.md");
assert.equal(insideConsumer(skill), insideConsumer(fileURLToPath(import.meta.resolve("@easypost/easy-ui/skills/easy-ui/SKILL.md"))));
const installedSkill = join(".agents", "skills", "easy-ui", "SKILL.md");
assert.ok(lstatSync(dirname(installedSkill)).isSymbolicLink());
assert.equal(readFileSync(installedSkill, "utf8"), readFileSync("expected-skill.md", "utf8"));
assert.equal(readFileSync(".claude/skills/easy-ui/SKILL.md", "utf8"), "Application-owned skill\n");
const reference = require.resolve("@easypost/easy-ui/skills/easy-ui/references/components.md");
assert.equal(insideConsumer(reference), insideConsumer(fileURLToPath(import.meta.resolve("@easypost/easy-ui/skills/easy-ui/references/components.md"))));
assert.equal(readFileSync(reference, "utf8"), readFileSync("expected-components.md", "utf8"));
const manifest = require("@easypost/easy-ui/package.json");
assert.ok(manifest.sideEffects.includes("**/*.scss"));
assert.ok(manifest.sideEffects.includes("**/*.css"));

const typeExpected = JSON.parse(readFileSync("expected-types.json", "utf8"));
const packageDirectory = dirname(insideConsumer(require.resolve("@easypost/easy-ui/package.json")));
const canonicalDirectory = typeExpected.mode === "source" ? join(packageDirectory, "dist") : packageDirectory;
const publicDeclarations = typeExpected.declarations.map((file) => insideConsumer(join(packageDirectory, file)));
assert.ok(publicDeclarations.length >= typeExpected.components.length, "Published declaration entry points are missing");
const typeResults = [];
for (const [name, moduleResolution, module] of [
  ["node", ts.ModuleResolutionKind.Node10, ts.ModuleKind.CommonJS],
  ["bundler", ts.ModuleResolutionKind.Bundler, ts.ModuleKind.ESNext],
]) {
  const options = { target: ts.ScriptTarget.ES2020, module, moduleResolution, jsx: ts.JsxEmit.ReactJSX, strict: true, noEmit: true, skipLibCheck: true, esModuleInterop: true, types: ["react", "react-dom"] };
  const fixture = resolve("consumer-types.tsx");
  const resolvedEntry = (specifier, containingFile = fixture) => {
    const result = ts.resolveModuleName(specifier, containingFile, options, ts.sys).resolvedModule;
    assert.ok(result, name + " failed to resolve " + specifier + " from " + containingFile);
    return insideConsumer(result.resolvedFileName);
  };
  const resolvedRelative = (specifier, containingFile) => {
    // Sass/CSS side-effect imports remain in a few declarations. They are
    // assets for the bundler, not TypeScript modules, and must exist in-package.
    if (/\.(?:s[ac]ss|css)$/.test(specifier)) return insideConsumer(resolve(dirname(containingFile), specifier));
    return resolvedEntry(specifier, containingFile);
  };
  const canonicalEntries = typeExpected.components.map((component) => insideConsumer(join(canonicalDirectory, component, "index.d.ts")));
  const publicEntries = typeExpected.components.map((component) => resolvedEntry("@easypost/easy-ui/" + component));
  let relativeTargets = 0;
  for (const file of publicDeclarations) {
    const subpath = relative(packageDirectory, file).split("\\").join("/").replace(/\.d\.ts$/, "");
    resolvedEntry("@easypost/easy-ui/" + subpath);
    // Check every generated forwarding target without adding shipped story or
    // test declarations to the application's typechecked imports.
    for (const imported of ts.preProcessFile(readFileSync(file, "utf8"), true, true).importedFiles) {
      if (!imported.fileName.startsWith(".")) continue;
      resolvedRelative(imported.fileName, file);
      relativeTargets++;
    }
  }
  const program = ts.createProgram([fixture, ...canonicalEntries], options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, name + " consumer typecheck failed:\n" + ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => process.cwd(), getCanonicalFileName: (file) => file, getNewLine: () => "\n" }));
  const checker = program.getTypeChecker();
  const exportedNames = (file) => {
    const declaration = program.getSourceFile(file);
    assert.ok(declaration, "TypeScript did not load " + file);
    const symbol = checker.getSymbolAtLocation(declaration);
    assert.ok(symbol, "Declaration is not an exported module: " + file);
    return checker.getExportsOfModule(symbol).map((entry) => entry.getName()).sort();
  };
  for (let index = 0; index < typeExpected.components.length; index++) {
    const expectedNames = exportedNames(canonicalEntries[index]);
    assert.ok(expectedNames.length > 0, "Empty component namespace: " + typeExpected.components[index]);
    assert.deepEqual(exportedNames(publicEntries[index]), expectedNames, name + " changed the exports of " + typeExpected.components[index]);
  }
  // skipLibCheck intentionally ignores third-party declaration diagnostics, so
  // separately resolve every relative edge of Easy UI's loaded declarations.
  for (const file of program.getSourceFiles()) {
    if (!file.isDeclarationFile || relative(packageDirectory, file.fileName).startsWith("..")) continue;
    insideConsumer(file.fileName);
    for (const imported of ts.preProcessFile(file.text, true, true).importedFiles) {
      if (!imported.fileName.startsWith(".")) continue;
      resolvedRelative(imported.fileName, file.fileName);
      relativeTargets++;
    }
  }
  assert.ok(relativeTargets > 0, "No declaration forwarding targets were checked");
  typeResults.push({ resolution: name, components: typeExpected.components.length, declarations: publicDeclarations.length, relativeTargets });
}

const dependencyImporter = {
  findFileUrl(url) {
    if (url.startsWith(".") || url.includes(":")) return null;
    for (const suffix of ["", ".scss", ".sass", ".css"]) {
      try { return pathToFileURL(insideConsumer(require.resolve(url + suffix))); }
      catch (error) { if (error.code !== "MODULE_NOT_FOUND" && error.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error; }
    }
    return null;
  }
};
const result = sass.compile("consumer.scss", {
  importers: [new sass.NodePackageImporter(process.cwd()), dependencyImporter]
});
const loaded = result.loadedUrls.map((url) => insideConsumer(fileURLToPath(url)));
for (const file of expected) assert.ok(loaded.some((path) => path.endsWith("/styles/" + file)), "Sass dependency not exercised: " + file);
const css = result.css;
assert.match(css, /\.sass-smoke\s*\{[^}]*color:\s*var\(--ezui-color-blue-800\)/);
assert.match(css, /--ezui-c-sass-smoke-font-size:\s*1rem/);
assert.match(css, /--ezui-c-sass-smoke-padding-xxl/);
assert.match(css, /\.sass-hidden\s*\{[^}]*position:\s*absolute/);
assert.match(css, /\.sass-button\s*\{[^}]*appearance:\s*none/);
assert.match(css, /Poppins Fallback/);
assert.match(css, /\[data-overlayscrollbars/);
assert.match(css, /\.os-scrollbar\.ezui-os-theme-overlay/);
assert.match(css, /--ezui-color-blue-800:\s*#061340/i);

// A real production bundler must retain side-effect-only SCSS imports. This
// entry deliberately never imports the compiled Easy UI style.css.
await build({ configFile: false, root: process.cwd(), logLevel: "error", build: { outDir: "consumer-build", lib: { entry: resolve("consumer.js"), formats: ["es"], fileName: "consumer", cssFileName: "consumer" } } });
const bundledCss = readFileSync("consumer-build/consumer.css", "utf8");
assert.match(bundledCss, /Poppins Fallback/);
assert.match(bundledCss, /--ezui-color-blue-800:\s*#061340/i);
assert.match(bundledCss, /\.os-scrollbar\.ezui-os-theme-overlay/);
assert.match(bundledCss, /\.bundled-sass-smoke\s*\{[^}]*color:var\(--ezui-color-blue-800\)/);
assert.ok(readdirSync("node_modules/@easypost/easy-ui").includes("package.json"));
console.log(JSON.stringify({ sassFiles: expected.length, cssBytes: css.length, productionCssBytes: bundledCss.length, publicImports: "CJS + ESM + SSR passed", typescript: ts.version, typeConsumers: typeResults }));
`;

try {
  for (const [mode, packageRoot] of [
    ["source", source],
    ["publish-directory", distribution],
  ]) {
    const folder = join(scratch, mode);
    const consumer = join(folder, "consumer");
    await mkdir(consumer, { recursive: true });
    await mkdir(join(consumer, ".claude/skills/easy-ui"), { recursive: true });
    await writeFile(
      join(consumer, ".claude/skills/easy-ui/SKILL.md"),
      "Application-owned skill\n",
    );
    await writeFile(
      join(consumer, "expected-skill.md"),
      await readFile(join(source, "skills/easy-ui/SKILL.md")),
    );
    await writeFile(
      join(consumer, "expected-components.md"),
      await readFile(join(source, "skills/easy-ui/references/components.md")),
    );
    const pack = spawnSync(
      npm,
      [
        "pack",
        "--ignore-scripts",
        "--json",
        "--pack-destination",
        folder,
        "--cache",
        cache,
      ],
      { cwd: packageRoot, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
    );
    await writeFile(join(folder, "pack.stdout.log"), pack.stdout ?? "");
    await writeFile(join(folder, "pack.stderr.log"), pack.stderr ?? "");
    if (pack.error) throw pack.error;
    assert.equal(pack.status, 0, "npm pack failed; inspect logs in " + folder);
    // npm 10 may run prepare despite --ignore-scripts, writing lifecycle output
    // before its final JSON array. Keep those logs and parse the trailing result.
    const jsonStart = pack.stdout.lastIndexOf("\n[");
    const packed = JSON.parse(pack.stdout.slice(jsonStart + 1))[0];
    await writeFile(join(folder, "pack.json"), JSON.stringify(packed, null, 2));
    assert.equal(
      packed.files.some(({ path }) => path.startsWith("src/")),
      false,
      "Tarball unexpectedly includes repository source files",
    );
    const compatibility = JSON.parse(
      await readFile(join(source, ".compatibility-entries.json"), "utf8"),
    );
    assert.equal(compatibility.version, 1);
    for (const entry of compatibility.files) {
      assert.ok(entry.source.startsWith("dist/"));
      const expectedPaths =
        mode === "source"
          ? [entry.path, entry.source]
          : [entry.source.slice("dist/".length)];
      for (const path of expectedPaths)
        assert.ok(
          packed.files.some((file) => file.path === path),
          "Tarball missing compatibility entry: " + mode + "/" + path,
        );
    }
    const prefix = mode === "source" ? "dist/" : "";
    for (const file of sassFiles)
      assert.ok(
        packed.files.some(({ path }) => path === prefix + "styles/" + file),
        "Tarball missing Sass: " + mode + "/" + file,
      );
    for (const file of [
      "style.css",
      "Chart/index.js",
      "Chart/index.mjs",
      "Chart/index.d.ts",
      "types.d.ts",
    ])
      assert.ok(
        packed.files.some(({ path }) => path === prefix + file),
        "Tarball missing built entry: " + file,
      );
    await writeFile(
      join(consumer, "package.json"),
      JSON.stringify(
        {
          private: true,
          type: "module",
          allowScripts: {
            ["file:" + join(folder, packed.filename)]: true,
            "@parcel/watcher": true,
            esbuild: true,
          },
          dependencies: {
            "@easypost/easy-ui": "file:" + join(folder, packed.filename),
            "@easypost/easy-ui-icons":
              "file:" + join(scratch, packedIcons.filename),
            react: "18.3.1",
            "react-dom": "18.3.1",
            "react-is": "18.3.1",
            "@types/react": "18.3.3",
            "@types/react-dom": "18.3.0",
            typescript: "5.7.3",
            sass: "1.89.2",
            vite: "6.3.5",
          },
        },
        null,
        2,
      ),
    );
    await writeFile(
      join(consumer, "expected-styles.json"),
      JSON.stringify(sassFiles),
    );
    await writeFile(join(consumer, "consumer.scss"), sassSource);
    await writeFile(
      join(consumer, "expected-icon.svg"),
      await readFile(join(repository, "easy-ui-icons/src/EasyUI.svg")),
    );
    await writeFile(join(consumer, "consumer-types.tsx"), typeSource);
    await writeFile(
      join(consumer, "expected-types.json"),
      JSON.stringify({
        mode,
        components: componentNames,
        declarations: compatibility.files
          .filter((entry) => entry.path.endsWith(".d.ts"))
          .map((entry) => entry.path),
      }),
    );
    await writeFile(
      join(consumer, "consumer.js"),
      'import "@easypost/easy-ui/styles/global.scss"; import "./bundled.scss"; export const compiled = true;',
    );
    await writeFile(
      join(consumer, "bundled.scss"),
      '@use "@easypost/easy-ui/styles/common" as ui; @use "@easypost/easy-ui/styles/token-helpers" as tokens; .bundled-sass-smoke { color: tokens.design-token("color.blue.800"); @include ui.breakpoint-sm-up { display: grid; } }',
    );
    await writeFile(join(consumer, "check.mjs"), runner);
    await writeFile(
      join(folder, "install.log"),
      run(
        npm,
        [
          "--prefix",
          consumer,
          "install",
          "--no-audit",
          "--no-fund",
          "--cache",
          cache,
        ],
        folder,
      ),
    );
    await assert.rejects(realpath(join(folder, ".agents/skills/easy-ui")), {
      code: "ENOENT",
    });
    const nested = join(consumer, "nested-invocation");
    await mkdir(nested);
    await writeFile(
      join(folder, "nested-rebuild.log"),
      run(npm, ["rebuild", "@easypost/easy-ui", "--offline"], nested),
    );
    await assert.rejects(realpath(join(nested, ".agents/skills/easy-ui")), {
      code: "ENOENT",
    });
    await checkSkillInstallerLifecycle(
      join(consumer, "node_modules/@easypost/easy-ui"),
      folder,
    );
    const output = run(process.execPath, ["check.mjs"], consumer);
    await writeFile(join(folder, "result.log"), output);
    console.log(mode + ": " + output.trim());
  }
  await Promise.all(
    ["publish-directory", "source"].map((mode) =>
      rm(join(scratch, mode, "consumer", "node_modules"), {
        recursive: true,
        force: true,
      }),
    ),
  );
  console.log("Packed consumer evidence: " + scratch);
} catch (error) {
  console.error("Packed consumer failed; evidence retained at " + scratch);
  throw error;
}
