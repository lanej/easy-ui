import React, { useState } from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { getInstanceByDom, setPlatformAPI } from "echarts";
import { render } from "../utilities/test";
import { ThemeProvider } from "../Theme";
import { Chart } from "./Chart";
import type { ChartOption } from "./types";

setPlatformAPI({ measureText: (text) => ({ width: text.length * 8 }) });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(["retry", "unmount"] as const)(
  "safely handles %s after an actual SVG engine formatter failure",
  async (action) => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(240);
    let allowRetry = false;
    const failure = vi.fn();
    let observedResize: (() => void) | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          observedResize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const option: ChartOption = {
      animation: false,
      xAxis: [
        {
          type: "value",
          min: 0,
          max: 100,
          axisLabel: {
            formatter: (value: number) => {
              if (!allowRetry) throw new Error("Intentional formatter failure");
              return String(value);
            },
          },
        },
        { type: "value", show: false },
      ],
      yAxis: { type: "value" },
      legend: { data: ["A", "B"] },
      dataZoom: [
        { id: "first", type: "inside", xAxisIndex: 0, start: 20, end: 80 },
        { id: "second", type: "inside", xAxisIndex: 1, start: 50, end: 100 },
      ],
      series: [
        {
          name: "A",
          type: "line",
          data: [
            [0, 1],
            [100, 2],
          ],
        },
        {
          name: "B",
          type: "line",
          xAxisIndex: 1,
          data: [
            [0, 2],
            [100, 3],
          ],
        },
      ],
    };
    function Fixture() {
      const [errors, setErrors] = useState(0);
      return (
        <ThemeProvider>
          <Chart
            title="Recoverable plot"
            option={{ ...option }}
            dataTable={{ columns: ["Value"], rows: [{ id: "a", values: [1] }] }}
            typography={{ label: 16 }}
            onRenderError={(error) => {
              failure(error);
              // Bound the reproduction if a failed render retries on every
              // application rerender with a fresh typography object.
              if (errors < 5) setErrors((n) => n + 1);
            }}
          />
          <span data-testid="errors">{errors}</span>
        </ThemeProvider>
      );
    }
    const { container, unmount } = render(<Fixture />);
    await screen.findByRole("alert");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      observedResize?.();
      window.dispatchEvent(new Event("resize"));
    });
    expect(failure).toHaveBeenCalledOnce();
    const host = container.querySelector<HTMLElement>(
      "[data-chart-state] > div",
    )!;
    const failedEngine = getInstanceByDom(host)!;
    const rendererDispose = vi.spyOn(failedEngine.getZr(), "dispose");
    if (action === "unmount") {
      unmount();
      expect(rendererDispose).toHaveBeenCalledOnce();
      expect(failure).toHaveBeenCalledOnce();
      return;
    }
    allowRetry = true;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(
        container.querySelector('[data-chart-state="ready"]'),
      ).not.toBeNull(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(failure).toHaveBeenCalledOnce();
    expect(rendererDispose).toHaveBeenCalledOnce();
    expect(getInstanceByDom(host)?.id).not.toBe(failedEngine.id);
    expect(host.querySelectorAll("svg")).toHaveLength(1);
    unmount();
  },
);
