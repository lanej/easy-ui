import { Key } from "@react-types/shared";
import React, { ReactNode, useLayoutEffect, useRef } from "react";
import { classNames } from "../utilities/css";

import styles from "./ExpandedRowContent.module.scss";

type ExpandedRowContentProps = {
  children: ReactNode;
  rowKey: Key;
  onFocusedUnmount: (rowKey: Key) => void;
};

export function ExpandedRowContent({
  children,
  rowKey,
  onFocusedUnmount,
}: ExpandedRowContentProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    return () => {
      // Layout cleanup runs before this subtree is removed. After removal the
      // browser's activeElement is already body, losing the source of focus.
      if (element?.contains(element.ownerDocument.activeElement)) {
        onFocusedUnmount(rowKey);
      }
    };
  }, [rowKey, onFocusedUnmount]);
  return (
    <div
      ref={ref}
      className={classNames(styles.ExpandedRowContent)}
      data-ezui-data-grid-expanded-row-content="active"
    >
      <div className={classNames(styles.inner)}>{children}</div>
    </div>
  );
}
