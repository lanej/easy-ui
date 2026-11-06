import type { InvestigationRecords, InvestigationSelection } from "./selection";
import type { InvestigationPrediction } from "./workbenchModel";

export type InvestigationMode = "overview" | "focused" | "deviation";
export type InvestigationWorkbenchState = {
  mode: InvestigationMode;
  focusedPathId: string | null;
  selection: InvestigationSelection;
  enabledPredictionIds: readonly string[];
  comparisonPredictionId: string | null;
  showDisconnected: boolean;
  showRisks: boolean;
};
export const initialInvestigationWorkbenchState: InvestigationWorkbenchState = {
  mode: "overview",
  focusedPathId: null,
  selection: null,
  enabledPredictionIds: [],
  comparisonPredictionId: null,
  showDisconnected: true,
  showRisks: true,
};
export type InvestigationWorkbenchAction =
  | { type: "mode"; mode: InvestigationMode }
  | { type: "focus"; pathId: string }
  | { type: "select"; selection: InvestigationSelection }
  | { type: "prediction"; id: string; enabled: boolean }
  | { type: "compare"; id: string }
  | { type: "disconnected"; show: boolean }
  | { type: "risks"; show: boolean };

/** Focus and selection are orthogonal; inspecting a marker never dismisses a forecast. */
export function reduceInvestigationWorkbench(
  state: InvestigationWorkbenchState,
  action: InvestigationWorkbenchAction,
  records: InvestigationRecords,
  predictions: readonly InvestigationPrediction[],
): InvestigationWorkbenchState {
  if (action.type === "select")
    return { ...state, selection: action.selection };
  if (action.type === "risks") return { ...state, showRisks: action.show };
  if (action.type === "disconnected")
    return { ...state, showDisconnected: action.show };
  if (action.type === "focus") {
    if (!records.paths?.some((path) => path.id === action.pathId)) return state;
    const eventId = state.selection?.eventId;
    const retained =
      eventId &&
      records.events.some(
        (event) =>
          event.id === eventId && event.pathIds?.includes(action.pathId),
      );
    return {
      ...state,
      mode: "focused",
      focusedPathId: action.pathId,
      selection: retained
        ? { type: "event", eventId }
        : { type: "path", pathId: action.pathId },
    };
  }
  if (action.type === "mode") {
    if (action.mode === "overview") return { ...state, mode: "overview" };
    const pathId = records.paths?.some(
      (path) => path.id === state.focusedPathId,
    )
      ? state.focusedPathId
      : (records.paths?.[0]?.id ?? null);
    if (!pathId) return state;
    if (action.mode === "focused")
      return { ...state, mode: "focused", focusedPathId: pathId };
    const available = predictions.filter((item) => item.pathId === pathId);
    const comparison =
      available.find((item) => item.id === state.comparisonPredictionId) ??
      available[0];
    if (!comparison)
      return {
        ...state,
        mode: "deviation",
        focusedPathId: pathId,
        comparisonPredictionId: null,
      };
    return {
      ...state,
      mode: "deviation",
      focusedPathId: pathId,
      comparisonPredictionId: comparison.id,
      enabledPredictionIds: [
        ...new Set([...state.enabledPredictionIds, comparison.id]),
      ],
    };
  }
  const prediction = predictions.find(
    (item) => item.id === action.id && item.pathId === state.focusedPathId,
  );
  if (!prediction) return state;
  if (action.type === "compare")
    return {
      ...state,
      mode: "deviation",
      comparisonPredictionId: action.id,
      enabledPredictionIds: [
        ...new Set([...state.enabledPredictionIds, action.id]),
      ],
    };
  const enabledPredictionIds = action.enabled
    ? [...new Set([...state.enabledPredictionIds, action.id])]
    : state.enabledPredictionIds.filter((id) => id !== action.id);
  const comparisonPredictionId =
    !action.enabled && state.comparisonPredictionId === action.id
      ? (predictions.find(
          (item) =>
            item.pathId === state.focusedPathId &&
            enabledPredictionIds.includes(item.id),
        )?.id ?? null)
      : state.comparisonPredictionId;
  return { ...state, enabledPredictionIds, comparisonPredictionId };
}
