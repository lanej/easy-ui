import React from "react";
import { Card } from "../Card";
import { Chart } from "./Chart";
import type { ChartSurfaceProps } from "./ChartSurface";
import type { ChartOption } from "./types";

const tiers = ["1", "2", "3", "4", "5 to 6", "7 to 8", "9+"];
const services = [
  { name: "Express Saver", values: [30, 25, 15, 10, 10, 5, 8] },
  { name: "Ground", values: [140, 118, 70, 47, 47, 30, 25] },
  { name: "Ground Advantage", values: [185, 154, 93, 62, 62, 37, 30] },
  { name: "Priority", values: [130, 109, 65, 44, 44, 26, 20] },
];

const option: ChartOption = {
  tooltip: { trigger: "axis" },
  legend: { data: services.map(({ name }) => name) },
  xAxis: {
    type: "category",
    data: tiers,
    axisLabel: {
      interval: 0,
      formatter: (tier: string) => tier.replace(" to ", "–"),
    },
  },
  yAxis: { type: "value", name: "Cartons" },
  series: services.map(({ name, values }) => ({
    id: name,
    name,
    type: "bar",
    data: values,
  })),
};

/** Same grouped-transit composition as the application, with synthetic counts. */
export function MobileChartsExample({
  largeText = false,
  layout,
  renderer,
}: {
  largeText?: boolean;
  layout?: ChartSurfaceProps["layout"];
  renderer?: ChartSurfaceProps["renderer"];
}) {
  return (
    <Card padding="2">
      <Chart
        variant="bare"
        title="Transit tier distribution"
        description="Calendar days · Cartons by service level"
        height={280}
        layout={layout}
        renderer={renderer}
        typography={
          largeText
            ? { title: 24, description: 18, label: 16, legend: 16, control: 18 }
            : undefined
        }
        option={option}
        dataTable={{
          columns: ["Calendar days", "Service level", "Cartons"],
          columnOptions: { 2: { allowsSorting: true } },
          rows: tiers.flatMap((tier, index) =>
            services.map(({ name, values }) => ({
              id: `${tier}-${name}`,
              values: [tier, name, values[index]],
            })),
          ),
        }}
      />
    </Card>
  );
}
