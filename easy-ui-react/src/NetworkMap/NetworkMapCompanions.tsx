import React from "react";
import { useId } from "react-aria";
import { useNetworkMap } from "./NetworkMapContext";
import { NetworkMapToolbar } from "./NetworkMapToolbar";
import { visualizationTypographyStyle } from "../visualization/typography";
import styles from "./NetworkMap.module.scss";

const percentage = (value: number | null) =>
  value === null ? "Unavailable" : `${Math.round(value * 100)}%`;
const exactProbability = (value: number | null) =>
  value === null
    ? "Unavailable"
    : Number.isFinite(value) && value >= 0 && value <= 1
      ? `${new Intl.NumberFormat("en", { style: "percent", maximumSignificantDigits: 21 }).format(value)} (${String(value)})`
      : `Invalid (${String(value)})`;
const exact = (value: number | null | undefined) =>
  value == null
    ? "Unavailable"
    : Number.isFinite(value)
      ? String(value)
      : "Invalid";

/** Visible presentation is independent of the surface's accessible name. */
export function NetworkMapHeading() {
  const { props: options, zoom } = useNetworkMap();
  if (!options.title && !options.description) return null;
  return (
    <div
      className={styles.heading}
      style={visualizationTypographyStyle(options.typography)}
    >
      <div>
        {options.title && <h3>{options.title}</h3>}
        {options.description && <p>{options.description}</p>}
      </div>
      <span className={styles.scale}>
        {zoom < 6 ? "National" : zoom < 10 ? "Regional" : "Local"} view
      </span>
    </div>
  );
}

/** Camera and layer controls connected to the same surface; can be placed anywhere under its provider. */
export function NetworkMapControlPanel() {
  const {
    props: options,
    controls,
    accessibleName,
    state,
    visibility,
    changeVisibility,
    commands,
  } = useNetworkMap();
  return (
    <NetworkMapToolbar
      accessibleName={accessibleName}
      labelledBy={options["aria-labelledby"]}
      controls={controls}
      labels={options.controlLabels}
      ready={state === "ready"}
      visibility={visibility}
      onVisibilityChange={changeVisibility}
      onFitAll={() => commands.current.fitAll()}
      onSelectedSegment={() => commands.current.selectedSegment()}
      onLatestEvent={() => commands.current.latestEvent()}
      style={visualizationTypographyStyle(options.typography)}
    />
  );
}

/** Selection details use normal document flow, so long content cannot cover the map or attribution. */
export function NetworkMapSelectionDetails() {
  const { props: options, visibility } = useNetworkMap();
  const active = options.facilities.find(
    (facility) => facility.id === options.selectedFacilityId,
  );
  if (!active) return null;
  return (
    <div
      className={styles.selection}
      aria-live="polite"
      style={visualizationTypographyStyle(options.typography)}
    >
      <span>
        {active.kind === "destination"
          ? "Destination"
          : active.id === options.latestFacilityId
            ? "Last observed location"
            : "Selected facility"}
      </span>
      <strong>{active.label}</strong>
      {active.detail && <p>{active.detail}</p>}
      {visibility.risk && active.risk && (
        <p>
          {active.risk.status === "current"
            ? `${percentage(active.risk.probability)} ${active.risk.event.toLowerCase()} risk`
            : `${active.risk.status} facility estimate`}{" "}
          · next {active.risk.horizonHours}h ·{" "}
          {percentage(active.risk.baseline)} baseline
        </p>
      )}
    </div>
  );
}

