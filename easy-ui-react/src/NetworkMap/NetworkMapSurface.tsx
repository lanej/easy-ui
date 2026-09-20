import React, { useEffect, useRef, useState } from "react";
import type {
  GeoJSONSource,
  Map as MapInstance,
  MapLayerMouseEvent,
  Marker,
} from "maplibre-gl";
import { loadMapEngine } from "./engine";
import {
  deliverySurfaceFilter,
  deliverySurfacePaint,
} from "./surfaceRendering";
import {
  areaData,
  facilityPointData,
  geographicBounds,
  placeLabels,
  segmentData,
  surfaceData,
  validCoordinate,
  validAreaCoordinates,
  validSurfaceBounds,
} from "./geometry";
import type { MapFacility, NetworkMapProps } from "./types";
import {
  NetworkMapProvider,
  useNetworkMap,
  useOptionalNetworkMap,
} from "./NetworkMapContext";
import {
  visualizationTypographyStyle,
  resolveVisualizationTypography,
} from "../visualization/typography";
import styles from "./NetworkMap.module.scss";

/** Rendering and engine lifecycle only. Compose under NetworkMapProvider to share state with companions,
 * or supply mapStyle/workerUrl and data directly for a standalone surface. Attribution is retained.
 */
export function NetworkMapSurface(
  options: NetworkMapProps | Record<string, never>,
) {
  const context = useOptionalNetworkMap();
  if (context) return <NetworkMapSurfaceView />;
  if (!options.mapStyle || !options.workerUrl) {
    throw new Error(
      "NetworkMapSurface requires NetworkMapProvider or mapStyle and workerUrl",
    );
  }
  return (
    <NetworkMapProvider {...(options as NetworkMapProps)}>
      <NetworkMapSurfaceView />
    </NetworkMapProvider>
  );
}

