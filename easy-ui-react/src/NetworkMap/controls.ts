import {
  segmentData,
  validAreaCoordinates,
  validCoordinate,
  validSurfaceBounds,
} from "./geometry";
import { hasSupportedSurfaceEstimate } from "./surfaceRendering";
import type {
  NetworkMapControlLabels,
  NetworkMapControls,
  NetworkMapProps,
} from "./types";

export const defaultControlLabels: NetworkMapControlLabels = {
  fitAll: "Fit all locations",
  selectedSegment: "Selected leg",
  latestEvent: "Latest events",
  risk: "Facility risk",
  weather: "Weather",
  deliverySurface: "Delivery time surface",
};

/** Keep applicability separate from preferences and layer visibility. */
export function resolveMapControls(
  props: NetworkMapProps,
): Required<NetworkMapControls> {
  const facilities = (props.facilities ?? []).filter((facility) =>
    validCoordinate(facility.coordinates),
  );
  const selectedSegment = props.segments?.find(
    (segment) => segment.id === props.selectedSegmentId,
  );
  const applicable = {
    fitAll:
      facilities.length > 0 ||
      (props.areas ?? []).some((area) =>
        validAreaCoordinates(area.coordinates),
      ) ||
      (props.surface?.cells ?? []).some(validSurfaceBounds),
    selectedSegment:
      selectedSegment !== undefined &&
      segmentData(facilities, [selectedSegment]).features.length > 0,
    latestEvent: facilities.some(
      (facility) => facility.id === props.latestFacilityId,
    ),
    risk: facilities.some((facility) => {
      const probability = facility.risk?.probability;
      return (
        typeof probability === "number" &&
        Number.isFinite(probability) &&
        probability >= 0 &&
        probability <= 1
      );
    }),
    weather: (props.areas ?? []).some((area) =>
      validAreaCoordinates(area.coordinates),
    ),
    deliverySurface: (props.surface?.cells ?? []).some(
      (cell) => validSurfaceBounds(cell) && hasSupportedSurfaceEstimate(cell),
    ),
    navigation: true,
    scale: true,
  };
  const enabled = (key: keyof NetworkMapControls, legacyGroup = false) => {
    if (props.controls === false || !applicable[key]) return false;
    const defaultEnabled = !legacyGroup || props.networkControls !== false;
    return props.controls?.[key] ?? defaultEnabled;
  };

  return {
    fitAll: enabled("fitAll", true),
    selectedSegment: enabled("selectedSegment", true),
    latestEvent: enabled("latestEvent", true),
    risk: enabled("risk", true),
    weather: enabled("weather"),
    deliverySurface: enabled("deliverySurface"),
    navigation: enabled("navigation"),
    scale: enabled("scale"),
  };
}
