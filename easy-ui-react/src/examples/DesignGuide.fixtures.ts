/** Original synthetic teaching data, not actual EasyPost prices or business rules. */
export const proposals = [
  {
    id: "A",
    identity: "A · North → Central",
    service: "Ground · weekday",
    price: "$6.20 → $5.90",
    range: "+$40 to +$120",
    constraint: "Clear",
    diagnostic:
      "Spare capacity in the fictional scenario. No constraint exception is declared.",
    demand: [90, 110, 100, 140, 130, 155, 160],
  },
  {
    id: "B",
    identity: "B · West → Central",
    service: "Ground · weekday",
    price: "$5.70 → $5.40",
    range: "−$20 to +$100",
    constraint: "Check",
    diagnostic:
      "The low scenario loses contribution. Investigate the assumed capacity restriction before queuing review.",
    demand: [100, 125, 120, 135, 150, 130, 145],
  },
  {
    id: "C",
    identity: "C · South → Coastal",
    service: "Ground · weekday",
    price: "$7.10 → $6.85",
    range: "+$10 to +$30",
    constraint: "Clear",
    diagnostic:
      "Smaller modeled upside. A fictional longer transit path is recorded for investigation.",
    demand: [50, 65, 60, 75, 80, 70, 85],
  },
];
export type Proposal = (typeof proposals)[number];
export const amounts = [
  { id: "A", label: "A", value: 80 },
  { id: "B", label: "B", value: 40 },
  { id: "C", label: "C", value: 20 },
];
export const guideRoot = "https://lanej.io/viewrule/guide/v1/";
export const modes = {
  compact: "Compact + expansion",
  sparse: "Sparse navigation",
  overloaded: "All details open",
  table: "Comparison table + detail panel",
  trends: "Visible trend comparisons",
  detail: "Dedicated investigation",
  clipped: "Clipped identities",
};
export const tasks = {
  routine:
    "Compare three proposals using identity, current/proposed USD per parcel, forecast contribution range, and constraint state before Queue review or Hold. Histories are supporting evidence.",
  trend:
    "Compare all three demand histories before review or hold. Trend direction and level are essential alongside price, range, and constraints.",
  audit:
    "Document one proposal's model assumptions and review rationale. Alternatives need not be compared for this individual investigation.",
};
export type Mode = keyof typeof modes;
export type Task = keyof typeof tasks;
