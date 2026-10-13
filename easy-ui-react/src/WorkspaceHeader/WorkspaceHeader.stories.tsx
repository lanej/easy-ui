import React from "react";
import { Meta, StoryObj } from "@storybook/react-vite";
import PriceChangeIcon from "@easypost/easy-ui-icons/PriceChange";
import { PillButton } from "../Pill";
import { WorkspaceHeader } from "./WorkspaceHeader";

const meta = {
  title: "Organisms/Navigation/WorkspaceHeader",
  component: WorkspaceHeader,
  args: { title: "Operations Overview", icon: PriceChangeIcon },
  parameters: {
    docs: {
      description: {
        component:
          "Navigation and workspace identity share a compact toolbar. Navigation and actions remain caller-supplied; there is no required subtitle.",
      },
    },
  },
} satisfies Meta<typeof WorkspaceHeader>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const WithNavigation: Story = {
  args: {
    navigation: (
      <div
        role="group"
        aria-label="Workspace views"
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      >
        <PillButton isSelected>Overview</PillButton>
        <PillButton>Performance</PillButton>
      </div>
    ),
  },
};
