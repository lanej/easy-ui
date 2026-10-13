import React, {
  ComponentProps,
  PropsWithChildren,
  useEffect,
  useRef,
  useState,
} from "react";
import "./docs.css";

/** Keep documentation columns readable while confining scrolling to the table. */
export function DocsScroll({
  children,
  api = false,
}: PropsWithChildren<{ api?: boolean }>) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () =>
      setScrollable(element.scrollWidth > element.clientWidth + 1);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    update();
    return () => observer.disconnect();
  }, [children]);
  return (
    <>
      <div
        ref={ref}
        className={`easy-ui-docs-table${api ? " easy-ui-docs-table--api" : ""}`}
        role={scrollable ? "region" : undefined}
        aria-label={scrollable ? "Scrollable documentation table" : undefined}
        tabIndex={scrollable ? 0 : undefined}
      >
        {children}
      </div>
      {scrollable && (
        <p className="easy-ui-docs-table-hint">
          Scroll horizontally to see all columns.
        </p>
      )}
    </>
  );
}

export function DocsTable(props: ComponentProps<"table">) {
  return (
    <DocsScroll>
      <table {...props} />
    </DocsScroll>
  );
}
