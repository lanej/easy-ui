import React, { ReactNode } from "react";
import {
  useDateRangePicker,
  DateValue,
  AriaDateRangePickerProps,
} from "react-aria";
import { useDateRangePickerState } from "react-stately";
import { RangeCalendar } from "../RangeCalendar";
import { DatePickerBase } from "../DatePicker/DatePickerBase";

export type DateRangePickerProps = Omit<
  AriaDateRangePickerProps<DateValue>,
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
  /** Show a separate button that requests an empty range. Defaults to false. */
  isClearable?: boolean;
  /** Accessible clear-button label. Defaults to "Clear date range". */
  clearLabel?: string;
  /**
   * The size of the DateRangePicker.
   * @default md
   */
  size?: "sm" | "md";
};

/**
 * A `DateRangePicker` has a `DateField` and a calendar popover
 * to allow users to enter or select a date.
 *
 * @remarks
 * Use a DateRangePicker when you want to provide a view that
 * allows the users to select a date.
 *
 * @example
 * _Standalone:_
 * ```tsx
 * import { DateRangePicker } from "@easypost/easy-ui/DateRangePicker";
 *
 * function PageWithDateRangePicker() {
 *   return <DateRangePicker />;
 * }
 * ```
 *
 * @example
 * _Controlled:_
 * ```tsx
 * import { DateRangePicker } from "@easypost/easy-ui/DateRangePicker";
 *
 * function PageWithDateRangePicker() {
 *   const [date, setDate] = React.useState(null);
 *   return (
 *      <DateRangePicker value={date} onChange={setDate}
 *      aria-label="Date picker" />
 *    );
 * }
 * ```
 */
export function DateRangePicker(props: DateRangePickerProps) {
  const {
    label,
    size = "md",
    isDisabled,
    errorMessage,
    description,
    isClearable,
    clearLabel = "Clear date range",
    "aria-label": ariaLabel,
  } = props;
  const datePickerRef = React.useRef<HTMLDivElement>(null);
  const state = useDateRangePickerState(props);
  const {
    groupProps,
    labelProps,
    startFieldProps,
    endFieldProps,
    buttonProps,
    dialogProps,
    calendarProps,
    descriptionProps,
    errorMessageProps,
    isInvalid,
  } = useDateRangePicker(props, state, datePickerRef);

  const triggerProps = {
    datePickerRef,
    buttonProps,
    groupProps,
    startFieldProps,
    endFieldProps,
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
      <RangeCalendar {...calendarProps} isInvalid={false} />
    </DatePickerBase>
  );
}
