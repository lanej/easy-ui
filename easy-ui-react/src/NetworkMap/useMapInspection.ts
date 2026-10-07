import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Map as MapInstance } from "maplibre-gl";
import type {
  MapCoordinate,
  MapInspectionTarget,
  MapOverlaySelection,
  NetworkMapProps,
} from "./types";
import { overlayCoordinates } from "./overlays";

type Inspection = {
  key: string;
  facilityId?: string;
  overlayId?: string;
  selections?: readonly MapOverlaySelection[];
  coordinate?: MapCoordinate;
  anchor?: HTMLElement;
  x: number;
  y: number;
  pinned: boolean;
};

/** Shared facility/overlay inspection for engine events and public DOM triggers. */
export function useMapInspection(options: NetworkMapProps) {
  const id = useId();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const current = useRef<Inspection | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const card = useRef<HTMLDivElement>(null);
  const engine = useRef<{ map: MapInstance; element: HTMLElement } | null>(
    null,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dismissed = useRef<{ key: string; anchor?: HTMLElement } | null>(null);
  const anonymous = useRef(new WeakMap<object, number>());
  const nextAnonymous = useRef(0);
  const update = useCallback((value: Inspection | null) => {
    current.current = value;
    setInspection(value);
  }, []);
  const keep = useCallback(() => clearTimeout(timer.current), []);
  const close = useCallback(() => {
    keep();
    if (current.current)
      dismissed.current = {
        key: current.current.key,
        anchor: current.current.anchor,
      };
    update(null);
  }, [keep, update]);
  const leave = useCallback(
    (related?: EventTarget | null) => {
      const anchor = current.current?.anchor;
      if (
        related instanceof Node &&
        (card.current?.contains(related) || anchor?.contains(related))
      )
        return keep();
      if (
        anchor?.contains(document.activeElement) ||
        card.current?.contains(document.activeElement)
      )
        return keep();
      keep();
      dismissed.current = null;
      timer.current = setTimeout(() => {
        if (!current.current?.pinned) update(null);
      }, 180);
    },
    [keep, update],
  );
  const show = useCallback(
    (next: Inspection) => {
      keep();
      if (
        !next.pinned &&
        (current.current?.pinned ||
          (dismissed.current?.key === next.key &&
            dismissed.current.anchor === next.anchor))
      )
        return;
      if (next.pinned) dismissed.current = null;
      update(next);
    },
    [keep, update],
  );
  const keyFor = useCallback(
    (selections: readonly MapOverlaySelection[]) =>
      JSON.stringify(
        selections.map(({ overlayId, feature }) => {
          // Preserve ID types; numeric 1 and string "1" are different GeoJSON features.
          if (feature.id !== undefined)
            return [overlayId, typeof feature.id, feature.id];
          let key = anonymous.current.get(feature);
          if (key === undefined) {
            key = nextAnonymous.current++;
            anonymous.current.set(feature, key);
          }
          return [overlayId, "anonymous", key];
        }),
      ),
    [],
  );
  const inspect = useCallback(
    (
      selections: readonly MapOverlaySelection[],
      coordinate: MapCoordinate,
      x: number,
      y: number,
      pinned = false,
    ) => {
      if (
        !latest.current.renderOverlayHoverDetails &&
        !(pinned && latest.current.renderOverlayDetails)
      )
        return;
      if (!selections.length) return leave();
      show({ key: keyFor(selections), selections, coordinate, x, y, pinned });
    },
    [show, keyFor, leave],
  );
  const target = useCallback(
    (value: MapInspectionTarget, element: HTMLElement, pinned = false) => {
      const p = latest.current;
      const bounds = element.getBoundingClientRect();
      if ("facilityId" in value) {
        const facility = p.facilities?.find((f) => f.id === value.facilityId);
        if (!facility || !p.renderFacilityDetails) return;
        show({
          key: JSON.stringify(["facility", facility.id]),
          facilityId: facility.id,
          coordinate: facility.coordinates,
          anchor: element,
          x: bounds.left + bounds.width / 2,
          y: bounds.bottom,
          pinned,
        });
      } else {
        const overlay = p.overlays?.find(
          (o) => o.id === value.overlayId && o.visible !== false,
        );
        if (
          !overlay ||
          !overlay.layers.some((layer) => layer.layout?.visibility !== "none")
        )
          return;
        const features =
          value.featureId === undefined
            ? overlay.data.features
            : overlay.data.features.filter((f) => f.id === value.featureId);
        if (
          (value.featureId !== undefined && !features.length) ||
          (value.featureId !== undefined && features.length !== 1) ||
          (!p.renderOverlayHoverDetails && !(pinned && p.renderOverlayDetails))
        )
          return;
        const selections = features.map((feature) => ({
          overlayId: overlay.id,
          feature,
        }));
        show({
          key:
            value.featureId === undefined
              ? JSON.stringify(["overlay", overlay.id])
              : keyFor(selections),
          overlayId: value.featureId === undefined ? overlay.id : undefined,
          selections: value.featureId === undefined ? undefined : selections,
          coordinate: overlayCoordinates([overlay])[0],
          anchor: element,
          x: bounds.left + bounds.width / 2,
          y: bounds.bottom,
          pinned,
        });
      }
    },
    [show, keyFor],
  );
  const pin = useCallback(() => {
    if (current.current) update({ ...current.current, pinned: true });
  }, [update]);
  const move = useCallback(() => {
    const value = current.current;
    if (!value) return;
    const focusedControl =
      value.anchor?.contains(document.activeElement) &&
      !engine.current?.element.contains(value.anchor);
    if (!value.pinned && !focusedControl) return close();
    if (value.anchor) {
      if (!value.anchor.isConnected) return close();
      const bounds = value.anchor.getBoundingClientRect();
      return update({
        ...value,
        x: bounds.left + bounds.width / 2,
        y: bounds.bottom,
      });
    }
    if (!value.coordinate || !engine.current) return;
    const { map, element } = engine.current;
    const point = map.project([...value.coordinate]);
    const bounds = element.getBoundingClientRect();
    update({ ...value, x: bounds.left + point.x, y: bounds.top + point.y });
  }, [close, update]);
  const attach = useCallback(
    (map: MapInstance, element: HTMLElement) => {
      engine.current = { map, element };
      return () => {
        engine.current = null;
        close();
      };
    },
    [close],
  );
  const facility = options.facilities?.find(
    (f) => f.id === inspection?.facilityId,
  );
  const available = (id: string) =>
    options.overlays?.find(
      (o) =>
        o.id === id &&
        o.visible !== false &&
        o.layers.some((layer) => layer.layout?.visibility !== "none"),
    );
  const collection = inspection?.overlayId
    ? available(inspection.overlayId)
    : undefined;
  const selections = collection
    ? collection.data.features.map((feature) => ({
        overlayId: collection.id,
        overlay: collection,
        feature,
        coordinate: inspection?.coordinate,
      }))
    : inspection?.selections?.flatMap((selection) => {
        const overlay = available(selection.overlayId);
        if (!overlay) return [];
        const matches = overlay.data.features.includes(selection.feature)
          ? [selection.feature]
          : selection.feature.id !== undefined
            ? overlay.data.features.filter((f) => f.id === selection.feature.id)
            : [];
        return matches.length === 1
          ? [{ ...selection, feature: matches[0], overlay }]
          : [];
      });
  const overlays = collection
    ? [collection]
    : [...new Set(selections?.map((s) => s.overlay) ?? [])];
  const content = !inspection
    ? null
    : inspection.facilityId
      ? facility && options.renderFacilityDetails?.({ facility })
      : overlays.length && options.renderOverlayHoverDetails
        ? options.renderOverlayHoverDetails({
            overlays,
            selections: selections ?? [],
            coordinate: inspection.coordinate,
          })
        : inspection.pinned && selections?.length
          ? options.renderOverlayDetails?.(selections[0])
          : null;
  const valid = Boolean(inspection && content != null && content !== false);
  useEffect(() => {
    if (inspection && !valid) close();
  }, [inspection, valid, close]);
  useEffect(() => {
    close();
    dismissed.current = null;
  }, [options.inspectionRevision, close]);
  useEffect(() => {
    const scroll = (event: Event) => {
      if (event.target instanceof Node && card.current?.contains(event.target))
        return;
      const value = current.current;
      if (!value) return;
      if (value.anchor?.contains(document.activeElement)) {
        keep();
        const bounds = value.anchor.getBoundingClientRect();
        update({
          ...value,
          x: bounds.left + bounds.width / 2,
          y: bounds.bottom,
        });
      } else move();
    };
    const pointer = (event: PointerEvent) => {
      const anchor = dismissed.current?.anchor;
      if (
        anchor &&
        event.target instanceof Node &&
        !anchor.contains(event.target)
      )
        dismissed.current = null;
    };
    window.addEventListener("pointermove", pointer, true);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", move);
    return () => {
      window.removeEventListener("pointermove", pointer, true);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", move);
      keep();
    };
  }, [move, update, keep]);
  const events = useMemo(
    () => ({ attach, target, inspect, leave, close, move, pin, keep }),
    [attach, target, inspect, leave, close, move, pin, keep],
  );
  return {
    id,
    card,
    inspection: valid ? inspection : null,
    facility,
    selections,
    overlays,
    content,
    events,
  };
}
