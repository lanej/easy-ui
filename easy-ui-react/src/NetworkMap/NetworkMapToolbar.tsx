import React from "react";
import { defaultControlLabels } from "./controls";
import type {
  NetworkMapControlLabels,
  NetworkMapControls,
  NetworkMapLayerVisibility,
} from "./types";
import styles from "./NetworkMap.module.scss";

type NetworkMapToolbarProps = {
  accessibleName: string;
  controls: Required<NetworkMapControls>;
  labels?: Partial<NetworkMapControlLabels>;
  ready: boolean;
  visibility: NetworkMapLayerVisibility;
  onVisibilityChange: (
    layer: keyof NetworkMapLayerVisibility,
    visible: boolean,
  ) => void;
  onFitAll: () => void;
  onSelectedSegment: () => void;
  onLatestEvent: () => void;
};

/** Only renders relevant controls; engine-owned navigation and scale are managed separately. */
export function NetworkMapToolbar({
  accessibleName,
  controls,
  labels,
  ready,
  visibility,
  onVisibilityChange,
  onFitAll,
  onSelectedSegment,
  onLatestEvent,
}: NetworkMapToolbarProps) {
  const cameraActions = [
    { key: "fitAll", onClick: onFitAll },
    { key: "selectedSegment", onClick: onSelectedSegment },
    { key: "latestEvent", onClick: onLatestEvent },
  ] as const;
  const visibleActions = cameraActions.filter(({ key }) => controls[key]);
  const visibleLayers = (
    ["risk", "weather", "deliverySurface"] as const
  ).filter((key) => controls[key]);
  if (!visibleActions.length && !visibleLayers.length) return null;

  return (
    <div
      className={styles.toolbar}
      role="group"
      aria-label={`${accessibleName} camera and layers`}
    >
      {visibleActions.length > 0 && (
        <div className={styles.buttons}>
          {visibleActions.map(({ key, onClick }) => (
            <button key={key} type="button" onClick={onClick} disabled={!ready}>
              {labels?.[key] ?? defaultControlLabels[key]}
            </button>
          ))}
        </div>
      )}
      {visibleLayers.length > 0 && (
        <div className={styles.buttons}>
          {visibleLayers.map((key) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={visibility[key]}
                disabled={!ready}
                onChange={(event) =>
                  onVisibilityChange(key, event.target.checked)
                }
              />{" "}
              {labels?.[key] ?? defaultControlLabels[key]}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
