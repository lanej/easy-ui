import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { DependencyGraph } from "./DependencyGraph";
import { DependencyGraphIdentity } from "./DependencyGraphIdentity";
import type { DependencyGraphNode } from "./types";
const nodes: readonly DependencyGraphNode[] = [
  {
    id: "source",
    label: "Source edit",
    categories: [{ label: "Source modified" }],
  },
  {
    id: "unknown",
    label: "Unknown plan",
    change: "unknown",
    categories: [{ label: "Source unchanged" }],
  },
  { id: "unchanged", label: "No-op plan", change: "unchanged" },
];
describe("resource category pills", () => {
  it("keeps categorical source evidence separate from plan actions", () => {
    const { container } = render(<DependencyGraph nodes={nodes} edges={[]} />);
    const source = container.querySelector(
      '[data-graph-resource-card="source"]',
    ) as HTMLElement;
    expect(within(source).getByText("Source modified")).toHaveAttribute(
      "data-graph-category",
    );
    expect(source.querySelector("[data-change]")).toBeNull();
    expect(source).not.toHaveAttribute("data-change");
    expect(
      screen.getByRole("button", { name: "Source edit, Source modified" }),
    ).toBeVisible();
    const unknown = container.querySelector(
      '[data-graph-resource-card="unknown"]',
    ) as HTMLElement;
    expect(within(unknown).getByText("Source unchanged")).toHaveAttribute(
      "data-graph-category",
    );
    expect(unknown.querySelector('[data-change="unknown"]')).toHaveTextContent(
      "Change unknown",
    );
    const unchanged = container.querySelector(
      '[data-graph-resource-card="unchanged"]',
    ) as HTMLElement;
    expect(
      unchanged.querySelector('[data-change="unchanged"]'),
    ).toHaveTextContent("Unchanged");
  });
  it("keeps categories searchable and available in the inspector", () => {
    render(<DependencyGraph nodes={nodes} edges={[]} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Find resource" }), {
      target: { value: "Source modified" },
    });
    expect(
      within(
        screen.getByRole("region", { name: "Resource search results" }),
      ).getByRole("status"),
    ).toHaveTextContent("1 matching resources");
    fireEvent.click(
      screen.getByRole("button", { name: "Source edit, Source modified" }),
    );
    const details = screen.getByRole("complementary");
    expect(within(details).getByText("Source modified")).toHaveAttribute(
      "data-graph-category",
    );
    expect(within(details).getByText("Change not supplied")).toBeVisible();
  });
  it("does not infer pills from prose or render empty categories", () => {
    const { container } = render(
      <DependencyGraphIdentity
        node={{
          id: "prose",
          label: "Resource",
          description: "Source unchanged",
          categories: [{ label: "" }, { label: "  " }],
        }}
        overview={false}
      />,
    );
    expect(screen.getByText("Source unchanged")).not.toHaveAttribute(
      "data-graph-category",
    );
    expect(container.querySelector("[data-graph-category]")).toBeNull();
    expect(container.querySelector("[data-change]")).toBeNull();
  });
  it("retains category labels and accessible plan meaning in the overview", () => {
    render(<DependencyGraphIdentity node={nodes[1]} overview />);
    expect(screen.getByText("Source unchanged")).toHaveAttribute(
      "data-graph-category",
    );
    expect(
      screen.getByRole("img", { name: "Change unknown" }),
    ).toHaveTextContent("?");
  });
});
