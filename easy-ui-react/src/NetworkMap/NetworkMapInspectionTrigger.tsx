import React, { ReactNode, useEffect, useRef } from "react";
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
    props: { inspectionRevision },
  } = useNetworkMap();
  const anchor = (element: HTMLSpanElement, eventTarget: EventTarget | null) =>
    eventTarget instanceof HTMLElement && element.contains(eventTarget)
      ? (eventTarget.closest<HTMLElement>(
          "button, a, input, select, textarea, [tabindex]",
        ) ?? element)
      : element;
  const keyboardPress = useRef<
    { key: string; control: HTMLElement } | undefined
  >(undefined);
  const activationControl = (
    element: HTMLSpanElement,
    eventTarget: EventTarget | null,
    key: string,
  ) => {
    if (!(eventTarget instanceof HTMLElement) || !element.contains(eventTarget))
      return;
    const control = eventTarget.closest<HTMLElement>(
      "button, [role=button], a[href]",
    );
    const editable = eventTarget.closest(
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
    if (
      key === "Enter" ||
      (key === " " && control.matches("button, [role=button]"))
    )
      return control;
  };
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancel = () => clearTimeout(pending.current);
  const facilityId = "facilityId" in target ? target.facilityId : undefined;
  const overlayId = "overlayId" in target ? target.overlayId : undefined;
  const featureId = "featureId" in target ? target.featureId : undefined;
  useEffect(
    () => () => {
      keyboardPress.current = undefined;
      cancel();
    },
    [facilityId, overlayId, featureId, inspectionRevision],
  );
  useEffect(() => {
    const blur = () => {
      keyboardPress.current = undefined;
    };
    window.addEventListener("blur", blur);
    return () => window.removeEventListener("blur", blur);
  }, []);
  const activate = (
    element: HTMLSpanElement,
    eventTarget: EventTarget | null,
  ) => {
    const control = anchor(element, eventTarget);
    cancel();
    // Finish the entire native event dispatch before moving focus. React Aria
    // may finish the application's press in a later click or keyup listener.
    pending.current = setTimeout(() => {
      if (
        element.isConnected &&
        control.isConnected &&
        element.contains(control)
      )
        events.target(target, control, true);
    }, 0);
  };
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
      onBlurCapture={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        )
          keyboardPress.current = undefined;
        events.leave(event.relatedTarget);
      }}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") {
          keyboardPress.current = undefined;
          cancel();
        } else if (!event.repeat) {
          const control = activationControl(
            event.currentTarget,
            event.target,
            event.key,
          );
          if (control) keyboardPress.current = { key: event.key, control };
        }
      }}
      onKeyUpCapture={(event) => {
        const held = keyboardPress.current;
        if (!held || held.key !== event.key) return;
        keyboardPress.current = undefined;
        const control = activationControl(
          event.currentTarget,
          event.target,
          event.key,
        );
        if (!event.repeat && control === held.control)
          activate(event.currentTarget, event.target);
      }}
      onClickCapture={(event) => {
        // Enter can emit a native click on keydown. Moving focus then would
        // cancel the press before the application's keyup action can finish.
        if (!keyboardPress.current) activate(event.currentTarget, event.target);
      }}
    >
      {children}
    </span>
  );
}
