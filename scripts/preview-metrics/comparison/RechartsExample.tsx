import React, { ReactNode, useState } from "react";
import {
  Area,
  Bar,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Sankey,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
  useXAxisScale,
  useYAxisScale,
} from "recharts";
import type { SankeyNodeProps, TreemapNode } from "recharts";
import { ChartFrame } from "../../../easy-ui-react/src/Chart/ChartFrame";
import { HeatMap } from "./HeatMap";
import { ExampleProps, palette, records, shortDate } from "./fixtures";
import { visibleDomain, WindowRange, zoomBy } from "./zoom";

const axis = {
  tick: { fill: "var(--ezui-color-neutral-600, #50647e)", fontSize: 10 },
  tickLine: false,
  stroke: "var(--ezui-color-neutral-200, #dfe5ed)",
};
const tooltipStyle = {
  fontSize: 12,
  background: "var(--ezui-color-neutral-050, white)",
  color: "var(--ezui-color-neutral-800, #172b4d)",
  borderColor: "var(--ezui-color-neutral-200, #dfe5ed)",
  maxWidth: 270,
  whiteSpace: "normal" as const,
};
const usd = (value: unknown) => `$${Number(value).toLocaleString("en-US")}`;

function ZoomControls({
  range,
  domain,
  onChange,
}: {
  range: WindowRange;
  domain: [number, number];
  onChange: (next: WindowRange) => void;
}) {
  return (
    <div className="plot-controls" role="group" aria-label="Zoom controls">
      {[0.5, 2, 0].map((factor, i) => (
        <button
          type="button"
          key={factor}
          onClick={() => onChange(zoomBy(range, domain, factor))}
        >
          {["Zoom in", "Zoom out", "Reset zoom"][i]}
        </button>
      ))}
    </div>
  );
}

