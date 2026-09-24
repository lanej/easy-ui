import React from "react";
import { screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { BarList } from "./BarList";

it("preserves exact category values and distinguishes zero from missing magnitudes", () => {
  const { container } = render(
    <BarList
      label="June volume"
      formatValue={(value) => `${value} parcels`}
      data={[
        { id: "a", label: "Ground", value: 10 },
        { id: "b", label: "Air", value: 5 },
        { id: "c", label: "Zero", value: 0 },
        { id: "d", label: "Missing", value: null },
        { id: "e", label: "Invalid", value: Infinity },
      ]}
    />,
  );
  const items = within(
    screen.getByRole("list", { name: "June volume" }),
  ).getAllByRole("listitem");
  expect(items.map((item) => item.textContent)).toEqual([
    "Ground10 parcels",
    "Air5 parcels",
    "Zero0 parcels",
    "MissingNo data",
    "InvalidInvalid value",
  ]);
  expect(
    [
      ...container.querySelectorAll<HTMLElement>(
        '[aria-hidden="true"] > [style]',
      ),
    ].map((bar) => bar.style.width),
  ).toEqual(["100%", "50%", "0%"]);
});

it("uses a caller-supplied shared maximum without rescaling each list", () => {
  const { container } = render(
    <>
      <BarList
        label="First"
        max={100}
        data={[
          { id: "a", label: "A", value: 50 },
          { id: "z", label: "Zero", value: 0 },
        ]}
      />
      <BarList
        label="Second"
        max={100}
        data={[
          { id: "b", label: "B", value: 50 },
          { id: "c", label: "C", value: 10 },
        ]}
      />
    </>,
  );
  expect(
    [
      ...container.querySelectorAll<HTMLElement>(
        '[aria-hidden="true"] > [style]',
      ),
    ].map((bar) => bar.style.width),
  ).toEqual(["50%", "0%", "50%", "10%"]);
});

it("preserves overflow values, supports explicit clamping, and rejects invalid maxima", () => {
  const props = {
    label: "Shared",
    data: [{ id: "a", label: "A", value: 120 }],
  };
  const { container, rerender } = render(<BarList {...props} max={100} />);
  expect(screen.getByText("120 · Outside scale")).toBeInTheDocument();
  expect(container.querySelector('[aria-hidden="true"] > [style]')).toBeNull();
  rerender(<BarList {...props} max={100} overflow="clamp" />);
  expect(
    container.querySelector<HTMLElement>('[data-overflow="true"]')?.style.width,
  ).toBe("100%");
  rerender(<BarList {...props} max={NaN} />);
  expect(screen.getByText("Invalid scale")).toBeInTheDocument();
  expect(screen.getByText("120")).toBeInTheDocument();
  expect(container.querySelector('[aria-hidden="true"] > [style]')).toBeNull();
});
