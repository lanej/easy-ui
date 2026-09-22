import React from "react";
import { Chart } from "./Chart";
import { Badge } from "../Badge";
import styles from "./RichDataTable.module.scss";

const money = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const zones = Array.from({ length: 8 }, (_, index) => `Zone ${index + 1}`);
const regions = [
  { name: "Northeast", costs: [6.6, 7, 7.4, 7.8, 8.9, 9.3, 11, 11.8] },
  { name: "Midwest", costs: [6.9, 7.3, 7.7, 8.1, 9.2, 9.6, 11.3, 12.1] },
  { name: "South", costs: [7.1, 7.5, 7.9, 8.3, 9.4, 9.8, 11.5, 12.3] },
  { name: "West", costs: [7.4, 7.8, 8.2, 8.6, 9.7, 10.1, 11.8, 12.6] },
  {
    name: "International",
    costs: [13.3, 13.9, 14.6, 15.2, 16, 16.7, 18.2, 19.2],
  },
];
// Both the plot and its built-in data disclosure derive from these same records.
const observations = regions.flatMap(({ name, costs }, regionIndex) =>
  zones.map((zone, index) => ({
    id: `${name}-${zone}`,
    region: name,
    zone,
    cost: costs[index],
    shipments: Math.round(
      [73, 72, 105, 105, 48, 47, 15, 15][index] * (1 - regionIndex * 0.12),
    ),
    change: regionIndex === 4 ? 0.6 : index < 4 ? -0.25 : -0.4,
  })),
);
const byId = new Map(observations.map((row) => [row.id, row]));

/** Rich content belongs to Chart's existing folded data view, with one source of observations. */
export function RichChartDataExample({
  largeText = false,
}: {
  largeText?: boolean;
}) {
  const detail = largeText ? 18 : 14;
  return (
    <Chart
      title="Cost per package by region and zone"
      description="September 2026 · Synthetic shipment data. Open View data table for exact costs, shipment counts, and changes versus August."
      height={340}
      typography={{
        detail,
        ...(largeText
          ? { title: 24, description: 18, label: 16, legend: 16, control: 18 }
          : {}),
      }}
      option={{
        grid: { left: 56, right: 16, top: 48, bottom: 76, containLabel: true },
        legend: { type: "scroll", bottom: 4 },
        tooltip: {
          trigger: "axis",
          valueFormatter: (value) => money(Number(value)),
        },
        xAxis: {
          type: "category",
          data: zones,
          axisLabel: { hideOverlap: true },
        },
        yAxis: { type: "value", min: 0, max: 24, name: "Cost / package ($)" },
        series: regions.map(({ name }) => ({
          id: name,
          name,
          type: "bar",
          data: observations
            .filter((row) => row.region === name)
            .map((row) => row.cost),
        })),
      }}
      dataTable={{
        columns: [
          "Region / zone",
          "Cost / package",
          "Change vs August",
          "Shipments",
        ],
        rows: observations.map((row) => ({
          id: row.id,
          values: [
            `${row.region} / ${row.zone}`,
            row.cost,
            row.change,
            row.shipments,
          ],
        })),
        pinnedColumnCount: 1,
        columnOptions: {
          0: { width: 120, minWidth: 120, whiteSpace: "normal" },
          1: { isNumeric: true, minWidth: 160, allowsSorting: true },
          2: { isNumeric: true, minWidth: 180, allowsSorting: true },
          3: { isNumeric: true, minWidth: 130, allowsSorting: true },
        },
        renderCell: (value, index, row) => {
          if (index === 0) {
            const observation = byId.get(row.id)!;
            return (
              <div className={styles.identity}>
                <span>{observation.region}</span>
                <span className={styles.zone}>{observation.zone}</span>
              </div>
            );
          }
          if (typeof value !== "number") return null;
          if (index === 3) return value.toLocaleString("en-US");
          if (index === 1) return <strong>{money(value)}</strong>;
          return (
            <Badge variant={value < 0 ? "success" : "danger"}>
              <span
                className={styles.change}
                data-sentiment={value < 0 ? "positive" : "negative"}
              >
                {`${value < 0 ? "−" : "+"}${money(Math.abs(value))}`}
              </span>
            </Badge>
          );
        },
      }}
    />
  );
}
