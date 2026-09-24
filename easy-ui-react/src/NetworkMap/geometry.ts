import type { FeatureCollection, Geometry } from "geojson";
import {
  hasSupportedSurfaceEstimate,
  hasSupportedSurfaceMetric,
} from "./surfaceRendering";
import type {
  MapArea,
  MapCoordinate,
  MapFacility,
  MapSegment,
  MapSurfaceCell,
} from "./types";

export function validCoordinate(p: MapCoordinate) {
  return (
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1]) &&
    Math.abs(p[0]) <= 180 &&
    Math.abs(p[1]) <= 85
  );
}

export function validAreaCoordinates(coordinates: readonly MapCoordinate[]) {
  return coordinates.length >= 3 && coordinates.every(validCoordinate);
}

export function validSurfaceBounds(cell: MapSurfaceCell) {
  return (
    cell.latMin < cell.latMax &&
    cell.lonMin < cell.lonMax &&
    validCoordinate([cell.lonMin, cell.latMin]) &&
    validCoordinate([cell.lonMax, cell.latMax])
  );
}

/** Stable geographic identity across immutable snapshot updates and cell reordering. */
export function surfaceCellKey(cell: MapSurfaceCell) {
  return `${cell.lonMin}:${cell.latMin}:${cell.lonMax}:${cell.latMax}`;
}

/** Split short dateline crossings at the world edge instead of drawing through Greenwich.
 * Preserve supplied intermediate points and interpolate only the boundary intersection.
 */
export function splitAntimeridian(
  points: readonly MapCoordinate[],
): number[][][] {
  if (!points.length) return [];
  const parts: number[][][] = [];
  let part: number[][] = [[...points[0]]];
  for (let index = 1; index < points.length; index++) {
    const previous = part[part.length - 1];
    const next = points[index];
    const delta = next[0] - previous[0];
    // +180 and -180 name the same meridian; there is no boundary distance to interpolate.
    if (Math.abs(delta) === 360) {
      if (previous[1] !== next[1]) part.push([previous[0], next[1]]);
      continue;
    }
    if (Math.abs(delta) > 180) {
      const wrapped = next[0] + (delta > 0 ? -360 : 360);
      const edge = wrapped > previous[0] ? 180 : -180;
      const fraction = (edge - previous[0]) / (wrapped - previous[0]);
      const latitude = previous[1] + fraction * (next[1] - previous[1]);
      if (fraction > 0) part.push([edge, latitude]);
      if (part.length > 1) parts.push(part);
      part = [[-edge, latitude]];
    }
    if (
      part[part.length - 1][0] !== next[0] ||
      part[part.length - 1][1] !== next[1]
    )
      part.push([...next]);
  }
  if (part.length > 1) parts.push(part);
  return parts;
}

export function segmentData(
  facilities: readonly MapFacility[],
  segments: readonly MapSegment[],
): FeatureCollection<Geometry> {
  const byId = new Map(facilities.map((f) => [f.id, f]));
  const maxVolume = Math.max(
    1,
    ...segments.map((s) =>
      Number.isFinite(s.volume) ? Math.max(0, s.volume ?? 0) : 0,
    ),
  );
  return {
    type: "FeatureCollection",
    features: segments.flatMap((s) => {
      const from = byId.get(s.from),
        to = byId.get(s.to);
      if (!from || !to || (s.evidence === "measured" && !s.coordinates))
        return [];
      const points = s.coordinates ?? [from.coordinates, to.coordinates];
      if (points.length < 2 || !points.every(validCoordinate)) return [];
      const parts = splitAntimeridian(points);
      return [
        {
          type: "Feature" as const,
          id: s.id,
          properties: {
            id: s.id,
            evidence: s.evidence,
            width:
              s.volume === undefined
                ? 4
                : 2 +
                  Math.sqrt(
                    Math.max(0, Number.isFinite(s.volume) ? s.volume : 0) /
                      maxVolume,
                  ) *
                    5,
            ...(s.color === undefined ? {} : { color: s.color }),
          },
          geometry:
            parts.length > 1
              ? {
                  type: "MultiLineString" as const,
                  coordinates: parts,
                }
              : {
                  type: "LineString" as const,
                  coordinates: parts[0] ?? points.map((p) => [...p]),
                },
        },
      ];
    }),
  };
}

/**
 * One GeoJSON Point feature per valid-coordinate facility, carrying only its `id` as a property —
 * the minimum a clustered MapLibre source needs. Feeds `NetworkMap`'s optional `clusterFacilities`
 * source; MapLibre's own supercluster integration computes `cluster`/`cluster_id`/`point_count` on
 * top of this at render time, so they are never set here.
 */
export function facilityPointData(
  facilities: readonly MapFacility[],
): FeatureCollection<Geometry> {
  return {
    type: "FeatureCollection",
    features: facilities
      .filter((f) => validCoordinate(f.coordinates))
      .map(
        (f) =>
          ({
            type: "Feature" as const,
            properties: { id: f.id },
            geometry: {
              type: "Point" as const,
              coordinates: [...f.coordinates],
            },
          }) as const,
      ),
  };
}

