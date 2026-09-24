import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapInstance, MapLayerMouseEvent } from "maplibre-gl";
import { surfaceCellKey, validSurfaceBounds } from "./geometry";
import { hasSupportedSurfaceMetric } from "./surfaceRendering";
import type { MapSurfaceMetric, NetworkMapProps } from "./types";

type Inspection = { key: string; x: number; y: number; pinned: boolean };

/** Keep pointer events independent of the map's engine lifecycle and preserve original records. */
export function useSurfaceInspection(
  options: NetworkMapProps,
  visible: boolean,
  field: MapSurfaceMetric["field"] = "medianMinutes",
) {
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const cells = useMemo(
    () =>
      new Map(
        options.surface?.cells.map((cell) => [surfaceCellKey(cell), cell]),
      ),
    [options.surface?.cells],
  );
  const latest = useRef({ options, visible, cells, field });
  latest.current = { options, visible, cells, field };
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hovering = useRef<string | null>(null);
  const dismissed = useRef<string | null>(null);
  const cancelLeave = useCallback(() => clearTimeout(timer.current), []);
  const clearHover = useCallback(() => {
    if (hovering.current !== null) latest.current.options.onCellHover?.(null);
    hovering.current = null;
  }, []);
  const close = useCallback(() => {
    cancelLeave();
    dismissed.current = hovering.current;
    clearHover();
    setInspection(null);
  }, [cancelLeave, clearHover]);
  const leave = useCallback(() => {
    cancelLeave();
    clearHover();
    dismissed.current = null;
    // The gap lets a pointer enter the card without losing its content.
    timer.current = setTimeout(() => {
      setInspection((current) => (current?.pinned ? current : null));
    }, 180);
  }, [cancelLeave, clearHover]);
  const resolve = useCallback((event: MapLayerMouseEvent) => {
    const { options, visible, cells, field } = latest.current;
    if (!visible || !options.surface) return;
    // DOM facility controls can overlap the fill. Their clicks retain facility semantics.
    const target = event.originalEvent?.target;
    if (target instanceof Element && target.closest("button")) return;
    const key = event.features?.[0]?.properties?.cellKey;
    const cell = cells.get(key);
    if (
      cell &&
      validSurfaceBounds(cell) &&
      hasSupportedSurfaceMetric(cell, field)
    )
      return { cell, key: surfaceCellKey(cell) };
  }, []);
  const hover = useCallback(
    (event: MapLayerMouseEvent) => {
      const match = resolve(event);
      if (!match) return;
      cancelLeave();
      hovering.current = match.key;
      latest.current.options.onCellHover?.(match.cell);
      if (
        latest.current.options.showCellDetails === false ||
        dismissed.current === match.key
      )
        return;
      setInspection((current) =>
        current?.pinned
          ? current
          : {
              key: match.key,
              x: event.point.x,
              y: event.point.y,
              pinned: false,
            },
      );
    },
    [resolve, cancelLeave],
  );
  const select = useCallback(
    (event: MapLayerMouseEvent) => {
      const match = resolve(event);
      if (!match) return;
      cancelLeave();
      dismissed.current = null;
      latest.current.options.onCellSelect?.(match.cell);
      if (latest.current.options.showCellDetails === false) return;
      setInspection({
        key: match.key,
        x: event.point.x,
        y: event.point.y,
        pinned: true,
      });
    },
    [resolve, cancelLeave],
  );
  const pin = useCallback(() => {
    setInspection((current) =>
      current && !current.pinned ? { ...current, pinned: true } : current,
    );
  }, []);
  const move = useCallback(
    (map: MapInstance) => {
      setInspection((current) => {
        if (!current?.pinned) return null;
        const cell = latest.current.cells.get(current.key);
        if (!cell) return null;
        const point = map.project([
          (cell.lonMin + cell.lonMax) / 2,
          (cell.latMin + cell.latMax) / 2,
        ]);
        return { ...current, x: point.x, y: point.y };
      });
      clearHover();
    },
    [clearHover],
  );

  const cell = inspection && cells.get(inspection.key);
  useEffect(() => {
    if (
      !visible ||
      options.showCellDetails === false ||
      (inspection && (!cell || !hasSupportedSurfaceMetric(cell, field)))
    )
      close();
    else if (hovering.current && !cells.has(hovering.current)) clearHover();
  }, [
    visible,
    options.showCellDetails,
    inspection,
    cell,
    cells,
    field,
    close,
    clearHover,
  ]);
  useEffect(
    () => () => {
      cancelLeave();
      clearHover();
    },
    [cancelLeave, clearHover],
  );

  const events = useMemo(
    () => ({ hover, select, leave, close, move }),
    [hover, select, leave, close, move],
  );
  return {
    inspection: visible && cell ? inspection : null,
    cell,
    events,
    pin,
    cancelLeave,
  };
}
