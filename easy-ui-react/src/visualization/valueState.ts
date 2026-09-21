/** Out-of-domain values retain their exact labels. Omit their mark, or clamp it explicitly. */
export type OverflowPolicy = "omit" | "clamp";
export type ObservationState =
  "valid" | "missing" | "invalid" | "out-of-domain";

export function observationState(
  value: number | null,
  domain?: readonly [number, number],
  minimum?: number,
): ObservationState {
  if (value === null) return "missing";
  if (!Number.isFinite(value) || (minimum !== undefined && value < minimum))
    return "invalid";
  if (domain && (value < domain[0] || value > domain[1]))
    return "out-of-domain";
  return "valid";
}

export function observationLabel(
  value: number | null,
  state: ObservationState,
  formatValue: (value: number) => string,
  labels: { missing: string; invalid: string; outside: string },
) {
  if (state === "missing") return labels.missing;
  if (value === null || !Number.isFinite(value)) return labels.invalid;
  const exact = formatValue(value);
  if (state === "invalid") return `${exact} · ${labels.invalid}`;
  if (state === "out-of-domain") return `${exact} · ${labels.outside}`;
  return exact;
}

export function plottedObservation(
  value: number | null,
  state: ObservationState,
  domain: readonly [number, number],
  overflow: OverflowPolicy,
) {
  if (state === "valid") return value;
  if (state === "out-of-domain" && overflow === "clamp" && value !== null) {
    return Math.max(domain[0], Math.min(domain[1], value));
  }
  return null;
}
