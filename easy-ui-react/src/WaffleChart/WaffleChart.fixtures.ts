import type {
  WaffleChartCategory,
  WaffleChartGroup,
  WaffleChartItem,
} from "./types";

/** Synthetic resources only; no consumer or business records. */
export const waffleCategories: readonly WaffleChartCategory[] = [
  { id: "engineering", label: "Engineering", color: "primary.600" },
  { id: "design", label: "Design", color: "warning.600" },
  { id: "operations", label: "Operations", color: "positive.600" },
];

export type ExampleMetadata = { discipline: string; note: string };
export const waffleItems: readonly WaffleChartItem<ExampleMetadata>[] =
  Array.from({ length: 17 }, (_, index) => ({
    id: `resource-${index + 1}`,
    label: `Resource ${String(index + 1).padStart(2, "0")}`,
    categoryId: waffleCategories[index % waffleCategories.length].id,
    draft: index === 3 || index === 10,
    metadata: {
      discipline: waffleCategories[index % waffleCategories.length].label,
      note: "Synthetic example resource",
    },
  }));

export const waffleGroups: readonly WaffleChartGroup[] = [
  {
    id: "shared",
    label: "Shared group",
    description: "Connected to two targets",
  },
  {
    id: "specialist",
    label: "Specialist group",
    description: "Connected to one target",
  },
  {
    id: "unlinked",
    label: "Unlinked group",
    description: "No relationship supplied",
  },
];

export const groupedWaffleItems: readonly WaffleChartItem<ExampleMetadata>[] =
  waffleItems.map((item, index) => ({
    ...item,
    groupId: index < 7 ? "shared" : index < 12 ? "specialist" : "unlinked",
  }));
