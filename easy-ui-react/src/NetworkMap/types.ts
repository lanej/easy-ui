import type { Map as MapInstance, StyleSpecification } from "maplibre-gl";
import type { VisualizationTypography } from "../visualization/typography";

/** Geographic position in longitude, latitude order (WGS84 degrees). */
export type MapCoordinate = readonly [number, number];

/** Caller-supplied model output. A facility cohort score is not a parcel score. */
export type MapRisk = {
  /** Probability between zero and one; null is unknown, never zero risk. */
  probability: number | null;
  /** Comparable baseline probability, or null when unavailable. */
  baseline: number | null;
  /** Event whose probability is being estimated. */
  event: string;
  /** Forecast horizon in hours after asOf. */
  horizonHours: number;
  /** Cohort to which the estimate applies. */
  cohort: string;
  /** ISO timestamp when this model output was produced. */
  asOf: string;
  /** Freshness/coverage supplied by the application. */
  status: "current" | "stale" | "unavailable";
};

/** Facility or destination shared by the map, event list and application data. */
export type MapFacility = {
  /** Stable application identifier. */
  id: string;
  /** Human-readable location name. */
  label: string;
  /** Geographic position; this does not imply a live parcel position. */
  coordinates: MapCoordinate;
  /** Marker shape and accessible role description. */
  kind: "warehouse" | "hub" | "delivery" | "destination";
  /** Smallest zoom at which an unselected label should appear; defaults to 0. */
  labelMinZoom?: number;
  /** Higher values receive label placement priority; defaults to 0. */
  priority?: number;
  /** Additional accessible location context, such as last-observation age. */
  detail?: string;
  /** Optional caller-supplied marker fill color (any valid CSS color, e.g. a hex string or a
   *  `var(--token)` reference). Falls back to the kind-based scheme when absent. Risk and
   *  selection treatments (outline, box-shadow, size) still layer on top. */
  color?: string;
  /** Optional conditional risk for a stated facility cohort. */
  risk?: MapRisk;
};

/** A facility connection; only measured geometry establishes a traveled route. */
export type MapSegment = {
  /** Stable segment identifier. */
  id: string;
  /** Origin facility identifier. */
  from: string;
  /** Destination facility identifier. */
  to: string;
  /** Accessible transfer description, including time/coverage where relevant. */
  label: string;
  /** Evidence behind the connection. Transfer means endpoints only. */
  evidence: "transfer" | "measured" | "inferred" | "planned";
  /** Optional supported or explicitly inferred path geometry. Required for measured paths. */
  coordinates?: readonly MapCoordinate[];
  /** Nonnegative flow count used for relative width; applications own its window and denominator. */
  volume?: number;
  /** Optional caller-supplied line color (any valid MapLibre paint-property color, e.g. a hex string). Falls back to the evidence-based scheme when absent. */
  color?: string;
};

/** Weather/disruption polygon with source and time semantics. */
export type MapArea = {
  /** Stable area identifier. */
  id: string;
  /** Visible hazard description. */
  label: string;
  /** Polygon outer ring. The component closes an open ring. */
  coordinates: readonly MapCoordinate[];
  /** Whether the hazard is observed or forecast. */
  evidence: "observed" | "forecast";
  /** ISO start of the applicable interval. */
  validFrom: string;
  /** ISO end of the applicable interval. */
  validUntil: string;
  /** Observation provider or forecast issuer. */
  source: string;
};

/** One grid cell of a delivery-time field surface, roughly 150m on a side. */
export type MapSurfaceCell = {
  /** Southern latitude bound of the cell. */
  latMin: number;
  /** Northern latitude bound of the cell. */
  latMax: number;
  /** Western longitude bound of the cell. */
  lonMin: number;
  /** Eastern longitude bound of the cell. */
  lonMax: number;
  /** Median delivery time in minutes; null when unavailable. A real zero is a valid estimate. */
  medianMinutes: number | null;
  /** Interquartile range of delivery time in minutes for this cell; null when unavailable. */
  iqrMinutes: number | null;
  /** Observation count backing this cell. Only finite positive counts support a rendered estimate. */
  n: number;
};

/** A delivery-time snapshot with per-cell estimates, spread, and observation counts. */
export type MapSurface = {
  /** Grid cells composing this surface. */
  cells: readonly MapSurfaceCell[];
  /** ISO timestamp this surface was computed/valid as of. */
  asOf: string;
  /** Computation source or model identifier. */
  source: string;
};

/** Native MapLibre clustering configuration for dense facility groups. See `NetworkMapProps.clusterFacilities`. */
export type ClusterFacilitiesOptions = {
  /**
   * Maximum zoom at which facilities still cluster; above this zoom every facility renders
   * individually regardless of proximity. Passed through to MapLibre's `clusterMaxZoom`.
   * Defaults to 14.
   */
  maxZoom?: number;
  /**
   * Cluster radius in pixels, evaluated at zoom 0 (supercluster scales it at other zooms).
   * Passed through to MapLibre's `clusterRadius`. Defaults to 50.
   */
  radius?: number;
};

