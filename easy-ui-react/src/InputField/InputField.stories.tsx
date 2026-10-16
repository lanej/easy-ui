import React from "react";
import { Meta, StoryObj } from "@storybook/react-vite";
import { InputField } from "./InputField";

const meta: Meta<typeof InputField> = {
  id: "components-inputfield",
  title: "Atoms/Forms/InputField",
  component: InputField,
  args: {
    label: "Shipment reference",
    placeholder: "Enter a reference",
    helperText: "Use the reference from your order.",
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof InputField>;

export const Default: Story = {};

export const Password: Story = {
  args: {
    label: "Password",
    type: "password",
    defaultValue: "example-password",
    helperText: "Use the visibility button to show or hide the password.",
  },
};

export const Multiline: Story = {
  args: {
    label: "Delivery instructions",
    isMultiline: true,
    rows: 4,
    placeholder: "Leave the parcel at reception",
    helperText: "Add instructions for the delivery driver.",
  },
};

export const Error: Story = {
  args: {
    validationState: "invalid",
    isRequired: true,
    errorText: "Enter a shipment reference.",
  },
};

export const Disabled: Story = {
  args: { isDisabled: true, defaultValue: "SHP-1042" },
};
