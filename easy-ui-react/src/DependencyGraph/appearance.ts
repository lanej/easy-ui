import { getComponentThemeToken } from "../utilities/css";
import type { DependencyGraphNodeAppearance } from "./types";

/** Theme variables keep caller-owned emphasis consistent in graph and tree views. */
export function dependencyGraphAppearanceStyle(
  appearance?: DependencyGraphNodeAppearance,
) {
  return {
    ...getComponentThemeToken(
      "dependency-graph-node",
      "background",
      "color",
      appearance?.background,
    ),
    ...getComponentThemeToken(
      "dependency-graph-node",
      "border",
      "color",
      appearance?.borderColor,
    ),
  };
}
