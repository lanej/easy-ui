import React, { ReactNode } from "react";
import { Icon } from "../Icon";
import { Text } from "../Text";
import { IconSymbol } from "../types";
import styles from "./WorkspaceHeader.module.scss";

export type WorkspaceHeaderProps = {
  title: ReactNode;
  icon?: IconSymbol;
  navigation?: ReactNode;
  actions?: ReactNode;
};

export function WorkspaceHeader({
  title,
  icon,
  navigation,
  actions,
}: WorkspaceHeaderProps) {
  return (
    <header className={styles.header}>
      {navigation && <div className={styles.navigation}>{navigation}</div>}
      <div className={styles.identity}>
        {icon && <Icon symbol={icon} size="sm" />}
        <Text as="h1" variant="subtitle1">
          {title}
        </Text>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
