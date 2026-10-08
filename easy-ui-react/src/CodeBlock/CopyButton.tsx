import ContentCopyIcon from "@easypost/easy-ui-icons/ContentCopy";
import React, { useCallback } from "react";
import { useHover } from "react-aria";
import { useTooltipTriggerState } from "react-stately";
import { useClipboard } from "use-clipboard-copy";
import { Icon } from "../Icon";
import { Text } from "../Text";
import { Tooltip } from "../Tooltip";
import { UnstyledButton } from "../UnstyledButton";

import styles from "./CopyButton.module.scss";

export type CopyButtonProps = {
  text: string;
};

export function CopyButton({ text }: CopyButtonProps) {
  const clipboard = useClipboard({ copiedTimeout: 2000 });
  const { tooltipState, triggerProps } = useCopyButtonTooltipState();
  const handlePress = useCallback(() => {
    clipboard.copy(text);
    tooltipState.close();
  }, [clipboard, text, tooltipState]);
  const content = clipboard.copied ? "Copied!" : "Copy code block";
  return (
    <Tooltip
      key={content}
      isOpen={tooltipState.isOpen || clipboard.copied}
      content={content}
    >
      <UnstyledButton
        className={styles.CopyButton}
        onPress={handlePress}
        {...triggerProps}
      >
        <Text visuallyHidden>Copy code</Text>
        <Icon symbol={ContentCopyIcon} />
      </UnstyledButton>
    </Tooltip>
  );
}

CopyButton.displayName = "CopyButton";

function useCopyButtonTooltipState() {
  const tooltipState = useTooltipTriggerState();
  const { hoverProps } = useHover({
    onHoverChange(isHovering) {
      tooltipState[isHovering ? "open" : "close"]();
    },
  });
  return {
    triggerProps: {
      onPointerEnter: hoverProps.onPointerEnter,
      onPointerLeave: hoverProps.onPointerLeave,
      onMouseEnter: hoverProps.onMouseEnter,
      onMouseLeave: hoverProps.onMouseLeave,
      onTouchStart: hoverProps.onTouchStart,
      onFocusChange(isFocused: boolean) {
        tooltipState[isFocused ? "open" : "close"]();
      },
    },
    tooltipState,
  };
}
