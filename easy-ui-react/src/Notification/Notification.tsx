import React, {
  ReactNode,
  useRef,
  useContext,
  createContext,
  useEffect,
  useState,
} from "react";
import { mergeRefs, useObjectRef } from "@react-aria/utils";
import CloseIcon from "@easypost/easy-ui-icons/Close";
import ErrorIcon from "@easypost/easy-ui-icons/Error";
import CheckCircleIcon from "@easypost/easy-ui-icons/CheckCircle";
import WarningIcon from "@easypost/easy-ui-icons/Warning";
import DocumentScannerIcon from "@easypost/easy-ui-icons/DocumentScanner";
import CurrencyExchangeIcon from "@easypost/easy-ui-icons/CurrencyExchange";
import { AriaToastProps, useToast } from "@react-aria/toast";
import { QueuedToast, ToastState } from "@react-stately/toast";
import { NotificationContainer } from "./NotificationContainer";
import { useNotificationState } from "./useNotificationState";
import { Icon } from "../Icon";
import { Text } from "../Text";
import { classNames, variationName } from "../utilities/css";
import { UnstyledButton } from "../UnstyledButton";
import styles from "./Notification.module.scss";

export type NotificationType = "alert" | "toast";

export type NotificationStatus =
  "promotional" | "success" | "neutral" | "error" | "warning";

export type BaseNotificationProps = {
  /** Notification type */
  type?: NotificationType;
  /** Notification message */
  message: ReactNode;
  /** Visible duration in milliseconds. Zero disables expiration. Alerts default to persistent. */
  timeout?: number;
  /** Show an individually named close control. Alerts default to true; toasts to false. */
  isDismissable?: boolean;
  /**
   * Notification status
   * @default 'success'
   */
  status?: NotificationStatus;
  /**
   * Notification will render with left aligned status icon
   * @default true
   */
  hasIcon?: boolean;
};

export type ToastProps = Omit<BaseNotificationProps, "type" | "status">;

export type AlertProps = Omit<BaseNotificationProps, "type" | "status"> & {
  /** Callback function when dismissing alerts */
  onDismiss?: () => void;
};

export type QueuedNotification = QueuedToast<NotificationProps> & {
  /** Presentation tracking is snapshotted when this item is added. */
  isStacked?: boolean;
};

export type NotificationProps = BaseNotificationProps & ToastProps & AlertProps;

export type NotificationInternalState = ToastState<NotificationProps> & {
  /** Track whether an item is fully presented in the scroll viewport. */
  setPresented(key: string, presented: boolean): void;
};

/** The methods below are accessible on the object returned by the `useNotification` hook. */
export type NotificationExternalState = {
  /** Shows promotional color status toast */
  showPromotionalToast(content: ToastProps): string;
  /** Shows neutral color status toast */
  showNeutralToast(content: ToastProps): string;
  /** Shows success color status toast */
  showSuccessToast(content: ToastProps): string;
  /** Shows warning color status toast */
  showWarningToast(content: ToastProps): string;
  /** Shows error color status toast */
  showErrorToast(content: ToastProps): string;
  /** Shows promotional color status alert */
  showPromotionalAlert(content: AlertProps): string;
  /** Shows neutral color status alert */
  showNeutralAlert(content: AlertProps): string;
  /** Shows success color status alert */
  showSuccessAlert(content: AlertProps): string;
  /** Shows warning color status alert */
  showWarningAlert(content: AlertProps): string;
  /** Shows error color status alert */
  showErrorAlert(content: AlertProps): string;
  /** Closes the most recently added notification that is still present. */
  closeActiveNotification(): void;
  /** Closes one notification by the key returned from a show method. */
  closeNotification(key: string): void;
};

export type NotificationCombinedState = NotificationInternalState &
  NotificationExternalState;