/** Explicit camera request; ordinary data updates never issue a camera request. */
export type MapFocus = {
  /** Change this value to repeat a request for the same locations. */
  revision: string | number;
  /** Facility identifiers whose bounds should be fitted. Pass an empty array when `bounds` should
   *  drive the fit instead (e.g. a surface-only consumer with no facilities). */
  facilityIds: readonly string[];
  /**
   * Explicit geographic bounding box to fit the camera to, in lieu of deriving bounds from
   * `facilityIds` — e.g. a delivery-time surface's own grid extent, which has no facilities to
   * fit to. When present, this wins over `facilityIds` (which normally wouldn't be populated
   * alongside it anyway). Omit to keep today's exact `facilityIds`-based fit.
   */
  bounds?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  /** Upper zoom bound for a fitted view; defaults to 12. */
  maxZoom?: number;
};

/** Built-in controls. An omitted or true flag shows a control only when it is applicable. */
export type NetworkMapControls = {
  /** Fit all valid facility locations. */
  fitAll?: boolean;
  /** Fit a selected drawable segment with valid endpoints. */
  selectedSegment?: boolean;
  /** Focus a valid facility referenced by latestFacilityId. */
  latestEvent?: boolean;
  /** Toggle risk treatments when a valid facility has a finite probability between zero and one. */
  risk?: boolean;
  /** Toggle weather when at least one area has valid polygon coordinates. */
  weather?: boolean;
  /** Toggle the delivery surface when a valid cell has a finite nonnegative estimate and positive observation count. */
  deliverySurface?: boolean;
  /** MapLibre zoom controls; defaults to true, independent of facility data. */
  navigation?: boolean;
  /** MapLibre distance scale; defaults to true, independent of facility data. */
  scale?: boolean;
};

/** Text for the built-in toolbar controls. */
export type NetworkMapControlLabels = {
  fitAll: string;
  selectedSegment: string;
  latestEvent: string;
  risk: string;
  weather: string;
  deliverySurface: string;
};

/** Layer visibility is independent of whether the corresponding control is shown. */
export type NetworkMapLayerVisibility = {
  risk: boolean;
  weather: boolean;
  deliverySurface: boolean;
};

