import React, { type ReactNode } from "react";
import ExpandMoreIcon from "@easypost/easy-ui-icons/ExpandMore400";
import { Disclosure } from "../Disclosure";
import { Icon } from "../Icon";
import { classNames } from "../utilities/css";
import styles from "./ScoreComposition.module.scss";

/** Shared title affordance for signal and contribution disclosures. */
export function ScoreDisclosureTitle({
  children,
  accessibleLabel,
  descriptionId,
  className,
}: {
  children: ReactNode;
  accessibleLabel: string;
  descriptionId?: string;
  className?: string;
}) {
  return (
    <div className={classNames(styles.disclosureTitle, className)}>
      <Disclosure.Trigger
        variant="text"
        isBlock
        aria-label={accessibleLabel}
        aria-describedby={descriptionId}
      >
        <span className={styles.titleContent}>
          {children}
          <span className={styles.chevron}>
            <Icon symbol={ExpandMoreIcon} size="sm" />
          </span>
        </span>
      </Disclosure.Trigger>
    </div>
  );
}