export type NotificationItemStateProps = AriaToastProps<NotificationProps> & {
  /**
   * The `toast` name here is an artifact of react-stately, not an Easy UI `toast`
   * it is more appropriate to think of this as a `notification`.
   */
  toast: QueuedNotification;
  /**
   * Holds the internal state for notifications and the functions that directly
   * interact with the queue object. Consumers do not see this state.
   */
  state: NotificationInternalState;
  /** Remove exiting items from focus recovery and announcements during animation. */
  isExiting?: boolean;
};

/**
 * @privateRemarks
 * The Notification component handles rendering of individual toasts or alerts.
 * The `toast` (notification) prop captures essential information such as the notification type,
 * the message to display, the status, whether or not it should render with an icon, and a callback
 * function that is called when an alert is dismissed. The `state` prop captures stateful information,
 * such as functions that can interact with the queue in a programmatic way.
 */
export const Notification = React.forwardRef<
  HTMLDivElement,
  NotificationItemStateProps
>((props, forwardedRef) => {
  const ref = useRef<HTMLDivElement>(null);
  const mergedRef = useObjectRef(mergeRefs(ref, forwardedRef));
  const { state, toast: notification, isExiting } = props;
  const {
    type = "toast",
    message,
    status = "success",
    hasIcon = true,
    onDismiss,
    isDismissable = type === "alert",
  } = notification.content;

  const {
    toastProps: notificationProps,
    titleProps,
    contentProps,
    closeButtonProps,
  } = useToast(props, state, ref);

  const { setPresented } = state;
  const [isOversized, setIsOversized] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (
      !notification.isStacked ||
      typeof IntersectionObserver === "undefined"
    ) {
      setPresented(notification.key, true);
      return () => setPresented(notification.key, false);
    }
    const updateOversized = (bounds = node.getBoundingClientRect()) => {
      const region = node.parentElement?.getBoundingClientRect();
      const availableHeight = Math.min(
        window.innerHeight,
        region?.height || window.innerHeight,
      );
      const availableWidth = Math.min(
        window.innerWidth,
        region?.width || window.innerWidth,
      );
      setIsOversized(
        bounds.height > availableHeight + 1 ||
          bounds.width > availableWidth + 1,
      );
    };
    updateOversized();
    const onResize = () => updateOversized();
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(onResize);
    resizeObserver?.observe(node);
    if (node.parentElement) resizeObserver?.observe(node.parentElement);
    window.addEventListener("resize", onResize);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          updateOversized(entry.boundingClientRect);
          setPresented(
            notification.key,
            entry.isIntersecting && entry.intersectionRatio >= 0.999,
          );
        }
      },
      { threshold: [0, 0.999, 1] },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", onResize);
      setPresented(notification.key, false);
    };
  }, [notification.key, notification.isStacked, setPresented]);

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
    state.close(notification.key);
  };
  const closeButtonPropsWithDismiss = {
    ...closeButtonProps,
    onPress: handleDismiss,
  };

  return (
    <div
      {...notificationProps}
      role={isExiting ? undefined : notificationProps.role}
      aria-hidden={isExiting || undefined}
      data-notification-key={notification.key}
      tabIndex={isExiting ? -1 : notificationProps.tabIndex}
      ref={mergedRef}
      className={classNames(
        styles.Notification,
        styles[variationName("status", status)],
        styles[variationName("type", type)],
        isOversized && styles.oversized,
        isExiting && styles.exiting,
      )}
    >
      <div
        {...contentProps}
        role={type === "alert" ? "alert" : "status"}
        className={styles.iconText}
      >
        {hasIcon && <Icon size="lg" symbol={getStatusIcon(status)} />}
        <div {...titleProps}>
          <Text weight="semibold">{message}</Text>
        </div>
      </div>
      {(isDismissable || (isOversized && notification.timeout != null)) && (
        <span className={styles.closeButtonContainer}>
          <UnstyledButton
            {...closeButtonPropsWithDismiss}
            aria-label={
              typeof message === "string"
                ? `Dismiss ${message}`
                : "Dismiss notification"
            }
            aria-describedby={
              typeof message === "string" ? undefined : titleProps.id
            }
            className={styles.closeButton}
            isDisabled={isExiting}
          >
            <Icon size="md" symbol={CloseIcon} />
          </UnstyledButton>
        </span>
      )}
    </div>
  );
});

