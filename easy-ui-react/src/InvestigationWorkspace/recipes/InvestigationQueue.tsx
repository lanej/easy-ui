import React, { useCallback, useEffect, useRef, useState } from "react";
import { useResizeObserver } from "@react-aria/utils";
import { DataGrid } from "../../DataGrid";
import { Pagination } from "../../Pagination";
import type { KeyedSortDescriptor } from "../../DataGrid/types";
import { RiskScore, type RiskScoreAssessment } from "../../RiskScore";
import {
  ObservationFreshness,
  type ObservationFreshnessState,
} from "../../ObservationFreshness";
import { TextField } from "../../TextField";
import { Select } from "../../Select";
import { Button } from "../../Button";
import { Badge } from "../../Badge";
import { Popover } from "../../Popover";
import styles from "./InvestigationRecipes.module.scss";

export type InvestigationCaseCategory = { id: string; label: string };
export type InvestigationCase = {
  id: string;
  trackingCode: string;
  /** Caller-owned category; independent of assessment and review status. */
  category: InvestigationCaseCategory;
  subject?: string;
  risk: number | null;
  assessment?: RiskScoreAssessment;
  freshness: ObservationFreshnessState;
  observedAt?: string;
  observedAtLabel?: string;
  reviewStatus: "Unreviewed" | "In review" | "Reviewed";
};
export type InvestigationQueueProps = {
  cases: readonly InvestigationCase[];
  onOpenCase: (id: string) => void;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
};

