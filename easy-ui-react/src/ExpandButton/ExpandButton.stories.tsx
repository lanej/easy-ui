import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExpandButton } from "./ExpandButton";

const meta: Meta<typeof ExpandButton> = {
  id: "components-expandbutton",
  title: "Atoms/Actions/ExpandButton",
  component: ExpandButton,
  args: { accessibilityLabel: "Expand resource details" },
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof ExpandButton>;
export const Default: Story = {};
export const Disabled: Story = { args: { isDisabled: true } };
export const Disclosure: Story = {
  render: function DisclosureExample() {
    const [expanded, setExpanded] = useState(false);
    return (
      <div>
        <ExpandButton
          expanded={expanded}
          accessibilityLabel={`${expanded ? "Collapse" : "Expand"} resource details`}
          aria-controls="expandbutton-details"
          onPress={() => setExpanded(!expanded)}
        />
        <div id="expandbutton-details" hidden={!expanded}>
          Resource details
        </div>
      </div>
    );
  },
};
