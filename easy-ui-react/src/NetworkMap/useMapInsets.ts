import { useCallback, useRef, useState } from "react";
import type { Map as MapInstance } from "maplibre-gl";
import { validCoordinate } from "./geometry";
import type { NetworkMapProps } from "./types";

export type MapInset = {
  sectionId: string;
  anchorId: string;
  facilityIds: string[];
  key: string;
};

/** Find local groups whose marker centers collide in this viewport, without inferring journey membership. */
export function crowdedInsetNodes(
  options: NetworkMapProps,
  map: Pick<MapInstance, "project" | "getCenter" | "getContainer">,
  includeOffscreen = false,
) {
  const candidates = new Map<string, MapInset>();
  if (!options.zoomSections?.length) return candidates;
  const element = map.getContainer();
  const width = element.clientWidth;
  const height = element.clientHeight;
  const longitude = map.getCenter().lng;
  for (const section of options.zoomSections) {
    const members = new Set(section.facilityIds);
    const points =
      options.facilities
        ?.filter(
          (facility) =>
            members.has(facility.id) && validCoordinate(facility.coordinates),
        )
        .map((facility) => ({
          id: facility.id,
          point: map.project([
            facility.coordinates[0] +
              Math.round((longitude - facility.coordinates[0]) / 360) * 360,
            facility.coordinates[1],
          ]),
        }))
        .filter(
          ({ point }) =>
            includeOffscreen ||
            (point.x >= 12 &&
              point.x <= width - 12 &&
              point.y >= 12 &&
              point.y <= height - 12),
        ) ?? [];
    const remaining = new Set(points.map((point) => point.id));
    for (const start of points) {
      if (!remaining.delete(start.id)) continue;
      const group = [start];
      for (let index = 0; index < group.length; index++) {
        for (const next of points) {
          if (
            remaining.has(next.id) &&
            Math.hypot(
              group[index].point.x - next.point.x,
              group[index].point.y - next.point.y,
            ) < 48
          ) {
            remaining.delete(next.id);
            group.push(next);
          }
        }
      }
      if (group.length < 2) continue;
      const facilityIds = group.map((point) => point.id).sort();
      const key = JSON.stringify([section.id, facilityIds]);
      for (const anchorId of facilityIds) {
        const previous = candidates.get(anchorId);
        if (!previous || previous.facilityIds.length > facilityIds.length)
          candidates.set(anchorId, {
            sectionId: section.id,
            anchorId,
            facilityIds,
            key,
          });
      }
    }
  }
  return candidates;
}

function unclippedGroupKey(
  options: NetworkMapProps,
  map: MapInstance,
  inset: MapInset,
) {
  return crowdedInsetNodes(
    {
      ...options,
      zoomSections: options.zoomSections?.filter(
        (section) => section.id === inset.sectionId,
      ),
    },
    map,
    true,
  ).get(inset.anchorId)?.key;
}

export function useMapInsets(options: NetworkMapProps) {
  const latest = useRef(options);
  latest.current = options;
  const available = useRef(new Map<string, MapInset>());
  const activeRef = useRef<MapInset | null>(null);
  const activeUnclippedKey = useRef<string | undefined>(undefined);
  const generation = useRef(0);
  const map = useRef<MapInstance | null>(null);
  const [active, setActive] = useState<MapInset | null>(null);
  const [dock, setDock] = useState<"top" | "bottom">("bottom");
  const close = useCallback((returnFocus = false) => {
    generation.current++;
    if (!activeRef.current) return;
    const anchor = activeRef.current.anchorId;
    activeRef.current = null;
    activeUnclippedKey.current = undefined;
    setActive(null);
    if (returnFocus && anchor) {
      const target = available.current.has(anchor)
        ? ([
            ...(map.current
              ?.getContainer()
              .querySelectorAll<HTMLElement>("[data-map-facility-id]") ?? []),
          ].find((node) => node.dataset.mapFacilityId === anchor) ??
          map.current?.getCanvas?.())
        : map.current?.getCanvas?.();
      target?.focus({ preventScroll: true });
    }
  }, []);
  const update = useCallback(
    (instance: MapInstance) => {
      map.current = instance;
      const next = crowdedInsetNodes(latest.current, instance);
      available.current = next;
      const current = activeRef.current;
      if (current) {
        // A shorter frame can clip a group without changing its geometry.
        // Keep that requested close-up; camera movement closes it separately.
        if (
          unclippedGroupKey(latest.current, instance, current) !==
          activeUnclippedKey.current
        )
          close();
      }
      return next;
    },
    [close],
  );
  const request = useCallback(
    (id: string) => {
      generation.current++;
      const next = available.current.get(id);
      if (!next || map.current?.isMoving?.()) {
        close();
        return false;
      }
      activeUnclippedKey.current = map.current
        ? unclippedGroupKey(latest.current, map.current, next)
        : undefined;
      activeRef.current = next;
      setActive(next);
      return true;
    },
    [close],
  );
  const isOpen = useCallback(
    (id: string) => activeRef.current?.anchorId === id,
    [],
  );
  const getGeneration = useCallback(() => generation.current, []);
  return {
    active,
    dock,
    setDock,
    update,
    request,
    close,
    isOpen,
    getGeneration,
  };
}
