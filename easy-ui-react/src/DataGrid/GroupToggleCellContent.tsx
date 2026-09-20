import ArrowForwardIos from "@easypost/easy-ui-icons/ArrowForwardIos";
import React, { ReactNode } from "react";
import { Icon } from "../Icon";
import { UnstyledButton } from "../UnstyledButton";
import { classNames } from "../utilities/css";
import styles from "./GroupToggleCellContent.module.scss";

export function GroupToggleCellContent({
  children,
  groupLabel,
  isCollapsed,
  onToggle,
}: {
  children: ReactNode;
  groupLabel: string;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <span className={styles.content}>
      <UnstyledButton
        type="button"
        className={classNames(styles.button, !isCollapsed && styles.expanded)}
        aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${groupLabel} group`}
        data-ezui-data-grid-group-toggle="true"
        aria-expanded={!isCollapsed}
        onPress={onToggle}
      >
        <Icon symbol={ArrowForwardIos} size="xs" />
      </UnstyledButton>
      {children}
    </span>
  );
}
