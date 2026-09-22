import React, { useMemo, useState } from "react";
import { Chart } from "../Chart";
import { CompactTimeSeries } from "../CompactTimeSeries";
import { NetworkMapCellDetails } from "./NetworkMapCellDetails";
import type { MapSurface, MapSurfaceCellDetailsContext } from "./types";
import type { VisualizationTypography } from "../visualization/typography";
import styles from "./NetworkMapInspection.module.scss";

// Application-owned synthetic observations, not reconstructed from a summary.
// Their five-number summary is 5 / 20 / 45 / 50 / 120, with n = 80.
export const inspectionObservations = [
  [5, 4],
  [20, 17],
  [45, 23],
  [50, 20],
  [80, 10],
  [120, 6],
].flatMap(([minutes, count]) => Array<number>(count).fill(minutes));

export const inspectionSurface: MapSurface = {
  asOf: "2026-09-20T12:00:00Z",
  source: "Synthetic browser regression records",
  cells: [
    {
      latMin: 0.2,
      latMax: 0.8,
      lonMin: -1,
      lonMax: -0.1,
      medianMinutes: 45,
      iqrMinutes: 30,
      n: inspectionObservations.length,
      distribution: {
        minMinutes: 5,
        q1Minutes: 20,
        q3Minutes: 50,
        maxMinutes: 120,
      },
    },
    {
      latMin: 0.2,
      latMax: 0.8,
      lonMin: 0.1,
      lonMax: 1,
      medianMinutes: 20,
      iqrMinutes: 12,
      n: 40,
    },
  ],
};

const history = [55, 53, 48, 50, 45].map((value, index) => ({
  time: Date.UTC(2026, 8, 16 + index, 12),
  value,
}));
const date = (time: number) =>
  new Date(time).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
type View = "histogram" | "density" | "history";

/** An application recipe: the map has no knowledge of these charts or controls. */
export function CellChartExample({
  observations,
  typography,
  ...context
}: MapSurfaceCellDetailsContext & {
  observations?: readonly number[];
  typography?: VisualizationTypography;
}) {
  const [view, setView] = useState<View>("histogram");
  const { bins, density } = useMemo(() => {
    const sample = observations ?? [];
    // Equal-width bins over this example's known 0–120 minute domain.
    // All bins are left-inclusive; the final bin also includes its upper bound.
    const bins = Array.from({ length: 6 }, (_, index) => ({
      from: index * 20,
      to: (index + 1) * 20,
      count: sample.filter(
        (value) =>
          value >= index * 20 &&
          (index === 5 ? value <= 120 : value < (index + 1) * 20),
      ).length,
    }));
    // A Gaussian kernel estimate from the actual sample, with a declared
    // bandwidth and reflection at zero for nonnegative elapsed time.
    const bandwidth = 12;
    const kernel = (value: number) =>
      Math.exp(-0.5 * (value / bandwidth) ** 2) /
      (bandwidth * Math.sqrt(2 * Math.PI));
    const density = Array.from({ length: 41 }, (_, index) => {
      const minutes = index * 4;
      return [
        minutes,
        sample.length
          ? sample.reduce(
              (sum, value) =>
                sum + kernel(minutes - value) + kernel(minutes + value),
              0,
            ) / sample.length
          : 0,
      ];
    });
    return { bins, density };
  }, [observations]);
  if (!observations?.length)
    return <NetworkMapCellDetails {...context} typography={typography} />;

  const histogram = view === "histogram";
  return (
    <NetworkMapCellDetails {...context} typography={typography}>
      <label className={styles.viewControl}>
        Chart view
        <select
          value={view}
          onChange={(event) => setView(event.target.value as View)}
        >
          <option value="histogram">Histogram</option>
          <option value="density">Density curve</option>
          <option value="history">Median history</option>
        </select>
      </label>
      {view === "history" ? (
        <CompactTimeSeries
          label="Daily median delivery time"
          description="Five daily snapshots, September 16–20 (UTC). Synthetic history supplied independently of the distribution."
          series={[{ id: "median", label: "Daily median", points: history }]}
          domain={[0, 80]}
          formatTime={date}
          formatValue={(value) => `${value} min`}
          markers="all"
          typography={typography}
        />
      ) : (
        <Chart
          key={view}
          variant="bare"
          title={histogram ? "Delivery time histogram" : "Density estimate"}
          description={
            histogram
              ? `${observations.length} observations · Equal 20-minute bins.`
              : `${observations.length} observations · Density per minute.`
          }
          height={220}
          typography={typography}
          option={{
            grid: {
              left: 8,
              right: 16,
              top: 36,
              bottom: 40,
              containLabel: true,
            },
            tooltip: { trigger: "axis", confine: true },
            xAxis: histogram
              ? {
                  type: "category",
                  name: "Minutes",
                  nameLocation: "middle",
                  nameGap: 28,
                  data: bins.map(({ from, to }) => `${from}–${to}`),
                  axisLabel: { hideOverlap: true },
                }
              : {
                  type: "value",
                  min: 0,
                  max: 160,
                  name: "Minutes",
                  nameLocation: "middle",
                  nameGap: 28,
                  axisLabel: { hideOverlap: true },
                },
            yAxis: {
              type: "value",
              min: 0,
              name: histogram ? "Observations" : "Density / min",
              nameLocation: "end",
              nameTextStyle: { align: "left" },
            },
            series: histogram
              ? [
                  {
                    id: "bins",
                    type: "bar",
                    barWidth: "100%",
                    data: bins.map((bin) => bin.count),
                  },
                ]
              : [
                  {
                    id: "density",
                    type: "line",
                    showSymbol: false,
                    smooth: false,
                    areaStyle: { opacity: 0.2 },
                    data: density,
                  },
                ],
          }}
          dataTable={{
            columns: histogram
              ? ["Minutes", "Observations"]
              : ["Minutes", "Density / min"],
            rows: histogram
              ? bins.map(({ from, to, count }, index) => ({
                  id: String(from),
                  values: [
                    index === bins.length - 1
                      ? `${from}–${to} inclusive`
                      : `${from}–<${to}`,
                    count,
                  ],
                }))
              : density.map(([minutes, value]) => ({
                  id: String(minutes),
                  values: [minutes, value],
                })),
            columnOptions: { 1: { isNumeric: true } },
            renderCell: (value, column) =>
              !histogram && column === 1 && typeof value === "number"
                ? value.toFixed(6)
                : null,
          }}
        />
      )}
      {view !== "history" && (
        <details className={styles.method}>
          <summary>
            {histogram ? "About these bins" : "About this estimate"}
          </summary>
          <p>
            {histogram
              ? "Counts include each supplied observation once. Bins include their lower bound; the final bin also includes 120 minutes. Empty bins remain visible in exact data."
              : "Gaussian bandwidth: 12 minutes; reflected at zero. Estimated from the supplied observations. The curve shows density, not counts, and is not inferred from the median or IQR."}
          </p>
        </details>
      )}
    </NetworkMapCellDetails>
  );
}
