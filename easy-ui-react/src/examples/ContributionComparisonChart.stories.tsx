import { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ContributionComparisonChart } from "./ContributionComparisonChart.examples";
import { proposals } from "./DesignGuide.fixtures";

const meta = {
  id: "patterns-pricing-review-charts-contribution-comparison",
  title: "Organisms/Charts/Pricing Review/Contribution Comparison",
  component: ContributionComparisonChart,
  args: { proposals },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 440 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ContributionComparisonChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () =>
        expect(
          canvasElement.querySelector('[data-chart-state="ready"] svg'),
        ).toBeInTheDocument(),
      { timeout: 10000 },
    );
    await expect(canvas.getAllByRole("img")).toHaveLength(1);
    await expect(
      canvasElement.querySelector("svg")!.getBoundingClientRect().height,
    ).toBe(200);
    await expect(canvas.queryByText(/not confidence intervals/)).toBeNull();
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
