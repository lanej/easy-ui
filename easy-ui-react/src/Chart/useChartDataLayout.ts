import { useCallback, useEffect, useRef, useState } from "react";
import type { ChartDataTable } from "./types";
import styles from "./Chart.module.scss";

/** Measure actual column widths, including font changes and newly opened content. */
export function useChartDataLayout(
  {
    columns,
    columnOptions,
    pinnedColumnCount = 0,
    stickyHeader = true,
  }: ChartDataTable,
  hasDisclosure = false,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableRowElement>(null);
  const [layout, setLayout] = useState({
    offsets: [] as number[],
    pinnedWidth: 0,
    headerHeight: 0,
  });
  const revealFocus = useCallback(
    (target: HTMLElement | null) => {
      const scroll = scrollRef.current;
      if (
        !scroll ||
        !target ||
        target === scroll ||
        target.closest(`.${styles.tableScroll}`) !== scroll
      )
        return;
      // Native focus scrolling does not account for overlaid sticky cells.
      // Run after both native focus movement and measured layout updates.
      requestAnimationFrame(() => {
        if (!scroll.contains(target) || target !== document.activeElement)
          return;
        const { scrollLeft, scrollTop } = scroll;
        target.scrollIntoView?.({
          block: "nearest",
          inline: "nearest",
          behavior: "instant",
        });
        if (target.closest(`.${styles.pinnedColumn}`))
          scroll.scrollLeft = scrollLeft;
        if (stickyHeader && headerRef.current?.contains(target))
          scroll.scrollTop = scrollTop;
      });
    },
    [stickyHeader],
  );
  useEffect(() => {
    const scroll = scrollRef.current;
    const header = headerRef.current;
    if (!scroll || !header) return;
    const cells = Array.from(header.cells);
    const controls = Array.from(header.querySelectorAll("button"));
    const count = Number.isFinite(pinnedColumnCount)
      ? Math.min(columns.length, Math.max(0, Math.floor(pinnedColumnCount)))
      : 0;
    const measure = () => {
      // A folded disclosure has no useful geometry. ResizeObserver remeasures
      // its columns when opened, including columns containing deferred content.
      if (!scroll.clientWidth) return;
      const offsets: number[] = [];
      let pinnedWidth = 0;
      const widestControl = Math.max(
        0,
        ...controls.map((control) => control.getBoundingClientRect().width),
      );
      // Reserve both readable data space and room for an entire sort control,
      // including its focus ring, even when scrollbars consume viewport width.
      const pinnedLimit =
        scroll.clientWidth -
        Math.max(scroll.clientWidth / 2, widestControl + 8);
      for (const cell of cells.slice(0, count)) {
        const width = cell.getBoundingClientRect().width;
        if (pinnedWidth + width > pinnedLimit) break;
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
      revealFocus(document.activeElement as HTMLElement | null);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(scroll);
    cells.forEach((cell) => observer.observe(cell));
    controls.forEach((control) => observer.observe(control));
    return () => observer.disconnect();
  }, [
    columns.length,
    columnOptions,
    pinnedColumnCount,
    stickyHeader,
    hasDisclosure,
    revealFocus,
  ]);
  return { scrollRef, headerRef, revealFocus, ...layout };
}
