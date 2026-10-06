import CloseIcon from "@easypost/easy-ui-icons/Close";
import React, { useCallback } from "react";
import { Icon } from "../Icon";
import { Text } from "../Text";
import { UnstyledButton } from "../UnstyledButton";
import { useModalTriggerContext } from "./context";

import styles from "./Modal.module.scss";

export function ModalCloseButton() {
  const modalTriggerContext = useModalTriggerContext();

  const handleClick = useCallback(() => {
    modalTriggerContext.state.close();
  }, [modalTriggerContext.state]);

  if (!modalTriggerContext.isDismissable) {
    return null;
  }

  return (
    <UnstyledButton className={styles.closeBtn} onPress={handleClick}>
      <Text visuallyHidden>Close modal</Text>
      <Icon symbol={CloseIcon} size="sm" />
    </UnstyledButton>
  );
}
