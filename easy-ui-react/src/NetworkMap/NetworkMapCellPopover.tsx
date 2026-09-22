import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "./NetworkMap.module.scss";

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
}: {
  x: number;
  y: number;
  pinned: boolean;
  onClose: () => void;
  onPin: () => void;
  onEnter: () => void;
  onLeave: () => void;
  children: ReactNode;
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
    if (pinned) closeButton.current?.focus({ preventScroll: true });
  }, [pinned]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    const outside = (event: PointerEvent) => {
      if (pinned && !element.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
    };
  }, [pinned, onClose, dismiss]);
  return (
    <div
      ref={element}
      className={styles.cellPopover}
      style={position}
      role="region"
      aria-label="Delivery cell details"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onPin}
    >
      <div className={styles.cellPopoverHeader}>
        <strong>{pinned ? "Selected cell" : "Delivery cell"}</strong>
        {!pinned && (
          <button type="button" onClick={onPin}>
            Keep open
          </button>
        )}
        <button
          type="button"
          ref={closeButton}
          onClick={dismiss}
          aria-label="Close cell details"
        >
          Close
        </button>
      </div>
      {children}
    </div>
  );
}
