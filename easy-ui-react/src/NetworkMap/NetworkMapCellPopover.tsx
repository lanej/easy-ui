import React, {
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styles from "./NetworkMap.module.scss";
import { useOverlay } from "react-aria";
import { Button } from "../Button";

/** A non-modal inspector stays within the viewport and leaves room for attribution. */
export function NetworkMapCellPopover({
  x,
  y,
  pinned,
  onClose,
  onPin,
  onEnter,
  onLeave,
  children,
  label = "Delivery cell details",
  heading,
  closeLabel = "Close cell details",
  positioning = "parent",
  id,
  elementRef,
  returnFocusElement,
  styleSource,
}: {
  x: number;
  y: number;
  pinned: boolean;
  onClose: () => void;
  onPin: () => void;
  onEnter: () => void;
  onLeave: () => void;
  children: ReactNode;
  label?: string;
  heading?: string;
  closeLabel?: string;
  positioning?: "parent" | "viewport";
  id?: string;
  elementRef?: React.RefObject<HTMLDivElement | null>;
  returnFocusElement?: HTMLElement | null;
  styleSource?: HTMLElement | null;
}) {
  const element = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const dismiss = useCallback(() => {
    const node = element.current;
    if (node?.contains(document.activeElement)) {
      if (returnFocusElement?.isConnected)
        returnFocusElement.focus({ preventScroll: true });
      else
        node.parentElement
          ?.querySelector<HTMLCanvasElement>("canvas")
          ?.focus({ preventScroll: true });
    }
    onClose();
  }, [onClose, returnFocusElement]);
  const { overlayProps } = useOverlay(
    {
      isOpen: true,
      isDismissable: pinned,
      onClose: dismiss,
      shouldCloseOnInteractOutside: (target) => {
        if (
          target.closest(
            'button, a, input, select, textarea, label, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="combobox"], [role="slider"], [role="spinbutton"], [role="textbox"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="treeitem"]',
          )
        )
          return false;
        const canvas =
          element.current?.parentElement?.querySelector(".maplibregl-canvas");
        if (target === canvas) return false;
        const marker = target.closest(".maplibregl-marker");
        return !marker || !canvas?.closest(".maplibregl-map")?.contains(marker);
      },
    },
    element,
  );
  useEffect(() => {
    const node = element.current;
    const viewport = node?.parentElement;
    if (!node || !viewport) return;
    const place = () => {
      const width =
        positioning === "viewport"
          ? document.documentElement.clientWidth
          : viewport.clientWidth;
      const height =
        positioning === "viewport" ? window.innerHeight : viewport.clientHeight;
      const left =
        x + 16 + node.offsetWidth <= width - 8
          ? x + 16
          : x - node.offsetWidth - 16;
      const top =
        y + 16 + node.offsetHeight <= height - 48
          ? y + 16
          : y - node.offsetHeight - 16;
      setPosition({
        left: Math.max(8, Math.min(left, width - node.offsetWidth - 8)),
        top: Math.max(8, Math.min(top, height - node.offsetHeight - 48)),
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(node);
    observer.observe(viewport);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [x, y, positioning]);
  useEffect(() => {
    // Entering an embedded control pins the card without stealing its focus.
    // A map click still moves focus into the inspector for keyboard dismissal.
    if (pinned && !element.current?.contains(document.activeElement))
      closeButton.current?.focus({ preventScroll: true });
  }, [pinned]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !element.current?.contains(event.target as Node)
      )
        dismiss();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [dismiss]);
  useEffect(() => {
    if (!id || !returnFocusElement) return;
    const original =
      returnFocusElement
        .getAttribute("aria-describedby")
        ?.split(/\s+/)
        .filter(Boolean) ?? [];
    returnFocusElement.setAttribute(
      "aria-describedby",
      [...new Set([...original, id])].join(" "),
    );
    return () => {
      const remaining = returnFocusElement
        .getAttribute("aria-describedby")
        ?.split(/\s+/)
        .filter((part) => part !== id)
        .join(" ");
      if (remaining)
        returnFocusElement.setAttribute("aria-describedby", remaining);
      else returnFocusElement.removeAttribute("aria-describedby");
    };
  }, [id, returnFocusElement]);
  useLayoutEffect(() => {
    const node = element.current;
    const restoreTo =
      returnFocusElement ??
      node?.parentElement?.querySelector<HTMLCanvasElement>("canvas");
    return () => {
      // Context/data cleanup can remove a focused card without a Close action.
      if (node?.contains(document.activeElement) && restoreTo?.isConnected)
        restoreTo.focus({ preventScroll: true });
    };
  }, [returnFocusElement]);
  // Preserve nested and system themes when a viewport card is portalled to body.
  useLayoutEffect(() => {
    const node = element.current;
    if (positioning !== "viewport" || !styleSource || !node) return;
    let copied = new Set<string>();
    const sync = () => {
      const css = getComputedStyle(styleSource);
      const next = new Set<string>();
      for (let index = 0; index < css.length; index++) {
        const property = css.item(index);
        if (!property.startsWith("--ezui-")) continue;
        next.add(property);
        const value = css.getPropertyValue(property);
        if (node.style.getPropertyValue(property) !== value)
          node.style.setProperty(property, value);
      }
      for (const property of copied)
        if (!next.has(property)) node.style.removeProperty(property);
      copied = next;
      node.style.fontFamily = css.fontFamily;
      node.style.colorScheme = css.colorScheme;
    };
    sync();
    const ancestors = new Set<Element>();
    for (
      let parent: Element | null = styleSource;
      parent;
      parent = parent.parentElement
    )
      ancestors.add(parent);
    const isStylesheet = (target: Node) =>
      target instanceof HTMLStyleElement ||
      target instanceof HTMLLinkElement ||
      target.parentElement instanceof HTMLStyleElement;
    const observer = new MutationObserver((records) => {
      if (
        records.some(
          (record) =>
            (record.type === "attributes" &&
              ancestors.has(record.target as Element) &&
              !record.attributeName?.startsWith("data-map-")) ||
            isStylesheet(record.target) ||
            [...record.addedNodes, ...record.removedNodes].some(isStylesheet),
        )
      )
        sync();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", sync);
    const load = (event: Event) => {
      if (event.target instanceof HTMLLinkElement) sync();
    };
    document.addEventListener("load", load, true);
    return () => {
      observer.disconnect();
      media?.removeEventListener?.("change", sync);
      document.removeEventListener("load", load, true);
    };
  }, [positioning, styleSource]);
  const content = (
    <div
      {...overlayProps}
      id={id}
      ref={(node) => {
        element.current = node;
        if (elementRef) elementRef.current = node;
      }}
      className={styles.cellPopover}
      style={
        positioning === "viewport"
          ? {
              ...position,
              position: "fixed",
              zIndex: 1000,
              maxWidth: "calc(100vw - 16px)",
              maxHeight: "min(480px, calc(100vh - 56px))",
            }
          : position
      }
      role="region"
      aria-label={label}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onPin}
      onClickCapture={onPin}
    >
      <div className={styles.cellPopoverHeader}>
        <strong>
          {heading ?? (pinned ? "Selected cell" : "Delivery cell")}
        </strong>
        {!pinned && (
          <Button size="sm" variant="outlined" type="button" onPress={onPin}>
            <span className={styles.controlLabel}>Keep open</span>
          </Button>
        )}
        <Button
          size="sm"
          variant="outlined"
          type="button"
          ref={closeButton as React.RefObject<null>}
          onPress={dismiss}
          aria-label={closeLabel}
        >
          <span className={styles.controlLabel}>Close</span>
        </Button>
      </div>
      {children}
    </div>
  );
  return positioning === "viewport"
    ? createPortal(content, document.body)
    : content;
}
