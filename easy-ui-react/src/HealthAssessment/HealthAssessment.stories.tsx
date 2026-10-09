import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { Box } from "../Box";
import { DataGrid } from "../DataGrid";
import { Text } from "../Text";
import {
  HealthAssessment,
  type HealthAssessmentProps,
} from "./HealthAssessment";
import styles from "./HealthAssessment.examples.module.scss";
import {
  DurationReferenceExample,
  DurationPercentileMetrics,
  type DurationHealthRegion,
  type ReferenceVisualization,
} from "./DurationReference.example";

type ExampleArgs = HealthAssessmentProps & {
  referenceVisualization?: ReferenceVisualization;
  showHealthBands?: boolean;
  showHealthBandLabels?: boolean;
  showPercentiles?: boolean;
  showPercentileLabels?: boolean;
  showPercentileMetrics?: boolean;
  showReferenceDistribution?: boolean;
};

const meta: Meta<ExampleArgs> = {
  title: "Molecules/Feedback/HealthAssessment",
  component: HealthAssessment,
  parameters: { layout: "padded" },
  argTypes: {
    reference: { control: false },
    referenceDetails: { control: false },
    observationDetails: { control: false },
    showPercentileMetrics: {
      control: "boolean",
      description:
        "Story-only: show a colored percentile legend and duration submetrics beside the headline.",
    },
    health: { control: false },
    referenceVisualization: {
      control: "select",
      options: ["cumulative", "histogram", "both", "none"],
      description: "Story-only: choose reference graphics.",
    },
    showHealthBands: {
      control: "boolean",
      description: "Story-only: show background assessment ranges.",
    },
    showHealthBandLabels: {
      control: "boolean",
      description:
        "Story-only: show names and ranges above the colored bands; otherwise show thresholds on the duration axis.",
    },
    showPercentiles: {
      control: "boolean",
      description: "Story-only: show percentile reference points.",
    },
    showPercentileLabels: {
      control: "boolean",
      description: "Story-only: label percentile points and show their guides.",
    },
    showReferenceDistribution: {
      control: "boolean",
      description: "Story-only: offer the reference histogram disclosure.",
    },
  },
  args: {
    referenceVisualization: "cumulative",
    showHealthBands: true,
    showHealthBandLabels: false,
    showPercentiles: true,
    showPercentileLabels: false,
    showPercentileMetrics: false,
    showReferenceDistribution: true,
  },
  render: (args) => renderExample(args),
};
export default meta;
type Story = StoryObj<ExampleArgs>;

// Illustrative application policy, supplied independently of the distribution.
// Last range is open-ended; the reference viewport still ends at 30 hours.
const regionsByLocale: Record<"en" | "fr", readonly DurationHealthRegion[]> = {
  en: [
    {
      from: 0,
      to: 10,
      assessment: "healthy",
      label: "As expected",
      shortLabel: "Expected",
    },
    {
      from: 10,
      to: 20,
      assessment: "degraded",
      label: "Needs attention",
      shortLabel: "Attention",
    },
    {
      from: 20,
      to: Infinity,
      assessment: "unhealthy",
      label: "Outside expectations",
      shortLabel: "Outside",
    },
  ],
  fr: [
    {
      from: 0,
      to: 10,
      assessment: "healthy",
      label: "Conforme aux attentes",
      shortLabel: "Attendu",
    },
    {
      from: 10,
      to: 20,
      assessment: "degraded",
      label: "À surveiller",
      shortLabel: "À suivre",
    },
    {
      from: 20,
      to: Infinity,
      assessment: "unhealthy",
      label: "Hors attentes",
      shortLabel: "Hors plage",
    },
  ],
};

