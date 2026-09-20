import "./audit/console.mjs";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../../easy-ui-react/src/Theme";
import { Card } from "../../easy-ui-react/src/Card";
import { Sparkline } from "../../easy-ui-react/src/Sparkline";
import { CompactTimeSeries } from "../../easy-ui-react/src/CompactTimeSeries";
import { RangePlot } from "../../easy-ui-react/src/RangePlot";
import { BulletChart } from "../../easy-ui-react/src/BulletChart";
import { BarList } from "../../easy-ui-react/src/BarList";
import {
  MetricContent,
  MetricComparisonContent,
} from "../../easy-ui-react/src/MetricCard";
import "../../easy-ui-react/src/styles/global.scss";
import "../../.storybook/public/poppins.css";
import "./preview.css";
import "./native-regressions.css";

const timestamp = Date.UTC(2026, 8, 20, 9);
const money = (value: number) => `$${value.toFixed(2)}`;
function NativeRegressions() {
  const query = new URLSearchParams(location.search);
  const [large, setLarge] = useState(query.get("large") === "1");
  const stress = query.get("stress") === "1";
  const label = (text: string) =>
    stress ? `${text} across regional operations and comparison periods` : text;
  const typography = large
    ? {
        title: 24,
        description: 18,
        label: 16,
        control: 18,
        legend: 16,
        detail: 16,
      }
    : undefined;
  return (
    <main
      className="native-review"
      data-native-ready
      data-native-size={large ? "large" : "default"}
      data-native-stress={stress ? "long-labels" : "default"}
    >
      <header>
        <h1>Native chart acceptance</h1>
        <p>
          Synthetic observations for geometry, exact data, comparison scales and
          composition.
        </p>
        <label>
          <input
            type="checkbox"
            checked={large}
            onChange={(event) => setLarge(event.target.checked)}
          />{" "}
          Increase native text size
        </label>
      </header>
      <section aria-label="Responsive marker cases" data-native-case="markers">
        <h2>Responsive markers</h2>
        <div className="native-sparkline-row">
          {[80, 160, 480].map((width) => (
            <div
              className="native-sparkline-case"
              key={width}
              data-native-sparkline-width={width}
              style={{ width }}
            >
              <p>{width}px maximum</p>
              <div data-native-sparkline-kind="segments">
                <Sparkline
                  values={[1, 3, null, 2, 4]}
                  markers="all"
                  accessibilityLabel={`Two segments at ${width} pixel maximum width`}
                />
              </div>
              <div data-native-sparkline-kind="singleton">
                <Sparkline
                  values={[2]}
                  accessibilityLabel={`Single observation at ${width} pixel maximum width`}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section
        aria-label="Native time geometry and precision"
        data-native-case="time"
      >
        <h2>Time positions and exact observations</h2>
        <div className="native-grid">
          <Card padding="2" background="primary">
            <div data-native-case="singleton">
              <CompactTimeSeries
                label={label("One shared timestamp")}
                description="Both series observed at 09:00 UTC"
                height={stress ? 140 : undefined}
                domain={[0, 10]}
                formatTime={(time) => new Date(time).toISOString()}
                formatAxisTime={() => "09:00 UTC"}
                typography={typography}
                series={[
                  {
                    id: "a",
                    label: label("A"),
                    points: [{ time: timestamp, value: 3 }],
                  },
                  {
                    id: "b",
                    label: label("B"),
                    points: [{ time: timestamp, value: 7 }],
                  },
                ]}
              />
            </div>
          </Card>
          <Card padding="2" background="primary">
            <div data-native-case="explicit-time">
              <CompactTimeSeries
                label={label("One observation in a wider interval")}
                description="Elapsed position stays one quarter through the explicit interval"
                height={stress ? 140 : undefined}
                domain={[0, 10]}
                timeDomain={[0, 100]}
                formatTime={String}
                typography={typography}
                series={[
                  { id: "a", label: "A", points: [{ time: 25, value: 3 }] },
                ]}
              />
            </div>
          </Card>
          <Card padding="2" background="primary">
            <div data-native-case="precision">
              <CompactTimeSeries
                label={label("Precise hourly cost")}
                description="USD · Sep 20, 2026 · UTC"
                height={stress ? 140 : undefined}
                domain={[0, 2000]}
                formatTime={(time) => new Date(time).toISOString()}
                formatAxisTime={() => "Sep 20"}
                formatValue={money}
                formatAxisValue={(value) => `${value / 1000}k`}
                typography={typography}
                series={[
                  {
                    id: "cost",
                    label: label("Cost"),
                    points: [{ time: timestamp, value: 1234.56 }],
                  },
                ]}
              />
            </div>
          </Card>
        </div>
      </section>
      <section
        aria-label="Native value states and composition"
        data-native-case="comparison"
      >
        <h2>Explicit value states and shared scales</h2>
        <div className="native-grid">
          <Card padding="2" background="primary">
            <div data-native-case="range-overflow">
              <RangePlot
                label={label("Signed observations")}
                description="Exact values remain visible outside the supplied −5 to 5 scale"
                domain={[-5, 5]}
                interval={{
                  from: -10,
                  to: 3,
                  label: label("Supplied interval"),
                }}
                overflow="clamp"
                typography={typography}
                points={[
                  { id: "below", label: label("Below"), value: -8 },
                  { id: "inside", label: label("Inside"), value: 0 },
                  { id: "above", label: label("Above"), value: 8 },
                  { id: "missing", label: label("Missing"), value: null },
                  { id: "invalid", label: label("Invalid"), value: NaN },
                ]}
              />
            </div>
          </Card>
          <Card padding="2" background="primary">
            <div className="native-stack" data-native-case="bullet-overflow">
              <BulletChart
                label={label("Forecast volume")}
                value={14500}
                target={12000}
                max={13000}
                overflow="clamp"
                formatValue={(value) => value.toLocaleString("en-US")}
                formatAxisValue={(value) => `${value / 1000}k`}
                typography={typography}
              />
              <BulletChart
                label="Unavailable measure"
                value={null}
                target={80}
                max={100}
                typography={typography}
              />
              <BulletChart
                label="Invalid measure"
                value={NaN}
                target={80}
                max={100}
                typography={typography}
              />
              <div data-native-case="bullet-omitted">
                <BulletChart
                  label="Omitted volume"
                  value={120}
                  target={80}
                  max={100}
                  typography={typography}
                />
              </div>
            </div>
          </Card>
          <Card padding="2" background="primary">
            <div className="native-stack" data-native-case="shared-bars">
              <BarList
                label="West shared scale"
                max={100}
                typography={typography}
                data={[
                  { id: "full", label: label("West full"), value: 100 },
                  { id: "half", label: label("West half"), value: 50 },
                  { id: "zero", label: label("Observed zero"), value: 0 },
                  { id: "missing", label: label("Unavailable"), value: null },
                ]}
              />
              <BarList
                label="East shared scale"
                max={100}
                overflow="clamp"
                typography={typography}
                data={[
                  { id: "half", label: label("East half"), value: 50 },
                  { id: "small", label: label("East small"), value: 10 },
                  { id: "overflow", label: label("East overflow"), value: 120 },
                ]}
              />
            </div>
          </Card>
          <div data-native-case="unframed">
            <Card
              as="section"
              aria-label="Caller-owned metric analysis"
              padding="2"
              background="primary"
            >
              <div className="native-stack">
                <MetricContent
                  label={label("Average cost")}
                  value="$5.20"
                  supportingText="USD · June"
                  typography={typography}
                  valueSize={large ? 36 : 28}
                  trend={{
                    values: [6, 5.8, 5.2],
                    accessibilityLabel:
                      "Three equal buckets: cost declined to $5.20",
                  }}
                />
                <MetricComparisonContent
                  label="4.2% lower"
                  baseline={label("vs previous 30 days")}
                  sentiment="positive"
                  typography={typography}
                />
              </div>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider colorScheme="light">
    <NativeRegressions />
  </ThemeProvider>,
);
