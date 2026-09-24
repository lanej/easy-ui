import { useState } from "react";
import type { NetworkMapLayerVisibility, NetworkMapProps } from "./types";

/** Each layer can independently be controlled by the application or by its built-in switch. */
export function useLayerVisibility(props: NetworkMapProps) {
  const [uncontrolled, setUncontrolled] = useState<NetworkMapLayerVisibility>(
    () => ({
      risk: props.defaultLayerVisibility?.risk ?? true,
      weather: props.defaultLayerVisibility?.weather ?? false,
      deliverySurface:
        props.defaultLayerVisibility?.deliverySurface ??
        props.initialDeliverySurfaceVisible ??
        false,
    }),
  );
  const visibility: NetworkMapLayerVisibility = {
    risk: props.layerVisibility?.risk ?? uncontrolled.risk,
    weather: props.layerVisibility?.weather ?? uncontrolled.weather,
    deliverySurface:
      props.layerVisibility?.deliverySurface ?? uncontrolled.deliverySurface,
  };
  const changeVisibility = (
    layer: keyof NetworkMapLayerVisibility,
    visible: boolean,
  ) => {
    if (props.layerVisibility?.[layer] === undefined) {
      setUncontrolled((previous) => ({ ...previous, [layer]: visible }));
    }
    props.onLayerVisibilityChange?.({ ...visibility, [layer]: visible });
  };
  return { visibility, changeVisibility };
}
