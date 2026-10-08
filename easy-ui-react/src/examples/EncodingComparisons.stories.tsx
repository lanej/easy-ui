import { Meta, StoryObj } from "@storybook/react-vite";
import { EncodingExamples } from "./DesignGuide.examples";

const meta = {
  id: "patterns-encoding-comparisons",
  title: "Foundations/Data Visualization/Encoding Comparisons",
  component: EncodingExamples,
} satisfies Meta<typeof EncodingExamples>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {};
