import type { EChartsOption, ECElementEvent } from "echarts";

/** A dataZoom component's range. Stable IDs are recommended when components reorder. */
export type ChartZoomState = {
  id?: string;
  index?: number;
  start?: number;
  end?: number;
  startValue?: number | string | Date;
  endValue?: number | string | Date;
  rangeMode?: ["value" | "percent", "value" | "percent"];
};

/** One legend's series visibility, independently of its displayed labels. */
export type ChartLegendState = {
  id?: string;
  index?: number;
  selected: Record<string, boolean>;
};

/** Scope a keyboard command to an explicit component or intentional group. */
export type ChartZoomTarget =
  | { dataZoomId: string | readonly string[] }
  | { dataZoomIndex: number | readonly number[] };

/** Native ECharts options, including Cartesian, flow, hierarchy, and graph series. */
export type ChartOption = EChartsOption;
/**
 * ECharts click details for a series datum. Series IDs/names identify the
 * series; name/dataIndex identify its datum, and data/value preserve the
 * engine payload. dataType distinguishes node and edge selections in flows.
 * Use application table row IDs for stable keyboard drill-down.
 */
export type ChartSelection = Pick<
  ECElementEvent,
  | "seriesId"
  | "seriesName"
  | "name"
  | "dataIndex"
  | "dataType"
  | "data"
  | "value"
>;

/** One exact-data row corresponding to the chart's observations. */
export type ChartDataRow = {
  /** Stable application identifier used for keyboard-accessible drill-down. */
  id: string;
  /** Formatted values, in the same order as the column labels. null is missing. */
  values: (string | number | null)[];
};

/** Accessible data equivalent; callers keep these records consistent with option. */
export type ChartDataTable = {
  /** Visible column headings, including units where appropriate. */
  columns: string[];
  /** Rows in display order, each with one value per column. An empty list implies the default empty state. */
  rows: ChartDataRow[];
};
