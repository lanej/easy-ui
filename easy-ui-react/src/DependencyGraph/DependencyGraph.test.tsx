import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { DependencyGraph } from "./DependencyGraph";
import { DependencyGraphDetails } from "./DependencyGraphDetails";
import { DependencyGraphChanges } from "./DependencyGraphChanges";
import { DependencyGraphReviewExample } from "./DependencyGraph.examples";
import {
  dependencyNodes as nodes,
  dependencyEdges as edges,
  dependencyGroups as groups,
  subnetId,
} from "./DependencyGraph.fixtures";

describe("DependencyGraph interaction contract", () => {
  it("does not label absent change evidence as unchanged", () => {
    render(
      <DependencyGraph
        title="Graph"
        nodes={[{ id: "a", label: "Resource A" }]}
        edges={[]}
        defaultSelection={{ type: "node", id: "a" }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Resource A, Change unknown" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Unchanged")).not.toBeInTheDocument();
  });
  it("keeps the review example interactive when Storybook supplies action callbacks", () => {
    const change = vi.fn();
    render(<DependencyGraphReviewExample onSelectionChange={change} />);
    fireEvent.click(
      screen.getByRole("button", { name: /^Shipping API, Update/ }),
    );
    expect(
      screen.getByRole("heading", { name: "Shipping API" }),
    ).toBeInTheDocument();
    expect(change).toHaveBeenCalledWith({
      type: "node",
      id: "azurerm_container_app.api",
    });
  });
  it("requests original node IDs without mutating controlled selection or moving the layout", () => {
    const change = vi.fn();
    const { container, rerender } = render(
      <DependencyGraph
        title="Graph"
        nodes={nodes}
        edges={edges}
        groups={groups}
        selection={null}
        onSelectionChange={change}
      />,
    );
    const initial = [
      ...container.querySelectorAll<HTMLElement>("[data-graph-item-card]"),
    ].map((node) => node.style.cssText);
    const subnet = screen.getByRole("button", {
      name: /^Application subnet, Replace/,
    });
    fireEvent.click(subnet);
    expect(change).toHaveBeenCalledWith({ type: "node", id: subnetId });
    expect(subnet).toHaveAttribute("aria-pressed", "false");
    rerender(
      <DependencyGraph
        title="Graph"
        nodes={nodes}
        edges={edges}
        groups={groups}
        selection={{ type: "node", id: subnetId }}
        onSelectionChange={change}
      />,
    );
    expect(subnet).toHaveAttribute("aria-pressed", "true");
    expect(
      [
        ...container.querySelectorAll<HTMLElement>("[data-graph-item-card]"),
      ].map((node) => node.style.cssText),
    ).toEqual(initial);
  });
  it("grows a directed neighborhood from its original anchor after selecting a dependent", () => {
    const change = vi.fn();
    render(
      <DependencyGraph
        title="Graph"
        nodes={nodes}
        edges={edges}
        defaultView={{ scope: "dependents", nodeId: subnetId }}
        onViewChange={change}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /^Production network, Unchanged/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /^Shipping API, Update/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Expand one level" }));
    expect(change).toHaveBeenLastCalledWith({
      scope: "dependents",
      nodeId: subnetId,
      depth: 2,
    });
    expect(
      screen.getByRole("button", { name: /^API availability alert, Create/ }),
    ).toBeInTheDocument();
  });
  it("keeps collapsed internal edges and bundle identities available in keyboard details", () => {
    const all = [
      { id: "net", label: "Network" },
      { id: "apps", label: "Apps" },
    ];
    const records = [
      { id: "a", label: "A", groupId: "net" },
      { id: "b", label: "B", groupId: "net" },
      { id: "c", label: "C", groupId: "apps" },
    ];
    const links = [
      { id: "internal", source: "a", target: "b" },
      { id: "first", source: "a", target: "c" },
      { id: "second", source: "b", target: "c" },
    ];
    const change = vi.fn();
    const { container } = render(
      <DependencyGraph
        title="Graph"
        nodes={records}
        edges={links}
        groups={all}
        defaultCollapsedGroupIds={["net", "apps"]}
        defaultSelection={{ type: "group", id: "net" }}
        onSelectionChange={change}
      />,
    );
    const details = screen.getByRole("complementary", {
      name: "Graph selection details",
    });
    expect(
      within(details).getAllByRole("button", { name: /Dependency/ }),
    ).toHaveLength(3);
    fireEvent.click(container.querySelector("[data-graph-edge-ids]")!);
    expect(change).toHaveBeenLastCalledWith({
      type: "edges",
      ids: ["first", "second"],
    });
    expect(
      within(details).getAllByRole("button", { name: /Dependency/ }),
    ).toHaveLength(2);
  });
  it("never drops a relationship whose endpoint is missing", () => {
    render(
      <DependencyGraphDetails
        nodes={nodes}
        edges={[{ id: "unknown", source: subnetId, target: "other-root" }]}
        selection={{ type: "edge", id: "unknown" }}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Endpoint unavailable in supplied resources"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Inspect dependency" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Inspect dependent" }),
    ).not.toBeInTheDocument();
  });
  it("reports duplicate IDs and keeps missing controlled selection visibly unavailable", () => {
    const { rerender } = render(
      <DependencyGraph title="Graph" nodes={[nodes[0], nodes[0]]} edges={[]} />,
    );
    expect(screen.getByText(/Duplicate resource ID/)).toBeInTheDocument();
    rerender(
      <DependencyGraph
        title="Graph"
        nodes={nodes}
        edges={edges}
        selection={{ type: "node", id: "removed" }}
      />,
    );
    expect(
      screen.getByText(
        "The selected record is unavailable in the supplied graph.",
      ),
    ).toBeInTheDocument();
  });
  it("supports loading, error recovery, and an empty changed-only view", () => {
    const retry = vi.fn();
    const { rerender } = render(
      <DependencyGraph title="Graph" nodes={[]} edges={[]} status="loading" />,
    );
    expect(screen.getByText("Loading dependencies…")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    rerender(
      <DependencyGraph
        title="Graph"
        nodes={[]}
        edges={[]}
        status="error"
        onRetry={retry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
    rerender(
      <DependencyGraph
        title="Graph"
        nodes={[{ id: "a", label: "A" }]}
        edges={[]}
        defaultView={{ scope: "changes" }}
      />,
    );
    // Defaults initialize once; use controlled view to change an existing component.
    rerender(
      <DependencyGraph
        title="Graph"
        nodes={[{ id: "a", label: "A" }]}
        edges={[]}
        view={{ scope: "changes" }}
      />,
    );
    expect(screen.getByText("No resources in this view.")).toBeInTheDocument();
  });
});

describe("DependencyGraph per-resource changes", () => {
  it("expands attribute differences inside the card independently of selection and the inspector", () => {
    const change = vi.fn();
    const { container } = render(
      <DependencyGraph
        title="Graph"
        nodes={nodes}
        edges={edges}
        showDetails={false}
        onSelectionChange={change}
      />,
    );
    const card = container.querySelector(
      `[data-graph-resource-card="${subnetId}"]`,
    )! as HTMLElement;
    const toggle = within(card).getByRole("button", {
      name: "Show attribute differences for Application subnet",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(card).getByText("10.20.0.0/24")).toBeInTheDocument();
    expect(within(card).getByText("10.20.4.0/24")).toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(card).queryByText("10.20.0.0/24")).not.toBeInTheDocument();
  });
  it("requests original resource IDs and respects controlled card expansion", () => {
    const change = vi.fn();
    const props = {
      title: "Graph",
      nodes,
      edges,
      showDetails: false,
      onExpandedChangeNodeIdsChange: change,
    };
    const { rerender } = render(
      <DependencyGraph {...props} expandedChangeNodeIds={[]} />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Show attribute differences for Application subnet",
      }),
    );
    expect(change).toHaveBeenCalledWith([subnetId]);
    expect(screen.queryByText("10.20.0.0/24")).not.toBeInTheDocument();
    rerender(<DependencyGraph {...props} expandedChangeNodeIds={[subnetId]} />);
    expect(
      screen.getByRole("button", {
        name: "Hide attribute differences for Application subnet",
      }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("10.20.0.0/24")).toBeInTheDocument();
  });
  it("switches between summary and exact diff without moving the graph, and resets for another resource", () => {
    const { container } = render(
      <DependencyGraph
        title="Graph"
        nodes={nodes}
        edges={edges}
        defaultSelection={{ type: "node", id: subnetId }}
      />,
    );
    const details = screen.getByRole("complementary", {
      name: "Graph selection details",
    });
    const positions = [
      ...container.querySelectorAll("[data-graph-item-card]"),
    ].map((node) => node.getAttribute("style"));
    expect(
      within(details).getByText(
        "Address prefix changes; replacement required.",
      ),
    ).toBeInTheDocument();
    expect(within(details).queryByText("10.20.0.0/24")).not.toBeInTheDocument();
    fireEvent.click(
      within(details).getByRole("button", { name: "Specific changes" }),
    );
    expect(within(details).getByText("10.20.0.0/24")).toBeInTheDocument();
    expect(within(details).getByText("10.20.4.0/24")).toBeInTheDocument();
    expect(
      [...container.querySelectorAll("[data-graph-item-card]")].map((node) =>
        node.getAttribute("style"),
      ),
    ).toEqual(positions);
    fireEvent.click(
      screen.getByRole("button", { name: /^Shipping API, Update/ }),
    );
    expect(
      within(details).getByRole("button", { name: "Summary" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(details).getByText("1 added · 1 removed · 3 changed"),
    ).toBeInTheDocument();
    expect(within(details).queryByText("10.20.0.0/24")).not.toBeInTheDocument();
  });
  it("distinguishes additions, removals, empty strings, null text, unknown values, and redaction", () => {
    const { container } = render(
      <DependencyGraphChanges
        defaultPresentation="diff"
        node={{
          id: "a",
          label: "A",
          change: "update",
          changes: [
            { path: "added", type: "add", after: "false" },
            { path: "removed", type: "remove", before: "0" },
            { path: "nullable", type: "change", before: "", after: "null" },
            {
              path: "<script>ignored</script>",
              type: "change",
              before: { status: "redacted" },
              after: { status: "unknown" },
            },
          ],
        }}
      />,
    );
    const rows = (selector: string) =>
      [...container.querySelectorAll(selector)].map((row) => row.textContent);
    expect(rows('[data-diff="addition"]')).toEqual([
      "+Added: false",
      "+Added: null",
      "+Added: Unknown value",
    ]);
    expect(rows('[data-diff="removal"]')).toEqual([
      "−Removed: 0",
      '−Removed: ""',
      "−Removed: Redacted value",
    ]);
    expect(screen.getByText("<script>ignored</script>")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });
  it("keeps controlled presentation under application ownership", () => {
    const change = vi.fn();
    const { rerender } = render(
      <DependencyGraphChanges
        node={nodes[1]}
        presentation="summary"
        onPresentationChange={change}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Specific changes" }));
    expect(change).toHaveBeenCalledWith("diff");
    expect(screen.queryByText("10.20.0.0/24")).not.toBeInTheDocument();
    rerender(
      <DependencyGraphChanges
        node={nodes[1]}
        presentation="diff"
        onPresentationChange={change}
      />,
    );
    expect(screen.getByText("10.20.0.0/24")).toBeInTheDocument();
  });
  it("does not fabricate a field diff from a resource operation or missing evidence", () => {
    const { container, rerender } = render(
      <DependencyGraphChanges
        node={{ id: "a", label: "A", change: "replace" }}
        defaultPresentation="diff"
      />,
    );
    expect(
      screen.getByText("Specific changes were not supplied."),
    ).toBeInTheDocument();
    expect(container.querySelector("[data-diff]")).toBeNull();
    rerender(
      <DependencyGraphChanges
        node={{ id: "a", label: "A", changes: [] }}
        defaultPresentation="diff"
      />,
    );
    expect(screen.getByText("No field changes supplied.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Summary" }));
    expect(screen.getByText("Resource change is unknown.")).toBeInTheDocument();
    expect(
      screen.queryByText("No resource change planned."),
    ).not.toBeInTheDocument();
  });
});
