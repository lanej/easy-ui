import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { Box } from "../Box";
import { Card } from "../Card";
import { Text } from "../Text";
import { VerticalStack } from "../VerticalStack";
import {
  HealthAssessment,
  type HealthAssessmentProps,
} from "./HealthAssessment";

const meta: Meta<typeof HealthAssessment> = {
  title: "Molecules/Feedback/HealthAssessment",
  component: HealthAssessment,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof HealthAssessment>;

export const Default: Story = {
  args: {
    health: { assessment: "healthy", label: "As expected" },
    observation: { value: 6, unit: "hours" },
    freshness: { state: "fresh", observedAt: "2026-01-15T12:00:00Z" },
    reference: (
      <Text as="span" variant="body2" color="neutral.600">
        Typical duration: 9 hours
      </Text>
    ),
  },
};
export const Compact: Story = { args: { ...Default.args, size: "sm" } };
export const AssessmentOnly: Story = {
  args: { health: { assessment: "degraded" } },
};
export const MissingObservation: Story = {
  args: {
    ...Default.args,
    observation: { value: null, unit: "hours" },
    freshness: { state: "unavailable" },
  },
};
export const Unassessed: Story = {
  args: { ...Default.args, health: { assessment: null }, reference: undefined },
};
export const StaleObservation: Story = {
  args: {
    ...Default.args,
    freshness: { state: "stale", observedAt: "2026-01-14T12:00:00Z" },
  },
};
export const Loading: Story = { args: { ...Default.args, isLoading: true } };
export const LocalizedNarrow: Story = {
  args: {
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
    reference: (
      <Text as="span" variant="body2">
        Durée habituelle : 9 heures
      </Text>
    ),
    accessibilityLabel: "État de l’observation",
  },
  render: (args) => (
    <Box width={160} maxWidth="100%" lang="fr">
      <HealthAssessment {...args} />
    </Box>
  ),
};

const overviewExamples: { name: string; props: HealthAssessmentProps }[] = [
  {
    name: "As expected",
    props: {
      health: { assessment: "healthy", label: "As expected" },
      observation: { value: 6, unit: "hours" },
      freshness: { state: "fresh" },
    },
  },
  {
    name: "Needs attention",
    props: {
      health: { assessment: "degraded" },
      observation: { value: 12, unit: "hours" },
      freshness: { state: "fresh" },
    },
  },
  {
    name: "Outside expectations",
    props: {
      health: { assessment: "unhealthy" },
      observation: { value: 24, unit: "hours" },
      freshness: { state: "fresh" },
    },
  },
  {
    name: "Stale observation",
    props: {
      health: { assessment: "healthy" },
      observation: { value: 6, unit: "hours" },
      freshness: { state: "stale" },
    },
  },
  {
    name: "Not assessed",
    props: {
      health: { assessment: null },
      observation: { value: 9, unit: "hours" },
      freshness: { state: "fresh" },
    },
  },
  {
    name: "Loading",
    props: {
      health: { assessment: "healthy" },
      observation: { value: 6, unit: "hours" },
      freshness: { state: "fresh" },
      isLoading: true,
    },
  },
  {
    name: "Unavailable",
    props: {
      health: { assessment: "healthy" },
      observation: { value: null, unit: "hours" },
      freshness: { state: "unavailable" },
    },
  },
  {
    name: "Observed zero",
    props: {
      health: { assessment: "healthy" },
      observation: { value: 0, unit: "hours" },
      freshness: { state: "fresh" },
    },
  },
];

export const Overview: Story = {
  render: () => (
    <Box maxWidth={1000}>
      <VerticalStack gap="3">
        <Text variant="heading3">Observation and health foundations</Text>
        <Text color="subdued">
          Synthetic observations with assessments and freshness supplied by the
          application.
        </Text>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
          }}
        >
          {overviewExamples.map(({ name, props }) => (
            <Card.Container key={name}>
              <Card.Area>
                <VerticalStack gap="2" inlineAlign="start">
                  <Text variant="subtitle1">{name}</Text>
                  <HealthAssessment {...props} accessibilityLabel={name} />
                </VerticalStack>
              </Card.Area>
            </Card.Container>
          ))}
        </div>
      </VerticalStack>
    </Box>
  ),
  parameters: { controls: { disable: true } },
};

export const EnlargedText: Story = {
  args: Default.args,
  render: (args) => (
    <div style={{ maxWidth: 320, zoom: 2 }}>
      <HealthAssessment {...args} />
    </div>
  ),
};
