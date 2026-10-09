import React from "react";
import { screen } from "@testing-library/react";
import { render } from "../utilities/test";
import { ObservationFreshness } from "./ObservationFreshness";

describe("<ObservationFreshness />", () => {
  it.each([
    "15 janvier 2026",
    "not a timestamp",
    "2026-02-30",
    "2026-01-15T25:30:00Z",
    "2026-01-15T10:30:00",
  ])(
    "omits malformed timestamp %s without changing freshness",
    (observedAt) => {
      const { container } = render(
        <ObservationFreshness state="stale" observedAt={observedAt} />,
      );
      expect(screen.getByRole("img", { name: "Stale" })).toBeVisible();
      expect(screen.getByText("Stale")).toBeVisible();
      expect(container.querySelector("time")).toBeNull();
      expect(screen.queryByText(observedAt)).not.toBeInTheDocument();
    },
  );
  it.each(["2026-01-15", "2026-01-15T10:30:00+01:00"])(
    "retains valid machine-readable timestamp %s",
    (observedAt) => {
      render(<ObservationFreshness state="fresh" observedAt={observedAt} />);
      expect(screen.getByText(observedAt)).toHaveAttribute(
        "datetime",
        observedAt,
      );
    },
  );
  it("keeps caller freshness independent of the timestamp age", () => {
    render(
      <ObservationFreshness state="fresh" observedAt="2000-01-01T00:00:00Z" />,
    );
    expect(screen.getByRole("img", { name: "Fresh" })).toBeVisible();
    expect(screen.getByText("2000-01-01T00:00:00Z")).toBeVisible();
    expect(
      screen.queryByRole("img", { name: "Stale" }),
    ).not.toBeInTheDocument();
  });
  it("distinguishes stale from unavailable and suppresses prior observations", () => {
    const { rerender } = render(
      <ObservationFreshness state="stale" observedAt="2026-01-15T10:30:00Z" />,
    );
    expect(screen.getByRole("img", { name: "Stale" })).toBeVisible();
    expect(screen.getByText("Stale")).toBeVisible();
    rerender(
      <ObservationFreshness
        state="unavailable"
        observedAt="2026-01-15T10:30:00Z"
      />,
    );
    expect(screen.getByText("Unavailable")).toBeVisible();
    expect(screen.queryByText("2026-01-15T10:30:00Z")).not.toBeInTheDocument();
  });
  it("suppresses prior state and timestamp while loading", () => {
    render(
      <ObservationFreshness
        state="stale"
        observedAt="2026-01-15T10:30:00Z"
        isLoading
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.getByRole("group")).toHaveAttribute("aria-busy", "true");
    expect(
      screen.queryByRole("img", { name: "Stale" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("2026-01-15T10:30:00Z")).not.toBeInTheDocument();
  });
  it("uses caller formatting and retains a machine readable timestamp", () => {
    render(
      <ObservationFreshness
        state="stale"
        observedAt={new Date("2026-01-15T10:30:00Z")}
        stateLabel="Anciennes"
        observedAtLabel="Observé"
        formatObservedAt={() => "15 janvier"}
      />,
    );
    expect(screen.getByRole("img", { name: "Anciennes" })).toBeVisible();
    expect(screen.getByText("15 janvier")).toHaveAttribute(
      "datetime",
      "2026-01-15T10:30:00.000Z",
    );
  });
  it("omits the timestamp prefix by default and accepts a caller prefix", () => {
    const { rerender } = render(
      <ObservationFreshness state="fresh" observedAt="2026-01-15" />,
    );
    expect(screen.queryByText(/Observed/)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Fresh" })).toHaveAttribute(
      "title",
      "Fresh",
    );
    expect(screen.queryByText("Fresh")).not.toBeInTheDocument();
    rerender(
      <ObservationFreshness
        state="fresh"
        observedAt="2026-01-15"
        observedAtLabel="Observed"
      />,
    );
    expect(screen.getByText(/Observed/)).toBeVisible();
    expect(screen.getByText("2026-01-15")).toHaveAttribute(
      "datetime",
      "2026-01-15",
    );
  });
  it("retains state without an invalid Date", () => {
    render(<ObservationFreshness state="fresh" observedAt={new Date(NaN)} />);
    expect(screen.getByRole("img", { name: "Fresh" })).toBeVisible();
    expect(screen.queryByText(/Observed/)).not.toBeInTheDocument();
  });
});
