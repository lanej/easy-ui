import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { DependencyGraph } from "./DependencyGraph";
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

it("switches presentation without losing selection, scope, or field disclosure", () => {
  const { container } = render(
    <DependencyGraph
      nodes={nodes}
      edges={edges}
      groups={groups}
      defaultPresentation="tree"
      defaultSelection={{ type: "node", id: "api" }}
      defaultView={{ scope: "dependencies", nodeId: "api", depth: 1 }}
      defaultExpandedChangeNodeIds={["api"]}
    />,
  );
  expect(screen.getByRole("treegrid", { name: "Resource tree" })).toBeVisible();
  expect(
    container.querySelector('[data-tree-node="audit"]'),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Hide attribute differences for api" }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Graph" }));
  expect(screen.queryByRole("treegrid")).not.toBeInTheDocument();
  expect(container.querySelector('[data-graph-node="api"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "Tree" }));
  expect(container.querySelector('[data-tree-node="api"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    container.querySelector('[data-tree-node="audit"]'),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Hide attribute differences for api" }),
  ).toBeVisible();
});

it("retains child folds and exposes counts when folding a parent", () => {
  const { container } = render(
    <DependencyGraph
      nodes={nodes}
      edges={edges}
      groups={groups}
      defaultPresentation="tree"
      defaultCollapsedGroupIds={["runtime"]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /^Collapse Production/ }));
  expect(
    container.querySelector('[data-tree-node="api"]'),
  ).not.toBeInTheDocument();
  expect(
    container.querySelector('[data-tree-group="production"]'),
  ).toHaveTextContent("4 resources · 1 changed");
  fireEvent.click(screen.getByRole("button", { name: /^Expand Production/ }));
  expect(
    screen.getByRole("button", { name: /^Expand Runtime module/ }),
  ).toBeVisible();
  expect(
    container.querySelector('[data-tree-node="api"]'),
  ).not.toBeInTheDocument();
});

it("respects controlled presentation and collapse requests", () => {
  const onPresentationChange = vi.fn();
  const onCollapsedGroupIdsChange = vi.fn();
  const { rerender } = render(
    <DependencyGraph
      nodes={nodes}
      edges={edges}
      groups={groups}
      presentation="tree"
      onPresentationChange={onPresentationChange}
      collapsedGroupIds={[]}
      onCollapsedGroupIdsChange={onCollapsedGroupIdsChange}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Graph" }));
  expect(onPresentationChange).toHaveBeenCalledWith("graph");
  expect(screen.getByRole("treegrid")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /^Collapse Production/ }));
  expect(onCollapsedGroupIdsChange).toHaveBeenCalledWith(["production"]);
  expect(
    screen.getByRole("button", { name: /^Collapse Production/ }),
  ).toBeVisible();
  rerender(
    <DependencyGraph
      nodes={nodes}
      edges={edges}
      groups={groups}
      presentation="tree"
      collapsedGroupIds={["production"]}
    />,
  );
  expect(
    screen.getByRole("button", { name: /^Expand Production/ }),
  ).toBeVisible();
});

it("reveals a resource and its ancestors from search without losing the current scope", () => {
  const { container } = render(
    <DependencyGraph
      nodes={nodes}
      edges={edges}
      groups={groups}
      defaultPresentation="tree"
      defaultCollapsedGroupIds={["production", "runtime"]}
    />,
  );
  fireEvent.change(screen.getByRole("searchbox", { name: "Find resource" }), {
    target: { value: "api" },
  });
  fireEvent.click(
    within(
      screen.getByRole("region", { name: "Resource search results" }),
    ).getByRole("button"),
  );
  expect(container.querySelector('[data-tree-node="api"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    container.querySelector('[data-tree-node="audit"]'),
  ).toBeInTheDocument();
  expect(screen.getByRole("searchbox")).toHaveValue("");
});

it("reveals a shared reference without changing the filtered scope", () => {
  const data = [
    { id: "a", label: "Network" },
    { id: "b", label: "Database" },
    { id: "c", label: "Identity" },
    { id: "d", label: "API" },
  ];
  const links = [
    { id: "ab", source: "a", target: "b" },
    { id: "ac", source: "a", target: "c" },
    { id: "bd", source: "b", target: "d" },
    { id: "cd", source: "c", target: "d" },
  ];
  const onViewChange = vi.fn();
  const { container } = render(
    <DependencyGraph
      nodes={data}
      edges={links}
      defaultPresentation="tree"
      defaultCollapsedNodeIds={["b"]}
      onViewChange={onViewChange}
      showDetails={false}
    />,
  );
  expect(
    container.querySelector('[data-tree-node="d"]'),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Reveal primary row for API" }),
  );
  expect(container.querySelector('[data-tree-node="d"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(onViewChange).not.toHaveBeenCalled();
});

it("shows inline diffs and annotations without an inspector", () => {
  render(
    <DependencyGraph
      nodes={nodes}
      edges={edges}
      groups={groups}
      defaultPresentation="tree"
      showDetails={false}
      renderNodeAnnotation={(node) =>
        node.id === "api" ? <span>Review required</span> : null
      }
      renderAttributeAnnotation={() => <span>Caller-owned field finding</span>}
    />,
  );
  expect(screen.getByText("Review required")).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Show attribute differences for api" }),
  );
  expect(screen.getByText("Caller-owned field finding")).toBeVisible();
  expect(screen.getByText("app:v1")).toBeVisible();
  expect(screen.getByText("app:v2")).toBeVisible();
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
});

it("uses normal tree density while retaining the graph zoom", () => {
  const { container } = render(<DependencyGraph nodes={nodes} edges={edges} />);
  fireEvent.click(screen.getByRole("button", { name: "Zoom out graph" }));
  fireEvent.click(screen.getByRole("button", { name: "Zoom out graph" }));
  const zoom = screen.getByLabelText("Graph zoom").textContent;
  fireEvent.click(screen.getByRole("button", { name: "Tree" }));
  const root = container.querySelector("[data-dependency-graph]");
  expect(root).toHaveAttribute("data-graph-density", "detail");
  expect(root).toHaveStyle({ "--dependency-graph-zoom": "1" });
  fireEvent.click(screen.getByRole("button", { name: "Graph" }));
  expect(screen.getByLabelText("Graph zoom")).toHaveTextContent(zoom!);
});
