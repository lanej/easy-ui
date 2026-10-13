import { createContext } from "react";
import type { MapFacility } from "./types";

/** Coordinates for route continuations beyond the displayed local facilities. */
export const NetworkMapRouteContext = createContext<readonly MapFacility[]>([]);
