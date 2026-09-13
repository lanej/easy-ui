import React, { useEffect, useState } from "react";
import { ThemeProvider } from "../Theme";
import { Card } from "../Card";
import { Button } from "../Button";
import { CompactTimeSeries } from "../CompactTimeSeries";
import { RangePlot } from "../RangePlot";
import { BulletChart } from "../BulletChart";
import {
  amounts,
  guideRoot,
  modes,
  proposals,
  tasks,
  Mode,
  Task,
  Proposal,
} from "./DesignGuide.fixtures";
import styles from "./DesignGuide.module.scss";

function Header({
  encodings = false,
  children,
}: {
  encodings?: boolean;
  children: React.ReactNode;
}) {
  return (
    <header>
      <nav aria-label="Examples">
        <a href="./pricing.html">Action lists</a> ·{" "}
        <a href="./encodings.html">Encoding comparisons</a> ·{" "}
        <a href={guideRoot + "index.html"}>View Rule guide</a>
      </nav>
      <p className="eyebrow">
        EASY UI · ORIGINAL SYNTHETIC EXAMPLES ·{" "}
        {encodings ? "P-004 / P-005" : "P-001 / P-002 / P-003"}
      </p>
      <h1>
        {encodings
          ? "Same numbers. Different work for the reader."
          : "Compare first. Investigate in context."}
      </h1>
      {children}
    </header>
  );
}
function Trend({ proposal }: { proposal: Proposal }) {
  return (
    <div className="trend">
      <CompactTimeSeries
        label={`${proposal.id} · Demand, last 7 days`}
        description="Sep 7–13, 2026 · requested parcels/day · shared scale 0–200"
        series={[
          {
            id: proposal.id,
            label: proposal.identity,
            points: proposal.demand.map((value, i) => ({
              time: Date.UTC(2026, 8, 7 + i),
              value,
            })),
          },
        ]}
        domain={[0, 200]}
        timeDomain={[Date.UTC(2026, 8, 7), Date.UTC(2026, 8, 13)]}
        formatTime={(time) => `Sep ${new Date(time).getUTCDate()} UTC`}
        height={140}
      />
      <p className="trend-values">{proposal.demand.join(", ")}</p>
    </div>
  );
}
function Method() {
  return (
    <details>
      <summary>How the forecast was constructed</summary>
      <p>
        Invented lower and upper daily contribution scenarios, after assumed
        variable delivery costs. These bounds are not a statistical confidence
        interval. Demand history is also synthetic.
      </p>
    </details>
  );
}
/** Task-scoped composition of Easy UI primitives; several rows may expand independently. */
export function PricingExample({
  initialMode = "compact",
  initialTask = "routine",
  initialOpen = [],
  syncURL = false,
}: {
  initialMode?: Mode;
  initialTask?: Task;
  initialOpen?: string[];
  syncURL?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [task, setTask] = useState<Task>(initialTask);
  const [open, setOpen] = useState(new Set(initialOpen));
  const [selected, setSelected] = useState<string | undefined>(initialOpen[0]);
  const [actions, setActions] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [status, setStatus] = useState(
    "Local demonstration only. Nothing queued yet.",
  );
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const active = selected || "A";
  const inDetail =
    mode === "table" || mode === "detail" || (mode === "sparse" && !!selected);
  useEffect(() => {
    if (!syncURL || location.protocol === "file:") return;
    const url = new URL(location.href);
    url.searchParams.set("mode", mode);
    url.searchParams.set("task", task);
    const ids = inDetail ? [active] : [...open];
    if (ids.length) url.searchParams.set("open", ids.join(","));
    else url.searchParams.delete("open");
    history.replaceState(null, "", url);
  }, [mode, task, open, active, inDetail, syncURL]);
  useEffect(() => {
    if (focusTarget) {
      document.querySelector<HTMLElement>(focusTarget)?.focus();
      setFocusTarget(null);
    }
  }, [focusTarget]);
  function inspect(id: string) {
    setSelected(id);
    setOpen(new Set([id]));
    setFocusTarget("#detail-title");
  }
  function changeMode(next: Mode) {
    if (next === "table" || next === "detail") setSelected(active);
    setMode(next);
  }
  function act(p: Proposal, value: string) {
    setActions({ ...actions, [p.id]: value });
    setStatus(
      `${p.identity}: ${value}. Local demonstration; no price activated.`,
    );
  }
  const consequence =
    mode === "clipped"
      ? "Measurable defect: complete identities are clipped. Expect three pricing-labels findings."
      : task === "audit"
        ? mode === "detail"
          ? "Good for this individual investigation: item, methodology, and editable rationale stay together."
          : "A dedicated investigation is a useful alternative for documenting one proposal; comparison with the others is optional."
        : task === "trend"
          ? mode === "trends"
            ? "Good for this task: all histories share dates and value scales. Diagnostic notes remain secondary."
            : "Poor starting point for this task: hidden histories or separated expanded rows obstruct the required trend comparison."
          : mode === "sparse" || mode === "detail"
            ? "Advisory bad for routine comparison: opening one proposal replaces its alternatives. This can pass the identity check."
            : mode === "overloaded"
              ? "Advisory bad for a routine scan: every diagnostic interrupts the repeated decision rows. This can pass the identity check."
              : mode === "trends"
                ? "A valid comparison, but it promotes histories that are secondary in this routine task."
                : mode === "table"
                  ? "Good alternative: all routine fields stay in the table while one item's supporting evidence occupies a separate panel."
                  : "Good for this task: routine decision factors stay together and supporting evidence expands in place.";
  function row(p: Proposal, detail = false) {
    const sparse = mode === "sparse" && !detail;
    const expanded =
      detail || mode === "overloaded" || mode === "trends" || open.has(p.id);
    return (
      <article
        key={p.id}
        className={`proposal${sparse ? " sparse-row" : ""}`}
        data-proposal={p.id}
      >
        <div className="decision-row">
          <div className="identity-cell">
            <strong className="pricing-identity">{p.identity}</strong>
            <span>{p.service}</span>
          </div>
          {!sparse && (
            <>
              <div className="number">
                <span className="field-label">Current → proposed / parcel</span>
                <strong>{p.price}</strong>
              </div>
              <div className="number">
                <span className="field-label">Forecast contribution / day</span>
                <strong>{p.range}</strong>
              </div>
              <div>
                <span className="field-label">Constraint</span>
                <strong>{p.constraint}</strong>
              </div>
            </>
          )}
          <div className="row-controls">
            {!detail && mode !== "overloaded" && mode !== "trends" && (
              <span className="expand">
                <Button
                  size="sm"
                  variant="link"
                  aria-label={`${sparse ? "Open proposal" : "Trends and factors for"} ${p.id}`}
                  aria-expanded={sparse ? undefined : expanded}
                  aria-controls={sparse ? undefined : `factors-${p.id}`}
                  onPress={() => {
                    if (sparse) inspect(p.id);
                    else {
                      const next = new Set(open);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      setOpen(next);
                    }
                  }}
                >
                  {sparse ? "Open proposal" : "Trends & factors"}
                </Button>
              </span>
            )}
            {!sparse && (
              <>
                <span className="queue-action">
                  <Button size="sm" onPress={() => act(p, "Queued for review")}>
                    {actions[p.id] === "Queued for review"
                      ? "Queued for review"
                      : "Queue review"}
                  </Button>
                </span>
                <span className="hold-action">
                  <Button
                    size="sm"
                    variant="outlined"
                    onPress={() => act(p, "Held")}
                  >
                    {actions[p.id] === "Held" ? "Held" : "Hold"}
                  </Button>
                </span>
              </>
            )}
          </div>
        </div>
        <div
          id={`factors-${p.id}`}
          className="diagnostics"
          hidden={!expanded || sparse}
        >
          <Trend proposal={p} />
          <details
            key={`${mode}-${task}`}
            className="diagnostic-notes"
            open={mode !== "trends"}
          >
            <summary>Diagnostic factors</summary>
            <p>{p.diagnostic}</p>
            <Method />
            <p>Example record v1 · daily refresh · analyst review pending</p>
          </details>
        </div>
      </article>
    );
  }
  return (
    <ThemeProvider colorScheme="light">
      <div className={styles.root}>
        <Header>
          <p id="task-description">
            {tasks[task]} Synthetic exercise; no price is activated.
          </p>
          <details className="assumptions">
            <summary>Decision assumptions and evidence</summary>
            <p>
              “Check” means investigate before queuing in this fictional
              exercise. The task selector determines whether histories are
              routine or supporting evidence. These are not EasyPost business
              rules.
            </p>
            <p>
              Applies{" "}
              <a href={guideRoot + "evidence/carbon.html"}>Carbon (E-CARBON)</a>
              ,{" "}
              <a href={guideRoot + "evidence/disclosure-apg.html"}>
                disclosure semantics (E-DISCLOSURE-APG)
              </a>
              , and{" "}
              <a href={guideRoot + "evidence/sparklines.html"}>
                nearby trends (E-SPARKLINES)
              </a>
              . None tested this interface. Multiple disclosures use a
              composition of Card, Button, and CompactTimeSeries; this does not
              change DataGrid&apos;s single-expansion API.
            </p>
          </details>
        </Header>
        <main id="pricing" data-mode={mode} data-ready="true">
          <div className="demo-toolbar">
            <label>
              Task
              <select
                id="task"
                value={task}
                onChange={(e) => setTask(e.target.value as Task)}
              >
                <option value="routine">Compare proposals for review</option>
                <option value="trend">
                  Compare demand trends before review
                </option>
                <option value="audit">
                  Document one proposal&apos;s rationale
                </option>
              </select>
            </label>
            <label>
              Presentation
              <select
                id="mode"
                value={mode}
                onChange={(e) => changeMode(e.target.value as Mode)}
              >
                {Object.entries(modes).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <span id="reset">
              <Button
                variant="outlined"
                onPress={() => {
                  setMode("compact");
                  setTask("routine");
                  setOpen(new Set());
                  setSelected(undefined);
                  setNotes({});
                  setActions({});
                  setStatus("Local demonstration only. Nothing queued yet.");
                }}
              >
                Reset example
              </Button>
            </span>
          </div>
          <p className="consequence">{consequence}</p>
          <Card
            as="section"
            aria-label="Price proposals"
            padding="0"
            background="primary"
          >
            <div className="workspace">
              <div className="queue-heading">
                <div>
                  <h2>Price proposals</h2>
                  <p>
                    Forecast for Sep 14 · USD · Synthetic snapshot Sep 13, 2026
                  </p>
                </div>
                <span>3 proposals</span>
              </div>
              {!inDetail && (
                <div id="queue">{proposals.map((p) => row(p))}</div>
              )}
              {mode === "table" && (
                <div
                  id="comparison"
                  role="region"
                  aria-label="Proposal comparison table"
                  tabIndex={0}
                >
                  <table>
                    <caption>
                      Routine decision factors · all three proposals
                    </caption>
                    <thead>
                      <tr>
                        {[
                          "Proposal",
                          "Current → proposed / parcel",
                          "Forecast contribution / day",
                          "Constraint",
                          "Investigation",
                        ].map((x) => (
                          <th scope="col" key={x}>
                            {x}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {proposals.map((p) => (
                        <tr key={p.id}>
                          <th scope="row">
                            <span className="pricing-identity">
                              {p.identity}
                            </span>
                            <span>{p.service}</span>
                          </th>
                          <td>{p.price}</td>
                          <td>{p.range}</td>
                          <td>{p.constraint}</td>
                          <td>
                            <Button
                              size="sm"
                              variant="outlined"
                              aria-label={`Inspect proposal ${p.id}`}
                              aria-pressed={active === p.id}
                              aria-controls="detail"
                              onPress={() => inspect(p.id)}
                            >
                              Inspect
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {inDetail && (
                <section id="detail" aria-labelledby="detail-title">
                  {mode !== "table" && (
                    <span id="back">
                      <Button
                        variant="link"
                        onPress={() => {
                          setMode("sparse");
                          setSelected(undefined);
                          setOpen(new Set());
                          setFocusTarget(
                            `[data-proposal="${active}"] .expand button`,
                          );
                        }}
                      >
                        ← Back to proposals
                      </Button>
                    </span>
                  )}
                  <h2 id="detail-title" tabIndex={-1}>
                    Proposal {active} · investigation
                  </h2>
                  {row(proposals.find((p) => p.id === active)!, true)}
                  {task === "audit" && (
                    <div id="audit-work">
                      <label htmlFor="audit-note">
                        Review rationale for this proposal
                      </label>
                      <p>
                        Inspect the scenario bounds and diagnostic factors, then
                        record assumptions and unresolved questions.
                      </p>
                      <textarea
                        id="audit-note"
                        rows={5}
                        value={notes[active] || ""}
                        onChange={(e) =>
                          setNotes({ ...notes, [active]: e.target.value })
                        }
                      />
                      <p>
                        Notes stay only in page memory. Changing presentation
                        preserves them; reset/reload clears them. The URL shares
                        the item and task, never the note.
                      </p>
                    </div>
                  )}
                </section>
              )}
              <p id="action-status" role="status">
                {status}
              </p>
            </div>
          </Card>
          <p className="gallery-notes">
            <strong>Check boundary:</strong> pricing-labels checks identity
            clipping (DR-006), not decision sufficiency. Clipped identities
            fail; advisory counterexamples may pass.{" "}
            <a href="https://lanej.io/viewrule/examples/pricing-rules.json">
              Scoped rules
            </a>{" "}
            · <a href={guideRoot + "action-lists.html"}>Guidance and limits</a>.
            At narrow widths, tables scroll locally and trend panels stack;
            simultaneous comparison is not guaranteed.
          </p>
        </main>
      </div>
    </ThemeProvider>
  );
}

/** Real Easy UI encodings with explicitly labeled custom negative controls. */
export function EncodingExamples() {
  const currency = (n: number) => `$${n}`;
  const charts = (group: string, separate = false, reference = false) =>
    amounts.map((p) => (
      <div
        key={p.id}
        data-chart="contribution"
        data-group={group}
        data-min="0"
        data-max={separate ? p.value : 100}
      >
        <BulletChart
          label={p.id}
          value={p.value}
          max={separate ? p.value : 100}
          target={reference ? 60 : 0}
          targetLabel={reference ? "Planning reference" : "Baseline"}
          formatValue={currency}
        />
      </div>
    ));
  return (
    <ThemeProvider colorScheme="light">
      <div className={styles.root}>
        <Header encodings>
          <p>
            Compare A=80, B=40, C=20 USD/day forecast midpoints. B is half of A.
            Synthetic encoding exercise; pricing decisions also need ranges and
            constraints.
          </p>
        </Header>
        <main id="encodings" data-ready="true">
          <div className="encoding-grid">
            <section id="position">
              <p className="eyebrow">GOOD / PRECISE RATIO TASK</p>
              <h2>Positions on a common scale</h2>
              <RangePlot
                label="Forecast contribution"
                description="USD/day · same synthetic proposals"
                domain={[0, 100]}
                points={amounts}
                formatValue={currency}
              />
              <p>
                Easy UI RangePlot preserves the reference scale and exact
                values. A numeric table is another good solution.
              </p>
            </section>
            <section id="area">
              <p className="eyebrow">ADVISORY BAD / PRECISE RATIO TASK</p>
              <h2>Truthful areas, harder ratios</h2>
              <svg
                viewBox="0 0 400 220"
                role="img"
                aria-label="A 80, B 40, C 20 USD/day, encoded truthfully as circle areas"
              >
                {amounts.map((p, i) => (
                  <g key={p.id}>
                    <circle
                      cx={68 + i * 132}
                      cy={88}
                      r={Math.sqrt(p.value / 100) * 60}
                    />
                    <text x={68 + i * 132} y={178} textAnchor="middle">
                      {p.id} · ${p.value}
                    </text>
                  </g>
                ))}
              </svg>
              <p>
                This custom SVG is a teaching control, not a new Easy UI
                component. Numeric labels allow bypassing the perceptual task;
                this is not an experimental replication.
              </p>
            </section>
            <section id="shared">
              <p className="eyebrow">GOOD / ABSOLUTE MAGNITUDES</p>
              <h2>Repeat a shared scale</h2>
              {charts("shared")}
              <p>
                Easy UI BulletChart instances share 0–100 USD/day. Labels and
                zero give useful context.
              </p>
            </section>
            <section id="rescaled">
              <p className="eyebrow">BAD / ABSOLUTE MAGNITUDES</p>
              <h2>Equal lengths, unequal amounts</h2>
              {charts("rescaled", true)}
              <p>
                The same component and values, independently scaled. This misuse
                makes unequal amounts appear equally long; the declared-domain
                check finds the differing scales.
              </p>
            </section>
            <section id="ornament">
              <p className="eyebrow">BEFORE / ADVISORY BAD</p>
              <h2>Framing competes with evidence</h2>
              <p>
                Which midpoint exceeds a fictional 60 USD/day reference? A
                alone.
              </p>
              <div className="ornament">
                {charts("ornament", false, true)}
                <p className="repeated-legend">
                  ■ Forecast · ■ Forecast · ■ Forecast
                </p>
              </div>
              <p>
                A heavy frame and repeated legend compete with the same
                task-relevant marks.
              </p>
            </section>
            <section id="context">
              <p className="eyebrow">AFTER / GOOD FOR THE SAME TASK</p>
              <h2>Retain purposeful context</h2>
              <p>
                The same data and fictional 60 USD/day reference. A alone
                exceeds it.
              </p>
              {charts("context", false, true)}
              <p>
                Keep identities, values, units, zero, and the planning-reference
                marker. This is an application of Tufte&apos;s practitioner
                principles, not a measured performance result.
              </p>
            </section>
          </div>
          <p className="gallery-notes">
            Evidence: <a href={guideRoot + "evidence/cm1984.html"}>E-CM1984</a>,{" "}
            <a href={guideRoot + "evidence/hb2010.html"}>E-HB2010</a>,{" "}
            <a href={guideRoot + "evidence/tufte.html"}>E-TUFTE</a>. These
            sources did not test this interface.{" "}
            <a href="https://lanej.io/viewrule/examples/encodings-rules.json">
              Scoped rules
            </a>{" "}
            compare declared domains, not semantic truth. All sections except
            independently rescaled charts pass that boundary.
          </p>
        </main>
      </div>
    </ThemeProvider>
  );
}