/** Only supplied, visible domain layers contribute legend content. */
export function NetworkMapLegend() {
  const { props: options, visibility } = useNetworkMap();
  const observed = options.segments.some(
    (segment) =>
      segment.evidence === "measured" || segment.evidence === "transfer",
  );
  const planned = options.segments.some(
    (segment) =>
      segment.evidence === "planned" || segment.evidence === "inferred",
  );
  const risk =
    visibility.risk && options.facilities.some((facility) => facility.risk);
  return (
    <>
      {(observed || planned || risk) && (
        <div
          className={styles.legend}
          style={visualizationTypographyStyle(options.typography)}
        >
          {observed && (
            <span>
              <i className={styles.solid} />
              Observed transfer
            </span>
          )}
          {planned && (
            <span>
              <i className={styles.dashed} />
              Planned / inferred
            </span>
          )}
          {risk && (
            <span>
              <i className={styles.riskKey} />
              Facility risk ≥15%
            </span>
          )}
          {options.segments.length > 0 && (
            <span>Endpoint links are not traveled road routes.</span>
          )}
        </div>
      )}
      {visibility.deliverySurface && options.surface && (
        <div
          className={styles.legend}
          role="group"
          aria-label="Delivery time surface legend"
          style={visualizationTypographyStyle(options.typography)}
        >
          <span>Median minutes: blue 0 · yellow 60 · red 120+.</span>
          <span>Cells without an estimate or observations are unfilled.</span>
          <span>Opacity compares observation counts within this map.</span>
        </div>
      )}
      {visibility.weather && options.areas.length > 0 && (
        <div
          className={styles.weatherNote}
          style={visualizationTypographyStyle(options.typography)}
        >
          {options.areas.map((area) => (
            <p key={area.id}>
              <strong>{area.label}</strong> · {area.evidence} · {area.validFrom}
              –{area.validUntil} · {area.source}. Exposure does not establish a
              cause of delay.
            </p>
          ))}
        </div>
      )}
    </>
  );
}

export type NetworkMapDataViewProps = {
  /** ID for aria-describedby on an independently placed map surface. */
  id?: string;
  /** Keep the equivalent records visible without a disclosure. Defaults to false. */
  expanded?: boolean;
};

