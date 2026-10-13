import React, { forwardRef } from "react";
import AddIcon from "@easypost/easy-ui-icons/Add";
import RemoveIcon from "@easypost/easy-ui-icons/Remove";
import { IconButton } from "../IconButton";
import type { IconButtonProps } from "../IconButton";

export type ExpandButtonProps = Omit<IconButtonProps, "icon" | "children"> & {
  /** Controlled disclosure state. Defaults to collapsed (+). */
  expanded?: boolean;
};

/** Positive (+) disclosure atom. Supply a label naming the content it expands. */
export const ExpandButton = forwardRef<null, ExpandButtonProps>(
  ({ expanded = false, ...props }, ref) => (
    <IconButton
      size="sm"
      variant="outlined"
      aria-expanded={expanded}
      {...props}
      icon={expanded ? RemoveIcon : AddIcon}
      ref={ref}
    />
  ),
);
ExpandButton.displayName = "ExpandButton";
