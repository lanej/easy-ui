import React, { useState } from "react";
import { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs, TabsProps } from "./Tabs";

const meta: Meta<typeof Tabs> = {
  id: "components-tabs",
  title: "Atoms/Navigation/Tabs",
  component: Tabs,
  args: {
    containerComponent: "nav",
    containerProps: { "aria-label": "Account sections" },
    listComponent: "ul",
    listProps: {},
  },
  argTypes: { children: { control: false } },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

const sections = ["Overview", "Billing", "Members", "API keys", "Shipping"];

function NavigationExample(args: TabsProps) {
  const [selected, setSelected] = useState(sections[0]);
  return (
    <Tabs {...args}>
      {sections.map((section) => (
        <Tabs.Item
          key={section}
          containerComponent="li"
          tabComponent="a"
          href={`#${section.toLowerCase().replace(/ /g, "-")}`}
          aria-current={selected === section ? "page" : undefined}
          isSelected={selected === section}
          onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            setSelected(section);
          }}
        >
          {section}
        </Tabs.Item>
      ))}
    </Tabs>
  );
}

export const Default: Story = {
  render: (args) => <NavigationExample {...args} />,
};

export const Overflow: Story = {
  render: (args) => <NavigationExample {...args} />,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 320 }}>
        <Story />
      </div>
    ),
  ],
};
