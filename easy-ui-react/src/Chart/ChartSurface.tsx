import React, { AriaAttributes, useEffect, useRef, useState } from "react";
import { isEqual } from "lodash";
import { useColorScheme, useTheme } from "../Theme";
import {
  VisualizationTypography,
  visualizationTypographyStyle,
} from "../visualization/typography";
import { loadChartEngine } from "./engine";
import {
  controlledInteractions,
  interactionSnapshot,
  preserveInteractions,
} from "./interactions";
import { useChartConnection, useChartContext } from "./ChartProvider";
import { themedOption } from "./theme";
import { automaticChartLayout } from "./autoLayout";
import { ChartLegend, ChartLegendItem } from "./ChartLegend";
import type {
  ChartLegendState,
  ChartOption,
  ChartSelection,
  ChartZoomState,
} from "./types";
import styles from "./Chart.module.scss";

export type ChartSurfaceProps = Pick<
  AriaAttributes,
  "aria-label" | "aria-labelledby" | "aria-describedby"
> & {
  id?: string;
  option: ChartOption;
  height?: number;
  renderer?: "svg" | "canvas";
  status?: "ready" | "loading" | "empty" | "error";
  typography?: VisualizationTypography;
  /** Auto lays out ordinary unpositioned Cartesian charts with a wrapping HTML
   * legend. Authored grid/legend layouts remain native. Use native to opt out. */
  layout?: "auto" | "native";
  legendLabel?: string;
  onSelect?: (selection: ChartSelection) => void;
  onRenderError?: (error: unknown) => void;
  /** Retry application data errors. Engine failures have their own in-place retry. */
  onRetry?: () => void;
  /** Ranges supplied here are controlled; IDs match engine components, with index as a fallback. */
  zoomState?: readonly ChartZoomState[];
  /** Selected maps supplied here are controlled and override option/restored interaction state. */
  legendState?: readonly ChartLegendState[];
  /** Requested effective ranges after user/engine interaction. Programmatic prop updates are silent. */
  onZoomChange?: (zoom: ChartZoomState[]) => void;
  /** Requested legend state after user/engine interaction. Unaccepted controlled changes revert. */
  onLegendChange?: (legend: ChartLegendState[]) => void;
  loadingLabel?: string;
  emptyLabel?: string;
  errorLabel?: string;
  retryLabel?: string;
};

/** Rendering and interaction surface without a card, heading, or data disclosure.
 * Automatic layouts include a wrapping series legend outside the plot.
 * Associate an external equivalent data view with aria-describedby where appropriate.
 */
export function ChartSurface({
  height = 320,
  renderer = "svg",
  status = "ready",
  loadingLabel = "Loading chart…",
  emptyLabel = "No data for this selection",
  errorLabel = "Unable to display this chart",
  retryLabel = "Retry",
  ...props
}: ChartSurfaceProps) {
  const plotHeight = Math.max(160, height);
  const content =
    status === "ready" ? (
      <ChartEngine
        {...props}
        id={undefined}
        height={plotHeight}
        renderer={renderer}
        loadingLabel={loadingLabel}
        errorLabel={errorLabel}
        retryLabel={retryLabel}
      />
    ) : (
      <div
        className={styles.status}
        style={{
          ...visualizationTypographyStyle(props.typography),
          minHeight: plotHeight,
        }}
        role={status === "error" ? "alert" : "status"}
      >
        {status === "loading"
          ? loadingLabel
          : status === "empty"
            ? emptyLabel
            : errorLabel}
        {status === "error" && props.onRetry && (
          <button
            type="button"
            className={styles.control}
            onClick={props.onRetry}
          >
            {retryLabel}
          </button>
        )}
      </div>
    );
  return (
    <div
      id={props.id}
      role="group"
      aria-label={
        props["aria-labelledby"] ? undefined : (props["aria-label"] ?? "Chart")
      }
      aria-labelledby={props["aria-labelledby"]}
      aria-describedby={props["aria-describedby"]}
      className={styles.root}
      style={visualizationTypographyStyle(props.typography)}
    >
      {content}
    </div>
  );
}

type EngineProps = ChartSurfaceProps &
  Required<
    Pick<
      ChartSurfaceProps,
      "height" | "renderer" | "loadingLabel" | "errorLabel" | "retryLabel"
    >
  >;

