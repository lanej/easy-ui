import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CardListItem } from "./CardListItem";
import styles from "./CardListItem.stories.module.scss";

const facilities = [
  {
    id: "atlanta",
    name: "Atlanta",
    detail: "Southeast hub",
    parcels: "12,840 parcels / day",
  },
  {
    id: "dallas",
    name: "Dallas",
    detail: "South Central hub",
    parcels: "9,620 parcels / day",
  },
  {
    id: "newark",
    name: "Newark",
    detail: "Northeast hub",
    parcels: "15,210 parcels / day",
  },
];

function FacilityList({ interactive = true }: { interactive?: boolean }) {
  const [selected, setSelected] = useState("atlanta");
  return (
    <div className={styles.example}>
      <h2>Facilities</h2>
      <p>
        {interactive
          ? "Choose a facility to inspect its network."
          : "Daily parcel volume by facility."}
      </p>
      <ul className={styles.list} aria-label="Facilities">
        {facilities.map((facility) => (
          <CardListItem
            key={facility.id}
            selected={interactive && selected === facility.id}
            onSelect={interactive ? () => setSelected(facility.id) : undefined}
          >
            <strong>{facility.name}</strong>
            <span>{facility.detail}</span>
            <span>{facility.parcels}</span>
          </CardListItem>
        ))}
      </ul>
      {interactive && (
        <p role="status">
          Inspecting{" "}
          {facilities.find((facility) => facility.id === selected)?.name}
        </p>
      )}
    </div>
  );
}

const meta: Meta<typeof CardListItem> = {
  id: "components-cards-cardlistitem",
  title: "Molecules/Cards/CardListItem",
  component: CardListItem,
  parameters: { controls: { disable: true } },
};
export default meta;
type Story = StoryObj<typeof CardListItem>;
export const Selectable: Story = { render: () => <FacilityList /> };
export const ReadOnly: Story = {
  render: () => <FacilityList interactive={false} />,
};
