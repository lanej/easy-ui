import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { render } from "../utilities/test";
import { DependencyGraph } from "./DependencyGraph";
import { DependencyGraphDetails } from "./DependencyGraphDetails";
import {
  buildDependencyGraph,
  createDependencyGraphOrder,
  NODE_HEIGHT,
  NODE_WIDTH,
} from "./model";
import { realWorldEdges, realWorldNodes } from "./DependencyGraph.realWorld";

const resources = [
  { id: "missing", label: "Missing plan", description: "Source modified" },
  { id: "unknown", label: "Unknown plan", change: "unknown" as const },
  { id: "unchanged", label: "Unchanged plan", change: "unchanged" as const },
];

describe("source-only resource graphs", () => {
  it("distinguishes absent plan data, unknown operations, and unchanged resources", () => {
    const { container } = render(
      <DependencyGraph nodes={resources} edges={[]} />,
    );
    const missing = container.querySelector(
      '[data-graph-resource-card="missing"]',
    )!;
    expect(missing.querySelector("[data-change]")).toBeNull();
    expect(missing).not.toHaveAttribute("data-change");
    expect(
      screen.getByRole("button", { name: "Missing plan, Source modified" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Unknown plan, Change unknown" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Unchanged plan, Unchanged" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Missing plan, Source modified" }),
    );
    expect(
      within(screen.getByRole("complementary")).getByText(
        "Change not supplied",
      ),
    ).toBeVisible();
    expect(screen.queryByText("Update")).not.toBeInTheDocument();
  });

  it("keeps caller-owned names, types, full addresses, and reference evidence", () => {
    const { container } = render(
      <DependencyGraph nodes={realWorldNodes} edges={realWorldEdges} />,
    );
    const card = container.querySelector(
      '[data-graph-resource-card="google_sql_user.pipeline"]',
    ) as HTMLElement;
    expect(within(card).getByText("pipeline")).toBeVisible();
    expect(within(card).getByText("google_sql_user")).toBeVisible();
    expect(card.querySelector("[data-graph-resource-label]")).toHaveAttribute(
      "title",
      "google_sql_user.pipeline",
    );
    const boundary = container.querySelector(
      '[data-graph-resource-card="external:backend_bucket"]',
    ) as HTMLElement;
    expect(boundary).toHaveAttribute("data-node-kind", "unresolved");
    expect(within(boundary).getByText("var.backend_bucket")).toBeVisible();
    expect(within(boundary).getByText("Unresolved")).toBeVisible();
    expect(
      within(boundary).queryByText(/Evidence incomplete/),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(boundary).getByRole("button", {
        name: /^var.backend_bucket, Unresolved/,
      }),
    );
    expect(
      within(screen.getByRole("complementary")).getByText(
        /Evidence incomplete/,
      ),
    ).toBeVisible();
    expect(
      container.querySelectorAll('[data-node-kind="unresolved"]'),
    ).toHaveLength(4);
  });

  it("searches the full address and type without parsing the caller's label", () => {
    render(<DependencyGraph nodes={realWorldNodes} edges={realWorldEdges} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Find resource" }), {
      target: { value: "google_cloud_run_v2_service" },
    });
    expect(
      within(
        screen.getByRole("region", { name: "Resource search results" }),
      ).getByRole("status"),
    ).toHaveTextContent("1 matching resources");
    expect(
      within(
        screen.getByRole("region", { name: "Resource search results" }),
      ).getByText("runtime"),
    ).toBeVisible();
  });

  it("shows full addresses in selection details rather than substituting opaque IDs", () => {
    render(
      <DependencyGraphDetails
        nodes={[
          {
            id: "opaque",
            label: "pipeline",
            typeLabel: "google_sql_user",
            address: "module.runtime.google_sql_user.pipeline",
          },
        ]}
        edges={[]}
        selection={{ type: "node", id: "opaque" }}
        onSelectionChange={() => {}}
      />,
    );
    expect(
      screen.getByText("module.runtime.google_sql_user.pipeline"),
    ).toBeVisible();
    expect(screen.getByText("google_sql_user")).toBeVisible();
    expect(screen.getByText("Record ID: opaque")).toBeVisible();
  });

  it("keeps single-branch controls out of an otherwise empty footer", () => {
    const onSelectionChange = vi.fn();
    const { container } = render(
      <DependencyGraph
        nodes={[
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ]}
        edges={[{ id: "ab", source: "a", target: "b" }]}
        onSelectionChange={onSelectionChange}
      />,
    );
    expect(screen.queryByText("1 branch")).not.toBeInTheDocument();
    expect(
      container.querySelector("[data-graph-attribute-controls]"),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Collapse dependents of A" }),
    );
    expect(screen.getByText("1 hidden")).toBeVisible();
    expect(screen.queryByRole("button", { name: "B" })).not.toBeInTheDocument();
    expect(onSelectionChange).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Expand dependents of A" }),
    );
    expect(screen.getByRole("button", { name: "B" })).toBeInTheDocument();
  });

  it("does not combine distinct unresolved references with the same display label", () => {
    const nodes = [
      { id: "ref:a", label: "Input", kind: "unresolved" as const },
      { id: "ref:b", label: "Input", kind: "unresolved" as const },
      { id: "target", label: "Target" },
    ];
    const edges = [
      { id: "a", source: "ref:a", target: "target" },
      { id: "b", source: "ref:b", target: "target" },
    ];
    const { container } = render(
      <DependencyGraph nodes={nodes} edges={edges} />,
    );
    expect(
      container.querySelectorAll('[data-node-kind="unresolved"]'),
    ).toHaveLength(2);
    expect(container.querySelectorAll("[data-graph-edge-ids]")).toHaveLength(2);
  });

  it("uses detail-scale spacing for the initial ungrouped order", () => {
    const order = createDependencyGraphOrder(
      realWorldNodes,
      realWorldEdges,
      [],
    );
    const oldOverview = buildDependencyGraph(
      realWorldNodes,
      realWorldEdges,
      [],
      [],
      new Map(realWorldNodes.map((node) => [node.id, NODE_HEIGHT])),
      NODE_WIDTH,
      0.4,
    );
    const top = (boxes: Iterable<{ y: number }>) =>
      Math.max(...Array.from(boxes, (box) => box.y));
    expect(top(order.boxes.values())).toBeLessThan(top(oldOverview.items));
    const heights = new Map(
      realWorldNodes.map((node) => [node.id, NODE_HEIGHT]),
    );
    const withEdges = buildDependencyGraph(
      realWorldNodes,
      realWorldEdges,
      [],
      [],
      heights,
      NODE_WIDTH,
      1,
      order,
    );
    const withoutEdges = buildDependencyGraph(
      realWorldNodes,
      [],
      [],
      [],
      heights,
      NODE_WIDTH,
      1,
      order,
    );
    expect(withoutEdges.items.map(({ key, x, y }) => ({ key, x, y }))).toEqual(
      withEdges.items.map(({ key, x, y }) => ({ key, x, y })),
    );
  });
});
