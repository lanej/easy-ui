import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PriceRangeSlider, PriceRangeSliderProps } from "./PriceRangeSlider";
import { Button } from "../Button";
import styles from "./PriceRangeSlider.stories.module.scss";

function PriceEditor(args: PriceRangeSliderProps) {
  const [range, setRange] = useState(args.range);
  const [resetKey, setResetKey] = useState(0);
  return (
    <section className={styles.example} aria-label="Price envelope">
      <h2>Price envelope</h2>
      <p>
        Set the minimum and maximum parcel price. Standard price:{" "}
        {args.basePriceUsd > 0
          ? new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(args.basePriceUsd)
          : "unavailable"}
        .
      </p>
      <PriceRangeSlider
        {...args}
        range={range}
        resetKey={resetKey}
        onRangeChange={setRange}
      />
      <div className={styles.actions}>
        <Button
          size="sm"
          variant="outlined"
          onPress={() => {
            setRange(args.range);
            setResetKey((previous) => previous + 1);
          }}
        >
          Reset range
        </Button>
      </div>
    </section>
  );
}

const meta: Meta<typeof PriceRangeSlider> = {
  id: "components-forms-pricerangeslider",
  title: "Molecules/Forms/PriceRangeSlider",
  component: PriceRangeSlider,
  render: (args) => (
    <PriceEditor
      key={JSON.stringify([args.basePriceUsd, args.range])}
      {...args}
    />
  ),
  parameters: { controls: { disable: true } },
  args: {
    basePriceUsd: 14.28,
    range: { minRatio: 7.85 / 14.28, maxRatio: 7.95 / 14.28 },
  },
};
export default meta;
type Story = StoryObj<typeof PriceRangeSlider>;
export const NarrowRange: Story = {};
export const AcrossStandard: Story = {
  args: { basePriceUsd: 10, range: { minRatio: 0.9, maxRatio: 1.1 } },
};
export const EqualBounds: Story = {
  args: { basePriceUsd: 10, range: { minRatio: 1, maxRatio: 1 } },
};
export const Unavailable: Story = { args: { basePriceUsd: 0 } };
