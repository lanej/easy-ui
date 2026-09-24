import { Meta, StoryObj } from "@storybook/react-vite";
import React, { useState } from "react";
import { Button } from "../Button";
import { Disclosure } from "./Disclosure";

type Story = StoryObj<typeof Disclosure>;

const meta: Meta<typeof Disclosure> = {
  title: "Components/Disclosure",
  component: Disclosure,
  parameters: {
    controls: { include: ["defaultExpanded", "mountPolicy"] },
  },
};

export default meta;

export const Default: Story = {
  render: (args) => (
    <Disclosure {...args}>
      <Disclosure.Trigger variant="link">Trends and factors</Disclosure.Trigger>
      <Disclosure.Content>
        <p>Supporting evidence stays close to the decision it informs.</p>
      </Disclosure.Content>
    </Disclosure>
  ),
};

export const IndependentPanels: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 16 }}>
      {["Proposal A", "Proposal B"].map((proposal) => (
        <Disclosure key={proposal}>
          <article>
            <h3>{proposal}</h3>
            <Disclosure.Trigger
              variant="link"
              aria-label={`Trends and factors for ${proposal}`}
            >
              Trends and factors
            </Disclosure.Trigger>
            <Disclosure.Content role="region">
              <p>Each proposal can stay open while another is inspected.</p>
            </Disclosure.Content>
          </article>
        </Disclosure>
      ))}
    </div>
  ),
};

function ControlledExample() {
  const [isExpanded, setExpanded] = useState(false);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Button variant="outlined" onPress={() => setExpanded((value) => !value)}>
        Change expansion from outside
      </Button>
      <Disclosure isExpanded={isExpanded} onExpandedChange={setExpanded}>
        <Disclosure.Trigger>Investigation notes</Disclosure.Trigger>
        <Disclosure.Content role="region">
          <label>
            Rationale <input defaultValue="" />
          </label>
        </Disclosure.Content>
      </Disclosure>
    </div>
  );
}

export const Controlled: Story = { render: () => <ControlledExample /> };

export const MountPolicies: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 16 }}>
      {(["preserve", "unmount"] as const).map((mountPolicy) => (
        <Disclosure key={mountPolicy} mountPolicy={mountPolicy}>
          <div>
            <Disclosure.Trigger>{mountPolicy} content</Disclosure.Trigger>
            <Disclosure.Content>
              <label>
                {mountPolicy === "preserve"
                  ? "Retained note"
                  : "Temporary note"}
                <input defaultValue="" />
              </label>
            </Disclosure.Content>
          </div>
        </Disclosure>
      ))}
    </div>
  ),
};
