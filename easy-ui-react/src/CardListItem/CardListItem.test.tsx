import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CardListItem } from "./CardListItem";
import styles from "./CardListItem.module.scss";

function renderInList(children: React.ReactNode) {
  return render(<ul>{children}</ul>);
}

describe("CardListItem", () => {
  it("renders as a non-interactive div when onSelect is omitted", () => {
    renderInList(<CardListItem testId="card-1">Plain content</CardListItem>);
    const card = screen.getByTestId("card-1");
    expect(card.tagName).toBe("DIV");
    expect(card).not.toHaveAttribute("role", "button");
    expect(card).not.toHaveAttribute("aria-current");
  });

  it("renders as a button and fires onSelect on click when onSelect is provided", () => {
    const onSelect = vi.fn();
    renderInList(
      <CardListItem testId="card-1" onSelect={onSelect}>
        Tappable content
      </CardListItem>,
    );
    const card = screen.getByTestId("card-1");
    expect(card.tagName).toBe("BUTTON");
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("fires onSelect on Enter/Space keydown via native button semantics", async () => {
    const onSelect = vi.fn();
    renderInList(
      <CardListItem testId="card-1" onSelect={onSelect}>
        Tappable content
      </CardListItem>,
    );
    screen.getByTestId("card-1").focus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    await userEvent.keyboard(" ");
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("marks the interactive card as selected via aria-current and the selected class", () => {
    renderInList(
      <CardListItem testId="card-1" onSelect={vi.fn()} selected>
        Selected content
      </CardListItem>,
    );
    const card = screen.getByTestId("card-1");
    expect(card).toHaveAttribute("aria-current", "true");
    expect(card).toHaveClass(styles.selected);
  });

  it("does not add aria-current to the non-interactive div variant even when selected is true", () => {
    renderInList(
      <CardListItem testId="card-1" selected>
        Plain content
      </CardListItem>,
    );
    const card = screen.getByTestId("card-1");
    expect(card.tagName).toBe("DIV");
    expect(card).not.toHaveAttribute("aria-current");
    expect(card).toHaveClass(styles.selected);
  });

  it("wraps the card in a single <li>", () => {
    const { container } = renderInList(
      <CardListItem testId="card-1">Content</CardListItem>,
    );
    const listItems = container.querySelectorAll("li");
    expect(listItems).toHaveLength(1);
    expect(listItems[0].querySelector('[data-testid="card-1"]')).not.toBeNull();
  });
  it("does not render aria-expanded when the prop is omitted (existing callers unaffected)", () => {
    renderInList(
      <CardListItem testId="card-1" onSelect={vi.fn()}>
        Tappable content
      </CardListItem>,
    );
    expect(screen.getByTestId("card-1")).not.toHaveAttribute("aria-expanded");
  });

  it("renders aria-expanded on the interactive card when explicitly provided", () => {
    renderInList(
      <CardListItem testId="card-1" onSelect={vi.fn()} ariaExpanded>
        Tappable content
      </CardListItem>,
    );
    expect(screen.getByTestId("card-1")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("renders aria-expanded=false distinctly from omitted when explicitly false", () => {
    renderInList(
      <CardListItem testId="card-1" onSelect={vi.fn()} ariaExpanded={false}>
        Tappable content
      </CardListItem>,
    );
    expect(screen.getByTestId("card-1")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
