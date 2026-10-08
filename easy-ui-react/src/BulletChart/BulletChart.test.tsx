import React from "react";
import { screen } from "@testing-library/react";
import { render } from "../utilities/test";
import { BulletChart } from "./BulletChart";

it("keeps the measure, target, and scale meaningful across zero, missing, and out-of-range data", () => {
  const props = {
    label: "On-time delivery",
    target: 97,
    max: 100,
    formatValue: (value: number) => `${value}%`,
  };
  const { rerender } = render(<BulletChart {...props} value={97.8} />);
  expect(screen.getByRole("img")).toHaveAccessibleName(
    "On-time delivery: 97.8%. Target: 97%. 0%–100%.",
  );
  rerender(<BulletChart {...props} value={0} />);
  expect(screen.getByRole("img")).toHaveAccessibleName(
    "On-time delivery: 0%. Target: 97%. 0%–100%.",
  );
  rerender(<BulletChart {...props} value={null} />);
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByText("No data")).toBeInTheDocument();
  expect(screen.getByText("Target: 97%")).toBeInTheDocument();
  rerender(<BulletChart {...props} value={101} />);
  expect(screen.getByRole("img")).toHaveAccessibleName(/101% · Outside scale/);
  expect(screen.getByText("101% · Outside scale")).toBeInTheDocument();
});

it("omits only the outside measure while retaining the valid target and scale", () => {
  const { container, rerender } = render(
    <BulletChart label="Volume" value={120} target={80} max={100} />,
  );
  const plot = screen.getByRole("img");
  expect(plot).toHaveAccessibleName(
    "Volume: 120 · Outside scale. Target: 80. 0–100.",
  );
  expect(plot.children).toHaveLength(1);
  expect((plot.firstElementChild as HTMLElement).style.left).toBe("80%");
  expect((plot.firstElementChild as HTMLElement).style.width).toBe("");
  expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(
    "0100",
  );
  rerender(<BulletChart label="Volume" value={NaN} target={80} max={100} />);
  expect(screen.getByRole("img").children).toHaveLength(1);
  expect(screen.getByText("Invalid value")).toBeInTheDocument();
});

it("separates invalid values and scales from missing data, with explicit clamping", () => {
  const props = { label: "Volume", target: 80, max: 100 };
  const { container, rerender } = render(
    <BulletChart {...props} value={120} overflow="clamp" />,
  );
  expect(screen.getByRole("img")).toHaveAccessibleName(/120 · Outside scale/);
  expect(
    container.querySelector<HTMLElement>('[data-overflow="true"]')?.style.width,
  ).toBe("100%");
  rerender(<BulletChart {...props} value={NaN} />);
  expect(screen.getByText("Invalid value")).toBeInTheDocument();
  expect(screen.queryByText("No data")).toBeNull();
  rerender(<BulletChart {...props} value={42} max={0} />);
  expect(screen.getByText("42")).toBeInTheDocument();
  expect(screen.getByText("Invalid scale")).toBeInTheDocument();
  expect(screen.queryByRole("img")).toBeNull();
});

it("keeps exact accessible values when scale labels are abbreviated", () => {
  const { container } = render(
    <BulletChart
      label="Cost"
      value={1234.56}
      target={1500.25}
      max={2000}
      formatValue={(value) => `$${value.toFixed(2)}`}
      formatAxisValue={(value) => `${value / 1000}k`}
    />,
  );
  expect(screen.getByRole("img")).toHaveAccessibleName(/\$1234.56.*\$1500.25/);
  expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(
    "0k2k",
  );
});
