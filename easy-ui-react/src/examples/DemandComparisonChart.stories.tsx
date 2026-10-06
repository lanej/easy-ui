import { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { DemandComparisonChart } from "./DemandComparisonChart.examples";
import { proposals } from "./DesignGuide.fixtures";

const meta = {
  id: "patterns-pricing-review-charts-demand-comparison",
  title: "Organisms/Charts/Pricing Review/Demand Comparison",
  component: DemandComparisonChart,
  args: { proposals },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 440 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DemandComparisonChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () =>
        expect(
          canvasElement.querySelector('[data-chart-state="ready"] svg'),
        ).toBeInTheDocument(),
      { timeout: 10000 },
    );
    await expect(canvas.getAllByRole("img")).toHaveLength(1);
    const plot = canvasElement.querySelector("svg")!;
    const css = getComputedStyle(plot);
    const roles: Record<string, string> = {
      A: "primary-600",
      B: "secondary-600",
      C: "positive-700",
    };
    const strokes = [...plot.querySelectorAll("path")].map((path) =>
      path.getAttribute("stroke")?.toLowerCase(),
    );
    for (const proposal of args.proposals) {
      await expect(strokes).toContain(
        css
          .getPropertyValue(`--ezui-color-${roles[proposal.id]}`)
          .trim()
          .toLowerCase(),
      );
    }
    await expect(
      canvasElement.querySelector("svg")!.getBoundingClientRect().height,
    ).toBe(200);
    await expect(
      canvasElement
        .querySelector("[data-review-chart-footer]")!
        .getBoundingClientRect().top -
        canvasElement.querySelector("svg")!.getBoundingClientRect().bottom,
    ).toBeLessThanOrEqual(8);
    await userEvent.click(canvasElement.querySelector("summary")!);
    await expect(canvas.getByRole("table")).toBeVisible();
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    );
  },
};

export const Filtered: Story = {
  args: { proposals: proposals.filter((proposal) => proposal.id === "B") },
  play: Default.play,
};

export const WithoutDataTable: Story = { args: { showDataTable: false } };
