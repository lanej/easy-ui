import React from "react";
import { IconButton } from "../IconButton";
import { Tooltip } from "../Tooltip";

function FullscreenIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"
      />
    </svg>
  );
}
function ExitFullscreenIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5"
      />
    </svg>
  );
}

/** Compact camera control for expanding the entire resource graph. */
export function DependencyGraphFullscreenControl({
  active,
  onPress,
}: {
  active: boolean;
  onPress: () => void;
}) {
  const label = active ? "Exit full screen" : "Enter full screen";
  return (
    <Tooltip content={label} placement="bottom">
      <IconButton
        size="sm"
        variant="outlined"
        data-graph-fullscreen-toggle
        accessibilityLabel={label}
        aria-pressed={active}
        icon={active ? ExitFullscreenIcon : FullscreenIcon}
        onPress={onPress}
      />
    </Tooltip>
  );
}
