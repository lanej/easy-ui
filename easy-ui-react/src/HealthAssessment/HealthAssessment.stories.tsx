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
  type DurationHealthRegion,
} from "./DurationReference.example";

const meta: Meta<typeof HealthAssessment> = {
  title: "Molecules/Feedback/HealthAssessment",
  component: HealthAssessment,
  parameters: { layout: "padded" },
  argTypes: { reference: { control: false }, health: { control: false } },
  render: (args) => renderExample(args),
};
export default meta;
type Story = StoryObj<typeof HealthAssessment>;

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
) {
  return (
    <DurationReferenceExample
      value={value}
      locale={locale}
      regions={
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

function renderExample(
  args: HealthAssessmentProps,
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
          ? referenceFor(args.observation.value, assessed, locale)
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
};

export const Default: Story = { args: defaultProps };
export const Compact: Story = { args: { ...defaultProps, size: "sm" } };
export const AssessmentOnly: Story = {
  args: { label: "Observation health", health: { assessment: "degraded" } },
};
export const MissingObservation: Story = {
  args: {
    ...defaultProps,
    observation: { value: null, unit: "hours" },
    reference: referenceFor(null),
    freshness: { state: "unavailable" },
  },
};
export const Unassessed: Story = {
  args: {
    ...defaultProps,
    health: { assessment: null },
    reference: referenceFor(6, false),
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
      observedAtLabel: "Observé le",
    },
    reference: referenceFor(6.25, true, "fr"),
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
  },
  {
    ...defaultProps,
    health: { assessment: "unhealthy", label: "Outside expectations" },
    observation: { value: 24, unit: "hours" },
    reference: referenceFor(24),
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
      freshness: { state: "unavailable" },
    },
  },
  {
    name: "Without assessment",
    props: {
      ...defaultProps,
      health: { assessment: null },
      reference: referenceFor(6, false),
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
