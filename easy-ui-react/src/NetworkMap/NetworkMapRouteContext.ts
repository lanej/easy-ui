import { createContext } from "react";
import type { MapFacility, MapSegment } from "./types";

/** Route endpoints and the original cohort's flow scale for a local close-up. */
export const NetworkMapRouteContext = createContext<{
  facilities: readonly MapFacility[];
  volumeSegments?: readonly MapSegment[];
}>({ facilities: [] });
