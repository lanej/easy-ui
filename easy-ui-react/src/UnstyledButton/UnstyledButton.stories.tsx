import React, { useState } from "react";
import { Meta, StoryObj } from "@storybook/react-vite";
import { Text } from "../Text";
import { VerticalStack } from "../VerticalStack";
import { UnstyledButton, UnstyledButtonProps } from "./UnstyledButton";

const meta: Meta<typeof UnstyledButton> = {
  id: "components-unstyledbutton",
  title: "Atoms/Actions/UnstyledButton",
  component: UnstyledButton,
  args: { children: "Activate button" },
};

export default meta;
type Story = StoryObj<typeof UnstyledButton>;

function ActivationExample(args: UnstyledButtonProps) {
  const [count, setCount] = useState(0);
  return (
    <VerticalStack gap="2" inlineAlign="start">
      <UnstyledButton
        {...args}
        onPress={(event) => {
          args.onPress?.(event);
          setCount((value) => value + 1);
        }}
      />
      <Text as="p" aria-live="polite">
        Activations: {count}
      </Text>
    </VerticalStack>
  );
}

export const Default: Story = {
  render: (args) => <ActivationExample {...args} />,
};

export const Disabled: Story = {
  render: (args) => <ActivationExample {...args} />,
  args: { isDisabled: true },
};

export const AsLink: Story = {
  args: {
    href: "/settings",
    children: "Open settings",
  },
  parameters: {
    docs: {
      description: {
        story:
          "The href renders an anchor. Storybook's Provider records navigation in the Actions panel without leaving the preview.",
      },
    },
  },
};
