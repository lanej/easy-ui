import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { action } from "storybook/actions";
import { Box } from "../Box";
import { ThemeProvider } from "../Theme";
import { ThemeToggle, ThemeToggleProps } from "./ThemeToggle";

function ControlledToggle(props: ThemeToggleProps) {
  const [mode, setMode] = useState(props.mode);
  return (
    <ThemeProvider colorScheme={mode}>
      <Box background="neutral.050" padding="2">
        <ThemeToggle
          {...props}
          mode={mode}
          onModeChange={(nextMode) => {
            setMode(nextMode);
            props.onModeChange(nextMode);
          }}
        />
      </Box>
    </ThemeProvider>
  );
}

const meta = {
  title: "Atoms/Actions/ThemeToggle",
  component: ThemeToggle,
  args: { mode: "light", onModeChange: action("Mode change") },
  render: (args) => <ControlledToggle key={args.mode} {...args} />,
} satisfies Meta<typeof ThemeToggle>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { args: { mode: "dark" } };
export const Small: Story = { args: { size: "sm" } };
export const Disabled: Story = { args: { isDisabled: true } };
