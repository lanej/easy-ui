import React, { useState } from "react";
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
  return (
    <section className={styles.queue} aria-label="Investigation queue">
      <div className={styles.filters}>
        <TextField
          label="Find a case"
          type="search"
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder="Search cases"
        />
        <Select
          label="Category"
          selectedKey={category ? `category:${category.id}` : "all"}
          onSelectionChange={(key) => {
            setCategory(
              categoryOptions.find(
                (option) => `category:${option.id}` === key,
              ) ?? null,
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
      </div>
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
            { key: "risk", name: "Risk assessment" },
            { key: "reviewStatus", name: "Review" },
          ]}
          rows={rows}
          columnKeysAllowingSort={["id", "risk"]}
          sortDescriptor={sort}
          onSortChange={(value) => {
            setSort(value);
            setPage(1);
          }}
          columnOptions={{
            id: { minWidth: 180, whiteSpace: "normal" },
            risk: { minWidth: 140 },
            reviewStatus: { minWidth: 140 },
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
                <Badge variant="inverse" accessibilityLabel="Case category:">
                  {row.category.label}
                </Badge>
                {row.subject && <span>{row.subject}</span>}
                <span className={styles.muted}>{row.trackingCode}</span>
              </div>
            ) : key === "risk" ? (
              <RiskScore
                value={row.risk}
                assessment={row.assessment}
                size="sm"
              />
            ) : (
              <div className={styles.caseIdentity}>
                <span>{row.reviewStatus}</span>
                <ObservationFreshness
                  state={row.freshness}
                  observedAt={row.observedAt}
                  formatObservedAt={() =>
                    row.observedAtLabel ?? row.observedAt ?? ""
                  }
                  size="sm"
                  showStateLabel
                />
              </div>
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
                <Button
                  variant="text"
                  onPress={() => {
                    setQuery("");
                    setReview("all");
                    setAssessment("all");
                    setCategory(null);
                    setPage(1);
                  }}
                >
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
