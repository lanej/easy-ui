import CancelIcon from "@easypost/easy-ui-icons/Cancel";
import React, { useCallback } from "react";
import { Icon } from "../Icon";
import { Text } from "../Text";
import { UnstyledButton } from "../UnstyledButton";
import { useDrawerTriggerContext } from "./context";

import styles from "./Drawer.module.scss";

export function DrawerCloseButton() {
  const drawerTriggerContext = useDrawerTriggerContext();

  const handleClick = useCallback(() => {
    drawerTriggerContext.state.close();
  }, [drawerTriggerContext.state]);

  if (!drawerTriggerContext.isDismissable) {
    return null;
  }

  return (
    <UnstyledButton className={styles.closeButton} onPress={handleClick}>
      <Text visuallyHidden>Close drawer</Text>
      <Icon symbol={CancelIcon} size="md" />
    </UnstyledButton>
  );
}
