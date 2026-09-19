import CheckCircleIcon from "@easypost/easy-ui-icons/CheckCircle";
import ErrorIcon from "@easypost/easy-ui-icons/Error";
import { action } from "storybook/actions";
import { expect, userEvent, within } from "storybook/test";
import { Meta, StoryObj } from "@storybook/react-vite";
import React, { useState } from "react";
import { Key } from "react-aria";
import { useAsyncList } from "react-stately";
import { Icon } from "../Icon";
import { Menu } from "../Menu";
import { Text } from "../Text";
import {
  PlaceholderBox,
  createNaiveSortingFunction,
} from "../utilities/storybook";
import { DataGrid } from "./DataGrid";
import { DataGridProps } from "./types";

type Story = StoryObj<typeof DataGrid>;

const columns = [
  { key: "name", name: "Name" },
  { key: "email", name: "Email" },
  { key: "permissions", name: "Permissions" },
  { key: "status", name: "Status" },
  { key: "lastActive", name: "Last Active" },
];

const rows = [
  {
    key: 1,
    name: "Julie Smith",
    email: "julie.smith@example.com",
    permissions: "User",
    status: "Active",
    lastActive: "2022-12-08",
  },
  {
    key: 2,
    name: "Sam Frost",
    email: "sam.frost@example.com",
    permissions: "User",
    status: "Active",
    lastActive: "2022-12-12",
  },
  {
    key: 3,
    name: "Ashley Benson",
    email: "ashley.benson@example.com",
    permissions: "Admin",
    status: "Active",
    lastActive: "2023-03-24",
  },
  {
    key: 4,
    name: "Robert Gomez",
    email: "robert.gomez@example.com",
    permissions: "User",
    status: "Inactive",
    lastActive: "2022-10-03",
  },
  {
    key: 5,
    name: "William Macintosh",
    email: "william.macintosh@example.com",
    permissions: "User",
    status: "Active",
    lastActive: "2023-01-12",
  },
  {
    key: 6,
    name: "Sarah Skylar",
    email: "sarah.skylar@example.com",
    permissions: "User",
    status: "Active",
    lastActive: "2023-06-06",
  },
];

const Template = (args: Partial<DataGridProps>) => {
  return (
    <DataGrid
      columns={columns}
      rows={rows}
      renderColumnCell={(column) => (
        <span style={{ whiteSpace: "nowrap" }}>{String(column.name)}</span>
      )}
      renderRowCell={(item) => (
        <span style={{ whiteSpace: "nowrap" }}>{String(item)}</span>
      )}
      {...args}
    />
  );
};

const meta: Meta<typeof DataGrid> = {
  title: "Components/DataGrid",
  component: DataGrid,
  args: {
    headerVariant: "primary",
    selectionMode: "none",
  },
  parameters: {
    controls: {
      include: [],
    },
  },
};

export default meta;

export const Default: Story = {
  render: Template.bind({}),
  args: {
    "aria-label": "Example data grid",
    onRowAction: action("Row action!"),
  },
  parameters: {
    controls: {
      include: [
        "aria-label",
        "headerVariant",
        "maxRows",
        "selectionMode",
        "templateColumns",
      ],
    },
  },
};

export const WithSelection: Story = {
  render: Template.bind({}),
  args: {
    "aria-label": "Example data grid with selection",
    selectionMode: "multiple",
  },
  parameters: {
    controls: {
      include: ["selectionMode"],
    },
  },
};

export const WithRowExpansion: Story = {
  render: Template.bind({}),
  args: {
    "aria-label": "Example data grid with row expansion",
    onRowAction: action("Row action!"),
    renderExpandedRow: (rowKey: Key) => (
      <PlaceholderBox width="100%" height="140px">
        Space for row {rowKey} content
      </PlaceholderBox>
    ),
  },
};

