import React, { useState } from "react";
import { Button } from "../Button";
import { Chart } from "../Chart";
import type { MapOverlayDetailsContext } from "../NetworkMap";
import { visualizationColors } from "../visualization/colors";
import styles from "./OverlayChartDetails.module.scss";

export function OverlayChartDetails({
  feature,
  overlay,
}: MapOverlayDetailsContext) {
  const [view, setView] = useState<"line" | "bar">("line");
  const values: number[] = Array.isArray(feature.properties?.dailyParcels)
    ? feature.properties.dailyParcels.filter(
        (value: unknown): value is number =>
          typeof value === "number" && Number.isFinite(value) && value >= 0,
      )
    : [];
  const days = values.map((_, index) => `Sep ${7 + index}`);
  return (
    <div className={styles.root}>
      <p className={styles.period}>
        {overlay.label} · Sep 7–13, 2026 UTC · synthetic observations
      </p>
      {!values.length ? (
        <p>No daily observations supplied.</p>
      ) : (
        <>
          <dl className={styles.metrics}>
            <div>
              <dt>Latest day</dt>
              <dd>{values[values.length - 1]} parcels</dd>
            </div>
            <div>
              <dt>Seven-day total</dt>
              <dd>
                {values
                  .reduce((total, value) => total + value, 0)
                  .toLocaleString("en-US")}{" "}
                parcels
              </dd>
            </div>
          </dl>
          <div
            className={styles.views}
            role="group"
            aria-label="Overlay chart view"
          >
            <Button
              size="sm"
              variant={view === "line" ? "filled" : "outlined"}
              aria-pressed={view === "line"}
              onPress={() => setView("line")}
            >
              Trend
            </Button>
            <Button
              size="sm"
              variant={view === "bar" ? "filled" : "outlined"}
              aria-pressed={view === "bar"}
              onPress={() => setView("bar")}
            >
              Daily bars
            </Button>
          </div>
          <Chart
            variant="bare"
            aria-label={`${feature.properties?.label ?? overlay.label} daily parcels`}
            height={180}
            showDataTable={false}
            option={{
              grid: {
                left: 6,
                right: 8,
                top: 12,
                bottom: 8,
                containLabel: true,
              },
              tooltip: { trigger: "axis", confine: true },
              xAxis: {
                type: "category",
                data: days,
                axisLabel: { interval: values.length - 2, showMaxLabel: true },
              },
              yAxis: { type: "value", min: 0 },
              series: [
                {
                  name: "Parcels / day",
                  type: view,
                  data: values,
                  symbolSize: 5,
                  itemStyle: { color: visualizationColors.primary },
                  lineStyle: { color: visualizationColors.primary, width: 2 },
                },
              ],
            }}
          />
        </>
      )}
    </div>
  );
}
