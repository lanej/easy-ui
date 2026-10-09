import React, { useId, useMemo, type ReactNode } from "react";
import { Button } from "../Button";
import { Text } from "../Text";
import { EventTimeline, type EventTimelineProps } from "../EventTimeline";
import {
  NetworkMap,
  type NetworkMapProps,
  type MapOverlay,
  type MapOverlayHoverDetailsContext,
} from "../NetworkMap";
import { segmentData } from "../NetworkMap/geometry";
import {
  resolveSelection,
  selectEvent,
  type InvestigationDetailsContext,
  type InvestigationRecords,
  type InvestigationSelection,
} from "./selection";
import styles from "./InvestigationWorkspace.module.scss";

type MapOptions = Omit<
  NetworkMapProps,
  | "facilities"
  | "segments"
  | "selectedFacilityId"
  | "selectedSegmentId"
  | "onFacilitySelect"
  | "showSelectionDetails"
  | "clusterFacilities"
>;

export type InvestigationWorkspaceProps = InvestigationRecords & {
  selection: InvestigationSelection;
  onSelectionChange: (selection: InvestigationSelection) => void;
  /** Existing map options, including basemap and worker. Selection is owned by the workspace. */
  map: MapOptions;
  /** Caller content below the persistent selection summary; may include charts and actions. */
  renderDetails?: (context: InvestigationDetailsContext) => ReactNode;
  /** Reuse the timeline's optional content slots and density. */
  timeline?: Pick<
    EventTimelineProps,
    | "renderTrailing"
    | "renderInterval"
    | "renderDetails"
    | "size"
    | "emptyLabel"
  >;
  ariaLabel?: string;
  labels?: Partial<
    Record<
      | "timeline"
      | "map"
      | "details"
      | "paths"
      | "clear"
      | "previous"
      | "next"
      | "empty",
      string
    >
  >;
};

