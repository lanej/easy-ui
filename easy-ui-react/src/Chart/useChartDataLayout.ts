import { useEffect, useRef, useState } from "react";

/** Measure actual column widths, including font changes and newly opened content. */
export function useChartDataLayout(
  columnCount: number,
  pinnedColumnCount = 0,
  stickyHeader = true,
  hasDisclosure = false,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableRowElement>(null);
  const [layout, setLayout] = useState({
    offsets: [] as number[],
    pinnedWidth: 0,
    headerHeight: 0,
  });
  useEffect(() => {
    const scroll = scrollRef.current;
    const header = headerRef.current;
    if (!scroll || !header) return;
    const cells = Array.from(header.cells);
    const count = Number.isFinite(pinnedColumnCount)
      ? Math.min(columnCount, Math.max(0, Math.floor(pinnedColumnCount)))
      : 0;
    const measure = () => {
      // A folded disclosure has no useful geometry. ResizeObserver remeasures
      // its columns when opened, including columns containing deferred content.
      if (!scroll.clientWidth) return;
      const offsets: number[] = [];
      let pinnedWidth = 0;
      for (const cell of cells.slice(0, count)) {
        const width = cell.getBoundingClientRect().width;
        if (pinnedWidth + width > scroll.clientWidth / 2) break;
        offsets.push(pinnedWidth);
        pinnedWidth += width;
      }
      const headerHeight = stickyHeader
        ? header.getBoundingClientRect().height
        : 0;
      setLayout((previous) =>
        previous.headerHeight === headerHeight &&
        previous.pinnedWidth === pinnedWidth &&
        previous.offsets.length === offsets.length &&
        previous.offsets.every((value, index) => value === offsets[index])
          ? previous
          : { offsets, pinnedWidth, headerHeight },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(scroll);
    cells.forEach((cell) => observer.observe(cell));
    return () => observer.disconnect();
  }, [columnCount, pinnedColumnCount, stickyHeader, hasDisclosure]);
  return { scrollRef, headerRef, ...layout };
}
