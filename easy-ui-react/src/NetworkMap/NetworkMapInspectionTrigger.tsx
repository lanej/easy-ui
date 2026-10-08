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
      onKeyUpCapture={(event) => {
        // Press primitives may consume the native click. Wait until key release
        // so Space activation can run without an early focus transfer.
        if (event.repeat || !(event.target instanceof HTMLElement)) return;
        const control = event.target.closest<HTMLElement>(
          "button, [role=button], a[href]",
        );
        const editable = event.target.closest(
          "input, textarea, select, [contenteditable]",
        );
        if (
          !control ||
          control.matches(":disabled") ||
          control.closest('[aria-disabled="true"]')
        )
          return;
        if (editable && editable.getAttribute("contenteditable") !== "false")
          return;
        const button = control.matches("button, [role=button]");
        if (event.key === "Enter" || (event.key === " " && button))
          events.target(
            target,
            anchor(event.currentTarget, event.target),
            true,
          );
      }}
      onClickCapture={(event) =>
        events.target(target, anchor(event.currentTarget, event.target), true)
      }
    >
      {children}
    </span>
  );
}
