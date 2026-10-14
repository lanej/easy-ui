import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { DependencyGraph } from "./DependencyGraph";
import { dependencyGraphDetailsContext } from "./DependencyGraphDetails";
import {
  subgraphNodes as nodes,
  subgraphEdges as edges,
  subgraphGroups as groups,
} from "./DependencyGraph.groups.fixtures";

beforeAll(() => {
  const original = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = vi.fn();
  return () => {
    Element.prototype.scrollIntoView = original;
  };
});

describe("DependencyGraph nested group interaction", () => {
  it("selects a parent and includes descendant resources and internal evidence", () => {
    render(<DependencyGraph nodes={nodes} edges={edges} groups={groups} />);
    fireEvent.click(screen.getByRole("button", { name: "Production" }));
    const details = screen.getByRole("complementary", {
      name: "Graph selection details",
    });
    expect(
      within(details).getByRole("heading", { name: "Production" }),
    ).toBeVisible();
    expect(
      within(details).getByRole("button", {
        name: /primary Change not supplied/,
      }),
    ).toBeVisible();
    expect(
      dependencyGraphDetailsContext({
        nodes,
        edges,
        groups,
        selection: { type: "group", id: "production" },
      }).edges,
    ).toEqual(edges);
  });
  it("retains child collapse state across parent collapse and expansion", () => {
    const { container } = render(
      <DependencyGraph
        nodes={nodes}
        edges={edges}
        groups={groups}
        defaultCollapsedGroupIds={["runtime"]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse Production" }),
    );
    expect(
      container.querySelector('[data-graph-collapsed-group="production"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-graph-collapsed-group="runtime"]'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expand Production" }));
    expect(
      container.querySelector('[data-graph-collapsed-group="runtime"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-graph-group="database"]'),
    ).toBeInTheDocument();
  });
  it("reveals a selected resource through every collapsed ancestor", () => {
    const onCollapsedGroupIdsChange = vi.fn();
    const { container } = render(
      <DependencyGraph
        nodes={nodes}
        edges={edges}
        groups={groups}
        defaultCollapsedGroupIds={["production", "runtime"]}
        defaultSelection={{ type: "node", id: "api" }}
        onCollapsedGroupIdsChange={onCollapsedGroupIdsChange}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Reveal selected resource" }),
    );
    expect(onCollapsedGroupIdsChange).toHaveBeenLastCalledWith([]);
    expect(
      container.querySelector('[data-graph-resource-card="api"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-graph-group="production"]'),
    ).toBeInTheDocument();
  });
  it("keeps collapse controlled and reports the requested group ID", () => {
    const onCollapsedGroupIdsChange = vi.fn();
    const { container, rerender } = render(
      <DependencyGraph
        nodes={nodes}
        edges={edges}
        groups={groups}
        collapsedGroupIds={[]}
        onCollapsedGroupIdsChange={onCollapsedGroupIdsChange}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse Production" }),
    );
    expect(onCollapsedGroupIdsChange).toHaveBeenCalledWith(["production"]);
    expect(
      container.querySelector('[data-graph-group="production"]'),
    ).toBeInTheDocument();
    rerender(
      <DependencyGraph
        nodes={nodes}
        edges={edges}
        groups={groups}
        collapsedGroupIds={["production"]}
        onCollapsedGroupIdsChange={onCollapsedGroupIdsChange}
      />,
    );
    expect(
      container.querySelector('[data-graph-collapsed-group="production"]'),
    ).toBeInTheDocument();
  });
  it("renders invalid containment as an input error even with a selected group", () => {
    render(
      <DependencyGraph
        nodes={nodes}
        edges={edges}
        groups={[
          { id: "production", label: "Production", parentId: "production" },
        ]}
        defaultSelection={{ type: "group", id: "production" }}
      />,
    );
    expect(
      screen.getByText(/Cyclic group hierarchy: production/),
    ).toBeVisible();
  });
});
