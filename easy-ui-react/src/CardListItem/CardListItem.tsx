import React from "react";
import type { ReactNode } from "react";
import { UnstyledButton } from "../UnstyledButton";

import styles from "./CardListItem.module.scss";

export interface CardListItemProps {
  children: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  testId?: string;
  ariaExpanded?: boolean;
}

export function CardListItem({
  children,
  selected = false,
  onSelect,
  testId,
  ariaExpanded,
}: CardListItemProps) {
  const cardClassName = selected
    ? `${styles.card} ${styles.selected}`
    : styles.card;

  if (!onSelect) {
    return (
      <li>
        <div className={cardClassName} data-testid={testId}>
          {children}
        </div>
      </li>
    );
  }

  return (
    <li>
      <UnstyledButton
        type="button"
        className={cardClassName}
        data-testid={testId}
        aria-current={selected}
        aria-expanded={ariaExpanded}
        onPress={onSelect}
      >
        {children}
      </UnstyledButton>
    </li>
  );
}
