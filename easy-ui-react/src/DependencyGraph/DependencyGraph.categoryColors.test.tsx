import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { DependencyGraph } from "./DependencyGraph";
import { DependencyGraphIdentity } from "./DependencyGraphIdentity";
import { dependencyGraphCategoryLabels } from "./DependencyGraphCategories";
import type { DependencyGraphNode } from "./types";

const colored: DependencyGraphNode = {
  id: "source",
  label: "Source edit",
  categories: [
    { label: "Source unchanged", variant: "neutral" },
    { label: "Source modified", variant: "primary" },
    { label: "Review requested", variant: "warning" },
    { label: "No variant supplied" },
  ],
};

describe("caller-selected category colors", () => {
  it("keeps explicit and omitted neutral variants independent of plan actions", () => {
    const { container } = render(
      <DependencyGraphIdentity node={colored} overview={false} />,
    );
    expect(screen.getByText("Source unchanged")).toHaveAttribute(
      "data-category-variant",
      "neutral",
    );
    expect(screen.getByText("No variant supplied")).toHaveAttribute(
      "data-category-variant",
      "neutral",
    );
    expect(screen.getByText("Source modified")).toHaveAttribute(
      "data-category-variant",
      "primary",
    );
    expect(screen.getByText("Review requested")).toHaveAttribute(
      "data-category-variant",
      "warning",
    );
    expect(container.querySelector("[data-change]")).toBeNull();
  });

  it("uses object labels for search and accessibility and preserves color in details", () => {
    render(<DependencyGraph nodes={[colored]} edges={[]} />);
    const select = screen.getByRole("button", {
      name: "Source edit, Source unchanged, Source modified, Review requested, No variant supplied",
    });
    const search = screen.getByRole("searchbox", { name: "Find resource" });
    fireEvent.change(search, { target: { value: "Source modified" } });
    const results = screen.getByRole("region", {
      name: "Resource search results",
    });
    expect(within(results).getByRole("status")).toHaveTextContent(
      "1 matching resources",
    );
    fireEvent.change(search, { target: { value: "primary" } });
    expect(within(results).getByRole("status")).toHaveTextContent(
      "0 matching resources",
    );
    fireEvent.change(search, { target: { value: "" } });
    fireEvent.click(select);
    const details = screen.getByRole("complementary");
    expect(within(details).getByText("Source modified")).toHaveAttribute(
      "data-category-variant",
      "primary",
    );
    expect(within(details).getByText("Change not supplied")).toBeVisible();
    expect(select).not.toHaveAccessibleName(/object Object|primary|warning/);
  });

  it("omits empty object labels and preserves the category label in the overview", () => {
    const categories = [
      { label: "" },
      { label: "  ", variant: "danger" },
      { label: "Owner", variant: "secondary" },
    ] as const;
    expect(dependencyGraphCategoryLabels(categories)).toEqual(["Owner"]);
    expect(dependencyGraphCategoryLabels(undefined)).toEqual([]);
    const { container } = render(
      <DependencyGraphIdentity
        node={{ id: "owner", label: "Service", categories }}
        overview
      />,
    );
    expect(container.querySelectorAll("[data-graph-category]")).toHaveLength(1);
    expect(screen.getByText("Owner")).toHaveAttribute(
      "data-category-variant",
      "secondary",
    );
    expect(screen.getByText("Owner")).toHaveAttribute("title", "Owner");
  });

  it("applies color updates without changing labels or the caller's plan state", () => {
    const { rerender } = render(
      <DependencyGraphIdentity
        node={{
          id: "same",
          label: "Service",
          change: "unchanged",
          categories: [{ label: "Owner" }],
        }}
        overview={false}
      />,
    );
    rerender(
      <DependencyGraphIdentity
        node={{
          id: "same",
          label: "Service",
          change: "unchanged",
          categories: [{ label: "Owner", variant: "success" }],
        }}
        overview={false}
      />,
    );
    expect(screen.getByText("Owner")).toHaveAttribute(
      "data-category-variant",
      "success",
    );
    expect(screen.getByRole("img", { name: "Unchanged" })).toHaveTextContent(
      "Unchanged",
    );
  });
});