function SeriesPlot({ kind, example }: ExampleProps) {
  const data = records(example);
  const time = [
    "time-series",
    "stacked-area",
    "annotations",
    "prediction-band",
  ].includes(kind);
  const zoomable = kind === "time-series" || kind === "annotations";
  const [range, setRange] = useState<WindowRange>({
    mode: "percent",
    start: 0,
    end: 100,
  });
  const [hidden, setHidden] = useState<string[]>([]);
  const domain: [number, number] = [data[0].x, data[data.length - 1].x];
  const [low, high] = visibleDomain(range, domain);
  const seriesNames =
    kind === "prediction-band"
      ? ["Observed", "Predicted"]
      : kind === "cdf"
        ? ["Delivered share"]
        : example.dataTable.columns.slice(1);
  let display = data;
  if (kind === "prediction-band")
    display = data.map((row) => ({
      ...row,
      band:
        row.v3 === null || row.v4 === null
          ? null
          : [Number(row.v3), Number(row.v4)],
    }));
  if (kind === "cdf")
    display = [
      { id: "0", name: "0", x: 0, v1: 0 },
      ...data.map((row) => ({ ...row, v1: row.v2 })),
    ];
  const yDomain: [number, number | "auto"] =
    kind === "stacked-area"
      ? [0, "auto"]
      : kind === "scenario"
        ? [-10, 40]
        : kind === "cdf"
          ? [0, 100]
          : kind === "prediction-band"
            ? [94, 100]
            : [90, 100];
  const toggle = (name: string) =>
    setHidden((current) =>
      current.includes(name)
        ? current.filter((value) => value !== name)
        : [...current, name],
    );
  const lineCount =
    kind === "cdf"
      ? 1
      : kind === "scenario" || kind === "prediction-band"
        ? 2
        : 3;
  return (
    <>
      <div
        className="plot-controls"
        role="group"
        aria-label="Series visibility"
      >
        {seriesNames.slice(0, lineCount).map((name, i) => (
          <button
            type="button"
            key={name}
            aria-pressed={!hidden.includes(name)}
            onClick={() => toggle(name)}
          >
            <span style={{ color: palette[i] }}>●</span> {name}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={example.height ?? 320}>
        <ComposedChart
          data={display}
          margin={{ top: 32, right: 28, bottom: 26, left: 0 }}
          accessibilityLayer
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--ezui-color-neutral-200, #dfe5ed)"
          />
          <XAxis
            {...axis}
            dataKey="x"
            type="number"
            scale={time ? "time" : "linear"}
            domain={
              zoomable
                ? [low, high]
                : kind === "cdf"
                  ? [0, 6]
                  : ["dataMin", "dataMax"]
            }
            allowDataOverflow
            tickCount={5}
            tickFormatter={time ? shortDate : undefined}
            label={
              time
                ? undefined
                : {
                    value:
                      kind === "scenario"
                        ? "Rate adjustment (%)"
                        : "Calendar days",
                    position: "bottom",
                    fontSize: 11,
                  }
            }
          />
          <YAxis
            {...axis}
            width={44}
            domain={yDomain}
            allowDataOverflow
            tickFormatter={(value) =>
              kind === "stacked-area" ? String(value) : `${value}%`
            }
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(label) =>
              time ? shortDate(Number(label)) : String(label)
            }
            filterNull
          />
          {kind === "annotations" && (
            <ReferenceArea y1={90} y2={95} fill="#bd6900" fillOpacity={0.08} />
          )}
          {(kind === "time-series" || kind === "annotations") && (
            <ReferenceLine
              y={97}
              stroke={palette[2]}
              strokeDasharray="6 4"
              label={{
                value: "Target 97%",
                position: "insideTopRight",
                fontSize: 10,
                fill: palette[2],
              }}
            />
          )}
          {kind === "annotations" && (
            <>
              <ReferenceLine
                y={95}
                stroke={palette[3]}
                strokeDasharray="2 3"
                label={{
                  value: "Warning 95%",
                  position: "insideBottomRight",
                  fontSize: 10,
                }}
              />
              <ReferenceLine
                x={Date.UTC(2026, 7, 6)}
                stroke="#627891"
                strokeDasharray="2 3"
                label={{
                  value: "Service change",
                  angle: -90,
                  position: "insideBottomLeft",
                  fontSize: 10,
                }}
              />
            </>
          )}
          {kind === "scenario" && (
            <>
              <ReferenceArea
                x1={-3}
                x2={-1}
                fill={palette[0]}
                fillOpacity={0.07}
                label={{
                  value: "Trial range",
                  position: "insideTop",
                  fontSize: 10,
                }}
              />
              <ReferenceLine y={0} stroke="#627891" strokeDasharray="2 3" />
            </>
          )}
          {kind === "cdf" && (
            <ReferenceLine
              y={90}
              stroke={palette[2]}
              strokeDasharray="2 3"
              label={{
                value: "90%",
                position: "insideBottomRight",
                fontSize: 10,
              }}
            />
          )}
          {kind === "prediction-band" && (
            <>
              <Area
                type="linear"
                dataKey="band"
                name="80% prediction interval"
                stroke="none"
                fill={palette[0]}
                fillOpacity={0.18}
                connectNulls={false}
                isAnimationActive={false}
              />
              <ReferenceLine
                x={Date.UTC(2026, 7, 5)}
                stroke="#627891"
                strokeDasharray="2 3"
                label={{
                  value: "Forecast starts",
                  position: "insideTopLeft",
                  fontSize: 10,
                }}
              />
            </>
          )}
          {Array.from({ length: lineCount }, (_, i) =>
            kind === "stacked-area" ? (
              <Area
                key={i}
                dataKey={`v${i + 1}`}
                name={seriesNames[i]}
                stackId="volume"
                type="linear"
                fill={palette[i]}
                fillOpacity={0.2}
                stroke={palette[i]}
                hide={hidden.includes(seriesNames[i])}
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={i}
                dataKey={`v${i + 1}`}
                name={seriesNames[i]}
                type={kind === "cdf" ? "stepAfter" : "linear"}
                stroke={kind === "prediction-band" ? palette[0] : palette[i]}
                strokeDasharray={
                  i === 1 && (kind === "prediction-band" || kind === "scenario")
                    ? "6 4"
                    : undefined
                }
                dot={{ r: 2.5 }}
                activeDot={{ r: 4 }}
                connectNulls={false}
                hide={hidden.includes(seriesNames[i])}
                isAnimationActive={false}
              />
            ),
          )}
          {kind === "scenario" && (
            <>
              <ReferenceDot
                x={-3}
                y={4.5}
                r={4}
                fill={palette[1]}
                label={{
                  value: "Model peak",
                  position: "top",
                  offset: 14,
                  fontSize: 10,
                }}
              />
              <ReferenceDot
                x={-2}
                y={4}
                r={4}
                fill={palette[1]}
                label={{
                  value: "Proposed",
                  position: "bottom",
                  offset: 14,
                  fontSize: 10,
                }}
              />
              <ReferenceDot
                x={0}
                y={0}
                r={4}
                fill={palette[1]}
                label={{ value: "Current", position: "left", fontSize: 10 }}
              />
            </>
          )}
          {zoomable && (
            <Brush
              dataKey="x"
              height={20}
              tickFormatter={shortDate}
              ariaLabel="Time window"
              startIndex={Math.max(
                0,
                data.findIndex((row) => row.x >= low),
              )}
              endIndex={Math.max(
                0,
                data.reduce(
                  (last, row, index) => (row.x <= high ? index : last),
                  0,
                ),
              )}
              onChange={({ startIndex, endIndex }) => {
                if (
                  startIndex !== undefined &&
                  endIndex !== undefined &&
                  endIndex > startIndex
                )
                  setRange({
                    mode: "percent",
                    start:
                      ((data[startIndex].x - domain[0]) /
                        (domain[1] - domain[0])) *
                      100,
                    end:
                      ((data[endIndex].x - domain[0]) /
                        (domain[1] - domain[0])) *
                      100,
                  });
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      {zoomable && (
        <ZoomControls range={range} domain={domain} onChange={setRange} />
      )}
    </>
  );
}

function BarsPlot({ kind, example }: ExampleProps) {
  const data = records(example);
  const horizontal = kind === "labeled-bars" || kind === "stacked-bars";
  const normalized = kind === "stacked-bars";
  const histogram = kind === "histogram";
  const labels = kind === "labeled-bars" || histogram;
  return (
    <ResponsiveContainer width="100%" height={example.height ?? 320}>
      <ComposedChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{
          top: 30,
          right: labels ? 44 : 16,
          bottom: 18,
          left: horizontal ? 20 : 0,
        }}
        barCategoryGap={histogram ? "5%" : "20%"}
        accessibilityLayer
      >
        <CartesianGrid
          horizontal={!horizontal}
          vertical={horizontal}
          stroke="var(--ezui-color-neutral-200, #dfe5ed)"
        />
        <XAxis
          {...axis}
          type={horizontal ? "number" : "category"}
          dataKey={horizontal ? undefined : "name"}
          domain={horizontal ? [0, normalized ? 100 : 16] : undefined}
          tickFormatter={
            horizontal
              ? (value) => (normalized ? `${value}%` : usd(value))
              : undefined
          }
        />
        <YAxis
          {...axis}
          type={horizontal ? "category" : "number"}
          dataKey={horizontal ? "name" : undefined}
          width={horizontal ? 65 : 46}
          domain={horizontal ? undefined : [0, "auto"]}
          tickFormatter={!horizontal && !histogram ? usd : undefined}
        />
        <Tooltip contentStyle={tooltipStyle} />
        {!histogram && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {Array.from({ length: histogram ? 1 : normalized ? 3 : 2 }, (_, i) => (
          <Bar
            key={i}
            dataKey={`v${i + 1}`}
            name={example.dataTable.columns[i + 1]}
            stackId={normalized ? "total" : undefined}
            fill={normalized ? palette[i] : i === 1 ? "#98aacd" : palette[0]}
            maxBarSize={histogram ? undefined : 32}
            isAnimationActive={false}
          >
            {labels && (
              <LabelList
                dataKey={`v${i + 1}`}
                position={horizontal ? "right" : "top"}
                fontSize={10}
                fill="var(--ezui-color-neutral-800, #172b4d)"
                formatter={(value) =>
                  histogram ? String(value) : `$${Number(value).toFixed(2)}`
                }
              />
            )}
          </Bar>
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Supplied quartiles are drawn directly; never manufacture raw samples. */
function BoxMarks({ example }: Pick<ExampleProps, "example">) {
  const xScale = useXAxisScale(),
    yScale = useYAxisScale();
  if (!xScale || !yScale) return null;
  return (
    <g data-box-summaries>
      {example.dataTable.rows.map((row) => {
        const [, , min, p25, median, p75, max] = row.values as [
          string,
          number,
          number,
          number,
          number,
          number,
          number,
        ];
        const y = yScale(String(row.values[0])) ?? 0;
        const [a, b, c, d, e] = [min, p25, median, p75, max].map(
          (value) => xScale(value) ?? 0,
        );
        return (
          <g key={row.id}>
            <title>{row.values.join(" · ")}</title>
            <line x1={a} x2={e} y1={y} y2={y} stroke={palette[0]} />
            <path
              d={`M${a},${y - 7}v14 M${e},${y - 7}v14`}
              stroke={palette[0]}
            />
            <rect
              x={b}
              y={y - 13}
              width={d - b}
              height={26}
              fill="#dce5ff"
              stroke={palette[0]}
            />
            <line
              x1={c}
              x2={c}
              y1={y - 13}
              y2={y + 13}
              stroke={palette[0]}
              strokeWidth={2}
            />
          </g>
        );
      })}
    </g>
  );
}

function BoxPlot({ example }: ExampleProps) {
  return (
    <ResponsiveContainer width="100%" height={example.height ?? 320}>
      <ComposedChart
        data={records(example)}
        layout="vertical"
        margin={{ top: 25, right: 25, bottom: 30, left: 25 }}
        accessibilityLayer
      >
        <XAxis
          {...axis}
          type="number"
          domain={[0, 8]}
          label={{ value: "Calendar days", position: "bottom", fontSize: 11 }}
        />
        <YAxis
          {...axis}
          type="category"
          dataKey="name"
          scale="point"
          padding={{ top: 35, bottom: 35 }}
        />
        <CartesianGrid
          horizontal={false}
          stroke="var(--ezui-color-neutral-200, #dfe5ed)"
        />
        <BoxMarks example={example} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function Waterfall({ example }: ExampleProps) {
  const data = records(example).map((row) => ({
    ...row,
    range: [
      Math.min(Number(row.v2) - Number(row.v1), Number(row.v2)),
      Math.max(Number(row.v2) - Number(row.v1), Number(row.v2)),
    ],
    balance: Number(row.v2),
    color:
      row.v1 === null
        ? palette[2]
        : Number(row.v1) < 0
          ? "#9b5900"
          : palette[0],
    amount: row.v1 === null ? Number(row.v2) : Number(row.v1),
  }));
  data[data.length - 1].range = [0, Number(data[data.length - 1].balance)];
  return (
    <ResponsiveContainer width="100%" height={example.height ?? 320}>
      <ComposedChart
        data={data}
        margin={{ top: 38, right: 20, bottom: 20, left: 0 }}
        accessibilityLayer
      >
        <CartesianGrid
          vertical={false}
          stroke="var(--ezui-color-neutral-200, #dfe5ed)"
        />
        <XAxis
          {...axis}
          dataKey="name"
          tickFormatter={(name) => (name === "Net contribution" ? "Net" : name)}
        />
        <YAxis
          {...axis}
          domain={[0, 28000]}
          tickFormatter={(value) => `$${value / 1000}k`}
          width={48}
        />
        <Tooltip
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as
              | (typeof data)[number]
              | undefined;
            return active && row ? (
              <div className="exact-tooltip" role="status">
                <strong>
                  {row.name}: {usd(row.amount)}
                </strong>
                <div>Balance: {usd(row.balance)}</div>
              </div>
            ) : null;
          }}
        />
        <Bar
          dataKey="range"
          name="USD"
          maxBarSize={40}
          isAnimationActive={false}
        >
          {data.map((row) => (
            <Cell key={row.id} fill={row.color} />
          ))}
          <LabelList
            dataKey="amount"
            position="top"
            fontSize={10}
            fill="var(--ezui-color-neutral-800, #172b4d)"
            formatter={(value) =>
              `${Number(value) < 0 ? "−" : ""}$${Math.abs(Number(value)) / 1000}k`
            }
          />
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function FlowNode({ x, y, width, height, payload }: SankeyNodeProps) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={
          payload.name.startsWith("Carrier")
            ? palette[payload.name.charCodeAt(payload.name.length - 1) - 65]
            : "#627891"
        }
      />
      <text
        x={x + width + 4}
        y={y + height / 2}
        dominantBaseline="middle"
        fontSize={10}
        fill="var(--ezui-color-neutral-800, #172b4d)"
      >
        {payload.name}
      </text>
    </g>
  );
}

function FlowPlot({ example }: ExampleProps) {
  const rows = example.dataTable.rows;
  const names = [
    ...new Set(
      rows.flatMap((row) => [String(row.values[0]), String(row.values[1])]),
    ),
  ];
  const data = {
    nodes: names.map((name) => ({
      name,
      color: name.startsWith("Carrier")
        ? palette[name.charCodeAt(name.length - 1) - 65]
        : "#627891",
    })),
    links: rows.map((row) => ({
      source: names.indexOf(String(row.values[0])),
      target: names.indexOf(String(row.values[1])),
      value: Number(row.values[2]),
    })),
  };
  return (
    <ResponsiveContainer width="100%" height={example.height ?? 360}>
      <Sankey
        data={data}
        node={FlowNode}
        nodeWidth={12}
        nodePadding={22}
        margin={{ top: 28, bottom: 28, left: 5, right: 72 }}
        link={{ stroke: "#7394cc", strokeOpacity: 0.28 }}
        accessibilityLayer
      >
        <Tooltip contentStyle={tooltipStyle} />
      </Sankey>
    </ResponsiveContainer>
  );
}

function TreeNode({
  x,
  y,
  width,
  height,
  name,
  value,
  depth,
  color,
}: TreemapNode) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={depth === 1 ? "#edf1f7" : String(color ?? palette[0])}
        stroke="#fff"
      />
      {width > 44 && height > 25 && (
        <text
          x={x + 5}
          y={y + 14}
          fontSize={10}
          fill={depth === 1 ? "#172b4d" : "white"}
        >
          {name}
          {depth > 1 && height > 42 && (
            <tspan x={x + 5} dy={14}>
              {value.toLocaleString("en-US")}
            </tspan>
          )}
        </text>
      )}
    </g>
  );
}

function TreePlot({ example }: ExampleProps) {
  const groups = [
    ...new Set(example.dataTable.rows.map((row) => String(row.values[0]))),
  ];
  const data = groups.map((name, i) => ({
    name,
    children: example.dataTable.rows
      .filter((row) => row.values[0] === name)
      .map((row) => ({
        name: String(row.values[1])
          .replace("Two-day", "2-day")
          .replace("Next-day", "1-day"),
        value: Number(row.values[2]),
        color: palette[i],
      })),
  }));
  return (
    <ResponsiveContainer width="100%" height={example.height ?? 320}>
      <Treemap
        data={data}
        dataKey="value"
        nodeInset={19}
        nodeGap={3}
        content={TreeNode}
        isAnimationActive={false}
      >
        <Tooltip contentStyle={tooltipStyle} />
      </Treemap>
    </ResponsiveContainer>
  );
}

function ScatterPlot({
  example,
  select,
}: ExampleProps & { select: (id: string) => void }) {
  const data = records(example);
  return (
    <ResponsiveContainer width="100%" height={example.height ?? 320}>
      <ScatterChart
        margin={{ top: 32, right: 18, bottom: 30, left: 0 }}
        accessibilityLayer
      >
        <CartesianGrid stroke="var(--ezui-color-neutral-200, #dfe5ed)" />
        <XAxis
          {...axis}
          type="number"
          dataKey="v1"
          domain={[0, 5]}
          name="Calendar days"
          label={{
            value: "Transit (calendar days)",
            position: "bottom",
            fontSize: 11,
          }}
        />
        <YAxis
          {...axis}
          type="number"
          dataKey="v2"
          domain={[0, 15]}
          name="USD / label"
          tickFormatter={usd}
          width={44}
        />
        <ZAxis
          dataKey="v3"
          type="number"
          domain={[0, 2400]}
          range={[0, Math.PI * ((Math.sqrt(2400) * 0.72) / 2) ** 2]}
          name="Parcels"
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {["A", "B", "C"].map((carrier, i) => (
          <Scatter
            key={carrier}
            name={`Carrier ${carrier}`}
            data={data.filter((row) => row.name.startsWith(carrier))}
            fill={palette[i]}
            fillOpacity={0.8}
            isAnimationActive={false}
            onClick={(point) => select(String(point.payload.id))}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function RechartsExample(props: ExampleProps) {
  const { kind, example } = props;
  const [selection, setSelection] = useState<string | null>(null);
  let plot: ReactNode;
  if (kind === "heatmap" || kind === "periodic-heatmap")
    plot = <HeatMap {...props} />;
  else if (kind === "sankey") plot = <FlowPlot {...props} />;
  else if (kind === "box-plot") plot = <BoxPlot {...props} />;
  else if (kind === "waterfall") plot = <Waterfall {...props} />;
  else if (kind === "treemap") plot = <TreePlot {...props} />;
  else if (kind === "scatter")
    plot = <ScatterPlot {...props} select={setSelection} />;
  else if (kind === "donut")
    plot = (
      <ResponsiveContainer width="100%" height={example.height ?? 320}>
        <PieChart accessibilityLayer>
          <Pie
            data={records(example)}
            nameKey="name"
            dataKey="v1"
            innerRadius="38%"
            outerRadius="62%"
            isAnimationActive={false}
          >
            {records(example).map((row, i) => (
              <Cell key={row.id} fill={palette[i]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(name) =>
              `${name} ${example.dataTable.rows.find((row) => row.values[0] === name)?.values[1]}`
            }
          />
        </PieChart>
      </ResponsiveContainer>
    );
  else if (
    ["grouped-bars", "labeled-bars", "stacked-bars", "histogram"].includes(kind)
  )
    plot = <BarsPlot {...props} />;
  else plot = <SeriesPlot {...props} />;
  return (
    <ChartFrame
      title={example.title}
      description={example.description}
      dataTable={example.dataTable}
      height={example.height}
      status={example.status}
      onRetry={example.onRetry}
      onRowSelect={kind === "scatter" ? setSelection : undefined}
      notice={selection ? `Selected cohort: ${selection}` : example.notice}
    >
      <div className="recharts-plot" data-recharts-plot={kind}>
        {plot}
      </div>
    </ChartFrame>
  );
}

/** Controlled percentage/value semantics for the live-refresh comparison. */
export function RechartsRefresh({
  maximum,
  responsive,
}: {
  maximum: number;
  responsive: boolean;
}) {
  const [range, setRange] = useState<WindowRange>(
    responsive
      ? { mode: "percent", start: 10, end: 90 }
      : { mode: "value", start: 10, end: 20 },
  );
  const domain: [number, number] = [0, maximum];
  const visible = visibleDomain(range, domain);
  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart
          data={Array.from({ length: maximum / 5 + 1 }, (_, i) => ({
            x: i * 5,
            y: 50 + Math.sin(i / 3) * 10,
          }))}
          accessibilityLayer
        >
          <XAxis
            {...axis}
            type="number"
            dataKey="x"
            domain={visible}
            allowDataOverflow
          />
          <YAxis {...axis} domain={[35, 65]} />
          <Line
            dataKey="y"
            dot={false}
            stroke={palette[0]}
            isAnimationActive={false}
          />
          <Tooltip contentStyle={tooltipStyle} />
        </ComposedChart>
      </ResponsiveContainer>
      <ZoomControls range={range} domain={domain} onChange={setRange} />
      <output data-visible-domain={visible.join(",")}>
        Window: {visible.map((value) => Number(value.toFixed(2))).join("–")} (
        {range.mode})
      </output>
    </div>
  );
}
