import React, {
  createContext,
  ReactNode,
  useContext,
  useRef,
  useState,
} from "react";
import { useMapInspection } from "./useMapInspection";
import { resolveMapControls } from "./controls";
import { useLayerVisibility } from "./useLayerVisibility";
import { useSurfaceMetric } from "./useSurfaceMetric";
import { useOverlayVisibility } from "./useOverlayVisibility";
import { useMapInsets } from "./useMapInsets";
import type { Map as MapInstance } from "maplibre-gl";
import type {
  MapArea,
  MapFacility,
  MapFocus,
  MapSegment,
  NetworkMapProps,
} from "./types";

const emptyFacilities: readonly MapFacility[] = [];
const emptySegments: readonly MapSegment[] = [];
const emptyAreas: readonly MapArea[] = [];
type MapState = "loading" | "ready" | "error";
type MapCommands = {
  focus: (target: MapFocus) => void;
  fitAll: () => void;
  selectedSegment: () => void;
  latestEvent: () => void;
};

/** The overview supplies its metric selection to close-ups that share its legend. */
export const NetworkMapMetricContext = createContext<ReturnType<
  typeof useSurfaceMetric
> | null>(null);

function useMapState(input: NetworkMapProps) {
  const { resolvedOverlays, changeOverlayVisibility } =
    useOverlayVisibility(input);
  const props = {
    ...input,
    facilities: input.facilities ?? emptyFacilities,
    segments: input.segments ?? emptySegments,
    areas: input.areas ?? emptyAreas,
    overlays: resolvedOverlays,
  };
  const mapInspection = useMapInspection(props);
  const insets = useMapInsets(props);
  const { visibility, changeVisibility } = useLayerVisibility(props);
  const localMetric = useSurfaceMetric(props.surface?.metrics);
  const { activeMetric, setActiveMetric } =
    useContext(NetworkMapMetricContext) ?? localMetric;
  const [state, setState] = useState<MapState>("loading");
  const [zoom, setZoom] = useState(0);
  const surfaceOwner = useRef<symbol | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const commands = useRef<MapCommands>({
    focus() {},
    fitAll() {},
    selectedSegment() {},
    latestEvent() {},
  });
  return {
    props,
    mapInspection,
    visibility,
    changeVisibility,
    changeOverlayVisibility,
    activeMetric,
    setActiveMetric,
    state,
    setState,
    zoom,
    setZoom,
    commands,
    surfaceOwner,
    mapRef,
    insets,
    accessibleName: props["aria-label"] || props.title || "Map",
    controls: resolveMapControls(props),
  };
}

const NetworkMapContext = createContext<ReturnType<typeof useMapState> | null>(
  null,
);

/** Share one map's data, visibility, camera actions and selection with independently placed companions. */
export function NetworkMapProvider({
  children,
  ...props
}: NetworkMapProps & { children: ReactNode }) {
  const value = useMapState(props);
  return (
    <NetworkMapContext.Provider value={value}>
      {children}
    </NetworkMapContext.Provider>
  );
}

export function useOptionalNetworkMap() {
  return useContext(NetworkMapContext);
}
export function useNetworkMap() {
  const context = useOptionalNetworkMap();
  if (!context) throw new Error("Map companions require NetworkMapProvider");
  return context;
}
