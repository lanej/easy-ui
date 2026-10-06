import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapInstance } from "maplibre-gl";
import type {
  MapOverlayDetailsContext,
  MapOverlaySelection,
  NetworkMapProps,
} from "./types";

type Inspection = MapOverlaySelection & { x: number; y: number };

export function useOverlayInspection(options: NetworkMapProps) {
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const close = useCallback(() => setInspection(null), []);
  const select = useCallback(
    (selection: MapOverlaySelection, map: MapInstance) => {
      if (!latest.current.renderOverlayDetails || !selection.coordinate) {
        close();
        return;
      }
      const point = map.project([...selection.coordinate]);
      setInspection({ ...selection, x: point.x, y: point.y });
    },
    [close],
  );
  const move = useCallback((map: MapInstance) => {
    setInspection((current) => {
      if (!current?.coordinate) return current;
      const point = map.project([...current.coordinate]);
      return { ...current, x: point.x, y: point.y };
    });
  }, []);
  const overlay = options.overlays?.find(
    (candidate) => candidate.id === inspection?.overlayId,
  );
  const feature = useMemo(() => {
    if (!inspection || !overlay) return undefined;
    if (overlay.data.features.includes(inspection.feature))
      return inspection.feature;
    if (inspection.feature.id === undefined) return undefined;
    const matches = overlay.data.features.filter(
      (candidate) => candidate.id === inspection.feature.id,
    );
    return matches.length === 1 ? matches[0] : undefined;
  }, [inspection, overlay]);
  const context: MapOverlayDetailsContext | null =
    inspection &&
    feature &&
    overlay &&
    overlay.visible !== false &&
    overlay.layers.some((layer) => layer.layout?.visibility !== "none") &&
    options.renderOverlayDetails
      ? {
          overlayId: overlay.id,
          overlay,
          feature,
          coordinate: inspection.coordinate,
        }
      : null;
  const hasContext = context !== null;
  useEffect(() => {
    if (inspection && !hasContext) close();
  }, [inspection, hasContext, close]);
  const events = useMemo(
    () => ({ close, select, move }),
    [close, select, move],
  );
  return { inspection: context ? inspection : null, context, events };
}
