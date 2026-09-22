import React, {
  createContext,
  ReactNode,
  useContext,
  useRef,
  useState,
} from "react";
import { resolveMapControls } from "./controls";
import { useLayerVisibility } from "./useLayerVisibility";
import { useSurfaceMetric } from "./useSurfaceMetric";
import type {
  MapArea,
  MapFacility,
  MapSegment,
  NetworkMapProps,
} from "./types";

const emptyFacilities: readonly MapFacility[] = [];
const emptySegments: readonly MapSegment[] = [];
const emptyAreas: readonly MapArea[] = [];
type MapState = "loading" | "ready" | "error";
type MapCommands = {
  fitAll: () => void;
  selectedSegment: () => void;
  latestEvent: () => void;
};

function useMapState(input: NetworkMapProps) {
  const props = {
    ...input,
    facilities: input.facilities ?? emptyFacilities,
    segments: input.segments ?? emptySegments,
    areas: input.areas ?? emptyAreas,
  };
  const { visibility, changeVisibility } = useLayerVisibility(props);
  const { activeMetric, setActiveMetric } = useSurfaceMetric(
    props.surface?.metrics,
  );
  const [state, setState] = useState<MapState>("loading");
  const [zoom, setZoom] = useState(0);
  const surfaceOwner = useRef<symbol | null>(null);
  const commands = useRef<MapCommands>({
    fitAll() {},
    selectedSegment() {},
    latestEvent() {},
  });
  return {
    props,
    visibility,
    changeVisibility,
    activeMetric,
    setActiveMetric,
    state,
    setState,
    zoom,
    setZoom,
    commands,
    surfaceOwner,
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
