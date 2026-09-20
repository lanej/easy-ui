import { isEqual } from "lodash";
import type { ChartLegendState, ChartOption, ChartZoomState } from "./types";

const items = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

function matching<T extends { id?: string | number }>(
  value: T | T[] | undefined,
  item: T,
  index: number,
) {
  const list = items(value);
  return item.id === undefined
    ? list[index]
    : list.find((candidate) => String(candidate.id) === String(item.id));
}

const zoomSettings = [
  "start",
  "end",
  "startValue",
  "endValue",
  "rangeMode",
  "type",
  "xAxisIndex",
  "yAxisIndex",
  "radiusAxisIndex",
  "angleAxisIndex",
  "filterMode",
  "orient",
] as const;

/** Keep local interaction state only while its application settings are unchanged. */
export function preserveInteractions(
  next: ChartOption,
  previous: ChartOption,
  current: ChartOption,
  viewport?: { width: number; height: number },
): ChartOption {
  const result = { ...next };
  if (next.baseOption) {
    result.baseOption = preserveInteractions(
      next.baseOption as ChartOption,
      (previous.baseOption ?? {}) as ChartOption,
      current,
      viewport,
    );
  }
  // ECharts applies active media overrides after baseOption. Preserve their unchanged
  // interaction settings too; inactive breakpoints must keep their authored defaults.
  if (next.media && viewport) {
    const matches = (query: object) =>
      Object.entries(query).every(([key, value]) => {
        const match = /^(min|max)(Width|Height|AspectRatio)$/.exec(key);
        if (!match) return true;
        const actual =
          match[2] === "Width"
            ? viewport.width
            : match[2] === "Height"
              ? viewport.height
              : viewport.width / viewport.height;
        return match[1] === "min" ? actual >= value : actual <= value;
      });
    const hasMatch = next.media.some(
      (media) => media.query && matches(media.query),
    );
    result.media = next.media.map((media, index) => {
      const before = previous.media?.[index];
      const active = media.query ? matches(media.query) : !hasMatch;
      return active &&
        media.option &&
        before?.option &&
        isEqual(media.query, before.query)
        ? {
            ...media,
            option: preserveInteractions(
              media.option as ChartOption,
              before.option as ChartOption,
              current,
            ),
          }
        : media;
    });
  }
  if (next.dataZoom) {
    result.dataZoom = items(next.dataZoom).map((zoom, index) => {
      const before = matching(previous.dataZoom, zoom, index);
      const active = matching(current.dataZoom, zoom, index);
      if (
        !before ||
        !active ||
        !zoomSettings.every((key) => isEqual(zoom[key], before[key]))
      )
        return zoom;
      // getOption includes both calculated percentages and values. Select the
      // authored range mode so a value window does not become a percentage one.
      const rangeMode = zoom.rangeMode ?? [
        zoom.startValue != null && zoom.start == null ? "value" : "percent",
        zoom.endValue != null && zoom.end == null ? "value" : "percent",
      ];
      return {
        ...zoom,
        start: active.start,
        end: active.end,
        startValue: active.startValue,
        endValue: active.endValue,
        rangeMode,
      };
    });
  }
  if (next.legend) {
    result.legend = items(next.legend).map((legend, index) => {
      const before = matching(previous.legend, legend, index);
      const active = matching(current.legend, legend, index);
      return before &&
        active &&
        isEqual(legend.selected, before.selected) &&
        legend.selectedMode === before.selectedMode
        ? { ...legend, selected: { ...active.selected } }
        : legend;
    });
  }
  return result;
}

/** Explicit controlled ranges and legend selections take precedence over restored engine state. */
export function controlledInteractions(
  option: ChartOption,
  zoomState?: readonly ChartZoomState[],
  legendState?: readonly ChartLegendState[],
): ChartOption {
  const result = { ...option };
  if (option.baseOption) {
    result.baseOption = controlledInteractions(
      option.baseOption as ChartOption,
      zoomState,
      legendState,
    );
  }
  if (option.media)
    result.media = option.media.map((media) => ({
      ...media,
      option: media.option
        ? controlledInteractions(
            media.option as ChartOption,
            zoomState,
            legendState,
          )
        : media.option,
    }));
  if (option.options)
    result.options = option.options.map((frame) =>
      controlledInteractions(frame as ChartOption, zoomState, legendState),
    );
  if (option.dataZoom && zoomState) {
    result.dataZoom = items(option.dataZoom).map((zoom, index) => {
      const state = zoomState.find((item) =>
        item.id === undefined
          ? (item.index ?? 0) === index
          : String(item.id) === String(zoom.id),
      );
      if (!state) return zoom;
      const { id: _id, index: _index, ...range } = state;
      return {
        ...zoom,
        startValue: undefined,
        endValue: undefined,
        ...range,
        rangeMode: range.rangeMode ?? [
          range.startValue != null && range.start == null ? "value" : "percent",
          range.endValue != null && range.end == null ? "value" : "percent",
        ],
      };
    });
  }
  if (option.legend && legendState) {
    result.legend = items(option.legend).map((legend, index) => {
      const state = legendState.find((item) =>
        item.id === undefined
          ? (item.index ?? 0) === index
          : String(item.id) === String(legend.id),
      );
      return state ? { ...legend, selected: { ...state.selected } } : legend;
    });
  }
  return result;
}

/** Read the effective option, including baseOption, media, and engine-linked components. */
export function interactionSnapshot(current: ChartOption) {
  return {
    ready: true,
    zoom: items(current.dataZoom).map(
      (zoom, index): ChartZoomState => ({
        ...(zoom.id === undefined ? {} : { id: String(zoom.id) }),
        index,
        start: zoom.start ?? 0,
        end: zoom.end ?? 100,
        startValue: zoom.startValue,
        endValue: zoom.endValue,
        rangeMode: zoom.rangeMode,
      }),
    ),
    legend: items(current.legend).map(
      (legend, index): ChartLegendState => ({
        ...(legend.id === undefined ? {} : { id: String(legend.id) }),
        index,
        selected: { ...legend.selected },
      }),
    ),
  };
}
