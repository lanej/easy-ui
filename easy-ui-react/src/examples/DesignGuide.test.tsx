import { fireEvent, screen, within } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import {
  mockGetComputedStyle,
  mockIntersectionObserver,
  render,
  userClick,
} from "../utilities/test";
import { PricingExample } from "./DesignGuide.examples";
import { NetworkGuideExample } from "./NetworkGuide.examples";

// Keep these composition tests independent of asynchronous chart/map engines.
vi.mock("../Chart", () => ({
  Chart: ({ title }: { title: string }) => (
    <section aria-label={title}>Chart evidence</section>
  ),
}));
vi.mock("../NetworkMap", () => ({
  NetworkMap: ({
    title,
    selectedFacilityId,
    onFacilitySelect,
  }: {
    title: string;
    selectedFacilityId: string;
    onFacilitySelect: (id: string) => void;
  }) => (
    <section aria-label={title}>
      <p>Map selection: {selectedFacilityId}</p>
      <button onClick={() => onFacilitySelect("buf")}>
        Select Buffalo on map
      </button>
    </section>
  ),
}));

describe("Reusable guide interactions", () => {
  let restoreStyle: () => void;
  let restoreObserver: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    restoreStyle = mockGetComputedStyle();
    restoreObserver = mockIntersectionObserver();
  });
  afterEach(() => {
    restoreStyle();
    restoreObserver();
    vi.useRealTimers();
  });

  it("keeps multiple pricing panels open and retains each audit draft across collapse", async () => {
    const { user } = render(<PricingExample initialTask="audit" />);
    const a = screen.getByRole("button", { name: "Trends and factors for A" });
    const b = screen.getByRole("button", { name: "Trends and factors for B" });
    await userClick(user, a);
    await userClick(user, b);
    expect(a).toHaveAttribute("aria-expanded", "true");
    expect(b).toHaveAttribute("aria-expanded", "true");
    const noteA = screen.getByRole("textbox", {
      name: "Review rationale for proposal A",
    });
    const noteB = screen.getByRole("textbox", {
      name: "Review rationale for proposal B",
    });
    fireEvent.change(noteA, { target: { value: "Check A assumptions" } });
    fireEvent.change(noteB, { target: { value: "Check B constraints" } });
    await userClick(user, a);
    expect(noteA).toBeInTheDocument();
    expect(noteA).not.toBeVisible();
    expect(noteB).toBeVisible();
    await userClick(user, a);
    expect(
      screen.getByRole("textbox", { name: "Review rationale for proposal A" }),
    ).toBe(noteA);
    expect(noteA).toHaveValue("Check A assumptions");
    expect(noteB).toHaveValue("Check B constraints");
  });

  it("scopes pricing disclosure and form relationships across example instances", async () => {
    const { user } = render(
      <>
        <section aria-label="First example">
          <PricingExample initialTask="audit" />
        </section>
        <section aria-label="Second example">
          <PricingExample initialTask="audit" />
        </section>
      </>,
    );
    const first = within(screen.getByRole("region", { name: "First example" }));
    const second = within(
      screen.getByRole("region", { name: "Second example" }),
    );
    const controls = [
      ...first.getAllByRole("button", { name: /Trends and factors/ }),
      ...second.getAllByRole("button", { name: /Trends and factors/ }),
    ];
    expect(
      new Set(controls.map((button) => button.getAttribute("aria-controls")))
        .size,
    ).toBe(6);
    for (const button of controls)
      expect(
        document.getElementById(button.getAttribute("aria-controls")!),
      ).toBeInTheDocument();
    await userClick(
      user,
      second.getByRole("button", { name: "Trends and factors for A" }),
    );
    expect(first.queryByRole("textbox")).not.toBeInTheDocument();
    const note = second.getByRole("textbox", {
      name: "Review rationale for proposal A",
    });
    expect(note).toHaveAccessibleName("Review rationale for proposal A");
    expect(document.querySelectorAll(`[id="${note.id}"]`)).toHaveLength(1);
  });

  it("uses standard keyboard tab navigation and retains linked hub selection across panels", async () => {
    const { user } = render(<NetworkGuideExample initialMode="fragmented" />);
    const network = screen.getByRole("tab", { name: "Network" });
    expect(network).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    await userClick(
      user,
      screen.getByRole("button", { name: "Select Buffalo on map" }),
    );
    expect(
      screen.getByRole("combobox", { name: "Investigate hub" }),
    ).toHaveValue("buf");
    await userClick(user, network);
    await user.keyboard("{ArrowRight}");
    const trajectory = screen.getByRole("tab", { name: "Trajectory" });
    expect(trajectory).toHaveFocus();
    expect(trajectory).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("Map selection: buf")).not.toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Trajectory");
    expect(
      screen.getByRole("region", { name: /Buffalo.*throughput and capacity/ }),
    ).toBeInTheDocument();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Downstream flow" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(network).toHaveFocus();
    expect(screen.getByText("Map selection: buf")).toBeInTheDocument();
  });

  it("generates independent tab and panel IDs in multiple network examples", () => {
    render(
      <>
        <NetworkGuideExample initialMode="fragmented" />
        <NetworkGuideExample initialMode="fragmented" />
      </>,
    );
    const tabs = screen.getAllByRole("tab");
    expect(new Set(tabs.map((tab) => tab.id)).size).toBe(8);
    const panels = screen.getAllByRole("tabpanel");
    expect(new Set(panels.map((panel) => panel.id)).size).toBe(2);
    for (const panel of panels) {
      const tab = document.getElementById(
        panel.getAttribute("aria-labelledby")!,
      );
      expect(tab).toHaveAttribute("aria-controls", panel.id);
    }
  });
});
