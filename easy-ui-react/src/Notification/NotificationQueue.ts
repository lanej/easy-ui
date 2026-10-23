import { ToastQueue } from "@react-stately/toast";
import type { NotificationOptions, NotificationProps } from "./Notification";

export const TOAST_TIMEOUT_DURATION = 4000;

/**
 * Retains React Stately's keyed queue and starts timers only when useToast mounts
 * an item. Configuration is read at insertion, never retroactively applied.
 */
export class EasyUINotificationQueue extends ToastQueue<NotificationProps> {
  private options: NotificationOptions = {};
  private isPaused = false;

  configure(options: NotificationOptions = {}) {
    this.options = options;
  }

  closeActiveNotification() {
    const latest = this.visibleToasts[0];
    if (latest) this.close(latest.key);
  }

  override close(key: string) {
    this.visibleToasts.find((toast) => toast.key === key)?.timer?.pause();
    super.close(key);
  }

  override clear() {
    super.pauseAll();
    super.clear();
    this.isPaused = false;
  }

  override pauseAll() {
    this.isPaused = true;
    super.pauseAll();
  }

  override resumeAll() {
    this.isPaused = false;
    super.resumeAll();
  }

  alert(content: NotificationProps, options = this.options) {
    return this.enqueue(content, true, options);
  }

  toast(content: NotificationProps, options = this.options) {
    return this.enqueue(content, false, options);
  }

  private enqueue(
    content: NotificationProps,
    isAlert: boolean,
    options: NotificationOptions,
  ) {
    if (!options.stacking) {
      // Clear every retained item when the next replacement arrives, including
      // items created before stacking was disabled. Do not invoke onDismiss.
      super.pauseAll();
      super.clear();
    }
    const timeout =
      content.timeout ??
      (isAlert ? 0 : (options.timeout ?? TOAST_TIMEOUT_DURATION));
    const key = super.add(
      {
        ...content,
        isDismissable:
          content.isDismissable ?? (isAlert || options.isDismissable === true),
      },
      {
        timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : undefined,
      },
    );
    const timer = this.visibleToasts.find((toast) => toast.key === key)?.timer;
    if (timer) {
      // React Stately's Timer.resume is not idempotent. Guard repeated region
      // focus/hover events, and preserve elapsed time across StrictMode effects.
      const reset = timer.reset.bind(timer);
      const resume = timer.resume.bind(timer);
      const pause = timer.pause.bind(timer);
      let started = false;
      let running = false;
      timer.resume = () => {
        if (!running && !this.isPaused) {
          running = true;
          resume();
        }
      };
      timer.pause = () => {
        running = false;
        pause();
      };
      timer.reset = (duration) => {
        if (!started) {
          started = true;
          reset(duration);
        } else {
          timer.resume();
        }
      };
    }
    return key;
  }
}
