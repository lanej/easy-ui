import React, { ReactNode } from "react";
import { UnstyledButton, UnstyledButtonProps } from "../UnstyledButton";
import { classNames, variationName } from "../utilities/css";
import { getComponentThemeToken } from "../utilities/css";
import { ThemeTokenNamespace } from "../types";
import styles from "./Pill.module.scss";

export type PillTone = "neutral" | "primary" | "success" | "warning" | "danger";
export type PillProps = {
  children: ReactNode;
  tone?: PillTone;
  size?: "sm" | "md";
  background?: ThemeTokenNamespace<"color">;
  bordered?: boolean;
};

export function Pill({
  children,
  tone = "neutral",
  size = "md",
  background,
  bordered = false,
}: PillProps) {
  return (
    <span
      className={classNames(
        styles.pill,
        styles[variationName("tone", tone)],
        styles[variationName("size", size)],
        bordered && styles.bordered,
      )}
      style={
        background
          ? getComponentThemeToken("pill", "background", "color", background)
          : undefined
      }
    >
      {children}
    </span>
  );
}

export type PillButtonProps = Omit<
  UnstyledButtonProps,
  "children" | "className" | "href"
> &
  Pick<PillProps, "children" | "size"> & {
    isSelected?: boolean;
  };

export function PillButton({
  children,
  size = "md",
  isSelected = false,
  ...props
}: PillButtonProps) {
  return (
    <UnstyledButton
      {...props}
      aria-pressed={isSelected}
      className={classNames(
        styles.pill,
        styles.action,
        styles[variationName("size", size)],
        isSelected && styles.selected,
      )}
    >
      {children}
    </UnstyledButton>
  );
}
