import { allExamples } from "../../../easy-ui-react/src/Chart/Chart.examples";
import { extensionExamples } from "../../../easy-ui-react/src/Chart/Chart.extensions";
import type { ChartProps } from "../../../easy-ui-react/src/Chart/Chart";

export const kinds = [
  "sankey",
  "time-series",
  "stacked-area",
  "grouped-bars",
  "scatter",
  "heatmap",
  "stacked-bars",
  "donut",
  "treemap",
  "labeled-bars",
  "annotations",
  "scenario",
  "histogram",
  "cdf",
  "box-plot",
  "prediction-band",
  "waterfall",
  "periodic-heatmap",
] as const;
export type Kind = (typeof kinds)[number];
// Both renderers consume the original synthetic fixtures. No duplicated datasets
// and no attempt to translate arbitrary ECharts options into a second grammar.
export const fixtures = kinds.map((kind, index) => ({
  kind,
  example: [...allExamples, ...extensionExamples][index],
}));
export type ExampleProps = { kind: Kind; example: ChartProps };
export type RecordDatum = {
  id: string;
  name: string;
  x: number;
  [key: string]: string | number | null | number[];
};
export function records(example: ChartProps): RecordDatum[] {
  return example.dataTable.rows.map((row, index) => ({
    id: row.id,
    name: String(row.values[0]),
    x: Number.isFinite(Number(row.id)) ? Number(row.id) : index,
    ...Object.fromEntries(
      row.values.slice(1).map((value, i) => [`v${i + 1}`, value]),
    ),
  }));
}
export const palette = ["#113abf", "#772bb0", "#007f86", "#bd6900"];
export const shortDate = (value: number) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(value);