export const WithKebabMenu: Story = {
  render: Template.bind({}),
  args: {
    "aria-label": "Example data grid with kebab menu",
    onRowAction: action("Row action!"),
    rowActions: () => [
      {
        type: "menu",
        renderMenuOverlay: () => (
          <Menu.Overlay onAction={action("Menu item clicked!")}>
            <Menu.Item>Action 1</Menu.Item>
            <Menu.Item>Action 2</Menu.Item>
          </Menu.Overlay>
        ),
      },
    ],
  },
};

export const WithHeaderVariant: Story = {
  render: WithSortTemplate.bind({}),
  args: {
    "aria-label": "Example data grid with header variant",
    onRowAction: action("Row action!"),
    headerVariant: "secondary",
  },
  parameters: {
    controls: {
      include: ["headerVariant"],
    },
  },
};

export const WithSort: Story = {
  render: WithSortTemplate.bind({}),
  args: {
    "aria-label": "Example data grid with sort",
  },
};

export const WithCustomSize: Story = {
  render: WithSortTemplate.bind({}),
  args: {
    "aria-label": "Example data grid with custom size",
    selectionMode: "multiple",
    size: "lg",
  },
  parameters: {
    controls: {
      include: ["size"],
    },
  },
};

export const WithCustomRendering: Story = {
  render: Template.bind({}),
  args: {
    "aria-label": "Example data grid with custom rendering",
    onRowAction: action("Row action!"),
    renderRowCell(cell, columnKey) {
      if (columnKey === "status") {
        return (
          <span
            style={{
              whiteSpace: "nowrap",
              color: cell === "Inactive" ? "red" : "green",
            }}
          >
            {String(cell)}
          </span>
        );
      }
      return <span style={{ whiteSpace: "nowrap" }}>{String(cell)}</span>;
    },
  },
};

export const WithIcons: Story = {
  render: Template.bind({}),
  args: {
    "aria-label": "Example data grid with icons",
    onRowAction: action("Row action!"),
    renderRowCell(cell, columnKey) {
      if (columnKey === "status") {
        return (
          <span style={{ color: cell === "Inactive" ? "red" : "green" }}>
            <Icon symbol={cell === "Inactive" ? ErrorIcon : CheckCircleIcon} />
          </span>
        );
      }
      return <span style={{ whiteSpace: "nowrap" }}>{String(cell)}</span>;
    },
  },
};

export const WithRowExpansionAndKebabMenu: Story = {
  render: Template.bind({}),
  args: {
    "aria-label": "Example data grid with row expansion and kebab menu",
    rows,
    onRowAction: action("Row action!"),
    renderExpandedRow: (rowKey: Key) => (
      <PlaceholderBox width="100%" height="140px">
        Space for row {rowKey} content
      </PlaceholderBox>
    ),
    rowActions: () => [
      {
        type: "menu",
        renderMenuOverlay: () => (
          <Menu.Overlay onAction={action("Menu item clicked!")}>
            <Menu.Item>Action 1</Menu.Item>
            <Menu.Item>Action 2</Menu.Item>
          </Menu.Overlay>
        ),
      },
    ],
  },
  parameters: {
    controls: {
      include: ["size", "maxRows"],
    },
  },
};

export const WithSelectionAndSortAndKebabMenu: Story = {
  render: WithSortTemplate.bind({}),
  args: {
    "aria-label": "Example data grid with selection and sort and kebab menu",
    selectionMode: "multiple",
    rowActions: () => [
      {
        type: "menu",
        renderMenuOverlay: () => (
          <Menu.Overlay onAction={action("Menu item clicked!")}>
            <Menu.Item>Action 1</Menu.Item>
            <Menu.Item>Action 2</Menu.Item>
          </Menu.Overlay>
        ),
      },
    ],
  },
  parameters: {
    controls: {
      include: ["size", "maxRows"],
    },
  },
};

export const EmptyState: Story = {
  render: Template.bind({}),
  args: {
    "aria-label": "Example data grid with no data",
    renderEmptyState: () => <span>No Data!!</span>,
    rows: [],
  },
};

