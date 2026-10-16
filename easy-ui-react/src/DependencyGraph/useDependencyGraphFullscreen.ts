import { RefObject, useEffect, useRef, useState } from "react";

/** The browser owns fullscreen state, including Escape and external exits. */
export function useDependencyGraphFullscreen(
  root: RefObject<HTMLElement | null>,
) {
  const [available, setAvailable] = useState(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const doc = element.ownerDocument;
    setAvailable(
      !!doc.fullscreenEnabled &&
        typeof element.requestFullscreen === "function" &&
        typeof doc.exitFullscreen === "function",
    );
    let wasActive = doc.fullscreenElement === element;
    const update = () => {
      const next = doc.fullscreenElement === element;
      setActive(next);
      if (wasActive && !next && element.isConnected) {
        element
          .querySelector<HTMLElement>("[data-graph-fullscreen-toggle]")
          ?.focus({ preventScroll: true });
      }
      wasActive = next;
    };
    update();
    doc.addEventListener("fullscreenchange", update);
    return () => doc.removeEventListener("fullscreenchange", update);
  }, [root]);

  const toggle = async () => {
    const element = root.current;
    if (!element || !available || pending.current) return;
    pending.current = true;
    setError("");
    try {
      if (element.ownerDocument.fullscreenElement === element) {
        await element.ownerDocument.exitFullscreen();
      } else {
        await element.requestFullscreen();
      }
    } catch {
      if (element.isConnected) {
        setError("Full screen could not be changed. Please try again.");
      }
    } finally {
      pending.current = false;
    }
  };

  return { available, active, error, toggle };
}
