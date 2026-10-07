import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button";
import { HorizontalGrid } from "../HorizontalGrid";
import { HorizontalStack } from "../HorizontalStack";
import { MetricContent } from "../MetricCard";
import { Pill } from "../Pill";
import { Text } from "../Text";
import { Textarea } from "../Textarea";
import { DrawerTable, DrawerTableProps } from "./DrawerTable";
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

type Parcel = (typeof parcels)[number];

function ParcelWorklist(
  props: Pick<
    DrawerTableProps<Parcel>,
    "rows" | "mountPolicy" | "renderFooter"
  >,
) {
  return (
    <DrawerTable
      aria-label="Parcel operations"
      {...props}
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
  );
}

export const Default: Story = {
  args: { mountPolicy: "unmount" },
  render: (args) => (
    <ParcelWorklist rows={parcels} mountPolicy={args.mountPolicy} />
  ),
};

const pagedParcels = Array.from({ length: 24 }, (_, index) => ({
  ...parcels[index % parcels.length],
  key: `ep-${1001 + index}`,
  tracking: `EP${1001 + index}`,
}));

function PaginatedWorklist() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(3);
  const start = (page - 1) * pageSize;
  return (
    <ParcelWorklist
      rows={pagedParcels.slice(start, start + pageSize)}
      renderFooter={() => (
        <HorizontalStack gap="2" align="space-between" blockAlign="center">
          <Text variant="caption" fontVariantNumeric="tabular-nums">
            {start + 1}–{Math.min(start + pageSize, pagedParcels.length)} of{" "}
            {pagedParcels.length} parcels
          </Text>
          <DrawerTable.Pagination
            label="Parcel pages"
            page={page}
            count={Math.ceil(pagedParcels.length / pageSize)}
            onChange={setPage}
          />
          <DrawerTable.RowsPerPage
            size="sm"
            rowsPerPage={pageSize}
            options={[3, 6, 12]}
            onChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
          />
        </HorizontalStack>
      )}
    />
  );
}

export const Paginated: Story = {
  render: () => <PaginatedWorklist />,
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
