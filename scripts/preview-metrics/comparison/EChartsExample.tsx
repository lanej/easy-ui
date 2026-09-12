import React, { useMemo, useRef, useState } from "react";
import { Chart } from "../../../easy-ui-react/src/Chart/Chart";
import type { ChartOption } from "../../../easy-ui-react/src/Chart/types";
import type { ExampleProps } from "./fixtures";

export function EChartsExample({ example, kind }: ExampleProps) {
  const [selection, setSelection] = useState<string | null>(null);
  return (
    <Chart
      {...example}
      onSelect={
        kind === "scatter" ? (value) => setSelection(value.name) : undefined
      }
      onRowSelect={kind === "scatter" ? setSelection : undefined}
      notice={selection ? `Selected cohort: ${selection}` : example.notice}
    />
  );
}

export function EChartsRefresh({
  maximum,
  responsive,
}: {
  maximum: number;
  responsive: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState("");
  const option = useMemo<ChartOption>(
    () => ({
      animation: false,
      xAxis: { type: "value", min: 0, max: maximum },
      yAxis: { type: "value", min: 35, max: 65 },
      grid: { left: 42, right: 20, top: 25, bottom: 40 },
      dataZoom: [
        {
          id: "time",
          type: "inside",
          ...(responsive ? {} : { startValue: 10, endValue: 20 }),
        },
      ],
      ...(responsive
        ? {
            media: [
              {
                query: { maxWidth: 2000 },
                option: { dataZoom: [{ id: "time", start: 10, end: 90 }] },
              },
            ],
          }
        : {}),
      series: [
        {
          type: "line",
          data: Array.from({ length: maximum / 5 + 1 }, (_, i) => [
            i * 5,
            50 + Math.sin(i / 3) * 10,
          ]),
          symbol: "none",
        },
      ],
    }),
    [maximum, responsive],
  );
  const readWindow = async () => {
    const engine = await import("echarts");
    const element = host.current?.querySelector<HTMLElement>(
      "[_echarts_instance_]",
    );
    const ranges = element
      ? (engine.getInstanceByDom(element)?.getOption().dataZoom as {
          startValue: number;
          endValue: number;
          start: number;
          end: number;
        }[])
      : undefined;
    if (ranges?.[0]) setSnapshot(JSON.stringify(ranges[0]));
  };
  return (
    <div ref={host}>
      <Chart
        title="ECharts refresh probe"
        description="Current PR interaction behavior"
        option={option}
        height={240}
        dataTable={{
          columns: ["Domain minimum", "Domain maximum"],
          rows: [{ id: "domain", values: [0, maximum] }],
        }}
      />
      <button type="button" onClick={readWindow}>
        Read current window
      </button>
      <output data-echarts-window={snapshot}>
        {snapshot &&
          (() => {
            const range = JSON.parse(snapshot);
            return `Window: ${range.startValue}–${range.endValue} (${range.start}–${range.end}%)`;
          })()}
      </output>
    </div>
  );
}