function referenceFor(
  value: number | null,
  assessed = true,
  locale: "en" | "fr" = "en",
  options: Pick<
    ExampleArgs,
    | "referenceVisualization"
    | "showHealthBands"
    | "showHealthBandLabels"
    | "showPercentiles"
    | "showPercentileLabels"
    | "showReferenceDistribution"
  > = {},
  section: "primary" | "details" = "primary",
) {
  if (options.referenceVisualization === "none") return undefined;
  if (
    section === "details" &&
    (options.referenceVisualization === "histogram" ||
      ((options.referenceVisualization ?? "cumulative") === "cumulative" &&
        options.showReferenceDistribution === false))
  )
    return undefined;
  return (
    <DurationReferenceExample
      value={value}
      section={section}
      currentAssessment={
        assessed &&
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0
          ? regionsByLocale[locale].find(
              ({ from, to }) => value >= from && value < to,
            )?.assessment
          : undefined
      }
      locale={locale}
      visualization={options.referenceVisualization}
      showDistribution={options.showReferenceDistribution}
      showHealthBandLabels={options.showHealthBandLabels}
      showPercentiles={options.showPercentiles}
      showPercentileLabels={options.showPercentileLabels}
      regions={
        options.showHealthBands !== false &&
        assessed &&
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0
          ? regionsByLocale[locale]
          : undefined
      }
    />
  );
}

function referenceDetailsFor(
  value: number | null,
  assessed = true,
  locale: "en" | "fr" = "en",
  options: Pick<
    ExampleArgs,
    | "referenceVisualization"
    | "showHealthBands"
    | "showHealthBandLabels"
    | "showPercentiles"
    | "showPercentileLabels"
    | "showReferenceDistribution"
  > = {},
) {
  return referenceFor(value, assessed, locale, options, "details");
}

function renderExample(
  {
    referenceVisualization,
    showHealthBands,
    showHealthBandLabels,
    showPercentiles,
    showPercentileLabels,
    showPercentileMetrics,
    showReferenceDistribution,
    ...args
  }: ExampleArgs,
  locale: "en" | "fr" = "en",
) {
  const assessed =
    args.health.assessment != null &&
    args.health.availability !== "unavailable";
  const value = args.observation?.value;
  const usesHours =
    args.observation?.unit === (locale === "fr" ? "heures" : "hours");
  const region =
    usesHours && typeof value === "number" && Number.isFinite(value)
      ? regionsByLocale[locale].find(
          ({ from, to }) => value >= from && value < to,
        )
      : undefined;
  return (
    <HealthAssessment
      {...args}
      observationDetails={
        usesHours &&
        args.observation &&
        referenceVisualization !== "none" &&
        showPercentiles !== false &&
        showPercentileMetrics ? (
          <DurationPercentileMetrics locale={locale} />
        ) : (
          args.observationDetails
        )
      }
      health={
        args.observation && !usesHours
          ? { ...args.health, assessment: null, label: undefined }
          : assessed && region
            ? {
                ...args.health,
                assessment: region.assessment,
                label: region.label,
              }
            : args.health
      }
      reference={
        usesHours && args.observation
          ? referenceFor(args.observation.value, assessed, locale, {
              referenceVisualization,
              showHealthBands,
              showHealthBandLabels,
              showPercentiles,
              showPercentileLabels,
              showReferenceDistribution,
            })
          : undefined
      }
      referenceDetails={
        usesHours && args.observation
          ? referenceDetailsFor(args.observation.value, assessed, locale, {
              referenceVisualization,
              showHealthBands,
              showHealthBandLabels,
              showPercentiles,
              showPercentileLabels,
              showReferenceDistribution,
            })
          : undefined
      }
    />
  );
}

const formatObservedAt = (value: string | Date) =>
  `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(new Date(value))} UTC`;

const reference = referenceFor(6);
const referenceDetails = referenceDetailsFor(6);

const defaultProps: HealthAssessmentProps = {
  label: "Elapsed duration",
  health: { assessment: "healthy", label: "As expected" },
  observation: { value: 6, unit: "hours" },
  freshness: {
    state: "fresh",
    observedAt: "2026-01-15T12:00:00Z",
    formatObservedAt,
  },
  reference,
  referenceDetails,
};

