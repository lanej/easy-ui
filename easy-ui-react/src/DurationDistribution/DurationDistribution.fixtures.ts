// Synthetic completed observations; nearest-rank P50 = 9 h, P90 = 18 h.
// Assessment ranges come from the application, independently of these samples.
export const samples = [
  [1.5, 20],
  [4.5, 100],
  [7.5, 260],
  [9, 120],
  [10.5, 180],
  [13.5, 140],
  [16.5, 60],
  [18, 20],
  [19.5, 60],
  [22.5, 30],
  [25.5, 10],
] as const;
const max = 30;
export const landmarks = [
  { label: "P50", value: 9 },
  { label: "P90", value: 18 },
];
export const bins = Array.from({ length: 10 }, (_, index) => ({
  from: index * 3,
  to: (index + 1) * 3,
  count: samples.reduce(
    (sum, [duration, count]) =>
      sum + (duration >= index * 3 && duration < (index + 1) * 3 ? count : 0),
    0,
  ),
}));

const total = samples.reduce((sum, [, count]) => sum + count, 0);
let runningCount = 0;
export const cumulative = [
  { duration: 0, fraction: 0 },
  ...samples.map(([duration, count]) => {
    runningCount += count;
    return { duration, fraction: runningCount / total };
  }),
  { duration: max, fraction: 1 },
];
