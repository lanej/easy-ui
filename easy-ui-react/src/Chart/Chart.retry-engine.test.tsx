import React, { useState } from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { setPlatformAPI } from "echarts";
import { render } from "../utilities/test";
import { ThemeProvider } from "../Theme";
import { Chart } from "./Chart";
import type { ChartOption } from "./types";

setPlatformAPI({ measureText: (text) => ({ width: text.length * 8 }) });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("reinitializes the actual SVG engine after a formatter initialization failure", async () => {
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
    xAxis: {
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
    yAxis: { type: "value" },
    series: [
      {
        type: "line",
        data: [
          [0, 1],
          [100, 2],
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
  allowRetry = true;
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() =>
    expect(
      container.querySelector('[data-chart-state="ready"]'),
    ).not.toBeNull(),
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(failure).toHaveBeenCalledOnce();
  unmount();
});