Notification.displayName = "Notification";

function getStatusIcon(status: NotificationStatus) {
  switch (status) {
    case "promotional":
      return CurrencyExchangeIcon;
    case "success":
      return CheckCircleIcon;
    case "neutral":
      return DocumentScannerIcon;
    case "error":
      return ErrorIcon;
    case "warning":
      return WarningIcon;
  }
}

export const NotificationContext =
  createContext<NotificationExternalState | null>(null);

/**
 * Notifications of type alert or toast can be displayed using this hook. The hook returns a notification
 * object on which methods can be invoked to display the appropriate notification.
 *
 * @remarks
 * Toasts dispay a brief non-disruptive message to the user as a result of an action taken. The displayed message
 * is accompanied by an associated status icon and by default automatically timeout after `4000ms` without a close control.
 * Configure provider defaults with `notificationOptions`, or pass `timeout` and `isDismissable` to a show method. Toasts should not be used to display critical information such as a system failure,
 * use `alerts` for such behavior. They should also contain purely text and no elements such as links.
 *
 * Alerts display an important message near the top of the page that does not automatically timeout and requires
 * user action to dismiss. The displayed messaged is accompanied by an associated status icon. If the message is
 * not prominent enough to immediately require the user's attention, consider using toasts.
 *
 * The following methods are available on the returned notification object:
 *
 * ```tsx
 * showPromotionalToast(content: ToastProps): string;
 * showNeutralToast(content: ToastProps): string;
 * showSuccessToast(content: ToastProps): string;
 * showWarningToast(content: ToastProps): string;
 * showErrorToast(content: ToastProps): string;
 * showPromotionalAlert(content: AlertProps): string;
 * showNeutralAlert(content: AlertProps): string;
 * showSuccessAlert(content: AlertProps): string;
 * showWarningAlert(content: AlertProps): string;
 * showErrorAlert(content: AlertProps): string;
 * closeActiveNotification(): void;
 *
 * type ToastProps = {
 *   // Notification message
 *   message: ReactNode;
 *   // Notification will render with left aligned status icon
 *   hasIcon?: boolean;
 * }
 *
 * type AlertProps = {
 *   // Notification message
 *   message: ReactNode;
 *   // Notification will render with left aligned status icon
 *   hasIcon?: boolean;
 *   // Callback function when dismissing alerts
 *   onDismiss?: () => void;
 * }
 * ```
 * @example
 * _Success:_
```tsx
* import { useNotification } from "@easypost/easy-ui/Notification";
* import { Button } from "@easypost/easy-ui/Button";
*
* function Component() {
*  const notification = useNotification();
*
*  const onToast = () => {
*    notification.showSuccessToast({ message: "message" });
*  };
*
*  const onAlert = () => {
*    notification.showSuccessAlert({ message: "message" });
* };
*
*  return (
*    <>
*      <Button onPress={onToast}>Show toast</Button>
*      <Button onPress={onAlert}>Show alert</Button>
*    </>
*  );
*}
*```
* @example
* _Without status icons:_
```tsx
* import { useNotification } from "@easypost/easy-ui/Notification";
* import { Button } from "@easypost/easy-ui/Button";
*
* function Component() {
*  const notification = useNotification();
*
*  const onToast = () => {
*    notification.showPromotionalToast({ message: "message", hasIcon: false });
*  };
*
*  const onAlert = () => {
*    notification.showWarningAlert({ message: "message", hasIcon: false });
* };
*
*  return (
*    <>
*      <Button onPress={onToast}>Show toast</Button>
*      <Button onPress={onAlert}>Show alert</Button>
*    </>
*  );
*}
*```
* @example
* _With onDismiss callback, only applicable for alerts:_
```tsx
* import { useNotification } from "@easypost/easy-ui/Notification";
* import { Button } from "@easypost/easy-ui/Button";
*
* function Component() {
*  const notification = useNotification();
*
*
*  const onAlert = () => {
*    notification.showNeutralAlert({
*      message: "message",
*      onDismiss: () => alert("i am called immediately before the alert closes"),
*    });
*  };
*
*  return (
*    <>
*      <Button onPress={onAlert}>Show alert</Button>
*    </>
*  );
*}
*```
 */
