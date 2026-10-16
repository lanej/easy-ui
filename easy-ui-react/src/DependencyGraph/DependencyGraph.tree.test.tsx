import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { DependencyGraph } from "./DependencyGraph";
import DatabaseIcon from "@easypost/easy-ui-icons/Database";
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
      showDetails={false}
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

it("keeps branch differences independently reachable through the field count", () => {
  const { container } = render(
    <DependencyGraph
      nodes={nodes}
      edges={edges}
      defaultPresentation="tree"
      showDetails={false}
    />,
  );
  const fields = screen.getByRole("button", {
    name: "Show attribute differences for api",
  });
  expect(fields).toHaveTextContent("1 field");
  fireEvent.click(fields);
  expect(screen.getByText("app:v2")).toBeVisible();
  expect(container.querySelector('[data-tree-node="output"]')).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /^Collapse api/ }));
  expect(
    container.querySelector('[data-tree-node="output"]'),
  ).not.toBeInTheDocument();
  expect(screen.getByText("app:v2")).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Hide attribute differences for api" }),
  );
  expect(screen.queryByText("app:v2")).not.toBeInTheDocument();
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

it("opens complete inspector content in a row drawer and keeps its resource icon", () => {
  const renderDetails = vi.fn(({ node }) => <p>Evidence for {node?.id}</p>);
  const { container } = render(
    <DependencyGraph
      nodes={nodes.map((node) => ({
        ...node,
        icon: DatabaseIcon,
        iconLabel: "Database",
      }))}
      edges={edges}
      groups={groups}
      defaultPresentation="tree"
      defaultChangePresentation="diff"
      renderDetails={renderDetails}
      renderAttributeAnnotation={() => <span>Review this field</span>}
    />,
  );
  expect(renderDetails).not.toHaveBeenCalled();
  const row = container.querySelector('[data-tree-node="api"]')!;
  const icon = row.querySelector("[data-tree-row-header] > span > svg");
  expect(icon).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show details for api" }));
  const drawer = screen.getByRole("region", { name: "Details for api" });
  expect(row).toContainElement(drawer);
  expect(within(drawer).getByText("Evidence for api")).toBeVisible();
  expect(within(drawer).getByText("app:v1")).toBeVisible();
  expect(within(drawer).getByText("app:v2")).toBeVisible();
  expect(within(drawer).getByText("Review this field")).toBeVisible();
  expect(
    within(drawer).getByRole("heading", {
      name: "Connected relationships (4)",
    }),
  ).toBeVisible();
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  expect(icon).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Close details for api" }),
  );
  expect(
    screen.queryByRole("region", { name: "Details for api" }),
  ).not.toBeInTheDocument();
  expect(icon).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Show details for audit" }),
  );
  expect(
    screen.getByRole("region", { name: "Details for audit" }),
  ).toBeVisible();
});

it("keeps relationship details in the originating drawer and reveals folded endpoints", () => {
  const { container } = render(
    <DependencyGraph
      nodes={nodes}
      edges={edges.map((edge) => ({
        ...edge,
        description: "Supplied relationship evidence",
      }))}
      groups={groups}
      defaultPresentation="tree"
      defaultSelection={{ type: "node", id: "api" }}
      defaultCollapsedGroupIds={["database"]}
    />,
  );
  fireEvent.click(
    within(screen.getByRole("region", { name: "Details for api" })).getByRole(
      "button",
      { name: /primary is a dependency of api/ },
    ),
  );
  const relationship = screen.getByRole("region", {
    name: "Details for Relationship",
  });
  expect(container.querySelector('[data-tree-node="api"]')).toContainElement(
    relationship,
  );
  expect(
    within(relationship).getByText("Supplied relationship evidence"),
  ).toBeVisible();
  fireEvent.click(
    within(relationship).getByRole("button", { name: "Inspect dependency" }),
  );
  expect(container.querySelector('[data-tree-node="db"]')).toContainElement(
    screen.getByRole("region", { name: "Details for primary" }),
  );
  expect(
    screen.queryByRole("region", { name: "Details for Relationship" }),
  ).not.toBeInTheDocument();
});

