import type { PathComparisonRow } from "./PathComparison";

/** Alignment is supplied by this synthetic application, not computed by the component. */
export const comparisonRows: PathComparisonRow[] = [
  {
    id: "origin",
    label: "Origin",
    cells: [
      { pathId: "north", eventIds: ["accepted"] },
      { pathId: "south", eventIds: ["accepted"] },
    ],
  },
  {
    id: "exchange",
    label: "Shared exchange",
    description: "Two separate observations",
    cells: [
      { pathId: "north", eventIds: ["arrived", "duplicate"] },
      { pathId: "south", eventIds: ["arrived", "duplicate"] },
    ],
  },
  {
    id: "processing",
    label: "Divergent locations",
    description: "Conflicting observations at 14:10",
    cells: [
      { pathId: "north", eventIds: ["north-scan"] },
      { pathId: "south", eventIds: ["south-scan"] },
    ],
  },
  {
    id: "destination",
    label: "Destination",
    cells: [
      { pathId: "north", eventIds: [], note: "Planned connection only" },
      { pathId: "south", eventIds: [], note: "Planned connection only" },
    ],
  },
];
