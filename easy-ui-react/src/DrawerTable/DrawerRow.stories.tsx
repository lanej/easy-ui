import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button";
import { Text } from "../Text";
import { DrawerRow } from "./DrawerRow";

const meta: Meta<typeof DrawerRow> = {
  id: "components-drawerrow",
  title: "Molecules/Content/DrawerRow",
  component: DrawerRow,
};
export default meta;
type Story = StoryObj<typeof DrawerRow>;
export const Default: Story = {
  args: {
    summary: <Text weight="semibold">Shipment EP1001</Text>,
    children: (
      <Text>Supporting details open beneath the unchanged summary.</Text>
    ),
    mountPolicy: "unmount",
  },
};
export const WithActions: Story = {
  args: {
    ...Default.args,
    actions: (
      <Button size="sm" variant="outlined">
        Track shipment
      </Button>
    ),
  },
};
export const Disabled: Story = {
  args: { ...Default.args, isDisabled: true },
};
