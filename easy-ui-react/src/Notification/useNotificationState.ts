import { useCallback, useEffect, useMemo } from "react";
import { useToastQueue } from "@react-stately/toast";
import {
  NotificationProps,
  NotificationOptions,
  AlertProps,
  ToastProps,
  NotificationCombinedState,
} from "./Notification";
import { EasyUINotificationQueue } from "./NotificationQueue";

/**
 * @privateRemarks
 * This is an internal hook to initialize the queue, the queue state, and compose
 * the functions that will be exposed to consumers.
 */
export function useNotificationState(
  options?: NotificationOptions,
): NotificationCombinedState {
  const queue = useMemo(() => new EasyUINotificationQueue(), []);
  useEffect(() => () => queue.clear(), [queue]);
  const state = useToastQueue<NotificationProps>(queue);
  const setPresented = useCallback(
    (key: string, presented: boolean) => queue.setPresented(key, presented),
    [queue],
  );
  return {
    ...state,
    setPresented,
    showPromotionalAlert: (content: AlertProps) =>
      queue.alert(
        { ...content, status: "promotional", type: "alert" },
        options,
      ),
    showNeutralAlert: (content: AlertProps) =>
      queue.alert({ ...content, status: "neutral", type: "alert" }, options),
    showSuccessAlert: (content: AlertProps) =>
      queue.alert({ ...content, status: "success", type: "alert" }, options),
    showWarningAlert: (content: AlertProps) =>
      queue.alert({ ...content, status: "warning", type: "alert" }, options),
    showErrorAlert: (content: AlertProps) =>
      queue.alert({ ...content, status: "error", type: "alert" }, options),
    showPromotionalToast: (content: ToastProps) =>
      queue.toast(
        { ...content, status: "promotional", type: "toast" },
        options,
      ),
    showNeutralToast: (content: ToastProps) =>
      queue.toast({ ...content, status: "neutral", type: "toast" }, options),
    showSuccessToast: (content: ToastProps) =>
      queue.toast({ ...content, status: "success", type: "toast" }, options),
    showWarningToast: (content: ToastProps) =>
      queue.toast({ ...content, status: "warning", type: "toast" }, options),
    showErrorToast: (content: ToastProps) =>
      queue.toast({ ...content, status: "error", type: "toast" }, options),
    closeActiveNotification: () => queue.closeActiveNotification(),
    closeNotification: (key: string) => queue.close(key),
  };
}
