import React, { ReactNode } from "react";
import ChevronRightIcon from "@easypost/easy-ui-icons/ChevronRight400";
import { AriaLabelingProps } from "@react-types/shared";
import { Disclosure, DisclosureProps } from "../Disclosure";
import { Icon } from "../Icon";
import styles from "./DrawerTable.module.scss";

export type DrawerRowProps = Omit<DisclosureProps, "children"> &
  AriaLabelingProps & {
    /** Visible summary. Use phrasing content without links or controls. */
    summary: ReactNode;
    /** Full-width inline details. The summary remains visible when expanded. */
    children: ReactNode;
    /** Independent actions beside the summary, never inside its button. */
    actions?: ReactNode;
    /** Disable the disclosure trigger without disabling independent actions. */
    isDisabled?: boolean;
  };

export function DrawerRow({
  summary,
  children,
  actions,
  isDisabled,
  mountPolicy = "unmount",
  ...props
}: DrawerRowProps) {
  const { isExpanded, defaultExpanded, onExpandedChange, ...labeling } = props;
  return (
    <Disclosure
      isExpanded={isExpanded}
      defaultExpanded={defaultExpanded}
      onExpandedChange={onExpandedChange}
      mountPolicy={mountPolicy}
    >
      <div className={styles.row}>
        <div className={styles.header}>
          <Disclosure.UnstyledTrigger
            {...labeling}
            className={styles.trigger}
            isDisabled={isDisabled}
          >
            <span className={styles.chevron} aria-hidden="true">
              <Icon symbol={ChevronRightIcon} size="sm" />
            </span>
            <span className={styles.summary}>{summary}</span>
          </Disclosure.UnstyledTrigger>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
        <Disclosure.Content className={styles.detail}>
          {children}
        </Disclosure.Content>
      </div>
    </Disclosure>
  );
}
