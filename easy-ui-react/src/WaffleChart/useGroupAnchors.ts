import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { WaffleChartGroupAnchor } from "./types";

/** Geometry is public and viewport-relative, independent of the internal markup. */
export function useGroupAnchors(
  root: RefObject<HTMLElement | null>,
  elements: RefObject<Map<string, HTMLElement>>,
  onChange: ((anchors: readonly WaffleChartGroupAnchor[]) => void) | undefined,
  revision: unknown,
) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const refresh = useRef<(() => void) | null>(null);
  const enabled = !!onChange;
  useEffect(() => {
    if (!enabled || !root.current) return;
    let frame: number | undefined;
    let last = "";
    let lastElements: HTMLElement[] = [];
    let observed = new Set<HTMLElement>();
    let disposed = false;
    const initialCallback = callback.current;
    const measure = () => {
      if (disposed) return;
      const anchors = [...elements.current].map(([groupId, element]) => {
        const { left, top, right, bottom, width, height } =
          element.getBoundingClientRect();
        return {
          groupId,
          element,
          bounds: { left, top, right, bottom, width, height },
        };
      });
      const signature = JSON.stringify(
        anchors.map(({ groupId, bounds }) => [groupId, bounds]),
      );
      if (
        signature !== last ||
        anchors.some((anchor, index) => anchor.element !== lastElements[index])
      ) {
        last = signature;
        lastElements = anchors.map((anchor) => anchor.element);
        callback.current?.(anchors);
      }
    };
    const schedule = () => {
      if (frame === undefined)
        frame = requestAnimationFrame(() => {
          frame = undefined;
          measure();
        });
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);
    refresh.current = () => {
      const next = new Set([root.current!, ...elements.current.values()]);
      if (
        next.size !== observed.size ||
        [...next].some((element) => !observed.has(element))
      ) {
        if (observed.size) observer?.disconnect();
        for (const element of next) observer?.observe(element);
        observed = next;
      }
      measure();
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    refresh.current();
    document.fonts?.ready.then(() => {
      if (!disposed) schedule();
    });
    return () => {
      disposed = true;
      refresh.current = null;
      if (frame !== undefined) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      (callback.current ?? initialCallback)?.([]);
    };
  }, [root, elements, enabled]);
  // Keep geometry comparisons across revisions. Inline callbacks and fresh data
  // arrays must not produce a parent-state feedback loop or transient [] anchors.
  useEffect(() => {
    refresh.current?.();
  }, [revision]);
}
