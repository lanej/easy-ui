import type { Meta, StoryObj } from "@storybook/react-vite";
import React from "react";
import { HorizontalGrid } from "../HorizontalGrid";
import { ScoreComposition } from "./ScoreComposition";
import { ScoreSignal } from "./ScoreSignal";
import { ScoreContribution } from "./ScoreContribution";
import { ScoreResult } from "./ScoreResult";
import { scoreCompositionExample } from "./ScoreComposition.examples";

const meta: Meta<typeof ScoreComposition> = {
  title: "Components/ScoreComposition",
  component: ScoreComposition,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof ScoreComposition>;

export const Default: Story = { args: scoreCompositionExample };

export const SignalSentiments: Story = {
  render: () => (
    <HorizontalGrid columns={{ xs: 1, md: 2 }} gap="3">
      <ScoreSignal
        label="Documentation verified"
        value={true}
        sentiment="positive"
        statusLabel="Confirmed"
      />
      <ScoreSignal
        label="Label ratio"
        value={0.26}
        sentiment="warning"
        statusLabel="Elevated"
      />
      <ScoreSignal
        label="Missing dimensions"
        value={true}
        sentiment="negative"
        statusLabel="Flagged"
      />
      <ScoreSignal label="Package count" value={12} />
    </HorizontalGrid>
  ),
};

export const ContributionFullness: Story = {
  render: () => (
    <HorizontalGrid columns={{ xs: 1, md: 2 }} gap="3">
      <ScoreContribution
        label="Full risk contribution"
        score={1}
        maxScore={1}
        sentiment="negative"
      />
      <ScoreContribution
        label="Half contribution"
        score={1}
        maxScore={2}
        sentiment="warning"
      />
      <ScoreContribution label="No contribution" score={0} maxScore={2} />
      <ScoreContribution
        label="Full credit"
        score={2}
        maxScore={2}
        sentiment="positive"
      />
    </HorizontalGrid>
  ),
};

export const ResultDecisions: Story = {
  render: () => (
    <HorizontalGrid columns={{ xs: 1, md: 3 }} gap="3">
      <ScoreResult
        score={2}
        maxScore={3}
        disposition="Disable"
        sentiment="negative"
        supportingText="The application determined that action is required."
      />
      <ScoreResult
        score={2}
        maxScore={3}
        disposition="Approved"
        sentiment="positive"
        supportingText="The same score can have a different application meaning."
      />
      <ScoreResult
        score={2}
        maxScore={3}
        disposition="Pending review"
        supportingText="Neutral is the default; the component infers no decision."
      />
    </HorizontalGrid>
  ),
};

export const Narrow: Story = {
  args: scoreCompositionExample,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
};

export const LargerText: Story = {
  args: {
    ...scoreCompositionExample,
    typography: {
      title: 24,
      description: 20,
      label: 18,
      detail: 18,
      control: 20,
    },
  },
};

export const SharedSignals: Story = {
  args: {
    title: "Application readiness",
    description: "One observation can support more than one contribution.",
    signals: [
      {
        id: "coverage",
        label: "Test coverage",
        value: 0.92,
        displayValue: "92%",
      },
      { id: "review", label: "Security review complete", value: true },
    ],
    contributions: [
      {
        id: "quality",
        label: "Quality",
        score: 4,
        maxScore: 5,
        signals: ["coverage"],
      },
      {
        id: "assurance",
        label: "Assurance",
        score: 3,
        maxScore: 4,
        signals: ["coverage", "review"],
      },
    ],
    result: {
      label: "Readiness score",
      score: 7,
      disposition: "Ready for review",
      sentiment: "neutral",
    },
    formatScore: (value) => String(value),
  },
};

export const ZeroAndMissing: Story = {
  args: {
    title: "Partial evaluation",
    signals: [
      { id: "observed", label: "Exceptions observed", value: 0 },
      { id: "missing", label: "External review", value: null },
      { id: "false", label: "Override active", value: false },
    ],
    contributions: [
      {
        id: "exceptions",
        label: "Exceptions",
        score: 0,
        maxScore: 2,
        signals: ["observed"],
      },
      {
        id: "external",
        label: "External assessment",
        score: null,
        maxScore: 3,
        signals: ["missing", "not-loaded"],
      },
    ],
    result: {
      score: null,
      supportingText: "Awaiting the external assessment.",
    },
  },
};

export const OutsideScale: Story = {
  args: {
    ...scoreCompositionExample,
    contributions: [
      {
        id: "overflow",
        label: "Above supplied cap",
        score: 3,
        maxScore: 2,
        signals: ["ratio"],
      },
      {
        id: "credit",
        label: "Signed adjustment",
        score: -1,
        maxScore: 2,
        signals: ["dimensions"],
      },
      {
        id: "invalid",
        label: "No valid cap",
        score: 0,
        maxScore: 0,
        signals: [],
      },
    ],
  },
};

export const NoData: Story = {
  args: {
    title: "Score composition",
    signals: [],
    contributions: [],
    result: { score: null },
  },
};

export const ExternalHeading: Story = {
  render: () => (
    <>
      <h2 id="score-heading">Decision details</h2>
      <ScoreComposition
        {...scoreCompositionExample}
        title={undefined}
        variant="bare"
        aria-labelledby="score-heading"
      />
    </>
  ),
};

export const IndependentPrimitives: Story = {
  render: () => (
    <HorizontalGrid columns={{ xs: 1, md: 3 }} gap="3">
      <ScoreSignal label="Documentation complete" value={true} />
      <ScoreContribution
        label="Documentation"
        score={2}
        maxScore={3}
        sourceLabels={["Documentation complete"]}
        explanation="Application-owned scoring rationale."
      />
      <ScoreResult label="Readiness" score={2} disposition="In progress" />
    </HorizontalGrid>
  ),
};
