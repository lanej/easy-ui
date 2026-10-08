import React from "react";
import { Meta, StoryObj } from "@storybook/react-vite";
import { today, getLocalTimeZone, CalendarDate } from "@internationalized/date";
import { DateRange } from "react-aria";
import { InputDecorator } from "../utilities/storybook";
import { TextField } from "../TextField";
import { DateRangePicker, DateRangePickerProps } from "./DateRangePicker";
import { Button } from "../Button";
import { Text } from "../Text";
import { VerticalStack } from "../VerticalStack";

type Story = StoryObj<typeof DateRangePicker>;

const meta: Meta<typeof DateRangePicker> = {
  id: "components-datepicker-daterangepicker",
  title: "Molecules/Forms/DateRangePicker",
  component: DateRangePicker,
  args: { "aria-label": "Range date picker" },
  decorators: [InputDecorator],
};

export default meta;

const Template = (args: DateRangePickerProps) => <DateRangePicker {...args} />;

export const Standalone: Story = {
  render: Template.bind({}),
};

export const DefaultValue: Story = {
  render: Template.bind({}),
  args: {
    defaultValue: {
      start: today(getLocalTimeZone()).subtract({ days: 7 }),
      end: today(getLocalTimeZone()),
    },
  },
};

export const Label: Story = {
  render: () => (
    <>
      <TextField label="Text field" placeholder="Placeholder text" />
      <DateRangePicker label="Date range picker" />
      <DateRangePicker size="sm" label="Small date range picker" />
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
    const [date, setDate] = React.useState<DateRange | null>(null);
    return (
      <DateRangePicker
        value={date}
        onChange={setDate}
        aria-label="Range date picker"
      />
    );
  },
};

export const InvalidSelection: Story = {
  render: () => {
    const [date, setDate] = React.useState<DateRange | null>({
      start: today(getLocalTimeZone()).subtract({ days: 7 }),
      end: today(getLocalTimeZone()),
    });

    const isInvalid = date ? date.end.compare(date.start) >= 7 : false;

    return (
      <DateRangePicker
        aria-label="Range date picker"
        value={date}
        onChange={setDate}
        isInvalid={isInvalid}
        errorMessage={isInvalid && "Limit to max 7 days selection"}
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

function ReviewPeriodForm() {
  const [submitted, setSubmitted] = React.useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setSubmitted(`${data.get("startDate")} – ${data.get("endDate")}`);
      }}
    >
      <VerticalStack gap="2">
        <DateRangePicker
          label="Review period"
          startName="startDate"
          endName="endDate"
          description="Choose a period in October 2026."
          defaultValue={{
            start: new CalendarDate(2026, 10, 6),
            end: new CalendarDate(2026, 10, 13),
          }}
          minValue={new CalendarDate(2026, 10, 1)}
          maxValue={new CalendarDate(2026, 10, 31)}
          isClearable
          isRequired
          validationBehavior="native"
          errorMessage="Choose a valid period in October 2026."
        />
        <Button type="submit">Apply period</Button>
        <Text aria-live="polite">
          {submitted ? `Submitted: ${submitted}` : "No period submitted."}
        </Text>
      </VerticalStack>
    </form>
  );
}

export const Form: Story = {
  render: () => <ReviewPeriodForm />,
};

export const ReadOnly: Story = {
  args: {
    label: "Review period",
    defaultValue: {
      start: new CalendarDate(2026, 10, 6),
      end: new CalendarDate(2026, 10, 13),
    },
    isReadOnly: true,
    isClearable: true,
  },
};
