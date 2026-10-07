import React, { ReactNode } from "react";
import { useDatePicker, DateValue, AriaDatePickerProps } from "react-aria";
import { useDatePickerState } from "react-stately";
import { DatePickerBase } from "./DatePickerBase";
import { Calendar } from "../Calendar";

export type DatePickerProps = Omit<
  AriaDatePickerProps<DateValue>,
  "label" | "errorMessage"
> & {
  /**
   * The content to display as the label.
   */
  label?: string;
  /**
   * An error message to display when the selected value is invalid.
   */
  errorMessage?: ReactNode;
  /** Show a separate button that requests an empty value. Defaults to false. */
  isClearable?: boolean;
  /** Accessible clear-button label. Defaults to "Clear date". */
  clearLabel?: string;
  /**
   * The size of the DatePicker.
   * @default md
   */
  size?: "sm" | "md";
};

/**
 * A `DatePicker` has a `DateField` and a calendar popover to
 * allow users to enter or select a date.
 *
 * @remarks
 * Use a DatePicker when you want to provide a view that allows
 * the users to select a date.
 *
 * @example
 * _Standalone:_
 * ```tsx
 * import { DatePicker } from "@easypost/easy-ui/DatePicker";
 *
 * function PageWithDatePicker() {
 *   return <DatePicker />;
 * }
 * ```
 *
 * @example
 * _Controlled:_
 * ```tsx
 * import { DatePicker } from "@easypost/easy-ui/DatePicker";
 *
 * function PageWithDatePicker() {
 *   const [date, setDate] = React.useState(null);
 *   return (
 *      <DatePicker value={date} onChange={setDate}
 *      aria-label="Date picker" />
 *    );
 * }
 * ```
 */
export function DatePicker(props: DatePickerProps) {
  const {
    label,
    size = "md",
    isDisabled,
    errorMessage,
    description,
    isClearable,
    clearLabel = "Clear date",
    "aria-label": ariaLabel,
  } = props;
  const datePickerRef = React.useRef<HTMLDivElement>(null);
  const state = useDatePickerState(props);
  const {
    groupProps,
    labelProps,
    fieldProps,
    buttonProps,
    dialogProps,
    calendarProps,
    descriptionProps,
    errorMessageProps,
    isInvalid,
  } = useDatePicker(props, state, datePickerRef);

  const triggerProps = {
    datePickerRef,
    buttonProps,
    groupProps,
    fieldProps,
    isDisabled,
    size,
    isInvalid,
    isReadOnly: props.isReadOnly,
    isClearable,
    clearLabel,
  };
  const overlayProps = { dialogProps };

  return (
    <DatePickerBase
      labelProps={labelProps}
      triggerProps={triggerProps}
      overlayProps={overlayProps}
      state={state}
      label={label}
      aria-label={ariaLabel}
      description={description}
      descriptionProps={descriptionProps}
      errorMessage={errorMessage ?? calendarProps.errorMessage}
      errorMessageProps={errorMessageProps}
    >
      {/** When DatePicker is invalid, error message display under both DatePicker and Calendar. Set calendar to valid prevent error message displaying twice  */}
      <Calendar {...calendarProps} isInvalid={false} />
    </DatePickerBase>
  );
}

DatePicker.displayName = "DatePicker";
