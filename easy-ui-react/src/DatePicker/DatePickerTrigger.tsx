import React, { MutableRefObject, RefObject } from "react";
import CalendarMonth from "@easypost/easy-ui-icons/CalendarMonth";
import { GroupDOMAttributes } from "@react-types/shared";
import { AriaDatePickerProps, DateValue, AriaButtonProps } from "react-aria";
import { DatePickerState, DateRangePickerState } from "react-stately";
import Close from "@easypost/easy-ui-icons/Close";
import { Icon } from "../Icon";
import { UnstyledButton } from "../UnstyledButton";
import { DateFieldField } from "./DateField";
import { Text } from "../Text";
import { classNames } from "../utilities/css";
import styles from "./DatePicker.module.scss";

export type DatePickerTriggerProps = {
  isDisabled?: boolean;
  size?: "sm" | "md";
  triggerRef: MutableRefObject<null>;
  datePickerRef: RefObject<HTMLDivElement | null>;
  buttonProps: AriaButtonProps;
  groupProps: GroupDOMAttributes;
  startFieldProps?: AriaDatePickerProps<DateValue>;
  endFieldProps?: AriaDatePickerProps<DateValue>;
  fieldProps?: AriaDatePickerProps<DateValue>;
  isInvalid?: boolean;
  isReadOnly?: boolean;
  isClearable?: boolean;
  clearLabel?: string;
  state: DatePickerState | DateRangePickerState;
};

export function DatePickerTrigger(props: DatePickerTriggerProps) {
  const {
    isDisabled,
    size,
    triggerRef,
    datePickerRef,
    buttonProps,
    groupProps,
    startFieldProps,
    endFieldProps,
    fieldProps,
    isInvalid,
    isReadOnly,
    isClearable,
    clearLabel,
    state,
  } = props;

  const className = classNames(
    styles.datePickerTrigger,
    isInvalid && styles.errorInput,
    isDisabled && styles.disabled,
  );
  const hasValue =
    state.value &&
    ("start" in state.value
      ? state.value.start || state.value.end
      : state.value);

  return (
    <div className={className} ref={datePickerRef} {...groupProps}>
      <div className={styles.fields}>
        <DateFieldField {...(fieldProps ? fieldProps : startFieldProps)} />
        {endFieldProps && (
          <>
            <Text variant="caption" aria-hidden="true">
              &mdash;
            </Text>
            <DateFieldField {...endFieldProps} />
          </>
        )}
      </div>
      {isClearable && (
        <UnstyledButton
          aria-label={clearLabel}
          className={styles.iconButton}
          isDisabled={isDisabled || isReadOnly || !hasValue}
          onPress={() => {
            state.setValue(null);
            datePickerRef.current
              ?.querySelector<HTMLElement>('[role="spinbutton"]')
              ?.focus();
          }}
        >
          <Icon symbol={Close} size={size === "sm" ? "sm" : "md"} />
        </UnstyledButton>
      )}
      <UnstyledButton
        {...buttonProps}
        className={styles.iconButton}
        ref={triggerRef}
      >
        <Icon symbol={CalendarMonth} size={size === "sm" ? "sm" : "md"} />
      </UnstyledButton>
    </div>
  );
}
