import React from "react";
import { useId } from "react-aria";
import { Button } from "../Button";
import { useNetworkMap } from "./NetworkMapContext";
import { validCoordinate } from "./geometry";
import { visualizationTypographyStyle } from "../visualization/typography";
import styles from "./NetworkMapZoomSections.module.scss";

/** Focus controls for caller-defined location groups within one map surface. */
export function NetworkMapZoomSections() {
  const {
    props: options,
    controls,
    state,
    commands,
    accessibleName,
    activeZoomSectionId,
  } = useNetworkMap();
  const descriptionId = useId();
  if (!options.zoomSections?.length || options.controls === false) return null;
  const ids = new Set<string>();
  for (const section of options.zoomSections) {
    if (!section.id || ids.has(section.id))
      throw new Error("Map zoom section IDs must be nonempty and unique");
    ids.add(section.id);
  }
  const mappedIds = new Set(
    options.facilities
      .filter((facility) => validCoordinate(facility.coordinates))
      .map((facility) => facility.id),
  );
  const active = options.zoomSections.find(
    (section) => section.id === activeZoomSectionId,
  );
  const unavailable = options.zoomSections.filter(
    (section) => !section.facilityIds.some((id) => mappedIds.has(id)),
  );
  const configuredFitAll = options.toolbarControls?.some(
    (control) => control.type === "action" && control.action === "fitAll",
  );
  return (
    <div
      className={styles.sections}
      data-map-zoom-sections
      role="group"
      aria-label={`${accessibleName} map views`}
      style={visualizationTypographyStyle(options.typography)}
    >
      <div className={styles.buttons}>
        {controls.fitAll && !configuredFitAll && (
          <Button
            size="sm"
            variant={activeZoomSectionId === null ? "filled" : "outlined"}
            type="button"
            isDisabled={state !== "ready"}
            aria-pressed={activeZoomSectionId === null}
            onPress={() => commands.current.fitAll()}
          >
            <span className={styles.label}>
              {options.controlLabels?.fitAll ?? "Entire journey"}
            </span>
          </Button>
        )}
        {options.zoomSections.map((section) => (
          <span key={section.id} data-map-zoom-section={section.id}>
            <Button
              size="sm"
              variant={active?.id === section.id ? "filled" : "outlined"}
              type="button"
              isDisabled={state !== "ready" || unavailable.includes(section)}
              aria-pressed={active?.id === section.id}
              aria-describedby={
                active?.id === section.id && active.description
                  ? descriptionId
                  : undefined
              }
              onPress={() => commands.current.zoomSection(section.id)}
            >
              <span className={styles.label}>{section.title}</span>
            </Button>
          </span>
        ))}
      </div>
      <div className={styles.description} aria-live="polite">
        {active?.description && <p id={descriptionId}>{active.description}</p>}
        {unavailable.map((section) => (
          <p key={section.id}>
            {section.title}: No mapped locations in this section.
          </p>
        ))}
      </div>
    </div>
  );
}
