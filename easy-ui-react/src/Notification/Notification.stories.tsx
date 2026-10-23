import { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  Notification,
  NotificationProps,
  useNotification,
} from "./Notification";
import { Provider as EasyUIProvider } from "../Provider";
import { Button } from "../Button";
import { InlineStoryDecorator } from "../utilities/storybook";

type Story = StoryObj;

const meta: Meta<typeof Notification> = {
  id: "components-notification",
  title: "Molecules/Feedback/Notification",
  argTypes: {},
};

export default meta;

export const Notifications: Story = {
  render: () => {
    const notification = useNotification();

    return (
      <>
        <Button
          onPress={() => notification.showSuccessToast({ message: "Success" })}
        >
          Success Toast
        </Button>
        <Button
          onPress={() => notification.showSuccessAlert({ message: "Success" })}
        >
          Success Alert
        </Button>
        <Button
          onPress={() =>
            notification.showPromotionalToast({ message: "Promotional" })
          }
        >
          Promotional Toast
        </Button>
        <Button
          onPress={() =>
            notification.showPromotionalAlert({ message: "Promotional" })
          }
        >
          Promotional Alert
        </Button>
        <Button
          onPress={() => notification.showNeutralToast({ message: "Neutral" })}
        >
          Neutral Toast
        </Button>
        <Button
          onPress={() => notification.showNeutralAlert({ message: "Neutral" })}
        >
          Neutral Alert
        </Button>
        <Button
          onPress={() => notification.showWarningToast({ message: "Warning" })}
        >
          Warning Toast
        </Button>
        <Button
          onPress={() => notification.showWarningAlert({ message: "Warning" })}
        >
          Warning Alert
        </Button>
        <Button
          onPress={() => notification.showErrorToast({ message: "Error" })}
        >
          Error Toast
        </Button>
        <Button
          onPress={() => notification.showErrorAlert({ message: "Error" })}
        >
          Error Alert
        </Button>
        <Button
          onPress={() =>
            notification.showSuccessToast({
              message: "Success",
              hasIcon: false,
            })
          }
        >
          Without icon
        </Button>
        <Button
          onPress={() =>
            notification.showSuccessAlert({
              message: "Success",
              onDismiss: () => alert("alert has been dismissed"),
            })
          }
        >
          Dismiss callback
        </Button>
      </>
    );
  },

  decorators: [InlineStoryDecorator],
};

export const ProgrammaticDismissal: Story = {
  render: () => {
    const notification = useNotification();

    return (
      <>
        <Button
          onPress={() => notification.showSuccessAlert({ message: "Success" })}
          color="neutral"
        >
          Trigger Alert
        </Button>
        <Button
          onPress={() => notification.closeActiveNotification()}
          color="neutral"
        >
          Click to dismiss
        </Button>
      </>
    );
  },

  decorators: [InlineStoryDecorator],
};

export const CustomPlacement: Story = {
  render: () => {
    return (
      <EasyUIProvider
        colorScheme="system"
        notificationPlacement={{
          offset: { top: "80px", left: "0px" },
        }}
      >
        <SimulatedNotificationTrigger message="Hello World" />
      </EasyUIProvider>
    );
  },
};

export const CustomPlacementWithinContainer: Story = {
  render: () => {
    return (
      <EasyUIProvider
        colorScheme="system"
        notificationPlacement={{
          offset: { top: "50px", left: "0px" },
          position: "absolute",
          getContainer: () => document.getElementById("test-container"),
        }}
      >
        <>
          <div
            id="test-container"
            style={{
              position: "relative",
              border: "1px solid black",
              padding: "16px 8px",
              minHeight: "104px",
              marginBottom: "8px",
              textAlign: "center",
            }}
          >
            Container
          </div>
          <SimulatedNotificationTrigger message="Hello World" />
        </>
      </EasyUIProvider>
    );
  },
};

function SimulatedNotificationTrigger(props: NotificationProps) {
  const { message } = props;
  const notification = useNotification();

  return (
    <Button
      color="secondary"
      onPress={() => notification.showNeutralToast({ message })}
    >
      Neutral Toast
    </Button>
  );
}

function StackingExample() {
  const notification = useNotification();
  const [lastKey, setLastKey] = React.useState<string>();
  const arrivals = () => {
    notification.showSuccessToast({ message: "Order A saved" });
    notification.showSuccessToast({ message: "Order B saved" });
    notification.showWarningAlert({ message: "Address review required" });
  };
  return (
    <div style={{ minHeight: 360, padding: 16, maxWidth: 640 }}>
      <h2>Order updates</h2>
      <p>
        Toasts stay visible for five seconds. Hover or focus the notification
        region to pause. Alerts remain until dismissed.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button onPress={arrivals}>Save two orders</Button>
        <Button
          onPress={() =>
            setLastKey(
              notification.showSuccessToast({ message: "Order saved" }),
            )
          }
        >
          Repeat identical message
        </Button>
        <Button
          onPress={() => {
            if (lastKey) notification.closeNotification(lastKey);
          }}
        >
          Dismiss last repeated message
        </Button>
        <Button
          onPress={() =>
            notification.showNeutralToast({
              message:
                "A longer shipment update wraps without hiding the individual close control on narrow screens.",
            })
          }
        >
          Show long update
        </Button>
      </div>
    </div>
  );
}

export const StackedNotifications: Story = {
  render: (_, context) => (
    <EasyUIProvider
      colorScheme={context.globals.colorScheme === "dark" ? "dark" : "light"}
      notificationOptions={{
        stacking: true,
        timeout: 5000,
        isDismissable: true,
      }}
      notificationPlacement={{ offset: { bottom: "16px", right: "16px" } }}
    >
      <StackingExample />
    </EasyUIProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "Save two orders" }),
    );
    await waitFor(() => {
      expect(body.getByText("Order A saved")).toBeVisible();
      expect(body.getByText("Order B saved")).toBeVisible();
    });
    await userEvent.click(
      body.getByRole("button", { name: "Dismiss Order A saved" }),
    );
    await expect(body.getByText("Order B saved")).toBeVisible();
    await userEvent.click(
      body.getByRole("button", { name: "Dismiss Order B saved" }),
    );
    await userEvent.click(
      body.getByRole("button", { name: "Dismiss Address review required" }),
    );
    canvasElement.dataset.notificationInteractions = "complete";
  },
};

export const PerMessageOptions: Story = {
  render: () => {
    const notification = useNotification();
    return (
      <Button
        onPress={() =>
          notification.showNeutralToast({
            message: "This update stays until you close it",
            timeout: 0,
            isDismissable: true,
          })
        }
      >
        Show persistent dismissible toast
      </Button>
    );
  },
};
