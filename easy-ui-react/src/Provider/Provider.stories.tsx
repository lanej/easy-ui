import React, { useState } from "react";
import { Meta, StoryObj } from "@storybook/react-vite";
import { Box } from "../Box";
import { Button } from "../Button";
import { HorizontalStack } from "../HorizontalStack";
import { useNotification } from "../Notification";
import { Text } from "../Text";
import { TextField } from "../TextField";
import { VerticalStack } from "../VerticalStack";
import { Provider, ProviderProps } from "./Provider";

const meta: Meta<typeof Provider> = {
  id: "components-provider",
  title: "Foundations/Provider",
  component: Provider,
  parameters: {
    docs: { story: { inline: false, iframeHeight: "320px" } },
  },
  argTypes: {
    children: { control: false },
    colorScheme: {
      control: "select",
      options: ["light", "dark", "system", "inverted"],
    },
    theme: { control: false },
    navigate: { control: false },
    useHref: { control: false },
  },
  render: (args, context) => (
    <Provider colorScheme={context.globals.colorScheme ?? "system"} {...args}>
      <ProviderContent />
    </Provider>
  ),
};

export default meta;
type Story = StoryObj<typeof Provider>;

function ProviderContent() {
  const notification = useNotification();
  return (
    <Box
      padding="3"
      background="neutral.000"
      color="neutral.900"
      maxWidth={480}
    >
      <VerticalStack gap="2" inlineAlign="start">
        <Text as="h2" variant="subtitle1">
          Application settings
        </Text>
        <TextField label="Workspace name" defaultValue="Shipping operations" />
        <Button
          onPress={() =>
            notification.showSuccessToast({ message: "Settings saved" })
          }
        >
          Save settings
        </Button>
      </VerticalStack>
    </Box>
  );
}

export const Default: Story = {};

export const Dark: Story = {
  args: { colorScheme: "dark" },
};

export const CustomNotificationPlacement: Story = {
  args: { notificationPlacement: { offset: { top: "72px", left: "16px" } } },
};

function RoutingExample(args: ProviderProps) {
  const [path, setPath] = useState("/overview");
  return (
    <Provider
      {...args}
      navigate={setPath}
      useHref={(href) => `/console${href}`}
    >
      <Box padding="3" background="neutral.000" color="neutral.900">
        <VerticalStack gap="2" inlineAlign="start">
          <HorizontalStack gap="2">
            <Button href="/overview">Overview</Button>
            <Button href="/settings">Settings</Button>
          </HorizontalStack>
          <Text as="p" aria-live="polite">
            Current route: {path}
          </Text>
        </VerticalStack>
      </Box>
    </Provider>
  );
}

export const ClientSideRouting: Story = {
  render: (args, context) => (
    <RoutingExample
      colorScheme={context.globals.colorScheme ?? "system"}
      {...args}
    />
  ),
};