export const Default: Story = { args: defaultProps };
export const CumulativeOnly: Story = {
  args: { ...defaultProps, showReferenceDistribution: false },
};
export const HistogramOnly: Story = {
  args: { ...defaultProps, referenceVisualization: "histogram" },
};
export const BothReferences: Story = {
  args: { ...defaultProps, referenceVisualization: "both" },
};
export const LabeledPercentiles: Story = {
  args: { ...defaultProps, showPercentileLabels: true },
};
export const WithPercentileMetrics: Story = {
  args: {
    ...defaultProps,
    showPercentileMetrics: true,
    showReferenceDistribution: false,
  },
};
export const WithoutPercentiles: Story = {
  args: { ...defaultProps, showPercentiles: false },
};
export const WithHealthBandLabels: Story = {
  args: { ...defaultProps, showHealthBandLabels: true },
};
export const WithoutHealthBands: Story = {
  args: { ...defaultProps, showHealthBands: false },
};
export const WithoutReference: Story = {
  args: {
    ...defaultProps,
    referenceVisualization: "none",
    showReferenceDistribution: false,
  },
};
type ReferenceOption = {
  name: string;
  visualization: ReferenceVisualization;
  bands: boolean;
  labels?: boolean;
  percentiles?: boolean;
  percentileLabels?: boolean;
  metrics?: boolean;
  distribution?: boolean;
  expanded?: boolean;
};

const primaryOptions: ReferenceOption[] = [
  {
    name: "Curve · percentile metrics",
    visualization: "cumulative",
    bands: true,
    metrics: true,
  },
  {
    name: "Both · percentile metrics",
    visualization: "both",
    bands: true,
    metrics: true,
  },
  {
    name: "Curve · labeled percentiles",
    visualization: "cumulative",
    bands: true,
    percentileLabels: true,
  },
  {
    name: "Curve · percentiles off",
    visualization: "cumulative",
    bands: true,
    percentiles: false,
  },
  {
    name: "Curve · band labels on",
    visualization: "cumulative",
    bands: true,
    labels: true,
  },
  {
    name: "Both · band labels on",
    visualization: "both",
    bands: true,
    labels: true,
  },
  { name: "Curve · bands on", visualization: "cumulative", bands: true },
  { name: "Curve · bands off", visualization: "cumulative", bands: false },
  { name: "Histogram · bands on", visualization: "histogram", bands: true },
  { name: "Histogram · bands off", visualization: "histogram", bands: false },
  { name: "Both · bands on", visualization: "both", bands: true },
  { name: "Both · bands off", visualization: "both", bands: false },
];
const distributionOptions: ReferenceOption[] = [
  {
    name: "Distribution closed · bands on",
    visualization: "cumulative",
    bands: true,
    distribution: true,
  },
  {
    name: "Distribution open · bands on",
    visualization: "cumulative",
    bands: true,
    distribution: true,
    expanded: true,
  },
  {
    name: "Distribution closed · bands off",
    visualization: "cumulative",
    bands: false,
    distribution: true,
  },
  {
    name: "Distribution open · bands off",
    visualization: "cumulative",
    bands: false,
    distribution: true,
    expanded: true,
  },
  { name: "Reference off", visualization: "none", bands: false },
];

function ReferenceOptionExample({ option }: { option: ReferenceOption }) {
  const element = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const details = element.current?.querySelector("details");
    if (details) details.open = option.expanded === true;
  }, [option.expanded]);
  return (
    <section className={styles.option} data-reference-option={option.name}>
      <Text as="h3" variant="body2" weight="semibold">
        {option.name}
      </Text>
      <div ref={element}>
        {renderExample({
          ...defaultProps,
          referenceVisualization: option.visualization,
          showHealthBands: option.bands,
          showHealthBandLabels: option.labels === true,
          showPercentiles: option.percentiles !== false,
          showPercentileLabels: option.percentileLabels === true,
          showPercentileMetrics: option.metrics === true,
          showReferenceDistribution: option.distribution === true,
        })}
      </div>
    </section>
  );
}

