import React from "react";
import { CalendarDate } from "@internationalized/date";
import { screen } from "@testing-library/react";
import { render, userClick } from "../utilities/test";
import { DatePicker, DatePickerProps } from "./DatePicker";
import { DateRangePicker } from "../DateRangePicker";

type TestProps = Pick<
  DatePickerProps,
  "isReadOnly" | "isDisabled" | "isInvalid" | "onChange"
>;

function SinglePicker(props: TestProps) {
  return (
    <DatePicker
      label="Review date"
      name="reviewDate"
      defaultValue={new CalendarDate(2026, 10, 6)}
      description="Choose the review date."
      errorMessage="Choose an available date."
      isClearable
      {...props}
    />
  );
}

function RangePicker(props: Omit<TestProps, "onChange">) {
  return (
    <DateRangePicker
      label="Review period"
      startName="startDate"
      endName="endDate"
      defaultValue={{
        start: new CalendarDate(2026, 10, 6),
        end: new CalendarDate(2026, 10, 13),
      }}
      description="Choose the review period."
      errorMessage="Choose an available date."
      isClearable
      {...props}
    />
  );
}

const cases = [
  {
    Picker: SinglePicker,
    label: "Review date",
    clear: "Clear date",
    values: [["reviewDate", "2026-10-06"]],
  },
  {
    Picker: RangePicker,
    label: "Review period",
    clear: "Clear date range",
    values: [
      ["startDate", "2026-10-06"],
      ["endDate", "2026-10-13"],
    ],
  },
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe.each(cases)("$label", ({ Picker, label, clear, values }) => {
  it("keeps editable segments outside buttons and submits ISO calendar dates", () => {
    const { container } = render(
      <form>
        <Picker />
      </form>,
    );
    for (const segment of screen.getAllByRole("spinbutton")) {
      expect(segment.closest("button")).toBeNull();
    }
    const form = container.querySelector("form")!;
    const data = new FormData(form);
    expect(Array.from(data.entries())).toEqual(values);
    expect(
      screen.getByRole("group", { name: label }),
    ).toHaveAccessibleDescription(/Choose the review/);
  });

  it("edits from the keyboard without opening the calendar", async () => {
    const { user, container } = render(
      <form>
        <Picker />
      </form>,
    );
    screen.getAllByRole("spinbutton", { name: /month/i })[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      new FormData(container.querySelector("form")!).get(values[0][0]),
    ).toBe("2026-09-06");
  });

  it("clears the value independently and focuses the first segment", async () => {
    const { user, container } = render(
      <form>
        <Picker />
      </form>,
    );
    await userClick(user, screen.getByRole("button", { name: clear }));
    const data = new FormData(container.querySelector("form")!);
    for (const [name] of values) {
      expect(data.get(name)).toBe("");
    }
    expect(screen.getAllByRole("spinbutton")[0]).toHaveFocus();
    expect(screen.getByRole("button", { name: clear })).toBeDisabled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("links errors to the field without duplicating them in the calendar", async () => {
    const { user } = render(<Picker isInvalid />);
    const error = screen.getByText("Choose an available date.").parentElement!;
    const group = screen.getByRole("group", { name: label });
    expect(group.getAttribute("aria-describedby")?.split(" ")).toContain(
      error.id,
    );
    await userClick(user, screen.getByRole("button", { name: /calendar/i }));
    expect(screen.getAllByText("Choose an available date.")).toHaveLength(1);
    expect(screen.getByRole("dialog")).toHaveAccessibleName(/Calendar/);
  });

  it("restores calendar-trigger focus after Escape", async () => {
    const { user } = render(<Picker />);
    const trigger = screen.getByRole("button", { name: /calendar/i });
    await userClick(user, trigger);
    expect(screen.getByRole("dialog")).toContainElement(
      document.activeElement as HTMLElement,
    );
    await user.keyboard("{Escape}");
    vi.runAllTimers();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("keeps read-only values submittable without edit or clear controls", () => {
    const { container } = render(
      <form>
        <Picker isReadOnly />
      </form>,
    );
    expect(screen.getByRole("button", { name: /calendar/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: clear })).toBeDisabled();
    expect(
      Array.from(new FormData(container.querySelector("form")!).entries()),
    ).toEqual(values);
  });

  it("omits disabled values from form submission", () => {
    const { container } = render(
      <form>
        <Picker isDisabled />
      </form>,
    );
    expect(screen.getByRole("button", { name: /calendar/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: clear })).toBeDisabled();
    expect(
      Array.from(new FormData(container.querySelector("form")!).entries()),
    ).toEqual([]);
  });

  it("does not validate an empty read-only native form input", () => {
    const { container } = render(
      <form>
        {values.length === 1 ? (
          <DatePicker
            label={label}
            name={values[0][0]}
            isReadOnly
            isRequired
            validationBehavior="native"
          />
        ) : (
          <DateRangePicker
            label={label}
            startName={values[0][0]}
            endName={values[1][0]}
            isReadOnly
            isRequired
            validationBehavior="native"
          />
        )}
      </form>,
    );
    expect(container.querySelector("form")!.checkValidity()).toBe(true);
    for (const input of container.querySelectorAll("input")) {
      expect(input.readOnly).toBe(true);
      expect(input.willValidate).toBe(false);
    }
  });

  it("renders the final week when the first weekday differs from the locale", async () => {
    const { user } = render(
      values.length === 1 ? (
        <DatePicker
          label={label}
          defaultValue={new CalendarDate(2026, 2, 6)}
          firstDayOfWeek="mon"
        />
      ) : (
        <DateRangePicker
          label={label}
          defaultValue={{
            start: new CalendarDate(2026, 2, 6),
            end: new CalendarDate(2026, 2, 13),
          }}
          firstDayOfWeek="mon"
        />
      ),
    );
    await userClick(user, screen.getByRole("button", { name: /calendar/i }));
    expect(
      screen.getByRole("button", { name: /Saturday, February 28, 2026/ }),
    ).toBeInTheDocument();
  });
});

it("requests controlled clearing without changing an unaccepted value", async () => {
  const onChange = vi.fn();
  const { user, rerender } = render(
    <DatePicker
      label="Controlled date"
      value={new CalendarDate(2026, 10, 6)}
      onChange={onChange}
      isClearable
    />,
  );
  await userClick(user, screen.getByRole("button", { name: "Clear date" }));
  expect(onChange).toHaveBeenLastCalledWith(null);
  expect(screen.getByRole("spinbutton", { name: /day/i })).toHaveValue(6);
  rerender(
    <DatePicker
      label="Controlled date"
      value={null}
      onChange={onChange}
      isClearable
    />,
  );
  expect(screen.getByRole("button", { name: "Clear date" })).toBeDisabled();
});
