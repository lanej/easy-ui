import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { GraphItem } from "./model";
import type {
  DependencyGraphCardLayout,
  DependencyGraphCardLayouts,
} from "./types";
import { normalizeCardLayout } from "./cardLayout";

type Mode = "move" | "resize";
type Gesture = {
  id: string;
  mode: Mode;
  item: GraphItem;
  target: HTMLButtonElement;
  pointerId: number;
  clientX: number;
  clientY: number;
  scale: number;
  scrollLeft: number;
  scrollTop: number;
  viewportLeft: number;
  viewportTop: number;
  viewport: HTMLElement;
  changed: boolean;
  original: DependencyGraphCardLayout;
};

/** Preview gestures locally; notify persistence owners only when an edit commits. */
export function useDependencyGraphCardLayout({
  controlled,
  initial,
  onChange,
  enabled,
  zoom,
}: {
  controlled?: DependencyGraphCardLayouts;
  initial: DependencyGraphCardLayouts;
  onChange?: (layouts: DependencyGraphCardLayouts) => void;
  enabled: boolean;
  zoom: number;
}) {
  const [local, setLocal] = useState(initial);
  const [preview, setPreview] = useState<{
    id: string;
    value: DependencyGraphCardLayout;
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const gesture = useRef<Gesture | null>(null);
  const saved = controlled ?? local;
  const layouts = useMemo(
    () => (preview ? { ...saved, [preview.id]: preview.value } : saved),
    [saved, preview],
  );
  const commit = (next: DependencyGraphCardLayouts) => {
    if (controlled === undefined) setLocal(next);
    onChange?.(next);
  };
  const update = (id: string, value: DependencyGraphCardLayout) => {
    commit({ ...saved, [id]: normalizeCardLayout(value) });
  };
  const reset = (id?: string) => {
    if (id === undefined) commit({});
    else {
      const next = { ...saved };
      delete next[id];
      commit(next);
    }
    setAnnouncement(
      id ? "Card returned to automatic layout." : "Automatic layout restored.",
    );
  };
  const cancel = () => {
    const current = gesture.current;
    gesture.current = null;
    if (current?.target.hasPointerCapture(current.pointerId)) {
      current.target.releasePointerCapture(current.pointerId);
    }
    setPreview(null);
  };
  useEffect(() => {
    cancel();
    // A changed scale or disabled editor invalidates a gesture's coordinate system.
  }, [enabled, zoom]);
  useEffect(() => {
    if (gesture.current && !gesture.current.target.isConnected) cancel();
  });
  useEffect(
    () => () => {
      const current = gesture.current;
      if (current?.target.hasPointerCapture(current.pointerId))
        current.target.releasePointerCapture(current.pointerId);
      gesture.current = null;
    },
    [],
  );

  const valueAt = (current: Gesture, event: PointerEvent) => {
    const viewportBox = current.viewport.getBoundingClientRect();
    const dx =
      (event.clientX -
        current.clientX +
        current.viewport.scrollLeft -
        current.scrollLeft -
        (viewportBox.left - current.viewportLeft)) /
      current.scale;
    const dy =
      (event.clientY -
        current.clientY +
        current.viewport.scrollTop -
        current.scrollTop -
        (viewportBox.top - current.viewportTop)) /
      current.scale;
    current.changed ||= Math.abs(dx) + Math.abs(dy) >= 2;
    return normalizeCardLayout({
      ...current.original,
      x: current.mode === "move" ? current.item.x + dx : current.item.x,
      y: current.mode === "move" ? current.item.y + dy : current.item.y,
      ...(current.mode === "resize"
        ? { width: current.item.width + dx, height: current.item.height + dy }
        : {}),
    });
  };
  const describe = (
    item: GraphItem,
    mode: Mode,
    value: DependencyGraphCardLayout,
  ) => {
    setAnnouncement(
      mode === "move"
        ? `${item.node!.label} moved to ${value.x}, ${value.y}.`
        : `${item.node!.label} resized to ${value.width} by ${value.height}.`,
    );
  };
  const handleProps = (item: GraphItem, mode: Mode) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (!enabled || !event.isPrimary || event.button !== 0 || gesture.current)
        return;
      const viewport = event.currentTarget.closest<HTMLElement>(
        "[data-graph-canvas]",
      );
      if (!viewport) return;
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      const unit =
        parseFloat(
          getComputedStyle(event.currentTarget.ownerDocument.documentElement)
            .fontSize,
        ) / 16 || 1;
      gesture.current = {
        id: item.node!.id,
        mode,
        item,
        target: event.currentTarget,
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        scale: zoom * unit,
        viewport,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop,
        viewportLeft: viewport.getBoundingClientRect().left,
        viewportTop: viewport.getBoundingClientRect().top,
        changed: false,
        original: saved[item.node!.id] ?? {},
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const value = valueAt(current, event);
      if (current.changed) setPreview({ id: current.id, value });
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      const current = gesture.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const value = valueAt(current, event);
      cancel();
      if (current.changed) {
        update(current.id, value);
        describe(current.item, current.mode, value);
      }
    },
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Escape") {
        if (gesture.current) {
          event.preventDefault();
          event.stopPropagation();
          cancel();
          setAnnouncement("Layout edit cancelled.");
        }
        return;
      }
      if (
        !enabled ||
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      const step = event.shiftKey ? 50 : 10;
      const dx =
        event.key === "ArrowLeft"
          ? -step
          : event.key === "ArrowRight"
            ? step
            : 0;
      const dy =
        event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      const value = normalizeCardLayout({
        ...saved[item.node!.id],
        x: item.x + (mode === "move" ? dx : 0),
        y: item.y + (mode === "move" ? dy : 0),
        ...(mode === "resize"
          ? { width: item.width + dx, height: item.height + dy }
          : {}),
      });
      update(item.node!.id, value);
      describe(item, mode, value);
    },
  });
  return { layouts, saved, update, reset, handleProps, announcement, cancel };
}