export const ReferenceOptions: Story = {
  render: () => (
    <div className={styles.options}>
      {primaryOptions.map((option) => (
        <ReferenceOptionExample key={option.name} option={option} />
      ))}
    </div>
  ),
  parameters: { controls: { disable: true } },
};

export const DistributionOptions: Story = {
  render: () => (
    <div className={styles.options}>
      {distributionOptions.map((option) => (
        <ReferenceOptionExample key={option.name} option={option} />
      ))}
    </div>
  ),
  parameters: { controls: { disable: true } },
};

export const Compact: Story = { args: { ...defaultProps, size: "sm" } };
export const AssessmentOnly: Story = {
  args: { label: "Observation health", health: { assessment: "degraded" } },
};
export const MissingObservation: Story = {
  args: {
    ...defaultProps,
    observation: { value: null, unit: "hours" },
    reference: referenceFor(null),
    referenceDetails: referenceDetailsFor(null),
    freshness: { state: "unavailable" },
  },
};
export const Unassessed: Story = {
  args: {
    ...defaultProps,
    health: { assessment: null },
    reference: referenceFor(6, false),
    referenceDetails: referenceDetailsFor(6, false),
  },
};
export const StaleObservation: Story = {
  args: {
    ...defaultProps,
    freshness: {
      state: "stale",
      observedAt: "2026-01-14T12:00:00Z",
      formatObservedAt,
    },
  },
};
export const Loading: Story = { args: { ...defaultProps, isLoading: true } };
export const LocalizedNarrow: Story = {
  args: {
    label: "Durée écoulée",
    health: {
      assessment: "healthy",
      label: "Conforme aux attentes",
      unavailableLabel: "Évaluation indisponible",
      loadingLabel: "Évaluation en cours…",
    },
    observation: {
      value: 6.25,
      unit: "heures",
      formatValue: (value) => new Intl.NumberFormat("fr-FR").format(value),
      accessibilityLabel: "Durée observée",
      emptyLabel: "Durée indisponible",
      loadingLabel: "Chargement…",
    },
    freshness: {
      state: "fresh",
      stateLabel: "Observation récente",
      observedAt: "2026-01-15T12:00:00Z",
      formatObservedAt: (value) =>
        new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "UTC",
        }).format(new Date(value)),
    },
    reference: referenceFor(6.25, true, "fr"),
    referenceDetails: referenceDetailsFor(6.25, true, "fr"),
    accessibilityLabel: "État de l’observation",
  },
  render: (args) => (
    <Box width={160} maxWidth="100%" lang="fr">
      {renderExample(args, "fr")}
    </Box>
  ),
};

const assessmentExamples: HealthAssessmentProps[] = [
  defaultProps,
  {
    ...defaultProps,
    health: { assessment: "degraded", label: "Needs attention" },
    observation: { value: 12, unit: "hours" },
    reference: referenceFor(12),
    referenceDetails: referenceDetailsFor(12),
  },
  {
    ...defaultProps,
    health: { assessment: "unhealthy", label: "Outside expectations" },
    observation: { value: 24, unit: "hours" },
    reference: referenceFor(24),
    referenceDetails: referenceDetailsFor(24),
  },
];

