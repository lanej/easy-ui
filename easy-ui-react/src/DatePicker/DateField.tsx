import React from "react";
import {
  useDateField,
  useDateSegment,
  useLocale,
  DateValue,
  AriaDateFieldProps,
} from "react-aria";
import {
  useDateFieldState,
  DateFieldState,
  DateSegment as DateSegmentType,
} from "react-stately";
import { createCalendar } from "@internationalized/date";
import { classNames } from "../utilities/css";

import styles from "./DatePicker.module.scss";

type DateFieldFieldProps = AriaDateFieldProps<DateValue>;
export function DateFieldField(props: DateFieldFieldProps) {
  const dateFieldRef = React.useRef(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { locale } = useLocale();
  const state = useDateFieldState({ ...props, locale, createCalendar });
  const { fieldProps, inputProps } = useDateField(
    { ...props, inputRef },
    state,
    dateFieldRef,
  );

  return (
    <div {...fieldProps} ref={dateFieldRef} className={styles.dateField}>
      {state.segments.map((segment, i) => (
        <DateSegment key={i} segment={segment} state={state} />
      ))}
      <input {...inputProps} readOnly={props.isReadOnly} ref={inputRef} />
    </div>
  );
}

type DateSegmentProps = {
  segment: DateSegmentType;
  state: DateFieldState;
};

function DateSegment(props: DateSegmentProps) {
  const { segment, state } = props;
  const { type } = segment;
  const dateSegmentRef = React.useRef(null);
  const { segmentProps } = useDateSegment(segment, state, dateSegmentRef);

  return (
    <div
      {...segmentProps}
      ref={dateSegmentRef}
      className={classNames(
        styles.DateSegment,
        type === "literal" && !state.value && styles.literalSegment,
      )}
    >
      {segment.text}
    </div>
  );
}