it("controls drawer visibility through selection and restores the sidebar on Graph", () => {
  const onSelectionChange = vi.fn();
  const props = { nodes, edges, groups, onSelectionChange };
  const { rerender } = render(
    <DependencyGraph
      {...props}
      defaultPresentation="tree"
      selection={{ type: "node", id: "api" }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Hide details for api" }));
  expect(onSelectionChange).toHaveBeenLastCalledWith(null);
  expect(screen.getByRole("region", { name: "Details for api" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Graph" }));
  expect(
    screen.getByRole("complementary", { name: "Graph selection details" }),
  ).toHaveTextContent("api");
  fireEvent.click(screen.getByRole("button", { name: "Tree" }));
  expect(screen.getByRole("region", { name: "Details for api" })).toBeVisible();
  rerender(
    <DependencyGraph {...props} defaultPresentation="tree" selection={null} />,
  );
  expect(
    screen.queryByRole("region", { name: "Details for api" }),
  ).not.toBeInTheDocument();
});

it("keeps selected relationships reachable when endpoints or owners are folded or unavailable", () => {
  const props = { nodes, edges, groups, defaultPresentation: "tree" as const };
  const { container, rerender } = render(
    <DependencyGraph
      {...props}
      selection={{ type: "edge", id: "db-api" }}
      collapsedGroupIds={["database"]}
    />,
  );
  expect(container.querySelector('[data-tree-node="api"]')).toContainElement(
    screen.getByRole("region", { name: "Details for Relationship" }),
  );
  rerender(
    <DependencyGraph
      {...props}
      selection={{ type: "edge", id: "db-api" }}
      collapsedGroupIds={["production"]}
    />,
  );
  expect(
    container.querySelector('[data-tree-group="production"]'),
  ).toContainElement(
    screen.getByRole("region", { name: "Details for Relationship" }),
  );
  rerender(
    <DependencyGraph
      {...props}
      selection={{ type: "edge", id: "db-api" }}
      view={{ scope: "dependencies", nodeId: "audit", depth: 0 }}
    />,
  );
  expect(
    screen.getByRole("region", { name: "Details for Relationship" }),
  ).toHaveTextContent("primary");
  rerender(
    <DependencyGraph
      {...props}
      edges={[{ id: "missing", source: "unknown-a", target: "unknown-b" }]}
      selection={{ type: "edge", id: "missing" }}
    />,
  );
  expect(
    screen.getByRole("region", { name: "Details for Relationship" }),
  ).toHaveTextContent("Endpoint unavailable");
  rerender(
    <DependencyGraph
      {...props}
      selection={{ type: "group", id: "runtime" }}
      collapsedGroupIds={["production"]}
    />,
  );
  expect(
    screen.getByRole("region", { name: "Details for Runtime module" }),
  ).toBeVisible();
});

it("does not reuse a drawer owner for an unrelated controlled relationship selection", () => {
  const onSelectionChange = vi.fn();
  const props = {
    nodes,
    edges,
    groups,
    onSelectionChange,
    defaultPresentation: "tree" as const,
  };
  const { container, rerender } = render(
    <DependencyGraph {...props} selection={{ type: "node", id: "api" }} />,
  );
  fireEvent.click(
    within(screen.getByRole("region", { name: "Details for api" })).getByRole(
      "button",
      { name: /primary is a dependency of api/ },
    ),
  );
  expect(onSelectionChange).toHaveBeenLastCalledWith({
    type: "edge",
    id: "db-api",
  });
  rerender(
    <DependencyGraph {...props} selection={{ type: "edge", id: "db-api" }} />,
  );
  expect(container.querySelector('[data-tree-node="api"]')).toContainElement(
    screen.getByRole("region", { name: "Details for Relationship" }),
  );
  rerender(
    <DependencyGraph {...props} selection={{ type: "edge", id: "db-user" }} />,
  );
  expect(container.querySelector('[data-tree-node="db"]')).toContainElement(
    screen.getByRole("region", { name: "Details for Relationship" }),
  );
});

it("retains relationship inspection with an empty scope or no available endpoints", () => {
  const { rerender } = render(
    <DependencyGraph
      nodes={[
        { id: "a", label: "A", change: "unchanged" },
        { id: "b", label: "B", change: "unchanged" },
      ]}
      edges={[{ id: "ab", source: "a", target: "b" }]}
      defaultPresentation="tree"
      defaultView={{ scope: "changes" }}
      selection={{ type: "edge", id: "ab" }}
    />,
  );
  expect(screen.getByText("No resources in this view.")).toBeVisible();
  expect(
    screen.getByRole("region", { name: "Details for Relationship" }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Inspect dependency" }));
  expect(screen.getByRole("treegrid")).toBeVisible();
  rerender(
    <DependencyGraph
      nodes={[]}
      edges={[{ id: "ab", source: "a", target: "b" }]}
      defaultPresentation="tree"
      selection={{ type: "edge", id: "ab" }}
    />,
  );
  expect(
    screen.getByRole("region", { name: "Details for Relationship" }),
  ).toHaveTextContent("Endpoint unavailable");
});