/** Presentation and controlled selection contract for an optional geographic map. */
export type NetworkMapProps = {
  /** Optional visible heading. Independent of the description; null remains supported. */
  title?: string | null;
  /** Optional visible coverage, observation window or geographic context. */
  description?: string | null;
  /** Accessible name when the visible heading is omitted. Defaults to title, then "Map". */
  "aria-label"?: string;
  /** ID of a caller-owned heading; takes precedence over aria-label. */
  "aria-labelledby"?: string;
  /** IDs of caller-owned descriptions or an external equivalent data view. */
  "aria-describedby"?: string;
  /** Text sizes in CSS pixels, shared by DOM and engine labels. Changes remeasure placement. */
  typography?: VisualizationTypography;
  /** Caller-chosen MapLibre style URL or object, including source attribution. Keep object identity stable. */
  mapStyle: string | StyleSpecification;
  /** URL of the bundled MapLibre module worker matching the installed version. Keep stable across all maps in one application. */
  workerUrl: string;
  /** Locations in the current authorized cohort. */
  facilities?: readonly MapFacility[];
  /** Ordered connections in that cohort. */
  segments?: readonly MapSegment[];
  /** Optional time-filtered weather/disruption polygons. */
  areas?: readonly MapArea[];
  /** Optional delivery-time field surface, rendered as a data-driven fill layer. */
  surface?: MapSurface;
  /** Controlled location selection. */
  selectedFacilityId?: string;
  /** Show the selected facility details below the map; defaults to true. Set false when a linked panel already provides this context. */
  showSelectionDetails?: boolean;
  /** Receives marker, equivalent table, Selected leg destination or Latest events selection. */
  onFacilitySelect?: (id: string) => void;
  /** Controlled segment emphasis and Selected leg camera target. */
  selectedSegmentId?: string;
  /** Facility of the last observed event, never an interpolated current position. */
  latestFacilityId?: string;
  /** Location labels to prioritize alongside selection and last observation. */
  primaryFacilityIds?: readonly string[];
  /** Explicit camera command issued by application selection controls. */
  focus?: MapFocus;
  /** Initial view only; omit to fit all facilities once on mount. */
  initialView?: { center: MapCoordinate; zoom: number };
  /** Map height in CSS pixels; defaults to 560, minimum 220. */
  height?: number;
  /**
   * Configure individual built-in controls, or false to hide all of them. Omitted/true toolbar
   * flags show only applicable controls; false hides them. Empty toolbars are omitted. This does
   * not hide layer data or provider attribution. Navigation and scale changes apply without
   * recreating the map. Explicit flags take precedence over the legacy networkControls group.
   */
  controls?: false | NetworkMapControls;
  /** Override toolbar labels; fitAll defaults to "Fit all locations" for every map. */
  controlLabels?: Partial<NetworkMapControlLabels>;
  /**
   * Control any subset of layer visibility. Supplied fields follow these values; omitted fields
   * remain user-controlled. Hidden controls do not change visibility or prevent external updates.
   */
  layerVisibility?: Partial<NetworkMapLayerVisibility>;
  /** Initial values for uncontrolled layers. Defaults: risk on, weather and delivery surface off. */
  defaultLayerVisibility?: Partial<NetworkMapLayerVisibility>;
  /** Receives the full requested visibility after a toolbar toggle, including controlled fields. */
  onLayerVisibilityChange?: (visibility: NetworkMapLayerVisibility) => void;
  /** Receives initialization, tile or rendering errors. The data table remains available. */
  onRenderError?: (error: unknown) => void;
  /**
   * Escape hatch for custom styling and overlays this component's own typed props cannot express
   * (e.g. a custom `line-width` expression, a continuous facility-severity radius, or a highlight
   * mechanism that survives a fully-populated `MapSegment.color`). Fires once per initialized map instance,
   * after this component's own initial sources/layers have been added on `"load"` AND its own
   * first data/paint-property pass has already run — so a consumer's own `addSource`/`addLayer`/
   * `setPaintProperty`/`Marker` calls are guaranteed to layer on top of, never race, this
   * component's own baseline styling.
   *
   * Consumer paint overrides survive data, selection, and layer-visibility updates. Overriding
   * `easy-ui-observed`'s `line-color` takes ownership of that property's selection styling;
   * automatic color updates resume on the next component update after the consumer unsets the
   * property with `map.setPaintProperty("easy-ui-observed", "line-color", null)`.
   *
   * This component's own layer ids, useful for a consumer calling `map.setPaintProperty(...)`
   * against them directly: `"easy-ui-observed"` (transfer/measured evidence line layer) and
   * `"easy-ui-unobserved"` (planned/inferred evidence line layer). Its own sources are
   * `"easy-ui-transfers"` and `"easy-ui-weather"`.
   *
   * Does NOT re-fire on `facilities`/`segments`/other data updates — this component holds one
   * stable `Map` instance across those updates (a new instance is only created when `mapStyle` or
   * `workerUrl` change, remounting the map). A consumer that wants its own custom layers/markers
   * to react to ongoing data changes must retain the `map` instance itself (e.g. in a ref) and
   * manage its own update logic independently; this component's internal update effect never
   * calls back into `onMapReady`.
   */
  onMapReady?: (map: MapInstance) => void;
  /**
   * Opt-in native MapLibre clustering (via the `supercluster` library MapLibre bundles
   * internally) for dense facility groups — e.g. metro-scale co-located zip3s. Undefined (the
   * default) preserves today's exact behavior: every facility renders as its own always-visible,
   * always-interactive `Marker`, with click-to-select, severity risk styling and an accessible
   * role, regardless of how many facilities share a location.
   *
   * When set, facilities MapLibre's clustering currently merges together render as a `circle`
   * layer (radius/color bucketed by member count) plus a count label, drawn from a clustered
   * GeoJSON source — NOT as individual `Marker`s. This is captured once at mount, like `mapStyle`/
   * `workerUrl`: toggling it on an already-mounted map has no effect until the map remounts.
   *
   * Real tradeoff, stated plainly: while a facility is inside a cluster, it cannot be
   * individually selected, does not show its own severity risk badge, and is not reachable via
   * `selectedFacilityId`/`onFacilitySelect` — the same UX cost any clustering system pays.
   * Clicking a cluster flies the camera to that cluster's natural expansion zoom (MapLibre's
   * `getClusterExpansionZoom`), and supercluster's own zoom-based declustering splits it apart at
   * that point — each member facility then renders as its usual fully-interactive `Marker`, with
   * severity/selection/labels working exactly as when this prop is omitted.
   * `primaryFacilityIds`/`latestFacilityId`/`selectedFacilityId` are not currently forced out of a
   * cluster into their own marker — a caller that needs a specific facility to always stay
   * individually selectable alongside dense clustering should pick a `radius`/`maxZoom` that keeps
   * it separated at the zoom levels that matter, or leave this prop unset for that cohort.
   */
  clusterFacilities?: ClusterFacilitiesOptions;
  /**
   * Legacy initial delivery-surface visibility, read once at mount. Used only when
   * defaultLayerVisibility.deliverySurface is omitted; layerVisibility takes precedence.
   * @deprecated Use defaultLayerVisibility.deliverySurface instead.
   */
  initialDeliverySurfaceVisible?: boolean;
  /**
   * Legacy fallback for fitAll, selectedSegment, latestEvent, and risk controls. False hides that
   * group unless an individual controls flag overrides it. Other controls are unaffected.
   * Applicability still determines whether each control can appear.
   * @deprecated Use controls to configure individual controls instead.
   */
  networkControls?: boolean;
};