export function areaData(
  areas: readonly MapArea[],
): FeatureCollection<Geometry> {
  return {
    type: "FeatureCollection",
    features: areas.flatMap((a) => {
      if (!validAreaCoordinates(a.coordinates)) return [];
      const ring = a.coordinates.map((p) => [...p]);
      if (
        ring[0][0] !== ring[ring.length - 1][0] ||
        ring[0][1] !== ring[ring.length - 1][1]
      )
        ring.push([...ring[0]]);
      return [
        {
          type: "Feature" as const,
          properties: { id: a.id },
          geometry: { type: "Polygon" as const, coordinates: [ring] },
        },
      ];
    }),
  };
}

/**
 * One GeoJSON Polygon feature per valid grid cell of a delivery-time field, using each cell's
 * lat/lon min/max as the rectangle's four corners. Missing or unsupported estimates retain their
 * supplied values but are marked non-renderable. `relativeSampleCount` normalizes positive counts
 * against the largest count among drawable cells; this is not statistical confidence.
 */
export function surfaceData(
  cells: readonly MapSurfaceCell[],
): FeatureCollection<Geometry> {
  const maxN = cells.reduce(
    (maximum, cell) =>
      validSurfaceBounds(cell) && hasSupportedSurfaceEstimate(cell)
        ? Math.max(maximum, cell.n)
        : maximum,
    0,
  );
  return {
    type: "FeatureCollection",
    features: cells.flatMap((c) => {
      if (!validSurfaceBounds(c)) return [];
      const hasSupportedEstimate = hasSupportedSurfaceEstimate(c);
      const ring: MapCoordinate[] = [
        [c.lonMin, c.latMin],
        [c.lonMax, c.latMin],
        [c.lonMax, c.latMax],
        [c.lonMin, c.latMax],
        [c.lonMin, c.latMin],
      ];
      return [
        {
          type: "Feature" as const,
          properties: {
            cellKey: surfaceCellKey(c),
            medianMinutes: c.medianMinutes,
            iqrMinutes: c.iqrMinutes,
            n: c.n,
            hasSupportedEstimate,
            hasSupportedSpread: hasSupportedSurfaceMetric(c, "iqrMinutes"),
            relativeSampleCount: hasSupportedEstimate ? c.n / maxN : 0,
            // Scalar geometry remains inspectable; cellKey retrieves the original application
            // record, including distribution data that should not be copied into vector tiles.
            latMin: c.latMin,
            latMax: c.latMax,
            lonMin: c.lonMin,
            lonMax: c.lonMax,
          },
          geometry: {
            type: "Polygon" as const,
            coordinates: [ring.map((p) => [...p])],
          },
        },
      ];
    }),
  };
}

// Choose the shorter wrapped longitude interval, including dateline journeys.
export function geographicBounds(
  points: readonly MapCoordinate[],
): [[number, number], [number, number]] | null {
  const valid = points.filter(validCoordinate);
  if (!valid.length) return null;
  const longitudes = valid.map(([x]) => (x + 360) % 360).sort((a, b) => a - b);
  let gap = -1,
    index = 0;
  longitudes.forEach((x, i) => {
    const next =
      i + 1 < longitudes.length ? longitudes[i + 1] : longitudes[0] + 360;
    if (next - x > gap) {
      gap = next - x;
      index = i;
    }
  });
  let west = longitudes[(index + 1) % longitudes.length],
    east = longitudes[index];
  if (east < west) east += 360;
  if (west > 180) {
    west -= 360;
    east -= 360;
  }
  return [
    [west, Math.min(...valid.map((p) => p[1]))],
    [east, Math.max(...valid.map((p) => p[1]))],
  ];
}

export type LabelCandidate = {
  id: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  priority: number;
};
export function placeLabels(
  candidates: LabelCandidate[],
  width: number,
  height: number,
  reserved: { x: number; y: number; w: number; h: number }[] = [],
) {
  const occupied = [...reserved];
  const positions = new Map<string, { left: number; top: number }>();
  for (const c of [...candidates].sort(
    (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
  )) {
    if (c.x < 0 || c.y < 0 || c.x > width || c.y > height) continue;
    const labelHeight = c.height ?? 27;
    const centeredLeft =
      Math.max(5, Math.min(width - c.width - 5, c.x - c.width / 2)) - c.x;
    for (const [dx, dy] of [
      [16, -labelHeight / 2],
      [16, 15],
      [-c.width - 16, -labelHeight / 2],
      [-c.width - 16, 15],
      [-c.width / 2, -labelHeight - 17],
      [centeredLeft, -labelHeight - 12],
      [centeredLeft, 18],
    ]) {
      const box = { x: c.x + dx, y: c.y + dy, w: c.width, h: labelHeight };
      if (
        box.x < 5 ||
        box.y < 5 ||
        box.x + box.w > width - 5 ||
        box.y + box.h > height - 35
      )
        continue;
      if (
        occupied.some(
          (b) =>
            box.x < b.x + b.w + 8 &&
            box.x + box.w + 8 > b.x &&
            box.y < b.y + b.h + 5 &&
            box.y + box.h + 5 > b.y,
        )
      )
        continue;
      occupied.push(box);
      positions.set(c.id, { left: dx, top: dy });
      break;
    }
  }
  return positions;
}
