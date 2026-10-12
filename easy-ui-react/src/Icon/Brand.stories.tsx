import EasyUIIcon from "@easypost/easy-ui-icons/EasyUI";
import { Meta, StoryObj } from "@storybook/react-vite";
import { Icon } from "./Icon";

const meta: Meta<typeof Icon> = {
  title: "Foundations/Brand",
  component: Icon,
  args: {
    symbol: EasyUIIcon,
    color: "primary.500",
    size: "lg",
    accessibilityLabel: "Easy UI",
  },
};

export default meta;
export const Mark: StoryObj<typeof Icon> = {};
