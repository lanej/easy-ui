import { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { PriceComparisonChart } from "./PriceComparisonChart.examples";
import { proposals } from "./DesignGuide.fixtures";

const meta = {
  id: "patterns-pricing-review-charts-price-comparison",
  title: "Organisms/Charts/Pricing Review/Price Comparison",
  component: PriceComparisonChart,
  args: { proposals },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 440 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PriceComparisonChart>;

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
    const chart = canvas.getByRole("region", { name: "Price / parcel" });
    await expect(
      chart.querySelector("[data-review-chart-footer]")!.getBoundingClientRect()
        .top - chart.querySelector("svg")!.getBoundingClientRect().bottom,
    ).toBeLessThanOrEqual(8);
    const heading = canvas.getByRole("heading", { name: "Price / parcel" });
    const subtitle = canvas.getByText("Current vs proposed · USD");
    await expect(chart.querySelector("[data-review-chart-note]")).toBeNull();
    if (chart.getBoundingClientRect().width >= 400) {
      await expect(subtitle.getBoundingClientRect().left).toBeGreaterThan(
        heading.getBoundingClientRect().right,
      );
      await expect(subtitle.getBoundingClientRect().top).toBeLessThan(
        heading.getBoundingClientRect().bottom,
      );
      await expect(chart.getBoundingClientRect().height).toBeLessThanOrEqual(
        280,
      );
    }
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