const stateExamples: { name: string; props: HealthAssessmentProps }[] = [
  {
    name: "While fetching",
    props: { ...defaultProps, isLoading: true },
  },
  {
    name: "Missing observation",
    props: {
      ...defaultProps,
      observation: { value: null, unit: "hours" },
      reference: referenceFor(null),
      referenceDetails: referenceDetailsFor(null),
      freshness: { state: "unavailable" },
    },
  },
  {
    name: "Without assessment",
    props: {
      ...defaultProps,
      health: { assessment: null },
      reference: referenceFor(6, false),
      referenceDetails: referenceDetailsFor(6, false),
    },
  },
  {
    name: "Older observation",
    props: {
      ...defaultProps,
      freshness: {
        state: "stale",
        observedAt: "2026-01-14T12:00:00Z",
        formatObservedAt,
      },
    },
  },
  {
    name: "Observed zero",
    props: {
      ...defaultProps,
      observation: { value: 0, unit: "hours" },
      reference: referenceFor(0),
      referenceDetails: referenceDetailsFor(0),
    },
  },
];

function AssessmentExamples() {
  return (
    <div className={styles.comparisons}>
      {assessmentExamples.map((props: HealthAssessmentProps) => (
        <div className={styles.example} key={props.health.assessment}>
          <HealthAssessment {...props} />
        </div>
      ))}
    </div>
  );
}

function StateExamples() {
  return (
    <div className={styles.states}>
      {stateExamples.map(({ name, props }) => (
        <div className={styles.state} key={name}>
          <Text as="h3" variant="body2" weight="semibold">
            {name}
          </Text>
          <HealthAssessment {...props} size="sm" />
        </div>
      ))}
    </div>
  );
}

export const Assessments: Story = {
  render: () => <AssessmentExamples />,
  parameters: { controls: { disable: true } },
};

export const DataStates: Story = {
  render: () => <StateExamples />,
  parameters: { controls: { disable: true } },
};

export const Overview: Story = {
  render: () => (
    <div className={styles.overview}>
      <section
        className={styles.section}
        aria-label="Health assessment example"
      >
        <div className={styles.intro}>
          <Text as="h2" variant="subtitle1">
            Health assessment
          </Text>
          <Text as="p" variant="body2" color="subdued">
            A duration, its assessment, and the context needed to read it.
          </Text>
        </div>
        <HealthAssessment {...defaultProps} />
      </section>
      <section className={styles.section} aria-label="Compare assessments">
        <div className={styles.intro}>
          <Text as="h2" variant="subtitle2">
            Compare assessments
          </Text>
          <Text as="p" variant="body2" color="subdued">
            Illustrative health ranges: expected below 10 h, attention from 10
            h, outside expectations from 20 h.
          </Text>
        </div>
        <AssessmentExamples />
      </section>
      <section className={styles.section} aria-label="Observation data states">
        <div className={styles.intro}>
          <Text as="h2" variant="subtitle2">
            Data states
          </Text>
          <Text as="p" variant="body2" color="subdued">
            Missing data, freshness, and health carry different meanings.
          </Text>
        </div>
        <StateExamples />
      </section>
    </div>
  ),
  parameters: { controls: { disable: true } },
};

export const CompactTable: Story = {
  render: () => (
    <Box maxWidth={640}>
      <DataGrid
        aria-label="Sample duration observations"
        columns={[
          { key: "name", name: "Observation" },
          { key: "assessment", name: "Elapsed duration" },
        ]}
        rows={assessmentExamples.map((assessment, index) => ({
          key: String(index),
          name: `OBS-00${index + 1}`,
          assessment,
        }))}
        size="sm"
        selectionMode="none"
        renderColumnCell={(column) => String(column.name)}
        renderRowCell={(cell, columnKey, row) =>
          columnKey === "assessment" ? (
            <HealthAssessment
              {...row.assessment}
              label={undefined}
              freshness={undefined}
              size="sm"
              accessibilityLabel={`Elapsed duration for ${row.name}`}
            />
          ) : (
            String(cell)
          )
        }
      />
    </Box>
  ),
  parameters: { controls: { disable: true } },
};

export const EnlargedText: Story = {
  args: defaultProps,
  render: (args) => (
    <div style={{ maxWidth: 320, zoom: 2 }}>{renderExample(args)}</div>
  ),
};
