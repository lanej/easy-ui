import type { MapFacility, MapSegment, MapArea } from "../NetworkMap/types";
import type { ChartProps } from "../Chart";

export const snapshot = "2026-09-13T14:00:00Z";
export const hours = Array.from(
  { length: 14 },
  (_, i) => `${String(i).padStart(2, "0")}:00`,
);
const profile = [
  0.44, 0.35, 0.3, 0.28, 0.34, 0.51, 0.68, 0.78, 0.83, 0.88, 0.94, 1.03, 1.12,
  1.2,
];
export const hubs = [
  {
    id: "chi",
    name: "Chicago",
    coordinates: [-87.63, 41.88] as const,
    capacity: 1600,
    pressure: 92,
    risk: 0.07,
    dwell: 2.1,
    outgoing: ["dtw", "ind", "cle"],
    flow: [1800, 1100, 700],
  },
  {
    id: "dtw",
    name: "Detroit",
    coordinates: [-83.18, 42.37] as const,
    capacity: 1200,
    pressure: 120,
    risk: 0.18,
    dwell: 5.8,
    outgoing: ["cle", "buf", "pit"],
    flow: [1600, 900, 700],
  },
  {
    id: "cle",
    name: "Cleveland",
    coordinates: [-81.69, 41.5] as const,
    capacity: 1000,
    pressure: 78,
    risk: 0.05,
    dwell: 1.7,
    outgoing: ["buf", "pit", "cmh"],
    flow: [1100, 800, 500],
  },
  {
    id: "ind",
    name: "Indianapolis",
    coordinates: [-86.16, 39.77] as const,
    capacity: 900,
    pressure: 84,
    risk: 0.06,
    dwell: 2.4,
    outgoing: ["dtw", "cmh", "pit"],
    flow: [900, 700, 400],
  },
  {
    id: "cmh",
    name: "Columbus",
    coordinates: [-83.0, 39.96] as const,
    capacity: 900,
    pressure: 108,
    risk: 0.16,
    dwell: 4.2,
    outgoing: ["cle", "pit", "buf"],
    flow: [950, 650, 400],
  },
  {
    id: "pit",
    name: "Pittsburgh",
    coordinates: [-80.0, 40.44] as const,
    capacity: 800,
    pressure: 96,
    risk: 0.08,
    dwell: 2.8,
    outgoing: ["cle", "buf", "dtw"],
    flow: [800, 550, 350],
  },
  {
    id: "buf",
    name: "Buffalo",
    coordinates: [-78.88, 42.89] as const,
    capacity: 700,
    pressure: 89,
    risk: null,
    dwell: 3.2,
    outgoing: ["cle", "pit", "dtw"],
    flow: [650, 450, 300],
  },
];
export type Hub = (typeof hubs)[number];
const observedProfiles: Record<string, (number | null)[]> = {
  chi: [
    0.32, 0.3, 0.36, 0.42, 0.52, 0.73, 0.92, 1.04, 1.1, 1.05, 0.98, 0.97, 0.94,
    0.92,
  ],
  dtw: [
    0.44, 0.35, 0.3, 0.28, 0.34, 0.51, 0.68, 0.78, 0.83, 0.88, 0.94, 1.03, 1.12,
    1.2,
  ],
  cle: [
    0.25, 0.3, 0.28, 0.24, 0.37, 0.48, 0.62, 0.72, 0.74, 0.79, 0.75, 0.8, 0.76,
    0.78,
  ],
  ind: [
    0.31, 0.25, 0.22, 0.29, 0.42, 0.65, 0.76, 0.86, 0.9, 0.87, 0.89, 0.92, 0.88,
    0.84,
  ],
  cmh: [
    0.28, 0.23, 0.22, 0.28, 0.45, 0.69, 0.8, 0.94, 1.05, 1.21, 1.26, 1.19, 1.14,
    1.08,
  ],
  pit: [
    0.3, 0.27, 0.25, 0.32, 0.43, 0.54, 0.6, 0.66, 0.76, 0.81, 0.88, 0.94, 0.91,
    0.96,
  ],
  buf: [
    0.2,
    0.22,
    0.18,
    0.25,
    0.38,
    0.54,
    0.68,
    0.74,
    0.77,
    0.82,
    0.85,
    null,
    0.9,
    0.89,
  ],
};
export const volume = (hub: Hub) =>
  observedProfiles[hub.id].map((p) =>
    p === null ? null : Math.round(hub.capacity * p),
  );
