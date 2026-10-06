import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
}) {
  const element = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const dismiss = useCallback(() => {
    const node = element.current;
    if (node?.contains(document.activeElement)) {
      node.parentElement
        ?.querySelector<HTMLCanvasElement>("canvas")
        ?.focus({ preventScroll: true });
    }
    onClose();
  }, [onClose]);
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
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
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
    return () => observer.disconnect();
  }, [x, y]);
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
  return (
    <div
      {...overlayProps}
      ref={element}
      className={styles.cellPopover}
      style={position}
      role="region"
      aria-label={label}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onPin}
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
}
