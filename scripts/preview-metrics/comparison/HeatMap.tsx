import React, { useState } from "react";
import type { ExampleProps } from "./fixtures";

/** Explicit experiment gap: Recharts has no matrix chart. This native matrix
 * shares the original exact table, including unavailable and suppressed cells. */
export function HeatMap({ kind, example }: ExampleProps) {
  const periodic = kind === "periodic-heatmap";
  const rows = example.dataTable.rows;
  const columns = [
    ...new Set(rows.map((row) => String(row.values[periodic ? 1 : 0]))),
  ];
  const groups = [
    ...new Set(rows.map((row) => String(row.values[periodic ? 0 : 1]))),
  ];
  const [active, setActive] = useState<string | null>(null);
  const selected = rows.find((row) => row.id === active);
  const min = periodic ? 0 : 90,
    max = periodic ? 3 : 100;
  return (
    <div className="matrix" data-recharts-plot="native-heatmap">
      <div
        className="matrix-grid"
        style={{
          gridTemplateColumns: `54px repeat(${columns.length}, minmax(0, 1fr))`,
        }}
      >
        <span />
        {columns.map((column) => (
          <span className="matrix-axis" key={column}>
            {column}
          </span>
        ))}
        {groups.map((group) => (
          <React.Fragment key={group}>
            <span className="matrix-axis">{group}</span>
            {columns.map((column) => {
              const row = rows.find(
                (item) =>
                  String(item.values[periodic ? 0 : 1]) === group &&
                  String(item.values[periodic ? 1 : 0]) === column,
              )!;
              const value = row.values[periodic ? 4 : 2] as number | null;
              const position =
                value === null
                  ? 0
                  : Math.max(0, Math.min(1, (value - min) / (max - min)));
              const light = [234, 240, 255],
                dark = [17, 58, 191];
              const rgb = light.map((channel, i) =>
                Math.round(channel + (dark[i] - channel) * position),
              );
              const luminance = rgb
                .map((channel) => {
                  const s = channel / 255;
                  return s <= 0.04045
                    ? s / 12.92
                    : ((s + 0.055) / 1.055) ** 2.4;
                })
                .reduce(
                  (sum, channel, i) =>
                    sum + channel * [0.2126, 0.7152, 0.0722][i],
                  0,
                );
              return (
                <button
                  key={row.id}
                  type="button"
                  data-cell={row.id}
                  aria-label={`${group}, ${column}: ${value === null ? "Unavailable" : `${value}%`}`}
                  style={{
                    background:
                      value === null ? "transparent" : `rgb(${rgb.join(",")})`,
                    color: luminance > 0.179 ? "#000" : "#fff",
                  }}
                  onFocus={() => setActive(row.id)}
                  onMouseEnter={() => setActive(row.id)}
                  onClick={() => setActive(row.id)}
                >
                  {value === null ? "—" : `${value}%`}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="matrix-scale">
        <span>{min}%</span>
        <span />
        <span>{max}%</span>
      </div>
      <p className="matrix-detail" role="status">
        {selected
          ? selected.values
              .map(
                (value, i) =>
                  `${example.dataTable.columns[i]}: ${value ?? "Unavailable"}`,
              )
              .join(" · ")
          : "Focus or point to a cell for exact values and sample counts."}
      </p>
    </div>
  );
}
