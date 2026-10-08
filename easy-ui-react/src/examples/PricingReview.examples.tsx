import React, { useRef, useState } from "react";
import { Pill, PillButton } from "../Pill";
import { WorkspaceHeader } from "../WorkspaceHeader";
import PriceChangeIcon from "@easypost/easy-ui-icons/PriceChange";
import { Button } from "../Button";
import { Chart } from "../Chart";
import { Disclosure } from "../Disclosure";
import { Textarea } from "../Textarea";
import { SignedValue } from "../SignedValue";
import { MetricContent } from "../MetricCard";
import { pricingAmount } from "./PricingReviewChartFrame.examples";
import { proposals } from "./DesignGuide.fixtures";
import { PricingReviewCharts } from "./PricingReviewCharts.examples";
import styles from "./PricingReview.module.scss";

type Decision = "pending" | "queued" | "held";
type Filter = "all" | Decision;

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All proposals" },
  { key: "pending", label: "Needs review" },
  { key: "queued", label: "Queued" },
  { key: "held", label: "On hold" },
];

const constraints: Record<string, { label: string; detail: string }> = {
  A: {
    label: "No exceptions",
    detail: "Spare capacity in the modeled scenario.",
  },
  B: {
    label: "Capacity review",
    detail: "The lower scenario loses $20/day. Verify available capacity.",
  },
  C: {
    label: "Transit review",
    detail:
      "Confirm the longer transit path before accepting the smaller upside.",
  },
};

export type PricingReviewProps = {
  graphical?: boolean;
  showDataTable?: boolean;
  colorSignedValues?: boolean;
  initialOpen?: string[];
  initialDecisions?: Partial<Record<string, Decision>>;
};

