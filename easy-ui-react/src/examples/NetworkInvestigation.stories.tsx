import { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { NetworkGuideExample } from "./NetworkGuide.examples";
import { hours, hubs } from "./NetworkGuide.fixtures";

const meta = {
  title: "Patterns/Network Investigation",
  component: NetworkGuideExample,
} satisfies Meta<typeof NetworkGuideExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Linked: Story = {
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const root = canvasElement.querySelector<HTMLElement>(
      "[data-network-guide]",
    )!;
    delete root.dataset.networkLayoutChecked;
    await expect(
      canvas.queryByRole("navigation", { name: "Examples" }),
    ).toBeNull();
    await expect(
      canvas.queryByText(/EASY UI · NETWORK INVESTIGATION/),
    ).toBeNull();
    if (globals.colorScheme === "light" || globals.colorScheme === "dark") {
      await waitFor(() =>
        expect(root.dataset.colorScheme).toBe(globals.colorScheme),
      );
    }
    const tabs = root.querySelector('[role="tablist"]');
    if (tabs) {
      await expect(getComputedStyle(tabs).backgroundColor).toBe(
        getComputedStyle(root).backgroundColor,
      );
    }
    const toolbar = root.querySelector(".toolbar")!;
    const controls = within(toolbar as HTMLElement);
    for (const button of toolbar.querySelectorAll(
      'button[aria-haspopup="listbox"]',
    )) {
      const bounds = button.getBoundingClientRect();
      const arrow = button.parentElement!.querySelector("svg");
      await expect(arrow).not.toBeNull();
      const icon = arrow!.getBoundingClientRect();
      const rootBounds = root.getBoundingClientRect();
      await expect(bounds.right).toBeLessThanOrEqual(rootBounds.right);
      await expect(bounds.left).toBeGreaterThanOrEqual(rootBounds.left);
      await expect(icon.left).toBeGreaterThanOrEqual(bounds.left);
      await expect(icon.right).toBeLessThanOrEqual(bounds.right);
      await expect(icon.top).toBeGreaterThanOrEqual(bounds.top);
      await expect(icon.bottom).toBeLessThanOrEqual(bounds.bottom);
    }
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      controls.getByRole("button", { name: /Investigate hub/ }),
    );
    await userEvent.click(body.getByRole("option", { name: "Chicago" }));
    await expect(root.querySelector("main")).toHaveAttribute(
      "data-selected-hub",
      "chi",
    );
    await userEvent.click(
      controls.getByRole("button", { name: /Investigate hub/ }),
    );
    await userEvent.click(body.getByRole("option", { name: "Detroit" }));
    const network = root.querySelector('[data-panel="map"]')!;
    const networkCanvas = within(network as HTMLElement);
    const disclosure = networkCanvas.getByText("Locations and exact data");
    await userEvent.click(disclosure);
    const locations = networkCanvas.getByRole("region", {
      name: /location data$/,
    });
    await expect(within(locations).getAllByRole("columnheader")).toHaveLength(
      5,
    );
    await expect(
      within(locations).queryByRole("columnheader", { name: "Select" }),
    ).toBeNull();
    const location = within(locations).getByRole("button", {
      name: "Select location: Chicago",
    });
    location.focus();
    await expect(location).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(root.querySelector("main")).toHaveAttribute(
      "data-selected-hub",
      "chi",
    );
    await userEvent.click(
      within(locations).getByRole("button", {
        name: "Select location: Detroit",
      }),
    );
    await expect(root.querySelector("main")).toHaveAttribute(
      "data-selected-hub",
      "dtw",
    );
    await userEvent.click(disclosure);
    const pressure = root.querySelector('[data-panel="pressure"]');
    if (pressure) {
      await waitFor(
        () =>
          expect(
            pressure.querySelector('[data-chart-state="ready"] svg'),
          ).not.toBeNull(),
        { timeout: 10000 },
      );
      const scroll = pressure.querySelector(".matrix-scroll")!;
      const card = scroll.querySelector("section")!;
      const plot = pressure.querySelector("svg")!;
      const plotBounds = plot.getBoundingClientRect();
      if (scroll.clientWidth >= 360) {
        await expect(card.getBoundingClientRect().width).toBeLessThanOrEqual(
          scroll.getBoundingClientRect().width + 1,
        );
      }
      const labels = [...plot.querySelectorAll("text")];
      for (const name of [...hubs.map((hub) => hub.name), ...hours.slice(8)]) {
        const label = labels.find(
          (text) => text.textContent?.replace(/^› /, "") === name,
        );
        await expect(label).toBeDefined();
        const bounds = label!.getBoundingClientRect();
        await expect(bounds.left).toBeGreaterThanOrEqual(plotBounds.left);
        await expect(bounds.right).toBeLessThanOrEqual(plotBounds.right);
      }
    }
    root.dataset.networkLayoutChecked = "true";
  },
};
export const Fragmented: Story = {
  args: { initialMode: "fragmented" },
  play: Linked.play,
};
export const WithoutDataTables: Story = { args: { showDataTable: false } };
