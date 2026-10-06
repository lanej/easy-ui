import React from "react";
import { render, screen } from "@testing-library/react";
import LocalShippingIcon from "@easypost/easy-ui-icons/LocalShipping";
import { KpiTile } from "./KpiTile";

it("renders the Logistics Services metric and delta composition", () => {
  render(
    <KpiTile
      icon={LocalShippingIcon}
      metric={{
        label: "Parcels",
        displayValue: "1,440",
        deltaDisplay: "+12%",
        deltaDirection: "positive",
      }}
    />,
  );
  expect(screen.getByText("Parcels")).toBeInTheDocument();
  expect(screen.getByText("1,440")).toBeInTheDocument();
  expect(screen.getByText("+12%")).toHaveAttribute(
    "class",
    expect.stringContaining("toneSuccess"),
  );
});

it("keeps the point-in-time state optional for compact compositions", () => {
  const { rerender } = render(
    <KpiTile
      icon={LocalShippingIcon}
      metric={{ label: "Parcels", displayValue: "0" }}
    />,
  );
  expect(screen.getByText("Point-in-time")).toBeInTheDocument();
  rerender(
    <KpiTile
      icon={LocalShippingIcon}
      metric={{ label: "Parcels", displayValue: "0" }}
      compact
      bare
      hideUnavailableLabel
    />,
  );
  expect(screen.getByText("0")).toBeInTheDocument();
  expect(screen.queryByText("Point-in-time")).toBeNull();
});