export const expected = (hub: Hub) =>
  profile.map((p) => Math.round(hub.capacity * Math.min(p, 0.86) * 0.9));
export const facilities: MapFacility[] = hubs.map((h) => ({
  id: h.id,
  label: h.name,
  coordinates: h.coordinates,
  kind: "hub",
  priority: h.pressure,
  detail: `${h.pressure}% of supplied hourly capacity · ${h.dwell}h median dwell`,
  risk: {
    probability: h.risk,
    baseline: 0.06,
    event: "New tracking exception",
    horizonHours: 24,
    cohort:
      "Synthetic Ground parcels inducted at this hub in the preceding 24h",
    asOf: snapshot,
    status: h.risk === null ? "unavailable" : "current",
  },
}));
export const segments: MapSegment[] = hubs.flatMap((h) =>
  h.outgoing.map((to, i) => ({
    id: `${h.id}-${to}`,
    from: h.id,
    to,
    evidence: "transfer",
    volume: h.flow[i],
    label: `${h.name} → ${hubs.find((n) => n.id === to)!.name} · ${h.flow[i].toLocaleString("en-US")} parcels · 08:00–14:00 UTC`,
  })),
);
export const weather: MapArea[] = [
  {
    id: "forecast",
    label: "Illustrative storm forecast · impact not attributed",
    evidence: "forecast",
    validFrom: snapshot,
    validUntil: "2026-09-13T18:00:00Z",
    source: "Synthetic exercise; not a weather service",
    coordinates: [
      [-84.3, 41.8],
      [-82.2, 43.1],
      [-80.5, 42.6],
      [-82.3, 41.1],
      [-84.3, 41.8],
    ],
  },
];
const number = (n: number) => n.toLocaleString("en-US");
export function volumeChart(
  hub: Hub,
): Pick<ChartProps, "option" | "dataTable"> {
  const observed = volume(hub),
    baseline = expected(hub);
  return {
    option: {
      tooltip: { trigger: "axis" },
      legend: { top: 0, data: ["Observed", "Expected", "Capacity"] },
      grid: { left: 60, right: 18, top: 58, bottom: 55 },
      xAxis: { type: "category", data: hours, axisLabel: { interval: 2 } },
      yAxis: {
        type: "value",
        min: 0,
        max: 2100,
        name: "Parcels / hour",
        nameLocation: "end",
      },
      dataZoom: [{ type: "inside", start: 0, end: 100 }],
      series: [
        {
          name: "Observed",
          type: "bar",
          data: observed,
          itemStyle: { color: "#2450ca" },
          barMaxWidth: 24,
        },
        {
          name: "Expected",
          type: "line",
          data: baseline,
          showSymbol: false,
          lineStyle: { color: "#517687", type: "dashed", width: 2 },
          itemStyle: { color: "#517687" },
        },
        {
          name: "Capacity",
          type: "line",
          data: hours.map(() => hub.capacity),
          showSymbol: false,
          lineStyle: { color: "#ad5700", width: 2 },
          itemStyle: { color: "#ad5700" },
        },
      ],
    },
    dataTable: {
      columns: [
        "Hour starting UTC",
        "Observed parcels",
        "Expected parcels",
        "Supplied hourly capacity",
      ],
      rows: hours.map((hour, i) => ({
        id: hour,
        values: [hour, observed[i], baseline[i], hub.capacity],
      })),
    },
  };
}
export function pressureChart(
  selected: string,
): Pick<ChartProps, "option" | "dataTable"> {
  const buckets = hours.slice(8);
  const rows = hubs.flatMap((hub, y) =>
    buckets.map((hour, x) => {
      const observed = volume(hub)[x + 8];
      const value =
        observed === null ? null : Math.round((observed / hub.capacity) * 100);
      return { hub, hour, value, x, y };
    }),
  );
  return {
    option: {
      tooltip: {
        position: "top",
        formatter: (params) => {
          const point = Array.isArray(params) ? params[0] : params;
          const [x, y, value] = point.value as number[];
          return `${hubs[y].name} · ${buckets[x]}: ${value < 0 ? "Unavailable" : `${value}%`}`;
        },
      },
      grid: { left: 118, right: 22, top: 14, bottom: 85 },
      xAxis: {
        type: "category",
        data: buckets,
        splitArea: { show: true },
        axisLabel: { interval: 0 },
      },
      yAxis: {
        type: "category",
        data: hubs.map((h) => `${h.id === selected ? "› " : ""}${h.name}`),
        inverse: true,
        axisLabel: { interval: 0 },
        splitArea: { show: true },
      },
      visualMap: {
        min: 0,
        max: 130,
        orient: "horizontal",
        left: "center",
        bottom: 4,
        calculable: false,
        text: ["130%", "0%"],
        inRange: {
          color: ["#f0f5fc", "#b4cee8", "#568cae", "#edc182", "#d97835"],
        },
      },
      series: [
        {
          type: "heatmap",
          data: rows.map((r) => ({
            // -1 is a rendering sentinel only; exact-data rows retain null.
            value: [r.x, r.y, r.value ?? -1],
            itemStyle: r.value === null ? { color: "#e4e7ec" } : undefined,
          })),
          label: {
            show: true,
            color: "#111827",
            formatter: (p) => {
              const value = (p.value as (number | null)[])[2];
              return value === null || value < 0 ? "—" : `${value}%`;
            },
          },
          itemStyle: { borderColor: "#fff", borderWidth: 2 },
          emphasis: { itemStyle: { borderColor: "#172b4d", borderWidth: 2 } },
        },
      ],
    },
    dataTable: {
      columns: ["Hub", "Hour starting UTC", "Observed / supplied capacity %"],
      rows: rows.map((r) => ({
        id: `${r.hub.id}:${r.hour}`,
        values: [r.hub.name, r.hour, r.value],
      })),
    },
  };
}
export function flowChart(hub: Hub): Pick<ChartProps, "option" | "dataTable"> {
  const services = ["Economy", "Standard", "Priority"];
  const links = hub.outgoing.flatMap((id, i) => {
    const dest = hubs.find((h) => h.id === id)!.name;
    const total = hub.flow[i],
      economy = Math.round(total * 0.25),
      priority = Math.round(total * 0.15);
    return [
      { source: hub.name, target: dest, value: total },
      ...[economy, total - economy - priority, priority].map((value, j) => ({
        source: dest,
        target: services[j],
        value,
      })),
    ];
  });
  return {
    option: {
      tooltip: { trigger: "item", triggerOn: "mousemove" },
      series: [
        {
          type: "sankey",
          left: 12,
          right: 85,
          top: 18,
          bottom: 18,
          nodeWidth: 14,
          nodeGap: 25,
          layoutIterations: 0,
          data: [...new Set(links.flatMap((l) => [l.source, l.target]))].map(
            (name) => ({ name }),
          ),
          links,
          label: { fontSize: 12, color: "#172b4d" },
          emphasis: { focus: "adjacency" },
          lineStyle: { color: "source", opacity: 0.33, curveness: 0.48 },
          levels: [
            { depth: 0, itemStyle: { color: "#2450ca" } },
            { depth: 1, itemStyle: { color: "#568cae" } },
            { depth: 2, itemStyle: { color: "#8764b8" } },
          ],
        },
      ],
    },
    dataTable: {
      columns: ["From", "To", "Parcels in 08:00–14:00 UTC cohort"],
      rows: links.map((l, i) => ({
        id: `${hub.id}:${i}`,
        values: [l.source, l.target, number(l.value)],
      })),
    },
  };
}
