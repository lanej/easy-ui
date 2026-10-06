import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PriceRangeSlider, type PriceRatioRange } from "./PriceRangeSlider";

class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

beforeAll(() => vi.stubGlobal("PointerEvent", TestPointerEvent));
afterAll(() => vi.unstubAllGlobals());

function renderControl(
  initialRange: PriceRatioRange = { minRatio: 0.6, maxRatio: 0.9 },
  basePriceUsd = 10,
) {
  const onRangeChange = vi.fn<(range: PriceRatioRange) => void>();
  function Harness() {
    const [range, setRange] = useState(initialRange);
    return (
      <PriceRangeSlider
        basePriceUsd={basePriceUsd}
        range={range}
        onRangeChange={(next) => {
          onRangeChange(next);
          setRange(next);
        }}
      />
    );
  }
  return { ...render(<Harness />), onRangeChange };
}

function mockTrack() {
  vi.spyOn(
    screen.getByTestId("price-range-track"),
    "getBoundingClientRect",
  ).mockReturnValue({
    x: 100,
    y: 0,
    left: 100,
    right: 500,
    top: 0,
    bottom: 44,
    width: 400,
    height: 44,
    toJSON: () => ({}),
  });
}

describe("PriceRangeSlider", () => {
  it("cancels an active drag when the standard price becomes unavailable", () => {
    const onRangeChange = vi.fn();
    const range = { minRatio: 0.5, maxRatio: 1 };
    const { rerender } = render(
      <PriceRangeSlider
        basePriceUsd={10}
        range={range}
        onRangeChange={onRangeChange}
      />,
    );
    mockTrack();
    fireEvent.pointerDown(screen.getAllByRole("slider")[0], {
      pointerId: 1,
      button: 0,
    });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 250 });
    expect(onRangeChange).toHaveBeenCalledOnce();
    onRangeChange.mockClear();
    rerender(
      <PriceRangeSlider
        basePriceUsd={0}
        range={range}
        onRangeChange={onRangeChange}
      />,
    );
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 300 });
    expect(onRangeChange).not.toHaveBeenCalled();
    rerender(
      <PriceRangeSlider
        basePriceUsd={10}
        range={range}
        onRangeChange={onRangeChange}
      />,
    );
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 350 });
    expect(onRangeChange).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getAllByRole("slider")[1], {
      pointerId: 2,
      button: 0,
    });
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 350 });
    expect(onRangeChange).toHaveBeenCalledOnce();
    fireEvent.pointerUp(window, { pointerId: 2 });
  });

  it.each([0, -1, NaN, Infinity])(
    "disables unavailable standard price %s without nonfinite accessible values",
    (basePriceUsd) => {
      const { onRangeChange } = renderControl(undefined, basePriceUsd);
      for (const field of screen.getAllByRole("spinbutton")) {
        expect(field).toBeDisabled();
        expect(field).toHaveValue(null);
      }
      for (const handle of screen.getAllByRole("slider")) {
        expect(handle).toBeDisabled();
        expect(handle).toHaveAttribute("aria-valuenow", "0");
        expect(handle).toHaveAttribute("aria-valuetext", "Unavailable");
      }
      expect(onRangeChange).not.toHaveBeenCalled();
    },
  );

  it("keeps the active pointer when a second handle is pressed", () => {
    const { onRangeChange } = renderControl({ minRatio: 0.5, maxRatio: 1 });
    mockTrack();
    const [minimum, maximum] = screen.getAllByRole("slider");
    fireEvent.pointerDown(minimum, { pointerId: 1, button: 0 });
    fireEvent.pointerDown(maximum, { pointerId: 2, button: 0 });
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 300 });
    expect(onRangeChange).not.toHaveBeenCalled();
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 250 });
    expect(onRangeChange).toHaveBeenLastCalledWith({
      minRatio: 0.625,
      maxRatio: 1,
    });
    fireEvent.pointerUp(window, { pointerId: 1 });
  });

  it("gives a ten-cent selection useful travel and fits a newly chosen preset", () => {
    const onRangeChange = vi.fn();
    const { rerender } = render(
      <PriceRangeSlider
        basePriceUsd={14.28}
        range={{ minRatio: 7.85 / 14.28, maxRatio: 7.95 / 14.28 }}
        onRangeChange={onRangeChange}
      />,
    );
    expect(screen.getByText("$7.80")).toBeInTheDocument();
    expect(screen.getByText("$8.00")).toBeInTheDocument();
    const handles = screen.getAllByRole("slider");
    expect(parseFloat(handles[0].style.left)).toBeCloseTo(25);
    expect(parseFloat(handles[1].style.left)).toBeCloseTo(75);
    rerender(
      <PriceRangeSlider
        basePriceUsd={14.28}
        range={{ minRatio: 4.89 / 14.28, maxRatio: 4.99 / 14.28 }}
        onRangeChange={onRangeChange}
        resetKey={1}
      />,
    );
    expect(screen.getByText("$4.84")).toBeInTheDocument();
    expect(screen.getByText("$5.04")).toBeInTheDocument();
    expect(onRangeChange).not.toHaveBeenCalled();
  });

  it("keeps keyboard nudges on a stable scale and refits when the handle loses focus", () => {
    const { onRangeChange } = renderControl({
      minRatio: 0.785,
      maxRatio: 0.795,
    });
    const maximum = screen.getByRole("slider", {
      name: "Maximum price handle",
    });
    fireEvent.keyDown(maximum, { key: "ArrowRight" });
    fireEvent.keyDown(maximum, { key: "ArrowRight" });
    expect(onRangeChange.mock.lastCall?.[0].maxRatio).toBeCloseTo(0.797);
    expect(screen.getByText("$7.80")).toBeInTheDocument();
    expect(screen.getByText("$8.00")).toBeInTheDocument();
    fireEvent.blur(maximum);
    expect(screen.getByText("$7.79")).toBeInTheDocument();
    expect(screen.getByText("$8.03")).toBeInTheDocument();
  });

  it.each(["min", "max"] as const)(
    "accepts an equal %s dollar bound after keyboard nudges",
    (bound) => {
      const initialRange =
        bound === "min"
          ? { minRatio: 0.5, maxRatio: 7.95 / 8 }
          : { minRatio: 8.01 / 8, maxRatio: 2 };
      const { onRangeChange } = renderControl(initialRange, 8);
      const handle = screen.getByRole("slider", {
        name: bound === "min" ? "Maximum price handle" : "Minimum price handle",
      });
      const key = bound === "min" ? "ArrowRight" : "ArrowLeft";
      fireEvent.keyDown(handle, { key });
      fireEvent.keyDown(handle, { key });
      fireEvent.keyDown(handle, { key });
      const oppositeRatio =
        onRangeChange.mock.lastCall?.[0][
          bound === "min" ? "maxRatio" : "minRatio"
        ];
      const input = screen.getByRole("spinbutton", {
        name: bound === "min" ? "Minimum price" : "Maximum price",
      });
      fireEvent.change(input, { target: { value: "7.98" } });
      fireEvent.blur(input);
      expect(onRangeChange).toHaveBeenLastCalledWith({
        minRatio: oppositeRatio,
        maxRatio: oppositeRatio,
      });
      expect(
        screen.queryByText("Minimum price cannot exceed maximum price."),
      ).not.toBeInTheDocument();
    },
  );

  it("keeps a zero-priced collapsed range usable without negative prices", () => {
    const { onRangeChange } = renderControl({ minRatio: 0, maxRatio: 0 });
    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(screen.getByText("$0.02")).toBeInTheDocument();
    const maximum = screen.getByRole("slider", {
      name: "Maximum price handle",
    });
    fireEvent.keyDown(maximum, { key: "ArrowRight" });
    expect(onRangeChange).toHaveBeenLastCalledWith({
      minRatio: 0,
      maxRatio: 0.001,
    });
  });

  it("presents one pair of dollar inputs with derived percentages and dollar slider semantics", () => {
    renderControl();
    expect(screen.getAllByRole("spinbutton")).toHaveLength(2);
    expect(
      screen.getByRole("spinbutton", { name: "Minimum price" }),
    ).toHaveValue(6);
    expect(
      screen.getByRole("spinbutton", { name: "Maximum price" }),
    ).toHaveValue(9);
    expect(
      screen.getByTestId("price-range-min-standard-share"),
    ).toHaveTextContent("60%");
    expect(
      screen.getByTestId("price-range-max-standard-share"),
    ).toHaveTextContent("90%");
    expect(
      screen.queryByTestId("price-range-min-ratio-input"),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("slider")).toHaveLength(2);
    const minimum = screen.getByRole("slider", {
      name: "Minimum price handle",
    });
    expect(minimum).toHaveAttribute("aria-valuenow", "6");
    expect(minimum).toHaveAttribute("aria-valuemin", "4.5");
    expect(minimum).toHaveAttribute("aria-valuemax", "9");
    expect(minimum).toHaveAttribute("aria-valuetext", "$6.00");
    expect(screen.getByText("$4.50")).toBeInTheDocument();
    expect(screen.getByText("$10.50")).toBeInTheDocument();
  });

  it("commits dollar entry on blur without rounding its canonical ratio", () => {
    const { onRangeChange } = renderControl(
      { minRatio: 0.5, maxRatio: 1 },
      8.13,
    );
    const input = screen.getByRole("spinbutton", { name: "Minimum price" });
    fireEvent.change(input, { target: { value: "5.17" } });
    expect(onRangeChange).not.toHaveBeenCalled();
    expect(input).toHaveValue(5.17);
    fireEvent.blur(input);

    expect(onRangeChange).toHaveBeenCalledExactlyOnceWith({
      minRatio: 5.17 / 8.13,
      maxRatio: 1,
    });
    expect(input).toHaveValue(5.17);
    expect(
      screen.getByRole("slider", { name: "Minimum price handle" }),
    ).toHaveAttribute("aria-valuetext", "$5.17");
    expect(
      screen.getByTestId("price-range-min-standard-share"),
    ).toHaveTextContent("63.6%");
  });

  it("commits once on Enter and leaves the other bound unchanged", () => {
    const { onRangeChange } = renderControl();
    const input = screen.getByRole("spinbutton", { name: "Maximum price" });
    input.focus();
    fireEvent.change(input, { target: { value: "8.14" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRangeChange).toHaveBeenCalledExactlyOnceWith({
      minRatio: 0.6,
      maxRatio: 8.14 / 10,
    });
  });

  it("preserves invalid draft text and validates a crossing only on blur, then accepts a correction", () => {
    const { onRangeChange } = renderControl();
    const input = screen.getByRole("spinbutton", { name: "Minimum price" });
    fireEvent.change(input, { target: { value: "9.50" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.blur(input);
    expect(onRangeChange).not.toHaveBeenCalled();
    expect(input).toHaveValue(9.5);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Minimum price cannot exceed maximum price.",
    );

    fireEvent.change(input, { target: { value: "7.50" } });
    fireEvent.blur(input);
    expect(onRangeChange).toHaveBeenCalledExactlyOnceWith({
      minRatio: 0.75,
      maxRatio: 0.9,
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("accepts prices outside the focused view and refits without clipping the selection", () => {
    const { onRangeChange } = renderControl();
    const minimum = screen.getByRole("spinbutton", { name: "Minimum price" });
    const maximum = screen.getByRole("spinbutton", { name: "Maximum price" });
    for (const input of [minimum, maximum]) {
      expect(input).toHaveAttribute("min", "0");
      expect(input).not.toHaveAttribute("max");
    }
    fireEvent.change(maximum, { target: { value: "20.17" } });
    fireEvent.blur(maximum);
    expect(maximum).toHaveValue(20.17);
    expect(onRangeChange).toHaveBeenLastCalledWith({
      minRatio: 0.6,
      maxRatio: 20.17 / 10,
    });
    expect(screen.getByText("$27.26")).toBeInTheDocument();
    fireEvent.change(minimum, { target: { value: "12.34" } });
    fireEvent.blur(minimum);
    expect(onRangeChange).toHaveBeenLastCalledWith({
      minRatio: 12.34 / 10,
      maxRatio: 20.17 / 10,
    });
    expect(
      screen.getByTestId("price-range-min-standard-share"),
    ).toHaveTextContent("123.4%");
    fireEvent.change(minimum, { target: { value: "1" } });
    fireEvent.blur(minimum);
    expect(minimum).toHaveValue(1);
    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(onRangeChange).toHaveBeenLastCalledWith({
      minRatio: 0.1,
      maxRatio: 20.17 / 10,
    });
    fireEvent.change(minimum, { target: { value: "0" } });
    fireEvent.blur(minimum);
    expect(onRangeChange).toHaveBeenLastCalledWith({
      minRatio: 0,
      maxRatio: 20.17 / 10,
    });
    expect(screen.getByText("$0.00")).toBeInTheDocument();
  });

  it.each(["", "-1", "1e999"])(
    "rejects invalid or negative price entry %j without changing the range",
    (value) => {
      const { onRangeChange } = renderControl();
      const minimum = screen.getByRole("spinbutton", { name: "Minimum price" });
      fireEvent.change(minimum, { target: { value } });
      fireEvent.blur(minimum);
      expect(onRangeChange).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Enter a valid price.",
      );
      expect(minimum).toHaveAttribute("aria-invalid", "true");
      expect(
        screen.getByRole("slider", { name: "Minimum price handle" }),
      ).toHaveAttribute("aria-valuenow", "6");
    },
  );

  it("freezes the expanded slider scale for the whole drag gesture", () => {
    const { onRangeChange } = renderControl({ minRatio: 0.25, maxRatio: 2 });
    mockTrack();
    fireEvent.pointerDown(
      screen.getByRole("slider", { name: "Maximum price handle" }),
      { pointerId: 1, button: 0, clientX: 500 },
    );
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 300 });
    expect(onRangeChange).toHaveBeenLastCalledWith({
      minRatio: 0.25,
      maxRatio: 1.4375,
    });
    expect(screen.getByText("$28.75")).toBeInTheDocument();
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 300 });
    expect(onRangeChange).toHaveBeenLastCalledWith({
      minRatio: 0.25,
      maxRatio: 1.4375,
    });
    fireEvent.pointerUp(window, { pointerId: 1 });
    expect(screen.getByText("$20.32")).toBeInTheDocument();
    expect(screen.queryByText("$28.75")).not.toBeInTheDocument();
  });

  it.each(["Minimum", "Maximum"])(
    "either coincident %s handle can open a collapsed range in either direction",
    (label) => {
      const { onRangeChange } = renderControl({
        minRatio: 0.75,
        maxRatio: 0.75,
      });
      mockTrack();
      fireEvent.pointerDown(
        screen.getByRole("slider", { name: `${label} price handle` }),
        { pointerId: 1, button: 0, clientX: 300 },
      );
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 100 });
      expect(onRangeChange).toHaveBeenLastCalledWith({
        minRatio: 7.48 / 10,
        maxRatio: 0.75,
      });
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 500 });
      expect(onRangeChange).toHaveBeenLastCalledWith({
        minRatio: 0.75,
        maxRatio: 7.52 / 10,
      });
      expect(
        screen.getByRole("spinbutton", { name: "Minimum price" }),
      ).toHaveValue(7.5);
      expect(
        screen.getByRole("spinbutton", { name: "Maximum price" }),
      ).toHaveValue(7.52);
    },
  );

  it("uses a linear track and ignores unrelated pointers and movement after cancellation", () => {
    const { onRangeChange } = renderControl({ minRatio: 0.5, maxRatio: 1 });
    mockTrack();
    fireEvent.pointerDown(
      screen.getByRole("slider", { name: "Minimum price handle" }),
      { pointerId: 7, button: 0 },
    );
    fireEvent.pointerMove(window, { pointerId: 8, clientX: 300 });
    expect(onRangeChange).not.toHaveBeenCalled();
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 250 });
    expect(onRangeChange).toHaveBeenLastCalledWith({
      minRatio: 0.625,
      maxRatio: 1,
    });
    fireEvent.pointerCancel(window, { pointerId: 7 });
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 450 });
    expect(onRangeChange).toHaveBeenCalledTimes(1);
  });

  it("nudges by one cent and clamps keyboard movement at the opposite bound without crossing", () => {
    const { onRangeChange } = renderControl(
      { minRatio: 0.6, maxRatio: 0.8 },
      8,
    );
    const minimum = screen.getByRole("slider", {
      name: "Minimum price handle",
    });
    fireEvent.keyDown(minimum, { key: "ArrowRight" });
    expect(onRangeChange.mock.lastCall?.[0].minRatio).toBeCloseTo(4.81 / 8, 12);
    fireEvent.keyDown(minimum, { key: "End" });
    expect(onRangeChange).toHaveBeenLastCalledWith({
      minRatio: 0.8,
      maxRatio: 0.8,
    });
    fireEvent.keyDown(minimum, { key: "ArrowRight" });
    expect(onRangeChange).toHaveBeenLastCalledWith({
      minRatio: 0.8,
      maxRatio: 0.8,
    });
    const maximum = screen.getByRole("slider", {
      name: "Maximum price handle",
    });
    fireEvent.keyDown(maximum, { key: "Home" });
    expect(onRangeChange).toHaveBeenLastCalledWith({
      minRatio: 0.8,
      maxRatio: 0.8,
    });
  });

  it("updates both bound statuses when a recommendation changes the controlled range", () => {
    const onRangeChange = vi.fn();
    const { rerender } = render(
      <PriceRangeSlider
        basePriceUsd={10}
        range={{ minRatio: 1, maxRatio: 1 }}
        onRangeChange={onRangeChange}
      />,
    );
    rerender(
      <PriceRangeSlider
        basePriceUsd={10}
        range={{ minRatio: 0.55, maxRatio: 0.72 }}
        onRangeChange={onRangeChange}
      />,
    );
    expect(
      screen.getByRole("spinbutton", { name: "Minimum price" }),
    ).toHaveValue(5.5);
    expect(
      screen.getByRole("spinbutton", { name: "Maximum price" }),
    ).toHaveValue(7.2);
    expect(
      screen.getByTestId("price-range-min-standard-share"),
    ).toHaveTextContent("55%");
    expect(
      screen.getByTestId("price-range-max-standard-share"),
    ).toHaveTextContent("72%");
    expect(onRangeChange).not.toHaveBeenCalled();
  });

  it("keeps the active drag and its original anchor when the draft reset signal changes", () => {
    const onRangeChange = vi.fn<(range: PriceRatioRange) => void>();
    const { rerender } = render(
      <PriceRangeSlider
        basePriceUsd={10}
        range={{ minRatio: 0.6, maxRatio: 0.8 }}
        onRangeChange={onRangeChange}
        resetKey={0}
      />,
    );
    mockTrack();
    fireEvent.pointerDown(
      screen.getByRole("slider", { name: "Minimum price handle" }),
      { pointerId: 1, button: 0, clientX: 180 },
    );
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 500 });
    expect(onRangeChange).toHaveBeenLastCalledWith({
      minRatio: 0.8,
      maxRatio: 0.9,
    });

    rerender(
      <PriceRangeSlider
        basePriceUsd={10}
        range={{ minRatio: 0.8, maxRatio: 0.9 }}
        onRangeChange={onRangeChange}
        resetKey={1}
      />,
    );
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 480 });

    expect(onRangeChange).toHaveBeenLastCalledWith({
      minRatio: 0.8,
      maxRatio: 0.88,
    });
  });

  it("replaces an invalid local draft when an external recommendation changes the range", () => {
    const onRangeChange = vi.fn();
    const { rerender } = render(
      <PriceRangeSlider
        basePriceUsd={10}
        range={{ minRatio: 0.6, maxRatio: 0.8 }}
        onRangeChange={onRangeChange}
      />,
    );
    const minimum = screen.getByRole("spinbutton", { name: "Minimum price" });
    fireEvent.change(minimum, { target: { value: "9.75" } });
    fireEvent.blur(minimum);
    expect(minimum).toHaveAttribute("aria-invalid", "true");
    expect(minimum).toHaveValue(9.75);

    rerender(
      <PriceRangeSlider
        basePriceUsd={10}
        range={{ minRatio: 0.55, maxRatio: 0.72 }}
        onRangeChange={onRangeChange}
      />,
    );

    expect(minimum).toHaveValue(5.5);
    expect(
      screen.getByRole("spinbutton", { name: "Maximum price" }),
    ).toHaveValue(7.2);
    expect(
      screen.getByTestId("price-range-min-standard-share"),
    ).toHaveTextContent("55%");
    expect(
      screen.getByTestId("price-range-max-standard-share"),
    ).toHaveTextContent("72%");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(minimum).not.toHaveAttribute("aria-invalid");
    expect(onRangeChange).not.toHaveBeenCalled();
  });
});
