import type { CustomSeriesRenderItem } from "echarts";

/** Supplied endpoints, including negative values and intervals crossing zero. */
export const horizontalInterval: CustomSeriesRenderItem = (_params, api) => {
  const start = api.coord([api.value(1), api.value(0)]);
  const end = api.coord([api.value(2), api.value(0)]);
  const height = Math.abs((api.size!([0, 1]) as number[])[1]) * 0.55;
  return {
    type: "rect",
    shape: {
      x: Math.min(start[0], end[0]),
      y: start[1] - height / 2,
      width: Math.abs(end[0] - start[0]),
      height,
    },
    style: api.style(),
  };
};

export const verticalInterval: CustomSeriesRenderItem = (_params, api) => {
  const start = api.coord([api.value(0), api.value(1)]);
  const end = api.coord([api.value(0), api.value(2)]);
  const width = Math.abs((api.size!([1, 0]) as number[])[0]) * 0.55;
  return {
    type: "rect",
    shape: {
      x: start[0] - width / 2,
      y: Math.min(start[1], end[1]),
      width,
      height: Math.abs(end[1] - start[1]),
    },
    style: api.style(),
  };
};