export const LoadingState: Story = {
  render: Template.bind({}),
  args: {
    "aria-label": "Example data grid loading state",
    isLoading: true,
    rows: [],
  },
  parameters: {
    controls: {
      include: ["isLoading"],
    },
  },
};

export const WithFooter: Story = {
  render: WithFooterTemplate.bind({}),
  args: {
    "aria-label": "Example data grid with a footer",
    maxRows: 4,
  },
  parameters: {
    controls: {
      include: ["maxRows", "size"],
    },
  },
};

export const WithCustomFooter: Story = {
  render: Template.bind({}),
  args: {
    "aria-label": "Example data grid with a custom footer",
    maxRows: 4,
    renderFooter: () => (
      <DataGrid.Footer
        start={<Text variant="body2">6 results</Text>}
        end={<Text variant="body2">Updated just now</Text>}
      />
    ),
  },
};

export const FooterWithEmptyState: Story = {
  render: WithFooterTemplate.bind({}),
  args: {
    "aria-label": "Example data grid with a footer and no data",
    rows: [],
  },
};

function WithSortTemplate(args: Partial<DataGridProps>) {
  // https://react-spectrum.adobe.com/react-stately/useAsyncList.html
  const list = useAsyncList({
    async load() {
      return await Promise.resolve({ items: rows });
    },
    async sort({ items, sortDescriptor }) {
      return { items: items.sort(createNaiveSortingFunction(sortDescriptor)) };
    },
  });
  return (
    <DataGrid
      columns={columns}
      rows={list.items}
      renderColumnCell={(column) => (
        <span style={{ whiteSpace: "nowrap" }}>{String(column.name)}</span>
      )}
      renderRowCell={(item) => (
        <span style={{ whiteSpace: "nowrap" }}>{String(item)}</span>
      )}
      sortDescriptor={list.sortDescriptor}
      onSortChange={list.sort}
      columnKeysAllowingSort={columns.map((c) => c.key)}
      {...args}
    />
  );
}

function WithFooterTemplate(args: Partial<DataGridProps>) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  return (
    <DataGrid
      columns={columns}
      rows={rows}
      renderColumnCell={(column) => (
        <span style={{ whiteSpace: "nowrap" }}>{String(column.name)}</span>
      )}
      renderRowCell={(item) => (
        <span style={{ whiteSpace: "nowrap" }}>{String(item)}</span>
      )}
      renderFooter={() => (
        <DataGrid.Footer
          center={
            <DataGrid.Pagination page={page} count={10} onChange={setPage} />
          }
          end={
            <DataGrid.RowsPerPage
              rowsPerPage={rowsPerPage}
              options={[25, 50, 100]}
              onChange={setRowsPerPage}
            />
          }
        />
      )}
      {...args}
    />
  );
}

// Representative Analytics homepage data. Store spend in cents so aggregation
// operates on integers; apply currency formatting only when rendering cells.
const serviceSplitColumns = [
  { key: "carrier", name: "Carrier" },
  { key: "service", name: "Service level" },
  { key: "packages", name: "Package count" },
  { key: "spend", name: "Spend" },
];
const serviceSplitRows = [
  {
    key: "usps-ground",
    carrier: "USPS",
    service: "Ground Advantage",
    packages: 1200,
    spend: 684000,
  },
  {
    key: "usps-priority",
    carrier: "USPS",
    service: "Priority Mail",
    packages: 800,
    spend: 756000,
  },
  {
    key: "ups-ground",
    carrier: "UPS",
    service: "Ground",
    packages: 640,
    spend: 684800,
  },
  {
    key: "ups-next-day",
    carrier: "UPS",
    service: "Next Day Air",
    packages: 160,
    spend: 412800,
  },
  {
    key: "fedex-ground",
    carrier: "FedEx",
    service: "Ground",
    packages: 420,
    spend: 499800,
  },
  {
    key: "fedex-2day",
    carrier: "FedEx",
    service: "2Day",
    packages: 80,
    spend: 228000,
  },
];
const serviceSplitCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const serviceSplitCount = new Intl.NumberFormat("en-US");
function renderServiceSplitCell(cell: unknown, columnKey: string | number) {
  if (columnKey === "spend") {
    return serviceSplitCurrency.format(Number(cell) / 100);
  }
  if (columnKey === "packages") {
    return serviceSplitCount.format(Number(cell));
  }
  return String(cell ?? "");
}