export function useNotification() {
  const notification = useContext(NotificationContext);
  if (!notification) {
    throw new Error(
      "useNotification() must be used within a NotificationProvider, which is bundled with EasyUIProvider",
    );
  }

  return notification;
}

export type NotificationOffset = {
  /** Top offset */
  top?: string;
  /** Right offset */
  right?: string;
  /** Bottom offset */
  bottom?: string;
  /** Left offset */
  left?: string;
};

export type NotificationPosition = "fixed" | "absolute";

export type NotificationPlacement = {
  /** Callback function that retrieves HTMLElement where notifications will render to */
  getContainer?: () => HTMLElement | null;
  /** Position type */
  position?: NotificationPosition;
  /** Position placement */
  offset?: NotificationOffset;
};

export type NotificationOptions = {
  /** Retain concurrent notifications. Defaults to false (replace the previous notification). */
  stacking?: boolean;
  /** Default toast visible duration in milliseconds. Defaults to 4000; zero disables expiration. */
  timeout?: number;
  /** Default toast close control. Defaults to false. Alerts remain dismissible by default. */
  isDismissable?: boolean;
};

export type NotificationProviderProps = {
  /** Child components */
  children: ReactNode;
  /** Notification placement props */
  notificationPlacement?: NotificationPlacement;
  /** Defaults applied to notifications added after this render. */
  notificationOptions?: NotificationOptions;
};

/**
 * @privateRemarks
 * The NotificationProvider component bundles everything necessary for an app to
 * display notifications via the `useNotification` hook. This component shouldn't
 * be used on its own and is included in the general EasyUI Provider
 */
export function NotificationProvider(props: NotificationProviderProps) {
  const { children, notificationPlacement, notificationOptions } = props;
  const combinedState = useNotificationState(notificationOptions);

  const state = {
    close: combinedState.close,
    add: combinedState.add,
    pauseAll: combinedState.pauseAll,
    resumeAll: combinedState.resumeAll,
    setPresented: combinedState.setPresented,
    visibleToasts: combinedState.visibleToasts,
  };

  const notification = {
    showErrorAlert: combinedState.showErrorAlert,
    showErrorToast: combinedState.showErrorToast,
    showPromotionalToast: combinedState.showPromotionalToast,
    showPromotionalAlert: combinedState.showPromotionalAlert,
    showNeutralToast: combinedState.showNeutralToast,
    showNeutralAlert: combinedState.showNeutralAlert,
    showSuccessToast: combinedState.showSuccessToast,
    showSuccessAlert: combinedState.showSuccessAlert,
    showWarningToast: combinedState.showWarningToast,
    showWarningAlert: combinedState.showWarningAlert,
    closeActiveNotification: combinedState.closeActiveNotification,
    closeNotification: combinedState.closeNotification,
  };

  return (
    <NotificationContext.Provider value={notification}>
      <NotificationContainer
        getContainer={notificationPlacement?.getContainer}
        offset={notificationPlacement?.offset}
        position={notificationPlacement?.position}
        state={state}
        stacking={
          notificationOptions?.stacking ||
          combinedState.visibleToasts.some(
            (item) => (item as QueuedNotification).isStacked,
          )
        }
      />
      {children}
    </NotificationContext.Provider>
  );
}
