import React from "react";
import type { CustomSeriesOption, CustomSeriesRenderItem } from "echarts";
import { Chart, type ChartProps, type ChartOption } from "../Chart";
import { verticalInterval } from "../Chart/intervalRenderer";
import { visualizationColors } from "../visualization/colors";

export type WaterfallStep = { id: string; label: string; change: number };
export type WaterfallChartProps = Omit<ChartProps, "option"> & {
  /** Ordered signed changes. No cost, revenue, or sentiment is inferred. */
  steps: readonly WaterfallStep[];
  initialValue?: number;
  totalLabel?: string;
  /** Show signed changes and the final balance as direct labels. */
  showValues?: boolean;
  formatValue?: (value: number) => string;
  increaseItemStyle?: CustomSeriesOption["itemStyle"];
  decreaseItemStyle?: CustomSeriesOption["itemStyle"];
  totalItemStyle?: CustomSeriesOption["itemStyle"];
  option?: Omit<ChartOption, "series">;
};

/** A signed balance bridge. Custom interval geometry preserves changes crossing zero. */
export function WaterfallChart({
  steps,
  initialValue = 0,
  totalLabel = "Total",
  showValues = false,
  formatValue = String,
  increaseItemStyle,
  decreaseItemStyle,
  totalItemStyle,
  option,
  dataTable,
  typography,
  ...props
}: WaterfallChartProps) {
  let balance = initialValue;
  const ledger = steps.map((step) => {
    const before = balance;
    balance += step.change;
    return { ...step, before, after: balance };
  });
  const totalId = `${steps.map((step) => step.id).join("/")}/total`;
  const renderItem: CustomSeriesRenderItem = (params, api) => {
    const rectangle = verticalInterval(params, api);
    if (!showValues || !rectangle) return rectangle;
    return {
      ...rectangle,
      textContent: {
        type: "text",
        style: {
          text: formatValue(Number(api.value(3))),
          fill: String(api.visual("color")),
          fontSize: typography?.label ?? 12,
        },
      },
      textConfig: { position: "top", distance: 6 },
    };
  };
  return (
    <Chart
      {...props}
      typography={typography}
      dataTable={
        dataTable ?? {
          columns: ["Step", "Change", "Balance"],
          rows: [
            ...ledger.map((step) => ({
              id: step.id,
              values: [step.label, step.change, step.after],
            })),
            { id: totalId, values: [totalLabel, null, balance] },
          ],
        }
      }
      option={{
        grid: { left: 16, right: 24, top: 24, bottom: 48, containLabel: true },
        tooltip: { trigger: "item" },
        xAxis: {
          type: "category",
          data: [...steps.map((step) => step.label), totalLabel],
        },
        yAxis: { type: "value" },
        ...option,
        series: [
          {
            id: "waterfall",
            type: "custom",
            renderItem,
            clip: true,
            encode: { x: 0, y: [1, 2], tooltip: [3, 2] },
            dimensions: ["Step", "Before", "Balance", "Change"],
            data: [
              ...ledger.map((step, index) => ({
                id: step.id,
                name: step.label,
                value: [index, step.before, step.after, step.change],
                itemStyle: {
                  color:
                    step.change < 0
                      ? visualizationColors.secondary
                      : visualizationColors.primary,
                  ...(step.change < 0 ? decreaseItemStyle : increaseItemStyle),
                },
              })),
              {
                id: totalId,
                name: totalLabel,
                value: [steps.length, 0, balance, balance],
                itemStyle: {
                  color: visualizationColors.tertiary,
                  ...totalItemStyle,
                },
              },
            ],
          },
        ],
      }}
    />
  );
}