export function PricingReview({
  graphical = false,
  showDataTable = true,
  colorSignedValues = true,
  initialOpen = [],
  initialDecisions = {},
}: PricingReviewProps) {
  const [open, setOpen] = useState(new Set(initialOpen));
  const [decisions, setDecisions] = useState(initialDecisions);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [announcement, setAnnouncement] = useState("");
  const filterRef = useRef<HTMLDivElement>(null);
  const decisionFor = (id: string) => decisions[id] ?? "pending";
  const visibleProposals = proposals.filter(
    (proposal) => filter === "all" || decisionFor(proposal.id) === filter,
  );
  const countFor = (key: Filter) =>
    proposals.filter(
      (proposal) => key === "all" || decisionFor(proposal.id) === key,
    ).length;

  function decide(id: string, decision: Decision) {
    setDecisions((current) => ({ ...current, [id]: decision }));
    setAnnouncement(
      `Proposal ${id} ${decision === "queued" ? "queued for review" : decision === "held" ? "placed on hold" : "returned to review"}. No live price was changed.`,
    );
    if (filter !== "all" && filter !== decision)
      filterRef.current
        ?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
        ?.focus();
  }

  return (
    <main className={styles.root} aria-label="Pricing review workspace">
      <div className={styles.header}>
        <WorkspaceHeader
          title="Price review"
          icon={PriceChangeIcon}
          navigation={
            <div
              className={styles.filters}
              ref={filterRef}
              aria-label="Filter proposals"
              role="group"
            >
              {filters.map(({ key, label }) => (
                <PillButton
                  key={key}
                  size="sm"
                  isSelected={filter === key}
                  aria-label={`${label}, ${countFor(key)} proposals`}
                  onPress={() => setFilter(key)}
                >
                  {label} <span className={styles.count}>{countFor(key)}</span>
                </PillButton>
              ))}
            </div>
          }
          actions={<Pill size="sm">Synthetic workspace · USD</Pill>}
        />
      </div>
      <section className={styles.queue} aria-label="Price proposals">
        <div className={styles.toolbar}>
          <span className={styles.period}>
            Sep 14, 2026 forecast · Demand: Sep 13
          </span>
        </div>
        {graphical && visibleProposals.length > 0 && (
          <PricingReviewCharts
            proposals={visibleProposals}
            showDataTable={showDataTable}
          />
        )}
        {visibleProposals.map((proposal) => {
          const decision = decisionFor(proposal.id);
          const constraint = constraints[proposal.id];
          const [currentPrice, proposedPrice] = proposal.price.split(" → ");
          const latestDemand = proposal.demand[proposal.demand.length - 1];
          return (
            <Disclosure
              key={proposal.id}
              isExpanded={open.has(proposal.id)}
              onExpandedChange={(expanded) =>
                setOpen((current) => {
                  const next = new Set(current);
                  if (expanded) next.add(proposal.id);
                  else next.delete(proposal.id);
                  return next;
                })
              }
              mountPolicy="preserve"
            >
              <article
                className={styles.proposal}
                aria-label={`Proposal ${proposal.id}`}
                data-review-proposal={proposal.id}
              >
                <div className={styles.row} data-review-summary>
                  <div className={styles.proposalHeader}>
                    <div className={styles.identity}>
                      <h2>{proposal.identity}</h2>
                      <Pill size="sm">{proposal.service}</Pill>
                    </div>
                    <div className={styles.controls} data-review-controls>
                      <Disclosure.Trigger
                        size="sm"
                        variant="link"
                        aria-label={`Investigate proposal ${proposal.id}`}
                      >
                        {open.has(proposal.id)
                          ? "Close investigation"
                          : "Investigate"}
                      </Disclosure.Trigger>
                      <div className={styles.actions}>
                        {decision === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              aria-label={`Queue review for proposal ${proposal.id}`}
                              onPress={() => decide(proposal.id, "queued")}
                            >
                              Queue review
                            </Button>
                            <Button
                              size="sm"
                              variant="outlined"
                              aria-label={`Hold proposal ${proposal.id}`}
                              onPress={() => decide(proposal.id, "held")}
                            >
                              Hold
                            </Button>
                          </>
                        ) : (
                          <>
                            <Pill
                              size="sm"
                              tone={
                                decision === "queued" ? "primary" : "warning"
                              }
                            >
                              {decision === "queued"
                                ? "Queued for review"
                                : "On hold"}
                            </Pill>
                            <Button
                              size="sm"
                              variant="link"
                              aria-label={`Return proposal ${proposal.id} to review`}
                              onPress={() => decide(proposal.id, "pending")}
                            >
                              Return to review
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.metrics} data-review-metrics>
                    <div
                      className={styles.metric}
                      role="group"
                      aria-label={`Price per parcel for proposal ${proposal.id}`}
                    >
                      <MetricContent
                        label="Price / parcel"
                        value={proposedPrice}
                        supportingText={`from ${currentPrice}`}
                        typography={{ title: 12, description: 12 }}
                        valueSize={14}
                      />
                    </div>
                    <div
                      className={styles.metric}
                      role="group"
                      aria-label={`Contribution per day for proposal ${proposal.id}`}
                    >
                      <MetricContent
                        label="Contribution / day"
                        value={
                          <>
                            {proposal.range
                              .split(" to ")
                              .map((bound, index) => (
                                <React.Fragment key={index}>
                                  {index > 0 && " to "}
                                  <SignedValue
                                    value={pricingAmount(bound)}
                                    formatValue={() => bound}
                                    colorBySign={colorSignedValues}
                                  />
                                </React.Fragment>
                              ))}
                          </>
                        }
                        supportingText="Scenario bounds"
                        typography={{ title: 12, description: 12 }}
                        valueSize={14}
                      />
                    </div>
                    <div
                      className={styles.metric}
                      role="group"
                      aria-label={`Demand per day for proposal ${proposal.id}`}
                    >
                      <MetricContent
                        label="Demand / day"
                        value={String(latestDemand)}
                        supportingText="parcels · Sep 13"
                        typography={{ title: 12, description: 12 }}
                        valueSize={14}
                      />
                    </div>
                    <div
                      className={styles.constraint}
                      role="group"
                      aria-label={`Constraint for proposal ${proposal.id}`}
                    >
                      <span className={styles.metricLabel}>Constraint</span>
                      <Pill
                        size="sm"
                        tone={proposal.id === "A" ? "neutral" : "warning"}
                      >
                        {constraint.label}
                      </Pill>
                      <span className={styles.constraintDetail}>
                        {constraint.detail}
                      </span>
                    </div>
                  </div>
                </div>

                <Disclosure.Content
                  role="region"
                  aria-label={`Investigation for proposal ${proposal.id}`}
                >
                  <div className={styles.investigation}>
                    <Chart
                      title={`Proposal ${proposal.id} · Demand history`}
                      description="Sep 7–13, 2026 UTC · parcels/day · shared scale 0–200"
                      variant="bare"
                      height={180}
                      layout="native"
                      typography={{ description: 12 }}
                      option={{
                        legend: { show: false },
                        grid: {
                          left: 4,
                          right: 24,
                          top: 16,
                          bottom: 8,
                          containLabel: true,
                        },
                        tooltip: {
                          trigger: "axis",
                          valueFormatter: (value) => `${value} parcels`,
                        },
                        xAxis: {
                          type: "category",
                          boundaryGap: false,
                          data: proposal.demand.map(
                            (_, index) => `Sep ${7 + index}`,
                          ),
                          axisLabel: {
                            interval: 6,
                            showMinLabel: true,
                            showMaxLabel: true,
                          },
                        },
                        yAxis: {
                          type: "value",
                          min: 0,
                          max: 200,
                          interval: 100,
                        },
                        series: [
                          {
                            id: proposal.id,
                            name: proposal.identity,
                            type: "line",
                            data: proposal.demand,
                            symbol: "circle",
                            symbolSize: 5,
                            lineStyle: { width: 2 },
                          },
                        ],
                      }}
                      dataTable={{
                        columns: ["Day (UTC)", "Parcels / day"],
                        rows: proposal.demand.map((value, index) => ({
                          id: `${proposal.id}-${index}`,
                          values: [
                            `2026-09-${String(7 + index).padStart(2, "0")}`,
                            value,
                          ],
                        })),
                      }}
                      dataTableLabel="View daily observations"
                      showDataTable={showDataTable}
                    />
                    <div className={styles.findings}>
                      <h3>What to verify</h3>
                      <p>{proposal.diagnostic}</p>
                      <p>
                        Contribution bounds are modeled lower and upper
                        scenarios after variable delivery costs, not a
                        confidence interval.
                      </p>
                      <Textarea
                        label={`Review rationale for proposal ${proposal.id}`}
                        placeholder="Record assumptions or the reason for holding this proposal…"
                        rows={3}
                        value={notes[proposal.id] ?? ""}
                        onChange={(value) =>
                          setNotes((current) => ({
                            ...current,
                            [proposal.id]: value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </Disclosure.Content>
              </article>
            </Disclosure>
          );
        })}
        {visibleProposals.length === 0 && (
          <div className={styles.empty}>
            <h2>
              No{" "}
              {filter === "queued"
                ? "queued proposals"
                : filter === "held"
                  ? "proposals on hold"
                  : "proposals awaiting review"}
            </h2>
            <p>Change the filter to see the other proposals.</p>
            <Button
              size="sm"
              variant="outlined"
              onPress={() => setFilter("all")}
            >
              Show all proposals
            </Button>
          </div>
        )}
        <footer className={styles.footer}>
          <span>
            {countFor("pending")} awaiting review · {countFor("queued")} queued
            · {countFor("held")} on hold
          </span>
          <span>
            Illustrative data. Decisions and notes reset on reload; no live
            prices change.
          </span>
        </footer>
      </section>
      <p role="status" className={styles.announcement}>
        {announcement}
      </p>
      <p className={styles.chartNote}>
        Expand an investigation for demand history
        {showDataTable ? " and exact observations" : ""}.
      </p>
    </main>
  );
}
