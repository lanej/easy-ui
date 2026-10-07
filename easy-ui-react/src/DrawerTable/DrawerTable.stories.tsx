import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button";
import { HorizontalGrid } from "../HorizontalGrid";
import { MetricContent } from "../MetricCard";
import { Pill } from "../Pill";
import { Text } from "../Text";
import { Textarea } from "../Textarea";
import { DrawerTable } from "./DrawerTable";
import styles from "./DrawerTable.examples.module.scss";

const parcels = [
  {
    key: "ep-1001",
    tracking: "EP1001",
    service: "Ground",
    status: "In transit",
    location: "Detroit",
    hours: "4.2 hours",
    parcels: "120",
  },
  {
    key: "ep-1002",
    tracking: "EP1002",
    service: "Two-day",
    status: "At facility",
    location: "Chicago",
    hours: "2.1 hours",
    parcels: "85",
  },
  {
    key: "ep-1003",
    tracking: "EP1003",
    service: "Ground",
    status: "Out for delivery",
    location: "Cleveland",
    hours: "0 hours",
    parcels: "42",
  },
];
const meta: Meta<typeof DrawerTable> = {
  id: "components-drawertable",
  title: "Organisms/Tables/DrawerTable",
  component: DrawerTable,
  parameters: { layout: "padded", controls: { include: ["mountPolicy"] } },
};
export default meta;
type Story = StoryObj<typeof DrawerTable>;

export const Default: Story = {
  args: { mountPolicy: "unmount" },
  render: (args) => (
    <DrawerTable
      aria-label="Parcel operations"
      rows={parcels}
      mountPolicy={args.mountPolicy}
      renderRow={(parcel) => (
        <span className={styles.summary}>
          <span className={styles.identity}>
            <Text weight="semibold">{parcel.tracking}</Text>
            <Pill size="sm">{parcel.status}</Pill>
          </span>
          <span className={styles.fact}>
            <Text variant="caption" color="neutral.600">
              Service
            </Text>
            <Text>{parcel.service}</Text>
          </span>
          <span className={styles.fact}>
            <Text variant="caption" color="neutral.600">
              Last scan
            </Text>
            <Text>{parcel.location}</Text>
          </span>
          <span className={styles.fact}>
            <Text variant="caption" color="neutral.600">
              Facility dwell
            </Text>
            <Text fontVariantNumeric="tabular-nums">{parcel.hours}</Text>
          </span>
        </span>
      )}
      renderRowActions={(parcel) => (
        <Button
          variant="outlined"
          size="sm"
          onPress={() => undefined}
          aria-label={`Track ${parcel.tracking}`}
        >
          Track parcel
        </Button>
      )}
      renderExpandedRow={(parcel) => (
        <div className={styles.detail}>
          <Text as="h3" variant="subtitle2">
            Parcel journey
          </Text>
          <Text>
            The last supplied scan places {parcel.tracking} at {parcel.location}
            . Summary facts stay above while the investigation opens below.
          </Text>
          <HorizontalGrid columns={{ xs: 1, sm: 2 }} gap="2">
            <MetricContent
              label="Facility dwell"
              value={parcel.hours}
              valueSize={22}
            />
            <MetricContent
              label="Associated cohort"
              value={`${parcel.parcels} parcels`}
              valueSize={22}
            />
          </HorizontalGrid>
          <Textarea label={`Investigation note for ${parcel.tracking}`} />
        </div>
      )}
    />
  ),
};

export const Expanded: Story = {
  ...Default,
  render: (args) => (
    <DrawerTable
      aria-label="Lane operations"
      rows={parcels}
      defaultExpandedKey="ep-1001"
      mountPolicy={args.mountPolicy}
      renderRow={(parcel) => (
        <Text weight="semibold">
          {parcel.location} · {parcel.service}
        </Text>
      )}
      renderExpandedRow={(parcel) => (
        <MetricContent
          label="Observed facility dwell"
          value={parcel.hours}
          valueSize={22}
        />
      )}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <DrawerTable
      aria-label="Parcels"
      rows={[]}
      renderRow={() => null}
      renderExpandedRow={() => null}
      emptyContent={<Text>No parcels match this view.</Text>}
    />
  ),
};
