import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CollapseButton } from "./CollapseButton";

const meta: Meta<typeof CollapseButton> = {
  id: "components-collapsebutton",
  title: "Atoms/Actions/CollapseButton",
  component: CollapseButton,
  args: { accessibilityLabel: "Collapse resource details" },
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof CollapseButton>;
export const Default: Story = {};
export const Disabled: Story = { args: { isDisabled: true } };
export const Disclosure: Story = {
  render: function DisclosureExample() {
    const [expanded, setExpanded] = useState(true);
    return (
      <div>
        <CollapseButton
          expanded={expanded}
          accessibilityLabel={`${expanded ? "Collapse" : "Expand"} resource details`}
          aria-controls="collapsebutton-details"
          onPress={() => setExpanded(!expanded)}
        />
        <div id="collapsebutton-details" hidden={!expanded}>
          Resource details
        </div>
      </div>
    );
  },
};
