import { act, renderHook } from "@testing-library/react";
import { useOverlayVisibility } from "./useOverlayVisibility";
import type { MapOverlay, NetworkMapProps } from "./types";

const overlay: MapOverlay = {
  id: "coverage",
  data: { type: "FeatureCollection", features: [] },
  layers: [{ id: "area", type: "fill" }],
};
const props: NetworkMapProps = {
  mapStyle: { version: 8, sources: {}, layers: [] },
  workerUrl: "/worker.js",
  overlays: [overlay],
};

it("toggles unmanaged overlays and reports their IDs without changing supplied data", () => {
  const onOverlayVisibilityChange = vi.fn();
  const { result } = renderHook(() =>
    useOverlayVisibility({ ...props, onOverlayVisibilityChange }),
  );
  expect(result.current.resolvedOverlays[0].visible).toBe(true);
  act(() => result.current.changeOverlayVisibility("coverage", false));
  expect(result.current.resolvedOverlays[0].visible).toBe(false);
  expect(result.current.resolvedOverlays[0].data).toBe(overlay.data);
  expect(overlay.visible).toBeUndefined();
  expect(onOverlayVisibilityChange).toHaveBeenCalledWith("coverage", false);
});

it("keeps controlled overlays unchanged until the parent applies the proposed visibility", () => {
  const onOverlayVisibilityChange = vi.fn();
  const { result, rerender } = renderHook(useOverlayVisibility, {
    initialProps: {
      ...props,
      overlays: [{ ...overlay, visible: false }],
      onOverlayVisibilityChange,
    },
  });
  act(() => result.current.changeOverlayVisibility("coverage", true));
  expect(onOverlayVisibilityChange).toHaveBeenCalledWith("coverage", true);
  expect(result.current.resolvedOverlays[0].visible).toBe(false);
  rerender({
    ...props,
    overlays: [{ ...overlay, visible: true }],
    onOverlayVisibilityChange,
  });
  expect(result.current.resolvedOverlays[0].visible).toBe(true);
});

it("initializes each new overlay once and retains toggles through data and default changes", () => {
  const { result, rerender } = renderHook(useOverlayVisibility, {
    initialProps: {
      ...props,
      overlays: [{ ...overlay, defaultVisible: false }],
    },
  });
  expect(result.current.resolvedOverlays[0].visible).toBe(false);
  act(() => result.current.changeOverlayVisibility("coverage", true));
  const extra = { ...overlay, id: "points", defaultVisible: false };
  rerender({
    ...props,
    overlays: [
      { ...overlay, defaultVisible: false, data: { ...overlay.data } },
      extra,
    ],
  });
  expect(result.current.resolvedOverlays.map((entry) => entry.visible)).toEqual(
    [true, false],
  );
  rerender({
    ...props,
    overlays: [
      { ...overlay, defaultVisible: false },
      { ...extra, defaultVisible: true },
    ],
  });
  expect(result.current.resolvedOverlays.map((entry) => entry.visible)).toEqual(
    [true, false],
  );
});

it("forgets removed overlays and ignores unknown control targets", () => {
  const onOverlayVisibilityChange = vi.fn();
  const { result, rerender } = renderHook(useOverlayVisibility, {
    initialProps: { ...props, onOverlayVisibilityChange },
  });
  act(() => result.current.changeOverlayVisibility("coverage", false));
  rerender({ ...props, overlays: [], onOverlayVisibilityChange });
  act(() => result.current.changeOverlayVisibility("missing", false));
  expect(onOverlayVisibilityChange).toHaveBeenCalledTimes(1);
  rerender({ ...props, overlays: [overlay], onOverlayVisibilityChange });
  expect(result.current.resolvedOverlays[0].visible).toBe(true);
});
