import React, {
  createContext,
  ReactNode,
  useContext,
  useRef,
  useState,
} from "react";
import type { ChartInstance } from "./engine";
import type {
  ChartLegendState,
  ChartZoomState,
  ChartZoomTarget,
} from "./types";

export type ChartInteractionSnapshot = {
  ready: boolean;
  zoom: ChartZoomState[];
  legend: ChartLegendState[];
};

export function useChartConnection() {
  const instance = useRef<ChartInstance | null>(null);
  const owner = useRef<object | null>(null);
  const [snapshot, setSnapshot] = useState<ChartInteractionSnapshot>({
    ready: false,
    zoom: [],
    legend: [],
  });
  const snapshotRef = useRef(snapshot);
  const publish = (next: ChartInteractionSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
  };
  return { instance, owner, snapshot, snapshotRef, publish };
}

const ChartContext = createContext<ReturnType<
  typeof useChartConnection
> | null>(null);

/** Connect one ChartSurface to independently positioned ChartZoomControls. */
export function ChartProvider({ children }: { children: ReactNode }) {
  const connection = useChartConnection();
  return (
    <ChartContext.Provider value={connection}>{children}</ChartContext.Provider>
  );
}

export function useChartContext() {
  return useContext(ChartContext);
}

export function selectedZooms(
  zoom: readonly ChartZoomState[],
  target?: ChartZoomTarget,
) {
  if (!target) return zoom.slice(0, 1);
  if ("dataZoomId" in target) {
    const ids =
      typeof target.dataZoomId === "string"
        ? [target.dataZoomId]
        : target.dataZoomId;
    return zoom.filter(
      (item) => item.id !== undefined && ids.includes(item.id),
    );
  }
  const indices =
    typeof target.dataZoomIndex === "number"
      ? [target.dataZoomIndex]
      : target.dataZoomIndex;
  return zoom.filter(
    (item) => item.index !== undefined && indices.includes(item.index),
  );
}

export function dispatchZoom(
  instance: ChartInstance,
  ranges: readonly ChartZoomState[],
  factor: number,
) {
  const batch = ranges.map(({ id, index, start = 0, end = 100 }) => {
    const size = Math.min(100, Math.max(1, (end - start) * factor));
    const nextStart =
      factor === 0
        ? 0
        : Math.max(0, Math.min(100 - size, (start + end - size) / 2));
    return {
      ...(id === undefined ? { dataZoomIndex: index } : { dataZoomId: id }),
      start: nextStart,
      end: factor === 0 ? 100 : nextStart + size,
    };
  });
  if (batch.length === 1)
    instance.dispatchAction({ type: "dataZoom", ...batch[0] });
  else if (batch.length) instance.dispatchAction({ type: "dataZoom", batch });
}
