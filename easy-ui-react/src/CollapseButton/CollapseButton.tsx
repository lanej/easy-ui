import React, { forwardRef } from "react";
import { ExpandButton } from "../ExpandButton";
import type { ExpandButtonProps } from "../ExpandButton";

export type CollapseButtonProps = ExpandButtonProps;

/** Negative (−) disclosure atom. Supply a label naming the content it collapses. */
export const CollapseButton = forwardRef<null, CollapseButtonProps>(
  (props, ref) => <ExpandButton expanded {...props} ref={ref} />,
);
CollapseButton.displayName = "CollapseButton";
