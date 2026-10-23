import { AriaLabelingProps } from "@react-types/shared";
import React, {
  KeyboardEvent,
  ReactNode,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./WorkspaceTabs.module.scss";

export type WorkspaceTab = {
  /** Unique across both lists. IDs are opaque, not DOM IDs. */
  id: string;
  label: string;
  /** A supplied count; zero is retained in the tab's accessible name. */
  count?: number;
  isDisabled?: boolean;
  /** Open tabs are closable by default; pinned tabs are never closable. */
  isClosable?: boolean;
};

export type WorkspaceTabIds = {
  tabId: (id: string) => string;
  panelId: (id: string) => string;
};

// Fixed-width UTF-16 encoding is injective, even for literal escape-like keys,
// empty strings, astral characters, and lone surrogates. Never sanitize keys.
function encodeId(id: string) {
  return id
    .split("")
    .map((character) => character.charCodeAt(0).toString(16).padStart(4, "0"))
    .join("");
}

/** Call once per workspace and pass the same object to its tabs and panels. */
export function useWorkspaceTabIds(): WorkspaceTabIds {
  const instanceId = useId();
  return useMemo(
    () => ({
      tabId: (id: string) => `workspace-${instanceId}-tab-${encodeId(id)}`,
      panelId: (id: string) => `workspace-${instanceId}-panel-${encodeId(id)}`,
    }),
    [instanceId],
  );
}

export type WorkspaceTabsProps = AriaLabelingProps & {
  pinnedTabs?: readonly WorkspaceTab[];
  openTabs?: readonly WorkspaceTab[];
  /** Selection is always application-owned. Arrow keys only move focus. */
  selectedKey: string | null;
  onSelectionChange: (id: string) => void;
  onClose?: (id: string) => void;
  /** Share useWorkspaceTabIds() with externally rendered tab panels. */
  ids?: WorkspaceTabIds;
  /** Optional shared panel ID instead of one panel per tab. */
  panelId?: string;
  variant?: "primary" | "secondary";
  trailing?: ReactNode;
  /** Localize the separate close button's accessible name. */
  getCloseLabel?: (tab: WorkspaceTab) => string;
};

/** Manually activated, controlled workspace views with application-owned panels. */
export function WorkspaceTabs({
  pinnedTabs = [],
  openTabs = [],
  selectedKey,
  onSelectionChange,
  onClose,
  ids: suppliedIds,
  panelId,
  variant = "primary",
  trailing,
  getCloseLabel = (tab) => `Close ${tab.label} tab`,
  ...labelingProps
}: WorkspaceTabsProps) {
  const generatedIds = useWorkspaceTabIds();
  const ids = suppliedIds ?? generatedIds;
  const tabs = [...pinnedTabs, ...openTabs];
  const enabledTabs = tabs.filter((tab) => !tab.isDisabled);
  const initialKey = enabledTabs.find((tab) => tab.id === selectedKey)?.id;
  const [focusedKey, setFocusedKey] = useState<string | null>(
    initialKey ?? enabledTabs[0]?.id ?? null,
  );
  const rovingKey = enabledTabs.some((tab) => tab.id === focusedKey)
    ? focusedKey
    : (initialKey ?? enabledTabs[0]?.id ?? null);
  const listRef = useRef<HTMLDivElement>(null);
  const tablistRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>());
  const focusedControl = useRef<{
    id: string;
    index: number;
    element: HTMLElement;
  } | null>(null);

  function reveal(id: string | null) {
    const viewport = listRef.current;
    const button = id == null ? null : buttonsRef.current.get(id);
    const item = button?.parentElement;
    if (!viewport || !item) return;
    const viewportBounds = viewport.getBoundingClientRect();
    const itemBounds = item.getBoundingClientRect();
    const delta =
      itemBounds.left < viewportBounds.left
        ? itemBounds.left - viewportBounds.left
        : itemBounds.right > viewportBounds.right
          ? itemBounds.right - viewportBounds.right
          : 0;
    // Scroll only this bar, never an ancestor or the application page.
    if (delta) viewport.scrollLeft += delta;
  }

  function focusTab(id: string) {
    setFocusedKey(id);
    buttonsRef.current.get(id)?.focus({ preventScroll: true });
    reveal(id);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    const index = enabledTabs.findIndex((tab) => tab.id === id);
    if (index < 0) return;
    const rtl = getComputedStyle(listRef.current!).direction === "rtl";
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = index + (rtl ? -1 : 1);
        break;
      case "ArrowLeft":
        nextIndex = index + (rtl ? 1 : -1);
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = enabledTabs.length - 1;
        break;
      default:
        // Native buttons activate on Enter/Space, without duplicate callbacks.
        return;
    }
    event.preventDefault();
    focusTab(
      enabledTabs[(nextIndex + enabledTabs.length) % enabledTabs.length].id,
    );
  }

  // A controlled removal may happen long after onClose returns. Recover only
  // when the removed/disabled control still owned focus, not after a user moved
  // to a different part of the application while awaiting that update.
  useLayoutEffect(() => {
    if (document.activeElement === tablistRef.current && enabledTabs.length) {
      focusTab(initialKey ?? enabledTabs[0].id);
      return;
    }
    const previous = focusedControl.current;
    if (!previous) return;
    const isAvailable = tabs.some(
      (tab) => tab.id === previous.id && !tab.isDisabled,
    );
    const hasControl =
      previous.element.isConnected &&
      !previous.element.hasAttribute("disabled");
    if (isAvailable && hasControl) {
      previous.index = tabs.findIndex((tab) => tab.id === previous.id);
      return;
    }
    const active = document.activeElement;
    if (active !== document.body && active !== previous.element) {
      focusedControl.current = null;
      return;
    }
    const target =
      tabs.slice(previous.index).find((tab) => !tab.isDisabled) ??
      tabs
        .slice(0, previous.index)
        .reverse()
        .find((tab) => !tab.isDisabled);
    if (target) focusTab(target.id);
    else {
      focusedControl.current = null;
      tablistRef.current?.focus({ preventScroll: true });
    }
  });

  useLayoutEffect(() => {
    if (!listRef.current?.contains(document.activeElement)) {
      setFocusedKey(initialKey ?? enabledTabs[0]?.id ?? null);
    }
    reveal(selectedKey);
    // Only an actual selection change resets the entry point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  // Width transitions and opening/closing neighbors can hide a previously
  // visible item without changing selection. Keep the current focus visible.
  useLayoutEffect(() => {
    const viewport = listRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const revealCurrent = () =>
      reveal(
        viewport.contains(document.activeElement)
          ? (focusedControl.current?.id ?? selectedKey)
          : selectedKey,
      );
    const observer = new ResizeObserver(revealCurrent);
    observer.observe(viewport);
    Array.from(viewport.children).forEach((child) => observer.observe(child));
    revealCurrent();
    return () => observer.disconnect();
  });

  return (
    <div className={styles.workspace} data-variant={variant}>
      <div
        className={styles.tabs}
        ref={listRef}
        onBlurCapture={(event) => {
          if (
            (event.relatedTarget instanceof Node &&
              !event.currentTarget.contains(event.relatedTarget)) ||
            (event.relatedTarget == null &&
              event.target.isConnected &&
              !event.target.hasAttribute("disabled"))
          ) {
            focusedControl.current = null;
          }
        }}
      >
        {/* Own only tabs in the accessibility tree. Close controls remain
            separate sibling buttons rather than invalid tablist children. */}
        <div
          {...labelingProps}
          ref={tablistRef}
          role="tablist"
          className={styles.tablist}
          aria-orientation="horizontal"
          aria-owns={
            tabs.length
              ? tabs.map((tab) => ids.tabId(tab.id)).join(" ")
              : undefined
          }
          tabIndex={enabledTabs.length ? undefined : 0}
        />
        {tabs.map((tab, index) => {
          const pinned = index < pinnedTabs.length;
          const selected = tab.id === selectedKey;
          return (
            <div
              className={styles.item}
              role="presentation"
              key={tab.id}
              data-selected={selected || undefined}
              data-disabled={tab.isDisabled || undefined}
              data-pinned={pinned || undefined}
              onFocusCapture={(event) => {
                focusedControl.current = {
                  id: tab.id,
                  index,
                  element: event.target as HTMLElement,
                };
              }}
            >
              <button
                ref={(button) => {
                  if (button) buttonsRef.current.set(tab.id, button);
                  else buttonsRef.current.delete(tab.id);
                }}
                type="button"
                role="tab"
                className={styles.tab}
                id={ids.tabId(tab.id)}
                aria-controls={panelId ?? ids.panelId(tab.id)}
                aria-selected={selected}
                aria-disabled={tab.isDisabled || undefined}
                disabled={tab.isDisabled}
                tabIndex={!tab.isDisabled && tab.id === rovingKey ? 0 : -1}
                title={tab.label}
                onFocus={() => {
                  setFocusedKey(tab.id);
                  reveal(tab.id);
                }}
                onKeyDown={(event) => onKeyDown(event, tab.id)}
                onClick={() => onSelectionChange(tab.id)}
              >
                <span className={styles.label}>{tab.label}</span>
                {tab.count != null && (
                  <span className={styles.count}>{tab.count}</span>
                )}
              </button>
              {!pinned && tab.isClosable !== false && onClose && (
                <button
                  type="button"
                  className={styles.close}
                  disabled={tab.isDisabled}
                  aria-label={getCloseLabel(tab)}
                  onClick={() => onClose(tab.id)}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                    <path d="m4 4 8 8M12 4l-8 8" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
      {trailing != null && <div className={styles.trailing}>{trailing}</div>}
    </div>
  );
}