/** Carrier × service breakdown with automatically computed carrier subtotals. */
export const ServiceSplit: Story = {
  args: {
    size: "md",
    maxRows: "all",
    headerVariant: "secondary",
    columnOptions: {
      carrier: { width: "20%", minWidth: 184 },
      service: { width: "40%", minWidth: 200 },
      packages: { width: "20%", minWidth: 140, isNumeric: true },
      spend: { width: "20%", minWidth: 144, isNumeric: true },
    },
  },
  parameters: {
    controls: {
      include: [
        "size",
        "headerVariant",
        "maxRows",
        "maxHeight",
        "columnOptions",
      ],
    },
  },
  argTypes: {
    maxRows: { control: "select", options: ["all", 4, 6, 9] },
    maxHeight: {
      control: "text",
      description:
        'CSS height limit, such as "280px" or "60vh". Overrides maxRows.',
    },
    columnOptions: { control: "object" },
  },
  render: ({
    maxRows,
    maxHeight,
    size,
    headerVariant,
    columnOptions,
    grouping,
  }) => (
    <DataGrid
      maxRows={maxRows}
      maxHeight={maxHeight}
      size={size}
      headerVariant={headerVariant}
      columnOptions={columnOptions}
      aria-label="Service Split"
      columns={serviceSplitColumns}
      rows={serviceSplitRows}
      renderColumnCell={(column) => column.name}
      renderRowCell={renderServiceSplitCell}
      grouping={{
        getGroupKey: (row) => row.carrier,
        aggregators: {
          packages: (rows) => rows.reduce((sum, row) => sum + row.packages, 0),
          spend: (rows) => rows.reduce((sum, row) => sum + row.spend, 0),
        },
        renderSubtotalCell: renderServiceSplitCell,
        ...grouping,
      }}
    />
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const table = canvas.getByRole("grid");
    const scrollContainer = table.parentElement!.parentElement!;
    // A table that fits must not acquire overflow from decorative elements.
    if (
      table.getBoundingClientRect().width <=
      scrollContainer.clientWidth + 1
    ) {
      await expect(scrollContainer.scrollWidth).toBeLessThanOrEqual(
        scrollContainer.clientWidth + 1,
      );
    }
    if (args.maxRows === "all" && args.maxHeight == null) {
      await expect(scrollContainer.scrollHeight).toBeLessThanOrEqual(
        scrollContainer.clientHeight + 1,
      );
    }
    for (const [carrier, packages, spend] of [
      ["USPS", "2,000", "$14,400.00"],
      ["UPS", "800", "$10,976.00"],
      ["FedEx", "500", "$7,278.00"],
    ]) {
      const subtotal = canvas.getByRole("row", {
        name: new RegExp(`${carrier} subtotal`),
      });
      await expect(subtotal).toHaveAttribute(
        "data-ezui-data-grid-subtotal",
        "true",
      );
      await expect(
        within(subtotal).getByRole("gridcell", { name: packages }),
      ).toBeInTheDocument();
      await expect(
        within(subtotal).getByRole("gridcell", { name: spend }),
      ).toBeInTheDocument();
    }
  },
};

/** The same table in a dashboard panel with a deliberate height limit. */
export const ServiceSplitConstrained: Story = {
  ...ServiceSplit,
  args: { ...ServiceSplit.args, maxHeight: "280px" },
};

