import React, { CSSProperties } from "react";
import { useId } from "react-aria";
import { Button } from "../Button";
import { Checkbox } from "../Checkbox";
import { RadioGroup } from "../RadioGroup";
import { defaultControlLabels } from "./controls";
import type {
  MapSurfaceMetric,
  MapOverlay,
  NetworkMapControlLabels,
  NetworkMapControls,
  NetworkMapLayerVisibility,
  NetworkMapToolbarControl,
} from "./types";
import styles from "./NetworkMap.module.scss";

type NetworkMapToolbarProps = {
  style?: CSSProperties;
  accessibleName: string;
  labelledBy?: string;
  controls: Required<NetworkMapControls>;
  labels?: Partial<NetworkMapControlLabels>;
  toolbarControls?: readonly NetworkMapToolbarControl[];
  overlays?: readonly MapOverlay[];
  onOverlayVisibilityChange?: (id: string, visible: boolean) => void;
  ready: boolean;
  visibility: NetworkMapLayerVisibility;
  onVisibilityChange: (
    layer: keyof NetworkMapLayerVisibility,
    visible: boolean,
  ) => void;
  onFitAll: () => void;
  onSelectedSegment: () => void;
  onLatestEvent: () => void;
  /** Delivery-surface metrics; the switcher renders only when at least one is supplied. */
  metrics?: readonly MapSurfaceMetric[];
  activeMetricKey?: string;
  onMetricChange?: (key: string) => void;
};

/** Only renders relevant controls; engine-owned navigation and scale are managed separately. */
export function NetworkMapToolbar({
  style,
  accessibleName,
  labelledBy,
  controls,
  labels,
  toolbarControls,
  overlays = [],
  onOverlayVisibilityChange,
  ready,
  visibility,
  onVisibilityChange,
  onFitAll,
  onSelectedSegment,
  onLatestEvent,
  metrics = [],
  activeMetricKey,
  onMetricChange,
}: NetworkMapToolbarProps) {
  const suffixId = useId();
  const metricSuffixId = useId();
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
  // Applicability of the surface itself (controls.deliverySurface) also gates its metric
  // switcher — a metric list with no supported cells to render is not worth switching between.
  const visibleMetrics = controls.deliverySurface ? metrics : [];
  const configured = toolbarControls?.filter((control) => {
    switch (control.type) {
      case "action":
        return controls[control.action];
      case "layer":
        return controls[control.layer];
      case "overlay":
        return overlays.some(
          (overlay) =>
            overlay.id === control.overlayId && overlay.layers.length > 0,
        );
      case "surfaceMetrics":
        return visibleMetrics.length > 0;
      case "button":
        return true;
    }
  });
  if (
    configured
      ? !configured.length
      : !visibleActions.length &&
        !visibleLayers.length &&
        !visibleMetrics.length
  )
    return null;
  if (configured) {
    const ids = new Set<string>();
    for (const control of toolbarControls!) {
      if (!control.id || ids.has(control.id))
        throw new Error("Map toolbar control IDs must be nonempty and unique");
      ids.add(control.id);
    }
  }
  const metricControls = (
    id: string,
    label: string,
    disabled: boolean,
    useExternalLabel = false,
  ) => (
    <RadioGroup.Container
      key={id}
      name={`${suffixId}-surface-metric-${id}`}
      value={activeMetricKey}
      isDisabled={disabled}
      onChange={onMetricChange}
      aria-label={useExternalLabel && externalLabel ? undefined : label}
      aria-labelledby={
        useExternalLabel && externalLabel
          ? `${externalLabel} ${metricSuffixId}`
          : undefined
      }
    >
      {useExternalLabel && externalLabel && (
        <span id={metricSuffixId} hidden>
          delivery surface metric
        </span>
      )}
      <div className={styles.buttons}>
        {visibleMetrics.map((metric) => (
          <RadioGroup.Item key={metric.key} value={metric.key}>
            <span className={styles.controlLabel}>{metric.label}</span>
          </RadioGroup.Item>
        ))}
      </div>
    </RadioGroup.Container>
  );
  const configuredControl = (control: NetworkMapToolbarControl) => {
    const disabled = !ready || control.disabled === true;
    if (control.type === "surfaceMetrics")
      return metricControls(control.id, control.label, disabled);
    if (control.type === "action" || control.type === "button") {
      const onClick =
        control.type === "button"
          ? control.onPress
          : cameraActions.find(({ key }) => key === control.action)!.onClick;
      return (
        <Button
          key={control.id}
          size="sm"
          variant="outlined"
          type="button"
          isDisabled={disabled}
          onPress={onClick}
        >
          <span className={styles.controlLabel}>{control.label}</span>
        </Button>
      );
    }
    const visible =
      control.type === "overlay"
        ? overlays.find((overlay) => overlay.id === control.overlayId)!
            .visible !== false
        : visibility[control.layer];
    return (
      <Checkbox
        key={control.id}
        isSelected={visible}
        isDisabled={disabled}
        onChange={(nextVisible) => {
          if (control.type === "overlay")
            onOverlayVisibilityChange?.(control.overlayId, nextVisible);
          else onVisibilityChange(control.layer, nextVisible);
        }}
      >
        <span className={styles.controlLabel}>{control.label}</span>
      </Checkbox>
    );
  };

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
      {configured && (
        <div className={styles.buttons}>
          {configured.map(configuredControl)}
        </div>
      )}
      {!configured && visibleActions.length > 0 && (
        <div className={styles.buttons}>
          {visibleActions.map(({ key, onClick }) => (
            <Button
              key={key}
              size="sm"
              variant="outlined"
              type="button"
              onPress={onClick}
              isDisabled={!ready}
            >
              <span className={styles.controlLabel}>
                {labels?.[key] ?? defaultControlLabels[key]}
              </span>
            </Button>
          ))}
        </div>
      )}
      {!configured && visibleLayers.length > 0 && (
        <div className={styles.buttons}>
          {visibleLayers.map((key) => (
            <Checkbox
              key={key}
              isSelected={visibility[key]}
              isDisabled={!ready}
              onChange={(visible) => onVisibilityChange(key, visible)}
            >
              <span className={styles.controlLabel}>
                {labels?.[key] ?? defaultControlLabels[key]}
              </span>
            </Checkbox>
          ))}
        </div>
      )}
      {!configured &&
        visibleMetrics.length > 0 &&
        metricControls(
          "surface",
          `${accessibleName} delivery surface metric`,
          !ready,
          true,
        )}
    </div>
  );
}