/** Application recipe: replace the local filters/paging with your query layer as needed. */
export function InvestigationQueue({
  cases,
  onOpenCase,
  isLoading,
  error,
  onRetry,
}: InvestigationQueueProps) {
  const queueRef = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const restoreSearchFocus = useRef(false);
  const measure = useCallback(() => {
    const width = queueRef.current?.getBoundingClientRect().width;
    // A queue retained behind case navigation has no measurable width.
    if (width) {
      setCompact(width < 900);
      if (width > 720 && filtersOpen) {
        restoreSearchFocus.current = true;
        setFiltersOpen(false);
      }
    }
  }, [filtersOpen]);
  useResizeObserver({ ref: queueRef, onResize: measure });
  useEffect(measure, [measure]);
  useEffect(() => {
    if (filtersOpen || !restoreSearchFocus.current) return;
    restoreSearchFocus.current = false;
    // Let the overlay finish restoring focus before replacing its hidden trigger.
    const frame = requestAnimationFrame(() => {
      queueRef.current
        ?.querySelector<HTMLInputElement>('input[type="search"]')
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [filtersOpen]);
  const [query, setQuery] = useState("");
  const [review, setReview] = useState("all");
  const [assessment, setAssessment] = useState("all");
  const [category, setCategory] = useState<InvestigationCaseCategory | null>(
    null,
  );
  const categories = new Map(
    cases.map((item) => [item.category.id, item.category]),
  );
  // Keep an active filter visible if its category disappears from a new snapshot.
  if (category && !categories.has(category.id))
    categories.set(category.id, category);
  const categoryOptions = [...categories.values()].sort((a, b) =>
    a.label.localeCompare(b.label),
  );
  const [sort, setSort] = useState<KeyedSortDescriptor<string>>({
    column: "risk",
    direction: "descending",
  });
  const [page, setPage] = useState(1);
  const search = query.trim().toLocaleLowerCase();
  const filtered = cases.filter(
    (item) =>
      (!search ||
        `${item.id} ${item.trackingCode} ${item.category.label} ${item.subject ?? ""}`
          .toLocaleLowerCase()
          .includes(search)) &&
      (!category || item.category.id === category.id) &&
      (review === "all" || item.reviewStatus === review) &&
      (assessment === "all" ||
        (item.assessment ?? "unassessed") === assessment),
  );
  const sorted = [...filtered].sort((a, b) => {
    if (sort.column === "risk") {
      const aRisk =
        a.risk != null &&
        Number.isFinite(a.risk) &&
        a.risk >= 0 &&
        a.risk <= 100
          ? a.risk
          : null;
      const bRisk =
        b.risk != null &&
        Number.isFinite(b.risk) &&
        b.risk >= 0 &&
        b.risk <= 100
          ? b.risk
          : null;
      if (aRisk === null) return bRisk === null ? 0 : 1;
      if (bRisk === null) return -1;
      return (aRisk - bRisk) * (sort.direction === "ascending" ? 1 : -1);
    }
    return a.id.localeCompare(b.id) * (sort.direction === "ascending" ? 1 : -1);
  });
  const count = Math.max(1, Math.ceil(sorted.length / 5));
  const currentPage = Math.min(page, count);
  const rows = sorted
    .slice((currentPage - 1) * 5, currentPage * 5)
    .map((item) => ({ ...item, key: item.id }));
  const clearFilters = () => {
    setQuery("");
    setReview("all");
    setAssessment("all");
    setCategory(null);
    setPage(1);
  };
  const activeFilters = [
    category?.label,
    review !== "all" ? review : null,
    assessment !== "all"
      ? {
          high: "High risk",
          medium: "Medium risk",
          low: "Low risk",
          unassessed: "Not assessed",
        }[assessment]
      : null,
  ].filter(Boolean);
  const filterFields = (
    <>
      <Select
        size="sm"
        label="Category"
        selectedKey={category ? `category:${category.id}` : "all"}
        onSelectionChange={(key) => {
          setCategory(
            categoryOptions.find((option) => `category:${option.id}` === key) ??
              null,
          );
          setPage(1);
        }}
      >
        {[
          <Select.Option key="all">All categories</Select.Option>,
          ...categoryOptions.map((option) => (
            <Select.Option key={`category:${option.id}`}>
              {option.label}
            </Select.Option>
          )),
        ]}
      </Select>
      <Select
        size="sm"
        label="Review status"
        selectedKey={review}
        onSelectionChange={(key) => {
          setReview(String(key));
          setPage(1);
        }}
      >
        <Select.Option key="all">All reviews</Select.Option>
        <Select.Option key="Unreviewed">Unreviewed</Select.Option>
        <Select.Option key="In review">In review</Select.Option>
        <Select.Option key="Reviewed">Reviewed</Select.Option>
      </Select>
      <Select
        size="sm"
        label="Risk assessment"
        selectedKey={assessment}
        onSelectionChange={(key) => {
          setAssessment(String(key));
          setPage(1);
        }}
      >
        <Select.Option key="all">All assessments</Select.Option>
        <Select.Option key="high">High risk</Select.Option>
        <Select.Option key="medium">Medium risk</Select.Option>
        <Select.Option key="low">Low risk</Select.Option>
        <Select.Option key="unassessed">Not assessed</Select.Option>
      </Select>
    </>
  );
  return (
    <section
      ref={queueRef}
      className={styles.queue}
      aria-label="Investigation queue"
    >
      <div className={styles.filters}>
        <TextField
          label="Find a case"
          size="sm"
          type="search"
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder="Search cases"
        />
        <div className={styles.inlineFilters}>{filterFields}</div>
        <div className={styles.mobileFilters}>
          <Popover isOpen={filtersOpen} onOpenChange={setFiltersOpen}>
            <Popover.Trigger>
              <Button variant="outlined" size="sm">
                {activeFilters.length
                  ? `Filters (${activeFilters.length})`
                  : "Filters"}
              </Button>
            </Popover.Trigger>
            <Popover.Overlay width="min(320px, calc(100vw - 24px))">
              <Popover.Header>
                <Popover.Title>Filter cases</Popover.Title>
              </Popover.Header>
              <Popover.Body>
                <div className={styles.filterPanel}>{filterFields}</div>
              </Popover.Body>
              <Popover.Footer>
                <div className={styles.saveRow}>
                  <Button variant="text" size="sm" onPress={clearFilters}>
                    Clear filters
                  </Button>
                  <Button size="sm" onPress={() => setFiltersOpen(false)}>
                    Done
                  </Button>
                </div>
              </Popover.Footer>
            </Popover.Overlay>
          </Popover>
        </div>
      </div>
      {activeFilters.length > 0 && (
        <p className={styles.filterSummary}>{activeFilters.join(" · ")}</p>
      )}
      {error ? (
        <div className={styles.panel}>
          <p role="alert">{error}</p>
          {onRetry && (
            <Button variant="outlined" onPress={onRetry}>
              Try again
            </Button>
          )}
        </div>
      ) : isLoading ? (
        <div className={styles.panel} role="status">
          Loading cases…
        </div>
      ) : (
        <DataGrid
          aria-label="Cases"
          size="sm"
          selectionMode="none"
          headerVariant="secondary"
          columns={[
            { key: "id", name: "Case" },
            ...(!compact ? [{ key: "category", name: "Category" }] : []),
            { key: "risk", name: "Risk" },
            { key: "reviewStatus", name: "Review state" },
            { key: "observedAt", name: "Last observation" },
          ]}
          rows={rows}
          columnKeysAllowingSort={["id", "risk"]}
          sortDescriptor={sort}
          onSortChange={(value) => {
            setSort(value);
            setPage(1);
          }}
          columnOptions={{
            id: { minWidth: 200, width: "26%", whiteSpace: "normal" },
            category: { minWidth: 160, whiteSpace: "nowrap" },
            risk: { minWidth: 190, whiteSpace: "nowrap" },
            reviewStatus: { minWidth: 110, whiteSpace: "nowrap" },
            observedAt: { minWidth: 170, whiteSpace: "nowrap" },
          }}
          renderColumnCell={(column) => String(column.name)}
          renderRowCell={(_cell, key, row) =>
            key === "id" ? (
              <div className={styles.caseIdentity}>
                <Button
                  variant="link"
                  size="sm"
                  onPress={() => onOpenCase(row.id)}
                  aria-label={`Open case ${row.id}`}
                >
                  {row.id}
                </Button>
                {compact && (
                  <Badge variant="inverse" accessibilityLabel="Case category:">
                    {row.category.label}
                  </Badge>
                )}
                {row.subject && <span>{row.subject}</span>}
                <span className={styles.muted}>{row.trackingCode}</span>
              </div>
            ) : key === "category" ? (
              <Badge variant="inverse" accessibilityLabel="Case category:">
                {row.category.label}
              </Badge>
            ) : key === "risk" ? (
              <RiskScore
                value={row.risk}
                assessment={row.assessment}
                size="sm"
                showBar={false}
                accessibilityLabel={`Risk score for ${row.id}`}
              />
            ) : key === "reviewStatus" ? (
              <Badge variant="inverse" accessibilityLabel="Review state:">
                {row.reviewStatus}
              </Badge>
            ) : (
              <ObservationFreshness
                state={row.freshness}
                observedAt={row.observedAt}
                formatObservedAt={() =>
                  row.observedAtLabel ?? row.observedAt ?? ""
                }
                size="sm"
                showStateLabel
              />
            )
          }
          renderEmptyState={() => (
            <div className={styles.panel}>
              <p>
                {cases.length
                  ? "No cases match these filters."
                  : "No cases to review."}
              </p>
              {cases.length > 0 && (
                <Button variant="text" onPress={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          )}
          renderFooter={() => (
            <div className={styles.queueFooter}>
              <span role="status">
                {`${filtered.length} ${filtered.length === 1 ? "case" : "cases"}`}
              </span>
              <Pagination.PageControls
                page={currentPage}
                count={count}
                onChange={setPage}
                label="Case pages"
                siblingCount={0}
                size="sm"
                wrap
              />
            </div>
          )}
        />
      )}
    </section>
  );
}