/** Collapse detail rows while keeping each carrier's totals visible. */
export const ServiceSplitCollapsible: Story = {
  ...ServiceSplit,
  args: {
    ...ServiceSplit.args,
    columnOptions: {
      ...ServiceSplit.args?.columnOptions,
      carrier: { width: "25%", minWidth: 212 },
      service: { width: "35%", minWidth: 200 },
    },
    grouping: {
      getGroupKey: (row) => String(row.carrier),
      aggregators: {
        packages: (rows) =>
          rows.reduce((sum, row) => sum + Number(row.packages), 0),
        spend: (rows) => rows.reduce((sum, row) => sum + Number(row.spend), 0),
      },
      isCollapsible: true,
    },
  },
  play: async (context) => {
    await ServiceSplit.play?.(context);
    const canvas = within(context.canvasElement);
    const toggle = canvas.getByRole("button", { name: "Collapse USPS group" });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveFocus();
    await expect(
      canvas.queryByText("Ground Advantage"),
    ).not.toBeInTheDocument();
    await expect(canvas.getByText("$14,400.00")).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getByText("Ground Advantage")).toBeInTheDocument();
    await userEvent.keyboard(" ");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  },
};

const longServiceRows = serviceSplitRows.map((row, index) => ({
  ...row,
  service: [
    "Ground Advantage — commercial parcel service with tracking and delivery confirmation",
    "Priority Mail — regional and nationwide delivery for time-sensitive shipments",
    "Ground — residential delivery with additional handling for oversized packages",
    "Next Day Air — early delivery with signature confirmation",
    "Ground — economy delivery to residential and commercial addresses",
    "2Day — scheduled delivery with a direct signature requirement",
  ][index],
}));

/** Long service names in a narrow dashboard panel, without cutting off text. */
export const LongLabelsNarrow: Story = {
  ...ServiceSplit,
  args: {
    ...ServiceSplit.args,
    columnOptions: {
      carrier: { width: 212, minWidth: 212 },
      service: { minWidth: 320 },
      packages: { minWidth: 140, isNumeric: true },
      spend: { minWidth: 144, isNumeric: true },
    },
  },
  render: ({ maxRows, maxHeight, size, headerVariant, columnOptions }) => (
    <div style={{ width: 480, maxWidth: "100%" }}>
      <DataGrid
        aria-label="Service Split with long service names"
        maxRows={maxRows}
        maxHeight={maxHeight}
        size={size}
        headerVariant={headerVariant}
        columnOptions={columnOptions}
        columns={serviceSplitColumns}
        rows={longServiceRows}
        renderColumnCell={(column) => (
          <Text whiteSpace="nowrap">{column.name}</Text>
        )}
        renderRowCell={(cell, key) => (
          <Text whiteSpace="nowrap">{renderServiceSplitCell(cell, key)}</Text>
        )}
        grouping={{
          getGroupKey: (row) => row.carrier,
          aggregators: {
            packages: (rows) =>
              rows.reduce((sum, row) => sum + row.packages, 0),
            spend: (rows) => rows.reduce((sum, row) => sum + row.spend, 0),
          },
          renderSubtotalCell: renderServiceSplitCell,
          isCollapsible: true,
        }}
      />
    </div>
  ),
  play: async (context) => {
    await ServiceSplit.play?.(context);
    const canvas = within(context.canvasElement);
    const table = canvas.getByRole("grid");
    const container = table.parentElement!.parentElement!;
    await expect(container.scrollWidth).toBeGreaterThan(container.clientWidth);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth + 1,
    );
    const label = canvas.getByText(longServiceRows[0].service);
    const labelBounds = label.getBoundingClientRect();
    const cellBounds = label.closest("td")!.getBoundingClientRect();
    await expect(labelBounds.width).toBeLessThanOrEqual(cellBounds.width);
    await expect(labelBounds.height).toBeLessThanOrEqual(cellBounds.height);
    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse USPS group" }),
    );
    await expect(
      canvas.queryByText(longServiceRows[0].service),
    ).not.toBeInTheDocument();
    await expect(canvas.getByText("$14,400.00")).toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Expand USPS group" }),
    );
    await expect(
      canvas.getByText(longServiceRows[0].service),
    ).toBeInTheDocument();
  },
};
