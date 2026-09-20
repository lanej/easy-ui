import { useEffect, useRef, useState } from "react";

/** Render deterministic SSR markup, then keep SVG text in CSS-pixel coordinates. */
export function usePlotWidth<ElementType extends Element = HTMLDivElement>(
  initialWidth = 480,
) {
  const ref = useRef<ElementType>(null);
  const [width, setWidth] = useState(initialWidth);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = () => {
      const measured = element.getBoundingClientRect().width;
      if (measured > 0) setWidth(measured);
    };
    resize();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(resize);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return { ref, width };
}
