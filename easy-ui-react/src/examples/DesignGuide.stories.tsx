import { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { PricingReview } from "./PricingReview.examples";

const meta = {
  title: "Patterns/Pricing Review",
  component: PricingReview,
  args: { showDataTable: true, colorSignedValues: true },
  argTypes: {
    showDataTable: { control: "boolean" },
    colorSignedValues: { control: "boolean" },
  },
} satisfies Meta<typeof PricingReview>;

export default meta;
type Story = StoryObj<typeof meta>;

async function expectCompactSummaries(canvasElement: HTMLElement) {
  delete canvasElement.dataset.reviewLayoutChecked;
  const root = canvasElement.querySelector("main")!;
  const rootStyle = getComputedStyle(root);
  const availableWidth =
    root.clientWidth -
    parseFloat(rootStyle.paddingLeft) -
    parseFloat(rootStyle.paddingRight);
  for (const summary of canvasElement.querySelectorAll<HTMLElement>(
    "[data-review-summary]",
  )) {
    const summaryBounds = summary.getBoundingClientRect();
    const controls = summary.querySelector("[data-review-controls]")!;
    const title = summary.querySelector("h2")!;
    const subtitle = title.parentElement!.querySelector("span")!;
    if (availableWidth > 560) {
      await expect(
        Math.abs(
          title.getBoundingClientRect().bottom -
            subtitle.getBoundingClientRect().bottom,
        ),
      ).toBeLessThanOrEqual(3);
    }
    const metrics = summary.querySelector("[data-review-metrics]")!;
    await expect(controls.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      metrics.getBoundingClientRect().top,
    );
    const fields = [...metrics.children].map((field) =>
      field.getBoundingClientRect(),
    );
    for (const field of fields) {
      await expect(field.left).toBeGreaterThanOrEqual(summaryBounds.left);
      await expect(field.right).toBeLessThanOrEqual(summaryBounds.right);
    }
    if (availableWidth > 560) {
      await expect(
        new Set(fields.map((field) => Math.round(field.top))).size,
      ).toBe(1);
    } else {
      await expect(fields[0].top).toBe(fields[1].top);
      await expect(fields[2].top).toBe(fields[3].top);
      await expect(fields[2].top).toBeGreaterThan(fields[0].bottom);
    }
  }
  canvasElement.dataset.reviewLayoutChecked = "true";
}

export const Compact: Story = {
  name: "Review Queue",
  play: ({ canvasElement }) => expectCompactSummaries(canvasElement),
};
export const Graphical: Story = {
  name: "Graphical Review Queue",
  args: { graphical: true },
  play: async ({ canvasElement, args }) => {
    await expectCompactSummaries(canvasElement);
    delete canvasElement.dataset.reviewLayoutChecked;
    const comparisons = canvasElement.querySelector(
      "[data-review-comparisons]",
    )!;
    await waitFor(
      () =>
        expect(
          comparisons.querySelectorAll('[data-chart-state="ready"] svg'),
        ).toHaveLength(3),
      { timeout: 10000 },
    );
    const bounds = comparisons.getBoundingClientRect();
    const charts = [
      ...comparisons.querySelectorAll("[data-review-comparison]"),
    ];
    const reference = charts[0].getBoundingClientRect();
    for (const chart of charts) {
      const chartBounds = chart.getBoundingClientRect();
      await expect(chartBounds.left).toBeGreaterThanOrEqual(bounds.left);
      await expect(chartBounds.right).toBeLessThanOrEqual(bounds.right);
      await expect(
        Math.abs(chartBounds.width - reference.width),
      ).toBeLessThanOrEqual(1);
      if (Math.abs(chartBounds.top - reference.top) <= 1) {
        await expect(
          Math.abs(chartBounds.height - reference.height),
        ).toBeLessThanOrEqual(1);
        await expect(
          Math.abs(
            chart.querySelector("svg")!.getBoundingClientRect().top -
              charts[0].querySelector("svg")!.getBoundingClientRect().top,
          ),
        ).toBeLessThanOrEqual(1);
      }
      await expect(
        chart.querySelector("svg")!.getBoundingClientRect().height,
      ).toBe(200);
      const footer = chart.querySelector("[data-review-chart-footer]");
      if (footer) {
        await expect(
          footer.getBoundingClientRect().top -
            chart.querySelector("svg")!.getBoundingClientRect().bottom,
        ).toBeLessThanOrEqual(8);
      }
      if (args.showDataTable === false) {
        await expect(chart.querySelector("details")).toBeNull();
        await expect(chart.querySelector("table")).toBeNull();
      } else {
        await expect(chart.querySelector("details")).toBeInTheDocument();
      }
      await expect(
        chart
          .querySelector("[data-review-chart-heading]")!
          .getBoundingClientRect().height,
      ).toBeLessThanOrEqual(64);
    }
    const text = [
      ...comparisons.querySelectorAll<HTMLElement>(
        "[data-review-chart-heading] h2, [data-review-chart-heading] p, [data-review-chart-footer] li, [data-review-chart-footer] summary",
      ),
    ];
    const originalSizes = text.map((element) => element.style.fontSize);
    try {
      for (const element of text) {
        element.style.fontSize = `${parseFloat(getComputedStyle(element).fontSize) * 2}px`;
      }
      for (const chart of charts) {
        const heading = chart.querySelector("[data-review-chart-heading]")!;
        const surface = chart.querySelector('[data-chart-state="ready"]')!;
        const footer = chart.querySelector("[data-review-chart-footer]");
        const disclosure = chart.querySelector("details");
        await expect(
          heading.getBoundingClientRect().bottom,
        ).toBeLessThanOrEqual(surface.getBoundingClientRect().top);
        await expect(
          heading.firstElementChild!.getBoundingClientRect().bottom,
        ).toBeLessThanOrEqual(surface.getBoundingClientRect().top);
        await expect(surface.getBoundingClientRect().height).toBe(200);
        if (footer) {
          await expect(
            surface.getBoundingClientRect().bottom,
          ).toBeLessThanOrEqual(footer.getBoundingClientRect().top);
        }
        if (disclosure) {
          await expect(
            disclosure.getBoundingClientRect().left,
          ).toBeGreaterThanOrEqual(chart.getBoundingClientRect().left);
          await expect(
            disclosure.getBoundingClientRect().right,
          ).toBeLessThanOrEqual(chart.getBoundingClientRect().right);
        }
      }
    } finally {
      text.forEach((element, index) => {
        element.style.fontSize = originalSizes[index];
      });
    }
    canvasElement.dataset.reviewLayoutChecked = "true";
  },
};
export const GraphicalWithoutDataTables: Story = {
  args: { graphical: true, showDataTable: false },
  play: Graphical.play,
};
export const Investigating: Story = {
  args: { initialOpen: ["B"] },
  play: ({ canvasElement }) => expectCompactSummaries(canvasElement),
};
export const Queued: Story = {
  args: { initialDecisions: { A: "queued" } },
  play: ({ canvasElement }) => expectCompactSummaries(canvasElement),
};
export const OnHold: Story = {
  args: { initialDecisions: { B: "held" }, initialOpen: ["B"] },
  play: ({ canvasElement }) => expectCompactSummaries(canvasElement),
};
export const MultipleInvestigations: Story = {
  args: { initialOpen: ["A", "B"] },
  play: async ({ canvasElement }) => {
    delete canvasElement.dataset.reviewLayoutChecked;
    const canvas = within(canvasElement);
    const note = canvas.getByRole("textbox", {
      name: "Review rationale for proposal A",
    });
    await userEvent.type(note, "Verify the demand assumptions.");
    const toggle = canvas.getByRole("button", {
      name: "Investigate proposal A",
    });
    await userEvent.click(toggle);
    await expect(note).not.toBeVisible();
    await expect(
      canvas.getByRole("textbox", { name: "Review rationale for proposal B" }),
    ).toBeVisible();
    await userEvent.click(toggle);
    await expect(note).toBeVisible();
    await expect(note).toHaveValue("Verify the demand assumptions.");
    await expectCompactSummaries(canvasElement);
  },
};
