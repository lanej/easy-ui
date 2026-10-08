import React from "react";
import { Meta, StoryObj } from "@storybook/react-vite";
import { useLocale, DateValue, MappedDateValue } from "react-aria";
import {
  today,
  getLocalTimeZone,
  isWeekend,
  endOfWeek,
  CalendarDate,
} from "@internationalized/date";
import { I18nProvider } from "react-aria";
import { Button } from "../Button";
import { Text } from "../Text";
import { VerticalStack } from "../VerticalStack";
import { InputDecorator } from "../utilities/storybook";
import { TextField } from "../TextField";
import { DatePicker, DatePickerProps } from "./DatePicker";

type Story = StoryObj<typeof DatePicker>;

const meta: Meta<typeof DatePicker> = {
  id: "components-datepicker-datepicker",
  title: "Molecules/Forms/DatePicker",
  args: { "aria-label": "Date picker" },
  component: DatePicker,
  decorators: [InputDecorator],
};

export default meta;

const Template = (args: DatePickerProps) => <DatePicker {...args} />;

export const Standalone: Story = {
  render: Template.bind({}),
};

export const DefaultValue: Story = {
  render: Template.bind({}),
  args: {
    defaultValue: today(getLocalTimeZone()),
  },
};

export const Label: Story = {
  render: () => (
    <>
      <TextField label="Text field" placeholder="Placeholder text" />
      <DatePicker label="Date picker" />
      <DatePicker size="sm" label="Small date picker" />
    </>
  ),
};

export const Sizes: Story = {
  render: Template.bind({}),
  args: {
    size: "sm",
  },
};

export const LimitAvailableDates: Story = {
  render: Template.bind({}),
  args: {
    minValue: today(getLocalTimeZone()).subtract({ days: 10 }),
    maxValue: today(getLocalTimeZone()),
  },
};

export const DatesAvailability: Story = {
  render: Template.bind({}),
  args: {
    isDateUnavailable: (date) => today(getLocalTimeZone()).compare(date) > 0,
  },
};

export const ControlledSelection: Story = {
  render: () => {
    const [date, setDate] = React.useState<MappedDateValue<DateValue> | null>(
      null,
    );
    return (
      <DatePicker value={date} onChange={setDate} aria-label="Date picker" />
    );
  },
};

export const InvalidSelection: Story = {
  render: () => {
    const { locale } = useLocale();
    const [date, setDate] = React.useState<MappedDateValue<DateValue> | null>(
      endOfWeek(today(getLocalTimeZone()), locale),
    );

    const isInvalid = date ? isWeekend(date, locale) : false;

    return (
      <DatePicker
        aria-label="Date picker"
        value={date}
        onChange={setDate}
        isInvalid={isInvalid}
        errorMessage={isInvalid && "Weekend is not available"}
      />
    );
  },
};

export const Disabled: Story = {
  render: Template.bind({}),
  args: {
    isDisabled: true,
  },
};

function ReviewDateForm() {
  const [submitted, setSubmitted] = React.useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(
          String(new FormData(event.currentTarget).get("reviewDate")),
        );
      }}
    >
      <VerticalStack gap="2">
        <DatePicker
          label="Review date"
          name="reviewDate"
          description="Choose a date in October 2026."
          defaultValue={new CalendarDate(2026, 10, 6)}
          minValue={new CalendarDate(2026, 10, 1)}
          maxValue={new CalendarDate(2026, 10, 31)}
          isClearable
          isRequired
          validationBehavior="native"
          errorMessage="Choose a date in October 2026."
        />
        <Button type="submit">Apply date</Button>
        <Text aria-live="polite">
          {submitted ? `Submitted: ${submitted}` : "No date submitted."}
        </Text>
      </VerticalStack>
    </form>
  );
}

export const Form: Story = {
  render: () => <ReviewDateForm />,
};

export const ReadOnly: Story = {
  args: {
    label: "Review date",
    defaultValue: new CalendarDate(2026, 10, 6),
    isReadOnly: true,
    isClearable: true,
  },
};

export const Localized: Story = {
  render: () => (
    <I18nProvider locale="fr-FR">
      <DatePicker
        label="Date de révision"
        defaultValue={new CalendarDate(2026, 10, 6)}
        isClearable
        clearLabel="Effacer la date"
      />
    </I18nProvider>
  ),
};
