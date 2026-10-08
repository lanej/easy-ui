import React, { useState } from "react";
import { useId } from "react-aria";
import { Card } from "../Card";
import { Checkbox } from "../Checkbox";
import { Select } from "../Select";
import { DataGrid } from "./DataGrid";
import type { DataGridColumnOptions } from "./types";
import styles from "./MobileDataGrid.examples.module.scss";

const metrics = [
  {
    key: "sla",
    name: "Met SLA",
    unit: "%",
    deltaUnit: "pts",
    higherIsBetter: true,
  },
  {
    key: "guaranteed",
    name: "Guaranteed SLA",
    unit: "%",
    deltaUnit: "pts",
    higherIsBetter: true,
  },
  {
    key: "nonGuaranteed",
    name: "Non-guaranteed SLA",
    unit: "%",
    deltaUnit: "pts",
    higherIsBetter: true,
  },
  {
    key: "transit",
    name: "Avg transit days",
    unit: " days",
    deltaUnit: "days",
    higherIsBetter: false,
  },
  {
    key: "exceptions",
    name: "Exception rate",
    unit: "%",
    deltaUnit: "pts",
    higherIsBetter: false,
  },
  {
    key: "package",
    name: "Cost / package",
    unit: "$",
    deltaUnit: "$",
    higherIsBetter: false,
  },
  {
    key: "mile",
    name: "Cost / mile",
    unit: "$",
    deltaUnit: "$",
    higherIsBetter: false,
  },
  {
    key: "pound",
    name: "Cost / pound",
    unit: "$",
    deltaUnit: "$",
    higherIsBetter: false,
  },
] as const;
type MetricKey = (typeof metrics)[number]["key"];
type Metric = (typeof metrics)[number];
type Measurement = { value: number; change: number; count: number };
type BenchmarkRow = {
  key: string;
  zone: string;
  shipments: number;
  metrics: Record<MetricKey, Measurement>;
};

// Synthetic application-supplied values, differences, and cohort counts.
// The grid does not calculate benchmarks or infer smaller SLA populations.
const rows: BenchmarkRow[] = [
  [120, 96, 1, 60, 40],
  [210, 95, 0, 110, 75],
  [260, 93, 0, 130, 90],
  [300, 92, 0, 145, 120],
  [280, 89, 2, 140, 105],
  [190, 85, 1, 90, 70],
  [110, 80, -1, 55, 40],
  [45, 74, -2, 20, 15],
].map(([count, sla, change, guaranteedCount, nonGuaranteedCount], index) => ({
  key: `zone-${index + 1}`,
  zone: `Zone ${index + 1}`,
  shipments: count,
  metrics: {
    sla: { value: sla, change, count },
    guaranteed: {
      value: sla + 2,
      change: change + 0.5,
      count: guaranteedCount,
    },
    nonGuaranteed: {
      value: sla - 2,
      change: change - 0.5,
      count: nonGuaranteedCount,
    },
    transit: { value: 1.2 + index * 0.4, change: -0.2, count },
    exceptions: { value: 2.1 + index * 0.7, change: -0.4, count },
    package: { value: 6.5 + index * 0.6, change: -0.25, count },
    mile: { value: 0.02 + index * 0.001, change: -0.002, count },
    pound: { value: 1.2 + index * 0.1, change: 0.05, count },
  },
}));

function formatValue(metric: Metric, value: number) {
  if (metric.unit === "$")
    return `$${value.toFixed(metric.key === "mile" ? 3 : 2)}`;
  const precision =
    metric.key === "transit" || metric.key === "exceptions" ? 1 : 0;
  return `${value.toFixed(precision)}${metric.unit}`;
}
function formatChange(metric: Metric, change: number) {
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  const amount = Math.abs(change).toFixed(
    metric.unit === "$" ? (metric.key === "mile" ? 3 : 2) : 1,
  );
  return metric.deltaUnit === "$"
    ? `${sign}$${amount}`
    : `${sign}${amount} ${metric.deltaUnit}`;
}
function Comparison({
  metric,
  measurement,
}: {
  metric: Metric;
  measurement: Measurement;
}) {
  const sentiment =
    measurement.change === 0
      ? "neutral"
      : measurement.change > 0 === metric.higherIsBetter
        ? "positive"
        : "negative";
  return (
    <span className={styles.comparison}>
      <strong>{formatValue(metric, measurement.value)}</strong>
      <span className={styles.change} data-sentiment={sentiment}>
        {formatChange(metric, measurement.change)}
      </span>
    </span>
  );
}

