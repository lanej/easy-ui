import React, { ReactNode } from "react";
import { useNetworkMap } from "./NetworkMapContext";
import type { MapInspectionTarget } from "./types";

export type NetworkMapInspectionTriggerProps = {
  target: MapInspectionTarget;
  /** Supply a focusable control with its own accessible name and application action. */
  children: ReactNode;
};

/** Bind ordinary controls to the map's shared inspection without engine IDs or marker conventions. */
export function NetworkMapInspectionTrigger({
  target,
  children,
}: NetworkMapInspectionTriggerProps) {
  const {
    mapInspection: { events },
  } = useNetworkMap();
  const anchor = (element: HTMLSpanElement, eventTarget: EventTarget | null) =>
    eventTarget instanceof HTMLElement && element.contains(eventTarget)
      ? (eventTarget.closest<HTMLElement>(
          "button, a, input, select, textarea, [tabindex]",
        ) ?? element)
      : element;
  return (
    <span
      style={{ display: "inline-flex", maxWidth: "100%" }}
      onMouseEnter={(event) =>
        events.target(target, anchor(event.currentTarget, event.target))
      }
      onMouseLeave={(event) => events.leave(event.relatedTarget)}
      onFocusCapture={(event) =>
        events.target(target, anchor(event.currentTarget, event.target))
      }
      onBlurCapture={(event) => events.leave(event.relatedTarget)}
      onClickCapture={(event) =>
        events.target(target, anchor(event.currentTarget, event.target), true)
      }
    >
      {children}
    </span>
  );
}
