import { AriaToastRegionProps, useToastRegion } from "@react-aria/toast";
import React, { useEffect, useLayoutEffect, useRef } from "react";
import { TransitionGroup } from "react-transition-group";
import { Notification, NotificationInternalState } from "./Notification";
import styles from "./Notification.module.scss";
import {
  NotificationTransition,
  NotificationTransitionProps,
} from "./NotificationTransition";

export type NotificationRegionProps = AriaToastRegionProps & {
  /**
   * Holds the internal state for notifications and the functions that directly
   * interact with the queue object. Consumers do not see this state.
   */
  state: NotificationInternalState;
  /** Effective current stacked layout, including retained items. */
  stacking?: boolean;

  /**
   * Callback function used to track the transition state of the notification.
   */
  onTransitionPendingChange: NotificationTransitionProps["onTransitionPendingChange"];
};

/**
 * @privateRemarks
 * This component is responsible for rendering individual notifications into
 * a region.
 */
export function NotificationRegion(props: NotificationRegionProps) {
  const { state, stacking, onTransitionPendingChange } = props;
  const ref = useRef<HTMLDivElement>(null);
  const focusedKey = useRef<string | null>(null);
  const focusedElement = useRef<HTMLElement | null>(null);
  // Capture before React Aria's layout effect can move index-stale focus.
  const previousFocusedKey = focusedKey.current;
  const previousFocusedElement = focusedElement.current;
  const resumeAll = useRef(state.resumeAll);
  resumeAll.current = state.resumeAll;
  useEffect(() => () => resumeAll.current(), []);
  const { regionProps } = useToastRegion(props, state, ref);
  // React Aria tracks focus by array index. New arrivals prepend items, so an
  // index can become stale while a user keeps reading an older notification.
  // Recover by the stable key when that exact focused item is dismissed.
  useLayoutEffect(() => {
    if (!previousFocusedKey) return;
    if (state.visibleToasts.some((item) => item.key === previousFocusedKey)) {
      // Removing a different item must not move focus from a surviving item,
      // even after several prepends changed React Aria's remembered index.
      if (previousFocusedElement?.isConnected) previousFocusedElement.focus();
      return;
    }
    const next = state.visibleToasts[0];
    if (next) {
      const node = Array.from(
        ref.current?.querySelectorAll<HTMLElement>("[data-notification-key]") ??
          [],
      ).find((element) => element.dataset.notificationKey === next.key);
      node?.focus();
    }
  }, [state.visibleToasts, previousFocusedKey, previousFocusedElement]);
  /**
   * `visibleToasts` and `toast` are artifacts of react-stately and in
   * Easy UI `visibleToasts` is being treated as `visibleNotifications` and
   * similarly, `toast` here is being treated as a `notification`.
   */
  return (
    <div
      {...regionProps}
      ref={ref}
      className={styles.region}
      style={
        state.visibleToasts.length === 0 ? { pointerEvents: "none" } : undefined
      }
      onFocusCapture={(event) => {
        focusedElement.current = event.target as HTMLElement;
        focusedKey.current =
          (event.target as HTMLElement).closest<HTMLElement>(
            "[data-notification-key]",
          )?.dataset.notificationKey ?? null;
      }}
      onBlurCapture={(event) => {
        if (event.relatedTarget) {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            focusedKey.current = null;
            focusedElement.current = null;
          }
        } else {
          const key = (event.target as HTMLElement).closest<HTMLElement>(
            "[data-notification-key]",
          )?.dataset.notificationKey;
          // A deliberate blur to the document is not a request to recover focus.
          // Keep the key only when removal of this item caused the blur.
          if (state.visibleToasts.some((item) => item.key === key)) {
            focusedKey.current = null;
            focusedElement.current = null;
          }
        }
      }}
    >
      <TransitionGroup component={null}>
        {state.visibleToasts.map((toast) => (
          <NotificationTransition
            key={toast.key}
            transitionKey={toast.key}
            onTransitionPendingChange={onTransitionPendingChange}
          >
            {({ nodeRef, isExiting }) => (
              <Notification
                ref={nodeRef}
                toast={toast}
                state={state}
                isExiting={isExiting}
                isStacked={stacking}
              />
            )}
          </NotificationTransition>
        ))}
      </TransitionGroup>
    </div>
  );
}
