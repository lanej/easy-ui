import { useEffect, useMemo, useState } from "react";
import type { MapOverlay, NetworkMapProps } from "./types";

const emptyOverlays: readonly MapOverlay[] = [];

export function useOverlayVisibility(props: NetworkMapProps) {
  const overlays = props.overlays ?? emptyOverlays;
  const [uncontrolled, setUncontrolled] = useState(
    () =>
      new Map(
        overlays.map((overlay) => [overlay.id, overlay.defaultVisible ?? true]),
      ),
  );
  useEffect(() => {
    setUncontrolled((previous) => {
      const next = new Map(
        overlays.map((overlay) => [
          overlay.id,
          previous.get(overlay.id) ?? overlay.defaultVisible ?? true,
        ]),
      );
      return next.size === previous.size &&
        [...next].every(([id, visible]) => previous.get(id) === visible)
        ? previous
        : next;
    });
  }, [overlays]);
  const resolvedOverlays = useMemo(
    () =>
      overlays.map((overlay) =>
        overlay.visible !== undefined
          ? overlay
          : {
              ...overlay,
              visible:
                uncontrolled.get(overlay.id) ?? overlay.defaultVisible ?? true,
            },
      ),
    [overlays, uncontrolled],
  );
  const changeOverlayVisibility = (id: string, visible: boolean) => {
    const overlay = overlays.find((entry) => entry.id === id);
    if (!overlay) return;
    if (overlay.visible === undefined)
      setUncontrolled((previous) => new Map(previous).set(id, visible));
    props.onOverlayVisibilityChange?.(id, visible);
  };
  return { resolvedOverlays, changeOverlayVisibility };
}
