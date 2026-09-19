import ArrowForwardIos from "@easypost/easy-ui-icons/ArrowForwardIos";
import { Key } from "@react-types/shared";
import React, { ReactNode } from "react";
import { Icon } from "../Icon";
import { UnstyledButton } from "../UnstyledButton";
import { classNames } from "../utilities/css";
import styles from "./GroupToggleCellContent.module.scss";

export function GroupToggleCellContent({
  children,
  groupKey,
  isCollapsed,
  onToggle,
}: {
  children: ReactNode;
  groupKey: Key;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <span className={styles.content}>
      <UnstyledButton
        type="button"
        className={classNames(styles.button, !isCollapsed && styles.expanded)}
        aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${groupKey} group`}
        aria-expanded={!isCollapsed}
        onPress={onToggle}
      >
        <Icon symbol={ArrowForwardIos} size="xs" />
      </UnstyledButton>
      {children}
    </span>
  );
}
