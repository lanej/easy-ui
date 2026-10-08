import React from "react";
import { Pagination, PaginationProps } from "./Pagination";

export type PaginationPageControlsProps = Pick<
  PaginationProps,
  "size" | "isDisabled" | "wrap"
> & {
  /** Current one-based page, within the supplied page count. */
  page: number;
  /** Total number of pages. Supply at least one, including an empty result. */
  count: number;
  /** Requested next page. The caller supplies the corresponding rows. */
  onChange: (page: number) => void;
  /** Accessible name of the navigation. Defaults to Pagination. */
  label?: string;
  /** Number of adjacent page numbers. Defaults to two. */
  siblingCount?: number;
};

export function PaginationPageControls({
  page,
  count,
  onChange,
  label = "Pagination",
  siblingCount,
  ...props
}: PaginationPageControlsProps) {
  const hasPrevious = page > 1;
  const hasNext = page < count;
  return (
    <Pagination
      {...props}
      label={label}
      hasFirst={hasPrevious}
      hasPrevious={hasPrevious}
      hasNext={hasNext}
      hasLast={hasNext}
      onFirst={() => onChange(1)}
      onPrevious={() => onChange(page - 1)}
      onNext={() => onChange(page + 1)}
      onLast={() => onChange(count)}
    >
      <Pagination.Pages
        page={page}
        count={count}
        siblingCount={siblingCount}
        onSelect={onChange}
      />
    </Pagination>
  );
}