/** Exact supplied records, independent of layer visibility and WebGL availability. */
export function NetworkMapDataView({
  id,
  expanded = false,
}: NetworkMapDataViewProps) {
  const { props: options, accessibleName } = useNetworkMap();
  const suffixId = useId();
  const externalLabel = options["aria-labelledby"]?.trim();
  const labelledBy = (kind: string) =>
    externalLabel ? `${externalLabel} ${suffixId}-${kind}` : undefined;
  const { facilities, segments, areas, surface, onFacilitySelect } = options;
  if (!facilities.length && !segments.length && !areas.length && !surface)
    return null;
  const content = (
    <>
      {facilities.length > 0 && (
        <div
          className={styles.tableScroll}
          tabIndex={0}
          role="region"
          aria-label={`${accessibleName} location data`}
          aria-labelledby={labelledBy("locations")}
        >
          {externalLabel && (
            <span id={`${suffixId}-locations`} hidden>
              location data
            </span>
          )}
          <table>
            <caption>{accessibleName} — facility evidence</caption>
            <thead>
              <tr>
                <th scope="col">Location</th>
                <th scope="col">Coordinates (longitude, latitude)</th>
                <th scope="col">Facility cohort risk</th>
                <th scope="col">Baseline</th>
                <th scope="col">Evidence / scope</th>
                <th scope="col">Select</th>
              </tr>
            </thead>
            <tbody>
              {facilities.map((facility) => (
                <tr key={facility.id}>
                  <th scope="row">{facility.label}</th>
                  <td>{facility.coordinates.join(", ")}</td>
                  <td>
                    {facility.risk
                      ? `${exactProbability(facility.risk.probability)} · ${facility.risk.status}`
                      : "Unavailable"}
                  </td>
                  <td>
                    {facility.risk
                      ? exactProbability(facility.risk.baseline)
                      : "Unavailable"}
                  </td>
                  <td>
                    {facility.risk
                      ? `${facility.risk.event}; next ${facility.risk.horizonHours} hours; ${facility.risk.cohort}; as of ${facility.risk.asOf}`
                      : (facility.detail ?? "No risk estimate")}
                  </td>
                  <td>
                    <button
                      type="button"
                      aria-label={`Select row: ${facility.label}`}
                      disabled={!onFacilitySelect}
                      onClick={() => onFacilitySelect?.(facility.id)}
                    >
                      Select
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {segments.length > 0 && (
        <div
          className={styles.tableScroll}
          role="region"
          tabIndex={0}
          aria-label={`${accessibleName} connection data`}
          aria-labelledby={labelledBy("connections")}
        >
          {externalLabel && (
            <span id={`${suffixId}-connections`} hidden>
              connection data
            </span>
          )}
          <table>
            <caption>Connections and exact flow data</caption>
            <thead>
              <tr>
                <th scope="col">Connection</th>
                <th scope="col">From</th>
                <th scope="col">To</th>
                <th scope="col">Evidence</th>
                <th scope="col">Flow count</th>
                <th scope="col">Supplied path (longitude, latitude)</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((segment) => (
                <tr key={segment.id}>
                  <th scope="row">{segment.label}</th>
                  <td>{segment.from}</td>
                  <td>{segment.to}</td>
                  <td>{segment.evidence}</td>
                  <td>{exact(segment.volume)}</td>
                  <td>
                    {segment.coordinates
                      ?.map((point) => point.join(", "))
                      .join("; ") ??
                      "Endpoints only; no traveled path supplied"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {areas.length > 0 && (
        <div
          className={styles.tableScroll}
          tabIndex={0}
          role="region"
          aria-label={`${accessibleName} area data`}
          aria-labelledby={labelledBy("areas")}
        >
          {externalLabel && (
            <span id={`${suffixId}-areas`} hidden>
              area data
            </span>
          )}
          <table>
            <caption>Weather and disruption evidence</caption>
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col">Evidence</th>
                <th scope="col">Valid from</th>
                <th scope="col">Valid until</th>
                <th scope="col">Source</th>
                <th scope="col">Coordinates (longitude, latitude)</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((area) => (
                <tr key={area.id}>
                  <th scope="row">{area.label}</th>
                  <td>{area.evidence}</td>
                  <td>{area.validFrom}</td>
                  <td>{area.validUntil}</td>
                  <td>{area.source}</td>
                  <td>
                    {area.coordinates
                      .map((point) => point.join(", "))
                      .join("; ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {surface && (
        <div
          className={styles.tableScroll}
          tabIndex={0}
          role="region"
          aria-label={`${accessibleName} delivery surface data`}
          aria-labelledby={labelledBy("surface")}
        >
          {externalLabel && (
            <span id={`${suffixId}-surface`} hidden>
              delivery surface data
            </span>
          )}
          <p>
            Source: {surface.source} · As of: {surface.asOf}. IQR describes the
            supplied spread; observation counts are not statistical confidence.
          </p>
          <table>
            <caption>
              Delivery estimates — minutes and observation counts
            </caption>
            <thead>
              <tr>
                <th scope="col">Cell bounds (west, south; east, north)</th>
                <th scope="col">Median minutes</th>
                <th scope="col">IQR minutes</th>
                <th scope="col">Observations</th>
              </tr>
            </thead>
            <tbody>
              {surface.cells.map((cell, index) => (
                <tr
                  key={`${cell.lonMin}:${cell.latMin}:${cell.lonMax}:${cell.latMax}:${index}`}
                >
                  <th scope="row">
                    {cell.lonMin}, {cell.latMin}; {cell.lonMax}, {cell.latMax}
                  </th>
                  <td>{exact(cell.medianMinutes)}</td>
                  <td>{exact(cell.iqrMinutes)}</td>
                  <td>{exact(cell.n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
  return expanded ? (
    <div
      id={id}
      className={styles.data}
      style={visualizationTypographyStyle(options.typography)}
    >
      {content}
    </div>
  ) : (
    <details
      id={id}
      className={styles.data}
      style={visualizationTypographyStyle(options.typography)}
    >
      <summary>
        {facilities.length ? "Locations and exact data" : "View exact map data"}
      </summary>
      {content}
    </details>
  );
}
