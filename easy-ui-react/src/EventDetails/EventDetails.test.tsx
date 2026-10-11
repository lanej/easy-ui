import React from "react";
import { screen } from "@testing-library/react";
import { render } from "../utilities/test";
import { EventDetails } from "./EventDetails";

describe("EventDetails", () => {
  it("preserves occurrence and receipt labels independently without converting timezones", () => {
    render(
      <EventDetails
        event={{
          id: "one",
          timeLabel: "01:10 PDT",
          receivedTimeLabel: "01:05 PDT",
          locationLabel: "Observed location",
        }}
        locationLabel="Fallback location"
        sourceLabel="Original feed"
        showEventId
        identifiers={[{ label: "Source ID", value: "00042" }]}
      />,
    );
    expect(screen.getByText("Event").nextElementSibling).toHaveTextContent(
      "01:10 PDT",
    );
    expect(screen.getByText("Received").nextElementSibling).toHaveTextContent(
      "01:05 PDT",
    );
    expect(screen.getByText("Location").nextElementSibling).toHaveTextContent(
      "Observed location",
    );
    expect(screen.getByText("Source ID").nextElementSibling).toHaveTextContent(
      "00042",
    );
    expect(screen.getByText("Event ID").nextElementSibling).toHaveTextContent(
      "one",
    );
  });
  it("does not substitute receipt time for missing occurrence time", () => {
    render(<EventDetails event={{ id: "one", receivedTimeLabel: "Later" }} />);
    expect(screen.getByText("Event").nextElementSibling).toHaveTextContent(
      "Unknown",
    );
    expect(screen.getByText("Location").nextElementSibling).toHaveTextContent(
      "Not supplied",
    );
    expect(screen.queryByText("Source")).not.toBeInTheDocument();
    expect(screen.queryByText("Event ID")).not.toBeInTheDocument();
  });
  it("supports fallback names and localized metadata without inventing missing fields", () => {
    render(
      <EventDetails
        event={{ id: "one" }}
        locationLabel="Local name"
        labels={{ event: "Occurrence", unknown: "Unavailable" }}
      />,
    );
    expect(screen.getByText("Occurrence").nextElementSibling).toHaveTextContent(
      "Unavailable",
    );
    expect(screen.getByText("Location").nextElementSibling).toHaveTextContent(
      "Local name",
    );
    expect(screen.queryByText("Received")).not.toBeInTheDocument();
  });
});