/** Linked, controlled inspection of supplied observations, candidate histories and locations. */
export function InvestigationWorkspace({
  events,
  locations,
  segments,
  paths,
  selection,
  onSelectionChange,
  map,
  timeline,
  renderDetails,
  ariaLabel = "Event investigation",
  labels,
}: InvestigationWorkspaceProps) {
  const id = useId();
  const overlayId = `${id}-investigation-connections`;
  const context = resolveSelection(
    { events, locations, segments, paths },
    selection,
  );
  const { event, location, path, segment, isAvailable } = context;
  const text = {
    timeline: "Events",
    map: "Locations and connections",
    details: "Selection details",
    paths: "Candidate paths",
    clear: "Clear selection",
    previous: "Previous event",
    next: "Next event",
    empty: "Select an event, location, or candidate path.",
    ...labels,
  };
  const selectedSegments = new Set(
    segment
      ? [segment.id]
      : context.paths.flatMap((item) => [...item.segmentIds]),
  );
  // Membership is presentation only: do not infer geometry or remove conflicting records.
  const geometry = useMemo(
    () => segmentData(locations, segments),
    [locations, segments],
  );
  const connections: MapOverlay = {
    id: overlayId,
    label: "Investigation connections",
    data: {
      ...geometry,
      features: geometry.features.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          selected: selectedSegments.has(String(feature.id)),
          label: segments.find((item) => item.id === feature.id)?.label,
        },
      })),
    },
    layers: [
      {
        id: "selection",
        type: "line",
        filter: ["==", ["get", "selected"], true],
        paint: {
          "line-color": "#608cff",
          "line-width": 12,
          "line-opacity": 0.35,
        },
      },
      {
        id: "hit-area",
        type: "line",
        paint: { "line-color": "#608cff", "line-width": 18, "line-opacity": 0 },
      },
    ],
  };
  const chooseEvent = (eventId: string) =>
    onSelectionChange(selectEvent(context, eventId));
  const index = context.events.findIndex((item) => item.id === event?.id);
  const title = !isAvailable
    ? "Selection unavailable"
    : (event?.label ??
      location?.label ??
      path?.label ??
      segment?.label ??
      text.details);
  const description =
    event?.description ?? path?.description ?? location?.detail;
  const inspectConnections = (hover: MapOverlayHoverDetailsContext) => {
    const hits = hover.selections.filter(
      (item) => item.overlayId === overlayId,
    );
    const external = {
      ...hover,
      overlays: hover.overlays.filter((item) => item.id !== overlayId),
      selections: hover.selections.filter(
        (item) => item.overlayId !== overlayId,
      ),
    };
    return (
      <>
        {hits.map(({ feature }) => {
          const connection = segments.find((item) => item.id === feature.id);
          if (!connection) return null;
          const candidates = paths.filter((item) =>
            item.segmentIds.includes(connection.id),
          );
          return (
            <div className={styles.preview} key={connection.id}>
              <strong>{connection.label}</strong>
              <span>
                {candidates.map((item) => item.label).join(" · ") ||
                  "No candidate membership supplied"}
              </span>
              <Button
                size="sm"
                variant="text"
                onPress={() =>
                  onSelectionChange({
                    type: "segment",
                    segmentId: connection.id,
                  })
                }
              >
                Inspect connection
              </Button>
            </div>
          );
        })}
        {external.overlays.length > 0 &&
          (map.renderOverlayHoverDetails
            ? map.renderOverlayHoverDetails(external)
            : external.selections.map((item, index) => (
                <React.Fragment key={index}>
                  {map.renderOverlayDetails?.(item)}
                </React.Fragment>
              )))}
      </>
    );
  };
  return (
    <section className={styles.root} aria-label={ariaLabel}>
      {paths.length > 0 && (
        <div className={styles.paths} role="group" aria-label={text.paths}>
          <Text as="span" variant="caption" color="subdued">
            {text.paths}
          </Text>
          {paths.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={path?.id === item.id ? "filled" : "outlined"}
              aria-pressed={path?.id === item.id}
              onPress={() =>
                onSelectionChange({ type: "path", pathId: item.id })
              }
            >
              {item.label}
            </Button>
          ))}
        </div>
      )}
      <div className={styles.layout}>
        <section className={styles.timeline} aria-labelledby={`${id}-events`}>
          <div className={styles.heading}>
            <Text as="h3" variant="heading5" id={`${id}-events`}>
              {text.timeline}
            </Text>
            <Text as="span" variant="caption" color="subdued">
              {events.length}
            </Text>
          </div>
          <EventTimeline
            {...timeline}
            events={events}
            selectedId={event?.id ?? null}
            onSelectedIdChange={chooseEvent}
            ariaLabel={text.timeline}
          />
        </section>
        <section className={styles.map} aria-label={text.map}>
          <NetworkMap
            {...map}
            aria-label={map["aria-label"] ?? text.map}
            facilities={locations}
            segments={segments}
            selectedFacilityId={location?.id}
            selectedSegmentId={segment?.id}
            onFacilitySelect={(locationId) =>
              onSelectionChange({ type: "location", locationId })
            }
            overlays={[...(map.overlays ?? []), connections]}
            onOverlaySelect={(hit) => {
              if (hit.overlayId === overlayId)
                onSelectionChange({
                  type: "segment",
                  segmentId: String(hit.feature.id),
                });
              else map.onOverlaySelect?.(hit);
            }}
            renderFacilityDetails={
              map.renderFacilityDetails ??
              (({ facility }) => (
                <div className={styles.preview}>
                  <strong>{facility.label}</strong>
                  <span>
                    {
                      events.filter((item) => item.locationId === facility.id)
                        .length
                    }{" "}
                    associated events
                  </span>
                </div>
              ))
            }
            renderOverlayHoverDetails={inspectConnections}
            showSelectionDetails={false}
            showLegend={map.showLegend ?? false}
            showDataTable={map.showDataTable ?? false}
            height={map.height ?? 340}
          />
          <details className={styles.index}>
            <summary>Browse locations and connections</summary>
            <div className={styles.indexItems}>
              {locations.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant="text"
                  aria-pressed={location?.id === item.id}
                  onPress={() =>
                    onSelectionChange({ type: "location", locationId: item.id })
                  }
                >
                  {item.label}
                </Button>
              ))}
              {segments.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant="text"
                  aria-pressed={segment?.id === item.id}
                  onPress={() =>
                    onSelectionChange({ type: "segment", segmentId: item.id })
                  }
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </details>
        </section>
        <section className={styles.details} aria-label={text.details}>
          <div className={styles.heading}>
            <Text as="h3" variant="heading5">
              {title}
            </Text>
            {selection && (
              <Button
                size="sm"
                variant="text"
                onPress={() => onSelectionChange(null)}
              >
                {text.clear}
              </Button>
            )}
          </div>
          <span className={styles.announcement} role="status">
            {selection ? title : "Selection cleared"}
          </span>
          {!selection ? (
            <Text as="p" color="subdued">
              {text.empty}
            </Text>
          ) : !isAvailable ? (
            <Text as="p" color="subdued">
              The selected record is no longer in this view.
            </Text>
          ) : (
            <>
              {selection.eventId !== undefined && !event && (
                <Text as="p" variant="body2" color="subdued">
                  The selected event is not available in this context.
                </Text>
              )}
              {segment && (
                <dl className={styles.facts}>
                  <div>
                    <dt>From</dt>
                    <dd>
                      {locations.find((item) => item.id === segment.from)
                        ?.label ?? segment.from}
                    </dd>
                  </div>
                  <div>
                    <dt>To</dt>
                    <dd>
                      {locations.find((item) => item.id === segment.to)
                        ?.label ?? segment.to}
                    </dd>
                  </div>
                  <div>
                    <dt>Evidence</dt>
                    <dd>{segment.evidence}</dd>
                  </div>
                </dl>
              )}
              {event && (
                <dl className={styles.facts}>
                  <div>
                    <dt>Event time</dt>
                    <dd>{event.timeLabel ?? "Unknown"}</dd>
                  </div>
                  {event.receivedTimeLabel && (
                    <div>
                      <dt>Received</dt>
                      <dd>{event.receivedTimeLabel}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Location</dt>
                    <dd>
                      {event.locationLabel ?? location?.label ?? "Not supplied"}
                    </dd>
                  </div>
                </dl>
              )}
              {description && (
                <Text as="p" variant="body2" color="subdued">
                  {description}
                </Text>
              )}
              {context.paths.length > 0 && selection.type !== "path" && (
                <div className={styles.memberships}>
                  <Text as="span" variant="caption" color="subdued">
                    {text.paths}
                  </Text>
                  {context.paths.map((item) => (
                    <Button
                      key={item.id}
                      size="sm"
                      variant="text"
                      onPress={() =>
                        onSelectionChange({ type: "path", pathId: item.id })
                      }
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              )}
              {selection.type !== "event" && (
                <div className={styles.associated}>
                  <Text as="p" variant="caption" color="subdued">
                    {context.events.length} associated events
                  </Text>
                  <div className={styles.eventChoices}>
                    {context.events.map((item) => (
                      <Button
                        key={item.id}
                        variant="text"
                        size="sm"
                        aria-pressed={item.id === event?.id}
                        onPress={() => chooseEvent(item.id)}
                      >
                        {item.timeLabel ?? "Time unknown"} · {item.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {context.events.length > 0 && (
                <nav className={styles.stepping} aria-label="Event navigation">
                  <Button
                    size="sm"
                    variant="outlined"
                    isDisabled={index <= 0}
                    onPress={() => chooseEvent(context.events[index - 1].id)}
                  >
                    {text.previous}
                  </Button>
                  <Text as="span" variant="caption" color="subdued">
                    {index < 0
                      ? `${context.events.length} events`
                      : `${index + 1} / ${context.events.length}`}
                  </Text>
                  <Button
                    size="sm"
                    variant="outlined"
                    isDisabled={index === context.events.length - 1}
                    onPress={() => chooseEvent(context.events[index + 1].id)}
                  >
                    {text.next}
                  </Button>
                </nav>
              )}
              {renderDetails && (
                <div className={styles.content}>{renderDetails(context)}</div>
              )}
            </>
          )}
        </section>
      </div>
    </section>
  );
}