function ChartEngine(props: EngineProps) {
  const container = useRef<HTMLDivElement>(null);
  const shared = useChartContext();
  const local = useChartConnection();
  const connection = shared ?? local;
  const instance = connection.instance;
  const update = useRef<(() => void) | null>(null);
  const resizeEngine = useRef<(() => void) | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const previousOption = useRef<ChartOption | undefined>(undefined);
  const retainedOption = useRef<ChartOption | undefined>(undefined);
  const applying = useRef(false);
  const owner = useRef({});
  const theme = useTheme();
  const { resolvedColorScheme } = useColorScheme();
  const [state, setState] = useState("loading");
  const [retry, setRetry] = useState(0);
  const [legend, setLegend] = useState<ChartLegendItem[]>([]);
  const [interactiveLegend, setInteractiveLegend] = useState(false);

  useEffect(() => {
    if (
      connection.owner.current &&
      connection.owner.current !== owner.current
    ) {
      setState("error");
      latest.current.onRenderError?.(
        new Error(
          "Each ChartProvider supports one ChartSurface. Use separate providers for multiple charts.",
        ),
      );
      return;
    }
    connection.owner.current = owner.current;
    const element = container.current!;
    let disposed = false;
    let failed = false;
    let failedOption: ChartOption | undefined;
    let observer: ResizeObserver | undefined;
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const scheme = window.matchMedia?.("(prefers-color-scheme: dark)");
    let layout: ReturnType<typeof automaticChartLayout> = null;
    const publishLegend = () => {
      const chart = instance.current;
      if (!layout || !chart) {
        setLegend([]);
        return;
      }
      const selected = interactionSnapshot(chart.getOption() as ChartOption)
        .legend[0]?.selected;
      setInteractiveLegend(layout.interactive);
      setLegend(
        layout.entries.map(({ seriesIndex, ...item }) => {
          const color = chart.getVisual({ seriesIndex }, "color");
          return {
            ...item,
            color: typeof color === "string" ? color : "currentColor",
            selected: selected?.[item.name] !== false,
          };
        }),
      );
    };
    const fail = (error: unknown) => {
      if (!disposed && !failed) {
        // An application error callback may itself rerender with fresh option
        // or typography objects. Keep a failed engine inert until Retry creates
        // a new instance (or the application supplies corrected options),
        // rather than repeatedly invoking the same failure.
        failed = true;
        failedOption = latest.current.option;
        setState("error");
        connection.publish({ ...connection.snapshotRef.current, ready: false });
        latest.current.onRenderError?.(error);
      }
    };
    const apply = () => {
      if (disposed) return;
      if (failed) {
        if (!isEqual(latest.current.option, failedOption)) {
          failedOption = latest.current.option;
          setRetry((n) => n + 1);
        }
        return;
      }
      if (!instance.current) return;
      try {
        layout =
          latest.current.layout === "native"
            ? null
            : automaticChartLayout(latest.current.option);
        const option = themedOption(
          element,
          layout?.option ?? latest.current.option,
          !!motion?.matches,
          latest.current.typography,
        );
        const current =
          retainedOption.current ??
          (instance.current.getOption() as ChartOption);
        const preserved = previousOption.current
          ? preserveInteractions(option, previousOption.current, current, {
              width: instance.current.getWidth?.() ?? element.clientWidth,
              height: instance.current.getHeight?.() ?? element.clientHeight,
            })
          : option;
        applying.current = true;
        instance.current.setOption(
          controlledInteractions(
            preserved,
            latest.current.zoomState,
            latest.current.legendState,
          ),
          { notMerge: true, silent: true },
        );
        previousOption.current = option;
        retainedOption.current = undefined;
        connection.publish(
          interactionSnapshot(instance.current.getOption() as ChartOption),
        );
        publishLegend();
        setState("ready");
      } catch (error) {
        fail(error);
      } finally {
        applying.current = false;
      }
    };
    const resize = () => {
      if (!disposed && !failed && element.clientWidth > 0 && instance.current) {
        try {
          instance.current.resize();
          connection.publish(
            interactionSnapshot(instance.current.getOption() as ChartOption),
          );
        } catch (error) {
          fail(error);
        }
      }
    };
    const fontsChanged = () => {
      apply();
      resize();
    };
    const changed = () => {
      if (disposed || failed || applying.current || !instance.current) return;
      const next = interactionSnapshot(
        instance.current.getOption() as ChartOption,
      );
      const before = connection.snapshotRef.current;
      connection.publish(next);
      if (!isEqual(next.zoom, before.zoom))
        latest.current.onZoomChange?.(next.zoom);
      if (!isEqual(next.legend, before.legend))
        latest.current.onLegendChange?.(next.legend);
      if (latest.current.zoomState || latest.current.legendState) apply();
      else publishLegend();
    };
    update.current = apply;
    resizeEngine.current = resize;
    setState("loading");
    connection.publish({ ...connection.snapshotRef.current, ready: false });
    loadChartEngine()
      .then((engine) => {
        if (disposed) return;
        instance.current = engine.init(element, undefined, {
          renderer: props.renderer,
        });
        instance.current.on("click", (event) => {
          if (event.componentType === "series") {
            const {
              seriesId,
              seriesName,
              name,
              dataIndex,
              dataType,
              data,
              value,
            } = event;
            latest.current.onSelect?.({
              seriesId,
              seriesName,
              name,
              dataIndex,
              dataType,
              data,
              value,
            });
          }
        });
        instance.current.on("datazoom", changed);
        instance.current.on("legendselectchanged", changed);
        instance.current.on("legendselected", changed);
        instance.current.on("legendunselected", changed);
        instance.current.on("legendselectall", changed);
        instance.current.on("legendinverseselect", changed);
        apply();
        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(resize);
          observer.observe(element);
        }
        window.addEventListener("resize", resize);
        motion?.addEventListener("change", apply);
        scheme?.addEventListener("change", apply);
        document.fonts?.addEventListener("loadingdone", fontsChanged);
        document.fonts?.ready.then(() => {
          if (!disposed) fontsChanged();
        });
      })
      .catch(fail);
    return () => {
      disposed = true;
      update.current = null;
      resizeEngine.current = null;
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      motion?.removeEventListener("change", apply);
      scheme?.removeEventListener("change", apply);
      document.fonts?.removeEventListener("loadingdone", fontsChanged);
      if (instance.current) {
        const retiring = instance.current;
        instance.current = null;
        // Failed setOption may leave component views only partly initialized.
        // Do not snapshot that model or let a secondary teardown error escape
        // React cleanup and prevent Retry from mounting a fresh engine.
        retainedOption.current = undefined;
        if (failed) previousOption.current = undefined;
        else {
          try {
            retainedOption.current = retiring.getOption() as ChartOption;
          } catch {
            previousOption.current = undefined;
          }
        }
        try {
          retiring.dispose();
        } catch {
          // ECharts can throw while disposing an inside-zoom view that never
          // rendered. Release its public renderer to stop animation/listeners.
          try {
            retiring.getZr?.()?.dispose();
          } catch {
            // A partially disposed renderer may already have released itself.
          }
          element.replaceChildren();
        }
      }
      connection.publish({ ...connection.snapshotRef.current, ready: false });
      connection.owner.current = null;
    };
    // Connection methods only write stable refs/state. Theme changes update the existing engine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.renderer, retry]);

  useEffect(() => {
    update.current?.();
  }, [
    props.option,
    props.zoomState,
    props.legendState,
    props.typography,
    props.layout,
    theme,
    resolvedColorScheme,
  ]);
  useEffect(() => {
    resizeEngine.current?.();
  }, [props.height]);

  return (
    <div
      className={styles.root}
      style={visualizationTypographyStyle(props.typography)}
    >
      {state !== "ready" && (
        <div role={state === "error" ? "alert" : "status"}>
          {state === "error" ? props.errorLabel : props.loadingLabel}
          {state === "error" && (
            <button
              type="button"
              className={styles.control}
              onClick={() => setRetry((n) => n + 1)}
            >
              {props.retryLabel}
            </button>
          )}
        </div>
      )}
      <div
        id={props.id}
        role={state === "ready" ? "img" : undefined}
        aria-label={
          props["aria-labelledby"]
            ? undefined
            : (props["aria-label"] ?? "Chart")
        }
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        data-chart-state={state}
      >
        <div
          ref={container}
          className={styles.plot}
          style={{
            height: props.height,
            visibility: state === "ready" ? "visible" : "hidden",
          }}
          aria-hidden="true"
        />
      </div>
      {state === "ready" && (
        <ChartLegend
          items={legend}
          typography={props.typography}
          aria-label={props.legendLabel}
          onItemToggle={
            interactiveLegend
              ? (name) =>
                  instance.current?.dispatchAction({
                    type: "legendToggleSelect",
                    name,
                  })
              : undefined
          }
        />
      )}
    </div>
  );
}
