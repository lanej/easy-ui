import React, { useEffect, useState } from "react";
import { Button } from "../Button";
import { TextField } from "../TextField";
import type { GraphItem } from "./model";
import type { DependencyGraphCardLayout } from "./types";
import styles from "./DependencyGraph.module.scss";

export function DependencyGraphCardSize({
  item,
  onApply,
  onReset,
}: {
  item: GraphItem;
  onApply: (size: DependencyGraphCardLayout) => void;
  onReset: () => void;
}) {
  const [width, setWidth] = useState(String(Math.round(item.width)));
  const [height, setHeight] = useState(String(Math.round(item.height)));
  const invalidWidth = !!width.trim() && !Number.isFinite(Number(width));
  const invalidHeight = !!height.trim() && !Number.isFinite(Number(height));
  useEffect(() => setWidth(String(Math.round(item.width))), [item.width]);
  useEffect(() => setHeight(String(Math.round(item.height))), [item.height]);
  return (
    <form
      className={styles.cardSize}
      aria-label={`Size ${item.node!.label}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (invalidWidth || invalidHeight) return;
        onApply({
          width: width.trim() ? Number(width) : undefined,
          height: height.trim() ? Number(height) : undefined,
        });
      }}
    >
      <span className={styles.cardSizeName}>{item.node!.label}</span>
      <TextField
        size="sm"
        inputMode="numeric"
        validationState={invalidWidth ? "invalid" : "valid"}
        errorText="Enter a finite number."
        label="Card width"
        value={width}
        onChange={setWidth}
      />
      <TextField
        size="sm"
        inputMode="numeric"
        validationState={invalidHeight ? "invalid" : "valid"}
        errorText="Enter a finite number."
        label="Card height"
        value={height}
        onChange={setHeight}
      />
      <Button
        size="sm"
        variant="outlined"
        type="submit"
        isDisabled={invalidWidth || invalidHeight}
      >
        Apply size
      </Button>
      <Button size="sm" variant="outlined" onPress={onReset}>
        Reset card
      </Button>
      <span className={styles.cardSizeHint}>
        Size at 100% zoom. Clear a field for automatic sizing.
      </span>
    </form>
  );
}
