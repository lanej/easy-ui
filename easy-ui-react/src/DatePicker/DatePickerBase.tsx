import React, { DOMAttributes, ReactNode } from "react";
import { AriaDialogProps } from "react-aria";
import { DatePickerState, DateRangePickerState } from "react-stately";
import { FocusableElement } from "@react-types/shared";
import { DatePickerTrigger, DatePickerTriggerProps } from "./DatePickerTrigger";
import { Text } from "../Text";
import { DatePickerOverlay } from "./DatePickerOverlay";
import { Label } from "../InputField/Label";
import { logWarningForMissingAriaLabel } from "../InputField/utilities";
import { classNames, variationName } from "../utilities/css";
import styles from "./DatePicker.module.scss";

type TriggerProps = Omit<DatePickerTriggerProps, "triggerRef" | "state">;

type OverlayProps = {
  dialogProps: AriaDialogProps;
};

export type DatePickerProps = {
  "aria-label"?: string;
  label?: string;
  triggerProps: TriggerProps;
  overlayProps: OverlayProps;
  labelProps: DOMAttributes<FocusableElement>;
  children: ReactNode;
  state: DatePickerState | DateRangePickerState;
  description?: ReactNode;
  descriptionProps?: DOMAttributes<FocusableElement>;
  errorMessage?: ReactNode;
  errorMessageProps?: DOMAttributes<FocusableElement>;
};
export function DatePickerBase(props: DatePickerProps) {
  const {
    label,
    "aria-label": ariaLabel,
    triggerProps,
    overlayProps,
    labelProps,
    children,
    state,
    description,
    descriptionProps,
    errorMessage,
    errorMessageProps,
  } = props;
  const { size, isInvalid } = triggerProps;
  const triggerRef = React.useRef(null);

  logWarningForMissingAriaLabel(label, ariaLabel);

  const className = classNames(
    styles.DatePicker,
    size && styles[variationName("datePicker", size)],
  );
  return (
    <div className={className}>
      {label && (
        <Label fieldSize={size} hasError={isInvalid} {...labelProps}>
          {label}
        </Label>
      )}
      <DatePickerTrigger
        {...triggerProps}
        triggerRef={triggerRef}
        state={state}
      />
      {description && (
        <div {...descriptionProps} className={styles.caption}>
          <Text variant="caption" color="neutral.600">
            {description}
          </Text>
        </div>
      )}
      {isInvalid && errorMessage && (
        <div {...errorMessageProps} className={styles.caption}>
          <Text variant="caption" color="negative.700">
            {errorMessage}
          </Text>
        </div>
      )}
      <DatePickerOverlay
        {...overlayProps}
        triggerRef={triggerRef}
        state={state}
      >
        {children}
      </DatePickerOverlay>
    </div>
  );
}
