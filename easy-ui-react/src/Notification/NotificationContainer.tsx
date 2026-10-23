import React from "react";
import { createPortal } from "react-dom";
import { NotificationRegion } from "./NotificationRegion";
import {
  NotificationInternalState,
  NotificationPosition,
  NotificationOffset,
} from "./Notification";
import { useNotificationTransitionTracking } from "./NotificationTransition";
import style from "./Notification.module.scss";

export type NotificationContainerProps = {
  /** Callback function that retrieves HTMLElement where notifications will render to */
  getContainer?: () => HTMLElement | null;
  /** Position type */
  position?: NotificationPosition;
  /** Position placement */
  offset?: NotificationOffset;
  /**
   * Holds the internal state for notifications and the functions that directly
   * interact with the queue object. Consumers do not see this state.
   */
  state: NotificationInternalState;
  /** Retain concurrent notifications in a compact stack. */
  stacking?: boolean;
};

/**
 * @privateRemarks
 * This component serves as a wrapper around the NotificationRegion component.
 * It handles the logic to render notifications into a portal and positional
 * styles.
 */
export function NotificationContainer(props: NotificationContainerProps) {
  const {
    getContainer = null,
    position = "fixed",
    offset,
    state,
    stacking,
  } = props;
  const { isTransitionPending, onTransitionPendingChange } =
    useNotificationTransitionTracking();

  const showNotifications =
    state.visibleToasts.length > 0 || isTransitionPending;
  let requestFailed = false;
  let container = null;
  if (showNotifications && getContainer) {
    container = getContainer();
    requestFailed = container === null;
  }

  const positionStyleProps =
    offset && !requestFailed
      ? {
          top: offset?.top,
          right: offset?.right,
          bottom: offset?.bottom,
          left: offset?.left,
        }
      : {
          top: 0,
          left: 0,
        };
  const positionProps = {
    position: !requestFailed ? position : "fixed",
  };

  const stackLength = (value: string | number | undefined) =>
    value === 0 ||
    (typeof value === "string" && /^[-+]?0(?:\.0+)?$/.test(value.trim()))
      ? "0px"
      : (value ?? "16px");
  const containerStyles = {
    ...positionStyleProps,
    ...positionProps,
    ...(stacking
      ? {
          "--easy-ui-notification-top": stackLength(positionStyleProps.top),
          "--easy-ui-notification-right": stackLength(
            "right" in positionStyleProps
              ? positionStyleProps.right
              : undefined,
          ),
          "--easy-ui-notification-bottom": stackLength(
            "bottom" in positionStyleProps
              ? positionStyleProps.bottom
              : undefined,
          ),
          "--easy-ui-notification-left": stackLength(positionStyleProps.left),
          justifyContent:
            "bottom" in positionStyleProps &&
            positionStyleProps.bottom != null &&
            positionStyleProps.top == null
              ? "flex-end"
              : "flex-start",
        }
      : {}),
  } as React.CSSProperties;

  return (
    <>
      {/** visibleToasts` is an artifact of react-stately */}
      {showNotifications
        ? createPortal(
            <div
              className={`${style.container} ${stacking ? style.stacked : ""}`}
              style={containerStyles}
            >
              <NotificationRegion
                state={state}
                onTransitionPendingChange={onTransitionPendingChange}
              />
            </div>,
            container ?? document.body,
          )
        : null}
    </>
  );
}
