import { Meta, StoryObj } from "@storybook/react-vite";
import LocalShippingIcon from "@easypost/easy-ui-icons/LocalShipping";
import { KpiTile } from "./KpiTile";

const meta = {
  title: "Molecules/Feedback/KpiTile",
  component: KpiTile,
  args: {
    icon: LocalShippingIcon,
    metric: {
      label: "Parcels per day",
      displayValue: "1,440",
      deltaDisplay: "+12%",
      deltaDirection: "positive",
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Adapted from Logistics Services’ components/shell/KpiTile. Keeps its icon chip, metric, delta pill, compact and point-in-time states, without depending on the application's data provider. Composes Easy UI MetricContent, Pill, Icon and Card.",
      },
    },
  },
} satisfies Meta<typeof KpiTile>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Compact: Story = { args: { compact: true } };
export const Negative: Story = {
  args: {
    metric: {
      label: "Parcels per day",
      displayValue: "1,200",
      deltaDisplay: "−8%",
      deltaDirection: "negative",
    },
  },
};
export const PointInTime: Story = {
  args: { metric: { label: "Parcels per day", displayValue: "1,440" } },
};
export const Inline: Story = {
  args: { bare: true, compact: true, hideUnavailableLabel: true },
};
