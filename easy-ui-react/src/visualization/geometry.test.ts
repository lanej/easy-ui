import { continuousSegments, markerPoints, position } from "./geometry";

it("shares gap construction while preserving caller-provided spacing and isolated observations", () => {
  const values = [0, 2, null, NaN, 5, Infinity, 7];
  const segments = continuousSegments(values, (value, index) =>
    value === null ? null : [index * 10, value],
  );
  expect(segments).toEqual([
    [
      [0, 0],
      [10, 2],
    ],
    [[40, 5]],
    [[60, 7]],
  ]);
  expect(markerPoints(segments, "endpoints")).toEqual([
    [0, 0],
    [10, 2],
  ]);
  expect(markerPoints(segments, "none")).toEqual([]);
});

it("normalizes extreme and constant domains without changing scale ownership", () => {
  expect(position(0, [-Number.MAX_VALUE, Number.MAX_VALUE])).toBe(0.5);
  expect(position(10, [10, 10])).toBe(0.5);
  expect(position(10, [0, 100])).toBe(0.1);
  expect(
    markerPoints(
      [
        [
          [0, 1],
          [1, 1],
          [2, 1],
        ],
      ],
      "extrema",
    ),
  ).toEqual([[0, 1]]);
});
