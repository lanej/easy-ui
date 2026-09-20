import React, { CSSProperties } from "react";
import { useId } from "react-aria";
import { defaultControlLabels } from "./controls";
import type {
  NetworkMapControlLabels,
  NetworkMapControls,
  NetworkMapLayerVisibility,
} from "./types";
import styles from "./NetworkMap.module.scss";

type NetworkMapToolbarProps = {
  style?: CSSProperties;
  accessibleName: string;
  labelledBy?: string;
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
  style,
  accessibleName,
  labelledBy,
  controls,
  labels,
  ready,
  visibility,
  onVisibilityChange,
  onFitAll,
  onSelectedSegment,
  onLatestEvent,
}: NetworkMapToolbarProps) {
  const suffixId = useId();
  const externalLabel = labelledBy?.trim();
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
      style={style}
      role="group"
      aria-label={`${accessibleName} camera and layers`}
      aria-labelledby={
        externalLabel ? `${externalLabel} ${suffixId}` : undefined
      }
    >
      {externalLabel && (
        <span id={suffixId} hidden>
          camera and layers
        </span>
      )}
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
