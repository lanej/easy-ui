import { vi } from "vitest";
import { EasyUINotificationQueue } from "./NotificationQueue";

function mount(queue: EasyUINotificationQueue) {
  for (const item of queue.visibleToasts) {
    if (item.timeout) item.timer?.reset(item.timeout);
  }
}

describe("notification queue configuration", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("retains replacement, four-second toast, and persistent alert defaults", () => {
    const queue = new EasyUINotificationQueue();
    queue.toast({ message: "first" });
    const latest = queue.toast({ message: "second" });
    expect(queue.visibleToasts.map((item) => item.key)).toEqual([latest]);
    mount(queue);
    vi.advanceTimersByTime(3999);
    expect(queue.visibleToasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(queue.visibleToasts).toHaveLength(0);
    queue.alert({ message: "alert" });
    mount(queue);
    vi.advanceTimersByTime(60000);
    expect(queue.visibleToasts[0].content.isDismissable).toBe(true);
    queue.clear();
  });

  it("keys identical rapid arrivals independently and preserves other timers when closed", () => {
    const queue = new EasyUINotificationQueue();
    queue.configure({ stacking: true, timeout: 5000, isDismissable: true });
    const first = queue.toast({ message: "Saved" });
    mount(queue);
    vi.advanceTimersByTime(1000);
    const second = queue.toast({ message: "Saved" });
    mount(queue);
    expect(first).not.toBe(second);
    queue.close(second);
    vi.advanceTimersByTime(3999);
    expect(queue.visibleToasts[0].key).toBe(first);
    vi.advanceTimersByTime(1);
    expect(queue.visibleToasts).toHaveLength(0);
  });

  it("does not expire an unmounted item or restart a paused visible duration", () => {
    const queue = new EasyUINotificationQueue();
    queue.configure({ stacking: true, timeout: 5000 });
    queue.toast({ message: "Saved" });
    vi.advanceTimersByTime(60000);
    expect(queue.visibleToasts).toHaveLength(1);
    mount(queue);
    vi.advanceTimersByTime(2000);
    queue.pauseAll();
    vi.advanceTimersByTime(60000);
    queue.resumeAll();
    queue.resumeAll(); // nested hover/focus events must not create extra timers
    mount(queue); // remount must not reset elapsed time
    vi.advanceTimersByTime(2999);
    expect(queue.visibleToasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(queue.visibleToasts).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("starts arrivals made during interaction only after the region resumes", () => {
    const queue = new EasyUINotificationQueue();
    queue.configure({ stacking: true, timeout: 5000 });
    queue.pauseAll();
    queue.toast({ message: "Saved while reading" });
    mount(queue);
    vi.advanceTimersByTime(60000);
    expect(queue.visibleToasts).toHaveLength(1);
    queue.resumeAll();
    vi.advanceTimersByTime(5000);
    expect(queue.visibleToasts).toHaveLength(0);
  });

  it("snapshots defaults, allows per-message overrides, and applies stacking changes on the next arrival", () => {
    const queue = new EasyUINotificationQueue();
    queue.configure({ stacking: true, timeout: 5000, isDismissable: true });
    queue.toast({ message: "original" });
    queue.alert({ message: "persistent" });
    queue.alert({ message: "timed alert", timeout: 1000 });
    mount(queue);
    queue.configure({ stacking: false, timeout: 8000, isDismissable: false });
    vi.advanceTimersByTime(1000);
    expect(queue.visibleToasts.map((item) => item.content.message)).toEqual([
      "persistent",
      "original",
    ]);
    expect(queue.visibleToasts[1].content.isDismissable).toBe(true);
    queue.toast({ message: "replacement", timeout: 0, isDismissable: true });
    mount(queue);
    vi.advanceTimersByTime(60000);
    expect(queue.visibleToasts.map((item) => item.content.message)).toEqual([
      "replacement",
    ]);
    queue.closeActiveNotification();
    expect(queue.visibleToasts).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears every timer, including ones not yet mounted", () => {
    const queue = new EasyUINotificationQueue();
    queue.configure({ stacking: true });
    queue.toast({ message: "one" });
    mount(queue);
    queue.toast({ message: "two" });
    queue.clear();
    expect(queue.visibleToasts).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