function NetworkMapSurfaceView() {
  const {
    props: options,
    controls,
    visibility,
    state,
    setState,
    zoom,
    setZoom,
    commands,
    surfaceOwner,
    accessibleName,
  } = useNetworkMap();
  const {
    facilities,
    segments,
    areas,
    surface,
    selectedFacilityId,
    onFacilitySelect,
    selectedSegmentId,
    latestFacilityId,
    height = 560,
  } = options;
  const container = useRef<HTMLDivElement>(null);
  const owner = useRef(Symbol("map surface"));
  const instance = useRef<MapInstance | null>(null);
  const refresh = useRef<(() => void) | null>(null);
  const refreshControls = useRef<(() => void) | null>(null);
  const latest = useRef(options);
  latest.current = options;

  const [basemapError, setBasemapError] = useState(false);
  const [retry, setRetry] = useState(0);

  const { risk, weather, deliverySurface } = visibility;
  const layers = useRef(visibility);
  layers.current = visibility;

  const flyToBounds = (
    bounds: [[number, number], [number, number]] | null,
    maxZoom = 12,
  ) => {
    const current = instance.current;
    if (!current || !bounds) return;
    current.fitBounds(bounds, {
      padding: { top: 70, bottom: 65, left: 65, right: 80 },
      maxZoom,
      duration: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 650,
    });
  };
  const fit = (ids: readonly string[], maxZoom = 12) => {
    const bounds = geographicBounds(
      latest.current.facilities
        .filter((f) => ids.includes(f.id))
        .map((f) => f.coordinates),
    );
    flyToBounds(bounds, maxZoom);
  };

  commands.current = {
    fitAll: () => {
      const p = latest.current;
      const validFacilities = p.facilities.filter((f) =>
        validCoordinate(f.coordinates),
      );
      const points = validFacilities.length
        ? validFacilities.map((f) => f.coordinates)
        : [
            ...p.areas
              .filter((area) => validAreaCoordinates(area.coordinates))
              .flatMap((area) => area.coordinates),
            ...(p.surface?.cells.filter(validSurfaceBounds).flatMap(
              (cell) =>
                [
                  [cell.lonMin, cell.latMin],
                  [cell.lonMax, cell.latMax],
                ] as [number, number][],
            ) ?? []),
          ];
      flyToBounds(geographicBounds(points), 11);
    },
    selectedSegment: () => {
      const p = latest.current;
      const segment = p.segments.find(
        (item) => item.id === p.selectedSegmentId,
      );
      if (segment) {
        p.onFacilitySelect?.(segment.to);
        fit([segment.from, segment.to], 13);
      }
    },
    latestEvent: () => {
      const id = latest.current.latestFacilityId;
      if (id) {
        latest.current.onFacilitySelect?.(id);
        fit([id], 12);
      }
    },
  };

  useEffect(() => {
    if (surfaceOwner.current && surfaceOwner.current !== owner.current)
      throw new Error("Use one NetworkMapSurface per NetworkMapProvider");
    surfaceOwner.current = owner.current;
    let disposed = false,
      observer: ResizeObserver | undefined;
    let markers: {
      facility: MapFacility;
      marker: Marker;
      button: HTMLButtonElement;
      label: HTMLSpanElement;
    }[] = [];
    // Guards the clustered-facility source's setData against re-triggering itself: MapLibre
    // fires "sourcedata" once its tiles finish (re-)loading, which update() also listens to in
    // order to resync which facilities currently render as individual Markers vs. a cluster.
    // Without this guard, an unconditional setData on every update() call would refire
    // "sourcedata" indefinitely.
    let lastClusterFacilities: typeof facilities | undefined;
    let lastFacilities: typeof facilities | undefined;
    let lastSegments: typeof segments | undefined;
    let lastAreas: typeof areas | undefined;
    let lastSurface: typeof surface;
    let positionLabels: (() => void) | undefined;
    const observedControls = new Set<Element>();
    const element = container.current!;
    setState("loading");
    setBasemapError(false);
    const fail = (error: unknown) => {
      if (disposed) return;
      window.clearTimeout(deadline);
      setState("error");
      latest.current.onRenderError?.(error);
    };
    const deadline = window.setTimeout(
      () =>
        fail(
          new Error(
            "Map initialization timed out; verify worker and basemap availability",
          ),
        ),
      30000,
    );
    loadMapEngine()
      .then((engine) => {
        if (disposed) return;
        engine.setWorkerUrl(latest.current.workerUrl);
        const initial = latest.current.initialView;
        const map = new engine.Map({
          container: element,
          style: latest.current.mapStyle,
          center: initial ? [...initial.center] : [-96, 38],
          zoom: initial?.zoom ?? 3,
          // Let MapLibre collapse attribution on narrow maps while keeping it accessible.
          attributionControl: {},
          renderWorldCopies: true,
          canvasContextAttributes: { antialias: true },
          cooperativeGestures: true,
        });
        instance.current = map;
        let navigation:
          | InstanceType<typeof engine.NavigationControl>
          | undefined;
        let scale: InstanceType<typeof engine.ScaleControl> | undefined;
        const updateControls = () => {
          const configured = latest.current.controls;
          const showNavigation =
            configured !== false && configured?.navigation !== false;
          const showScale = configured !== false && configured?.scale !== false;
          if (showNavigation && !navigation) {
            navigation = new engine.NavigationControl({ showCompass: false });
            map.addControl(navigation, "top-right");
          } else if (!showNavigation && navigation) {
            map.removeControl(navigation);
            navigation = undefined;
          }
          if (showScale && !scale) {
            scale = new engine.ScaleControl({
              maxWidth: 100,
              unit: "imperial",
            });
            map.addControl(scale, "bottom-left");
          } else if (!showScale && scale) {
            map.removeControl(scale);
            scale = undefined;
          }
          positionLabels?.();
        };
        refreshControls.current = updateControls;
        updateControls();
        map.on("error", (event) => {
          if (!disposed) {
            setBasemapError(true);
            latest.current.onRenderError?.(event.error);
          }
        });
        const position = () => {
          const p = latest.current,
            size = element.getBoundingClientRect();
          const candidates = markers.flatMap(({ facility: f, label }) => {
            const selected = f.id === p.selectedFacilityId,
              important =
                selected ||
                f.id === p.latestFacilityId ||
                p.primaryFacilityIds?.includes(f.id);
            if (!important && map.getZoom() < (f.labelMinZoom ?? 0)) return [];
            const longitude =
              f.coordinates[0] +
              Math.round(
                ((map.getCenter?.().lng ?? f.coordinates[0]) -
                  f.coordinates[0]) /
                  360,
              ) *
                360;
            const point = map.project([longitude, f.coordinates[1]]);
            label.style.maxWidth = `${Math.max(24, size.width - 50)}px`;
            const labelBounds = label.getBoundingClientRect();
            return [
              {
                id: f.id,
                x: point.x,
                y: point.y,
                width: Math.min(
                  size.width - 50,
                  labelBounds.width ||
                    label.scrollWidth ||
                    f.label.length *
                      resolveVisualizationTypography(p.typography).label *
                      0.65 +
                      22,
                ),
                height:
                  labelBounds.height ||
                  label.scrollHeight ||
                  resolveVisualizationTypography(p.typography).label * 1.5 + 10,
                priority:
                  (selected ? 1000 : 0) +
                  (important ? 500 : 0) +
                  (f.priority ?? 0),
              },
            ];
          });
          const controls = Array.from(
            element.querySelectorAll(".maplibregl-ctrl"),
          );
          for (const previous of observedControls) {
            if (!controls.includes(previous)) {
              observer?.unobserve?.(previous);
              observedControls.delete(previous);
            }
          }
          for (const control of controls) {
            if (!observedControls.has(control) && observer) {
              observer.observe(control);
              observedControls.add(control);
            }
          }
          const reserved = controls
            .map((control) => control.getBoundingClientRect())
            .filter((rect) => rect.width > 0 && rect.height > 0)
            .map((rect) => ({
              x: rect.left - size.left,
              y: rect.top - size.top,
              w: rect.width,
              h: rect.height,
            }));
          const placements = placeLabels(
            candidates,
            size.width,
            size.height,
            reserved,
          );
          markers.forEach(({ facility, label }) => {
            const at = placements.get(facility.id);
            label.style.visibility = at ? "visible" : "hidden";
            if (at) {
              // Projection/placement use the marker center; CSS offsets start at
              // the center-anchored button's top-left corner.
              label.style.left = `calc(50% + ${at.left}px)`;
              label.style.top = `calc(50% + ${at.top}px)`;
            }
          });
        };
        positionLabels = position;
        element.addEventListener("toggle", position, true);
        document.fonts?.addEventListener("loadingdone", position);
        document.fonts?.ready.then(() => {
          if (!disposed) position();
        });
        // Remember the value read back from MapLibre, which may clone/normalize an expression.
        // A different authored value belongs to the consumer (including onMapReady overrides),
        // so selection/data refreshes must leave it alone. Clearing it restores automatic color.
        let lastObservedColor: string | undefined;
        const update = () => {
          if (disposed || !map.getSource("easy-ui-transfers")) return;
          element.dataset.mapIdle = "false";
          const p = latest.current,
            css = getComputedStyle(element);
          const blue = css.getPropertyValue("--map-route").trim() || "#113abf";
          const muted = css.getPropertyValue("--map-muted").trim() || "#6a7e9d";
          if (p.facilities !== lastFacilities || p.segments !== lastSegments) {
            (map.getSource("easy-ui-transfers") as GeoJSONSource).setData(
              segmentData(p.facilities, p.segments),
            );
            lastFacilities = p.facilities;
            lastSegments = p.segments;
          }
          if (p.areas !== lastAreas) {
            (map.getSource("easy-ui-weather") as GeoJSONSource).setData(
              areaData(p.areas),
            );
            lastAreas = p.areas;
          }
          if (p.surface !== lastSurface) {
            (
              map.getSource("easy-ui-delivery-surface") as GeoJSONSource
            ).setData(surfaceData(p.surface?.cells ?? []));
            lastSurface = p.surface;
          }
          map.setFilter("easy-ui-selection", [
            "==",
            ["get", "id"],
            p.selectedSegmentId ?? "",
          ]);
          if (map.getSource("easy-ui-facility-clusters"))
            map.setLayoutProperty(
              "easy-ui-facility-cluster-count",
              "text-size",
              resolveVisualizationTypography(p.typography).label,
            );
          const observedColor = map.getPaintProperty(
            "easy-ui-observed",
            "line-color",
          );
          if (
            lastObservedColor === undefined ||
            observedColor == null ||
            JSON.stringify(observedColor) === lastObservedColor
          ) {
            map.setPaintProperty("easy-ui-observed", "line-color", [
              "coalesce",
              ["get", "color"],
              p.selectedSegmentId
                ? [
                    "case",
                    ["==", ["get", "id"], p.selectedSegmentId],
                    blue,
                    muted,
                  ]
                : blue,
            ]);
            lastObservedColor = JSON.stringify(
              map.getPaintProperty("easy-ui-observed", "line-color"),
            );
          }
          for (const id of ["easy-ui-weather-fill", "easy-ui-weather-edge"])
            map.setLayoutProperty(
              id,
              "visibility",
              layers.current.weather ? "visible" : "none",
            );
          map.setLayoutProperty(
            "easy-ui-delivery-surface-fill",
            "visibility",
            layers.current.deliverySurface ? "visible" : "none",
          );
          let visibleFacilities = p.facilities.filter((f) =>
            validCoordinate(f.coordinates),
          );
          const clusterSource = map.getSource("easy-ui-facility-clusters") as
            | GeoJSONSource
            | undefined;
          if (clusterSource) {
            if (p.facilities !== lastClusterFacilities) {
              lastClusterFacilities = p.facilities;
              clusterSource.setData(facilityPointData(p.facilities));
            }
            // MapLibre only reports which points are currently clustered vs. individual for tiles
            // it has already loaded — before that finishes this is empty, so every facility
            // starts out with no Marker until the "sourcedata" listener below reruns update().
            const unclustered = new Set(
              map
                .querySourceFeatures("easy-ui-facility-clusters", {
                  filter: ["!", ["has", "point_count"]],
                })
                .map((feature) => feature.properties?.id as string | undefined)
                .filter((id): id is string => id !== undefined),
            );
            visibleFacilities = visibleFacilities.filter((f) =>
              unclustered.has(f.id),
            );
          }
          const kept = new Set(visibleFacilities.map((f) => f.id));
          markers
            .filter((m) => !kept.has(m.facility.id))
            .forEach((m) => m.marker.remove());
          markers = markers.filter((m) => kept.has(m.facility.id));
          const markersById = new Map(
            markers.map((marker) => [marker.facility.id, marker]),
          );
          for (const f of visibleFacilities) {
            const existing = markersById.get(f.id);
            const button = existing?.button ?? document.createElement("button");
            button.type = "button";
            button.classList.add(styles.marker);
            button.dataset.kind = f.kind;
            button.dataset.selected = String(f.id === p.selectedFacilityId);
            button.dataset.latest = String(f.id === p.latestFacilityId);
            button.dataset.risk =
              layers.current.risk && f.risk
                ? f.risk.status === "current" && f.risk.probability !== null
                  ? f.risk.probability >= 0.15
                    ? "elevated"
                    : "normal"
                  : "unknown"
                : "off";
            button.title = f.label;
            button.disabled = !p.onFacilitySelect;
            button.setAttribute(
              "aria-label",
              `Select ${f.label}${f.detail ? `: ${f.detail}` : ""}`,
            );
            button.setAttribute(
              "aria-pressed",
              String(f.id === p.selectedFacilityId),
            );
            const dot =
              (existing?.button.firstElementChild as HTMLSpanElement) ??
              document.createElement("span");
            dot.className = styles.pin;
            if (f.color) {
              dot.style.setProperty("--map-facility-color", f.color);
            } else {
              dot.style.removeProperty("--map-facility-color");
            }
            dot.setAttribute("aria-hidden", "true");
            dot.textContent =
              f.kind === "warehouse"
                ? "▦"
                : f.kind === "destination"
                  ? "◇"
                  : "";
            const label = existing?.label ?? document.createElement("span");
            label.className = styles.markerLabel;
            label.dataset.mapLabel = "true";
            label.textContent = f.label;
            label.setAttribute("aria-hidden", "true");
            if (!existing) button.append(dot, label);
            if (!existing)
              button.addEventListener("click", () =>
                latest.current.onFacilitySelect?.(f.id),
              );
            if (existing) {
              existing.facility = f;
              existing.marker.setLngLat([...f.coordinates]);
            } else {
              const marker = new engine.Marker({
                element: button,
                anchor: "center",
              })
                .setLngLat([...f.coordinates])
                .addTo(map);
              markers.push({ facility: f, button, label, marker });
            }
          }
          position();
        };
        refresh.current = update;
        map.on("load", () => {
          if (disposed) return;
          const css = getComputedStyle(element);
          const blue = css.getPropertyValue("--map-route").trim() || "#113abf";
          const amber =
            css.getPropertyValue("--map-warning").trim() || "#9b5900";
          map.addSource("easy-ui-transfers", {
            type: "geojson",
            data: segmentData(
              latest.current.facilities,
              latest.current.segments,
            ),
          });
          map.addSource("easy-ui-weather", {
            type: "geojson",
            data: areaData(latest.current.areas ?? []),
          });
          map.addLayer({
            id: "easy-ui-weather-fill",
            type: "fill",
            source: "easy-ui-weather",
            paint: { "fill-color": amber, "fill-opacity": 0.12 },
          });
          map.addLayer({
            id: "easy-ui-weather-edge",
            type: "line",
            source: "easy-ui-weather",
            paint: {
              "line-color": amber,
              "line-width": 2,
              "line-dasharray": [3, 3],
            },
          });
          map.addSource("easy-ui-delivery-surface", {
            type: "geojson",
            data: surfaceData(latest.current.surface?.cells ?? []),
          });
          map.addLayer({
            id: "easy-ui-delivery-surface-fill",
            type: "fill",
            source: "easy-ui-delivery-surface",
            filter: deliverySurfaceFilter,
            paint: deliverySurfacePaint,
          });
          // The halo is behind evidence strokes/casing, keeping caller colors and dashes intact.
          map.addLayer({
            id: "easy-ui-selection",
            type: "line",
            source: "easy-ui-transfers",
            filter: [
              "==",
              ["get", "id"],
              latest.current.selectedSegmentId ?? "",
            ],
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": blue,
              "line-width": ["+", ["get", "width"], 10],
              "line-opacity": 0.45,
            },
          });
          map.addLayer({
            id: "easy-ui-casing",
            type: "line",
            source: "easy-ui-transfers",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#fff",
              "line-width": ["+", ["get", "width"], 3],
              "line-opacity": 0.85,
            },
          });
          map.addLayer({
            id: "easy-ui-observed",
            type: "line",
            source: "easy-ui-transfers",
            filter: [
              "in",
              ["get", "evidence"],
              ["literal", ["transfer", "measured"]],
            ],
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": ["coalesce", ["get", "color"], blue],
              "line-width": ["get", "width"],
              "line-opacity": 0.9,
            },
          });
          map.addLayer({
            id: "easy-ui-unobserved",
            type: "line",
            source: "easy-ui-transfers",
            filter: [
              "in",
              ["get", "evidence"],
              ["literal", ["planned", "inferred"]],
            ],
            paint: {
              "line-color": ["coalesce", ["get", "color"], amber],
              "line-width": 3,
              "line-dasharray": [2, 2],
            },
          });
          // A small white chevron on the route casing provides direction without a glyph service.
          const arrow = new Uint8Array(24 * 24 * 4);
          for (let y = 4; y < 20; y++)
            for (let x = 5; x < 20; x++) {
              if (Math.abs(x - (18 - Math.abs(y - 12))) <= 2) {
                const pixel = (y * 24 + x) * 4;
                arrow.set([255, 255, 255, 255], pixel);
              }
            }
          map.addImage("easy-ui-direction", {
            width: 24,
            height: 24,
            data: arrow,
          });
          map.addLayer({
            id: "easy-ui-direction",
            type: "symbol",
            source: "easy-ui-transfers",
            filter: [
              "in",
              ["get", "evidence"],
              ["literal", ["transfer", "measured"]],
            ],
            layout: {
              "symbol-placement": "line",
              "symbol-spacing": 130,
              "icon-image": "easy-ui-direction",
              "icon-size": 0.7,
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
            },
          });
          const cluster = latest.current.clusterFacilities;
          if (cluster) {
            // Captured once at mount, like mapStyle/workerUrl — see NetworkMapProps.clusterFacilities.
            map.addSource("easy-ui-facility-clusters", {
              type: "geojson",
              data: facilityPointData(latest.current.facilities),
              cluster: true,
              clusterMaxZoom: cluster.maxZoom ?? 14,
              clusterRadius: cluster.radius ?? 50,
            });
            map.addLayer({
              id: "easy-ui-facility-cluster-circles",
              type: "circle",
              source: "easy-ui-facility-clusters",
              filter: ["has", "point_count"],
              paint: {
                "circle-color": [
                  "step",
                  ["get", "point_count"],
                  "#51bbd6",
                  10,
                  "#f1c40f",
                  25,
                  "#e05a4e",
                ],
                "circle-radius": [
                  "step",
                  ["get", "point_count"],
                  16,
                  10,
                  20,
                  25,
                  26,
                ],
                "circle-stroke-width": 2,
                "circle-stroke-color": "#fff",
              },
            });
            map.addLayer({
              id: "easy-ui-facility-cluster-count",
              type: "symbol",
              source: "easy-ui-facility-clusters",
              filter: ["has", "point_count"],
              layout: {
                "text-field": ["get", "point_count_abbreviated"],
                "text-size": 12,
              },
              paint: { "text-color": "#1c1c1c" },
            });
            map.on(
              "click",
              "easy-ui-facility-cluster-circles",
              (event: MapLayerMouseEvent) => {
                const feature = event.features?.[0];
                const clusterId = feature?.properties?.cluster_id as
                  | number
                  | undefined;
                const source = map.getSource("easy-ui-facility-clusters") as
                  | GeoJSONSource
                  | undefined;
                if (!feature || clusterId === undefined || !source) return;
                source.getClusterExpansionZoom(clusterId).then((zoom) => {
                  if (disposed) return;
                  const [lng, lat] = (
                    feature.geometry as {
                      type: "Point";
                      coordinates: [number, number];
                    }
                  ).coordinates;
                  map.easeTo({ center: [lng, lat], zoom });
                });
              },
            );
            map.on("mouseenter", "easy-ui-facility-cluster-circles", () => {
              map.getCanvas().style.cursor = "pointer";
            });
            map.on("mouseleave", "easy-ui-facility-cluster-circles", () => {
              map.getCanvas().style.cursor = "";
            });
          }
          lastFacilities = latest.current.facilities;
          lastSegments = latest.current.segments;
          lastAreas = latest.current.areas;
          lastSurface = latest.current.surface;
          lastClusterFacilities = latest.current.facilities;
          update();
          // Fires after this mount's own sources/layers exist AND its own first data/paint pass
          // (the update() call above) has run, so a consumer's own overrides always land last.
          latest.current.onMapReady?.(map);
          window.clearTimeout(deadline);
          setState("ready");
          if (!initial) commands.current.fitAll();
          setZoom(map.getZoom());
        });
        map.on("move", position);
        map.on("moveend", () => {
          if (!disposed) setZoom(map.getZoom());
        });
        // MapLibre recomputes clustering per zoom level via its bundled supercluster index, and
        // reports the outcome through "sourcedata" (once isSourceLoaded) rather than through the
        // camera events above — this is what makes clusters split apart as the user zooms in.
        map.on("sourcedata", (event: { sourceId?: string }) => {
          if (
            !disposed &&
            event.sourceId === "easy-ui-facility-clusters" &&
            map.isSourceLoaded("easy-ui-facility-clusters")
          )
            refresh.current?.();
        });
        map.on("render", () => {
          if (!disposed)
            element.dataset.mapIdle = String(
              !map.isMoving() &&
                map.areTilesLoaded() &&
                Boolean(map.getSource("easy-ui-transfers")) &&
                map.isSourceLoaded("easy-ui-transfers"),
            );
        });
        map.on("idle", () => {
          if (!disposed) element.dataset.mapIdle = "true";
        });
        map.on("movestart", () => {
          element.dataset.mapIdle = "false";
        });
        observer = new ResizeObserver(() => {
          map.resize();
          position();
        });
        observer.observe(element);
      })
      .catch(fail);
    return () => {
      disposed = true;
      surfaceOwner.current = null;
      setState("loading");
      commands.current = {
        fitAll() {},
        selectedSegment() {},
        latestEvent() {},
      };
      window.clearTimeout(deadline);
      refresh.current = null;
      refreshControls.current = null;
      observer?.disconnect();
      if (positionLabels) {
        document.fonts?.removeEventListener("loadingdone", positionLabels);
        element.removeEventListener("toggle", positionLabels, true);
      }
      markers.forEach((m) => m.marker.remove());
      instance.current?.remove();
      instance.current = null;
    };
  }, [
    options.mapStyle,
    options.workerUrl,
    retry,
    commands,
    setState,
    setZoom,
    surfaceOwner,
  ]);

  useEffect(() => {
    refreshControls.current?.();
  }, [controls.navigation, controls.scale]);

  useEffect(() => {
    refresh.current?.();
  }, [
    facilities,
    segments,
    areas,
    surface,
    selectedFacilityId,
    selectedSegmentId,
    latestFacilityId,
    options.primaryFacilityIds,
    onFacilitySelect,
    options.typography,
    risk,
    weather,
    deliverySurface,
  ]);
  useEffect(() => {
    if (state !== "ready" || !options.focus) return;
    const { bounds, facilityIds, maxZoom } = options.focus;
    if (bounds) {
      flyToBounds(
        [
          [bounds.minLon, bounds.minLat],
          [bounds.maxLon, bounds.maxLat],
        ],
        maxZoom ?? 12,
      );
    } else {
      fit(facilityIds, maxZoom);
    }
    // A camera request is keyed by revision. Data updates do not recenter the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.focus?.revision, state]);
  useEffect(() => {
    instance.current?.resize();
  }, [height]);

  return (
    <div
      className={styles.viewport}
      data-map-state={state}
      data-map-zoom={zoom.toFixed(2)}
      role="region"
      aria-label={options["aria-labelledby"] ? undefined : accessibleName}
      aria-labelledby={options["aria-labelledby"]}
      aria-describedby={options["aria-describedby"]}
      style={visualizationTypographyStyle(options.typography)}
    >
      <div
        ref={container}
        className={styles.canvas}
        style={{ height: Math.max(220, height) }}
      />
      {state !== "ready" && (
        <div
          className={styles.message}
          role={state === "error" ? "alert" : "status"}
        >
          {state === "error" ? "Unable to display the map." : "Loading map…"}
          {state === "error" && (
            <button type="button" onClick={() => setRetry((n) => n + 1)}>
              Retry map
            </button>
          )}
        </div>
      )}
      {basemapError && (
        <p className={styles.warning} role="status">
          Some basemap data could not load.{" "}
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            Reload map
          </button>
        </p>
      )}
    </div>
  );
}
