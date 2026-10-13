import React, { forwardRef } from "react";
import DarkModeIcon from "@easypost/easy-ui-icons/DarkMode";
import LightModeIcon from "@easypost/easy-ui-icons/LightMode";
import { IconButton, IconButtonProps } from "../IconButton";
import type { ThemeableColorScheme } from "../Theme";

export type ThemeToggleProps = Pick<
  IconButtonProps,
  "color" | "variant" | "size" | "isDisabled" | "autoFocus" | "id"
> & {
  /** Current application mode. Resolve system preferences before passing it. */
  mode: ThemeableColorScheme;
  /** Requests the opposite mode. The application owns theme state and storage. */
  onModeChange: (mode: ThemeableColorScheme) => void;
};

/**
 * A sun/moon button for switching between light and dark mode.
 * Pair the controlled mode with Provider or ThemeProvider's colorScheme.
 */
export const ThemeToggle = forwardRef<null, ThemeToggleProps>(
  (
    { mode, onModeChange, color = "secondary", variant = "outlined", ...props },
    ref,
  ) => {
    const nextMode = mode === "light" ? "dark" : "light";
    return (
      <IconButton
        {...props}
        ref={ref}
        color={color}
        variant={variant}
        type="button"
        icon={nextMode === "dark" ? DarkModeIcon : LightModeIcon}
        accessibilityLabel={`Switch to ${nextMode} mode`}
        onPress={() => onModeChange(nextMode)}
      />
    );
  },
);

ThemeToggle.displayName = "ThemeToggle";