/** Application composition: ten columns, with an optional focused metric. */
export function MobileDataGridExample({
  largeText = false,
}: {
  largeText?: boolean;
}) {
  const [metricKey, setMetricKey] = useState<MetricKey>("sla");
  const [showAll, setShowAll] = useState(true);
  const descriptionId = useId();
  const metric = metrics.find(({ key }) => key === metricKey)!;
  const columns = [
    { key: "zone", name: "Zone" },
    ...(showAll
      ? [{ key: "shipments", name: "Shipments w/ SLA" }, ...metrics]
      : [metric]),
  ];
  const columnOptions: Record<string, DataGridColumnOptions> = {
    zone: { whiteSpace: "nowrap", ...(showAll ? { width: 80 } : {}) },
    shipments: { isNumeric: true, width: 96, minWidth: 96 },
    ...Object.fromEntries(
      metrics.map(({ key }) => [
        key,
        {
          isNumeric: true,
          // Headers can wrap while numeric body values retain their default
          // no-wrap behavior. Minimum widths keep each metric readable.
          ...(showAll ? { width: 112, minWidth: 96 } : {}),
        },
      ]),
    ),
  };
  return (
    <div className={styles.example} data-large-text={largeText || undefined}>
      <Card padding="2">
        <div className={styles.layout}>
          <h2 className={styles.heading}>Benchmark metrics by zone</h2>
          <p className={styles.caption} id={descriptionId}>
            Changes vs peer benchmark.{" "}
            {showAll
              ? "Higher SLA and lower exception rate, cost or transit time are better."
              : `${metric.higherIsBetter ? "Higher" : "Lower"} is better.`}
            {!showAll &&
              " Shipment counts reflect the selected metric’s sample."}
          </p>
          <div className={styles.controls}>
            {!showAll && (
              <Select
                label="Metric"
                selectedKey={metricKey}
                onSelectionChange={setMetricKey}
                size="lg"
              >
                {metrics.map(({ key, name }) => (
                  <Select.Option key={key}>{name}</Select.Option>
                ))}
              </Select>
            )}
            <Checkbox
              isSelected={!showAll}
              onChange={(focused) => setShowAll(!focused)}
            >
              Focus on one metric
            </Checkbox>
          </div>
          {showAll && (
            <p className={styles.caption}>
              {columns.length} columns. Swipe or scroll horizontally; Zone stays
              visible.
            </p>
          )}
          <DataGrid
            aria-label="Benchmark metrics by zone"
            aria-describedby={descriptionId}
            size="sm"
            headerVariant="secondary"
            maxRows="all"
            columns={columns}
            rows={rows}
            columnOptions={columnOptions}
            renderColumnCell={(column) => column.name}
            renderRowCell={(_, columnKey, row) => {
              if (columnKey === "zone")
                return (
                  <span className={styles.identity}>
                    <span>{row.zone}</span>
                    {!showAll && (
                      <span className={styles.sample}>
                        {row.metrics[metricKey].count} shipments
                      </span>
                    )}
                  </span>
                );
              if (columnKey === "shipments") return row.shipments;
              const selectedMetric = metrics.find(
                ({ key }) => key === columnKey,
              )!;
              return (
                <Comparison
                  metric={selectedMetric}
                  measurement={row.metrics[selectedMetric.key]}
                />
              );
            }}
          />
        </div>
      </Card>
    </div>
  );
}
