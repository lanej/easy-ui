import React, {
  Key,
  RefObject,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from "react";
import { CSSTransition } from "react-transition-group";
import styles from "./NotificationTransition.module.scss";

type ChildrenFunction<T> = (args: T) => ReactNode;

export type NotificationTransitionProps = {
  /**
   * Children function that receives a ref to the node being transitioned.
   */
  children: ChildrenFunction<{
    nodeRef: RefObject<HTMLDivElement | null>;
    isExiting: boolean;
    isEntered: boolean;
  }>;

  /**
   * Unique key for the transition.
   */
  transitionKey: Key;

  /**
   * Callback function used to track the transition state of the notification.
   */
  onTransitionPendingChange?: (isTransitionPending: boolean) => void;
};

export function NotificationTransition({
  children,
  transitionKey,
  onTransitionPendingChange = () => {},
  ...transitionGroupProps
}: NotificationTransitionProps) {
  const nodeRef = React.useRef<HTMLDivElement>(null);
  const removeEndListener = React.useRef<(() => void) | null>(null);
  useEffect(() => () => removeEndListener.current?.(), []);
  const transitionEndListener = useCallback((done: () => void) => {
    removeEndListener.current?.();
    const node = nodeRef.current;
    if (!node) return;
    const onEnd = (event: TransitionEvent) => {
      // A message may contain its own shorter transition. Only the item's
      // opacity transition can complete its entrance or exit.
      if (event.target !== node || event.propertyName !== "opacity") return;
      removeEndListener.current?.();
      done();
    };
    node.addEventListener("transitionend", onEnd);
    removeEndListener.current = () => {
      node.removeEventListener("transitionend", onEnd);
      removeEndListener.current = null;
    };
  }, []);
  return (
    <CSSTransition
      {...transitionGroupProps}
      key={transitionKey}
      appear={true}
      nodeRef={nodeRef}
      unmountOnExit
      timeout={150}
      addEndListener={transitionEndListener}
      classNames={{
        appear: styles.appear,
        appearActive: styles.appearActive,
        enter: styles.enter,
        enterActive: styles.enterActive,
        exit: styles.exit,
        exitActive: styles.exitActive,
      }}
      onEnter={() => {
        onTransitionPendingChange(true);
      }}
      onEntered={() => removeEndListener.current?.()}
      onExited={() => {
        removeEndListener.current?.();
        onTransitionPendingChange(false);
      }}
    >
      {(status) =>
        children({
          nodeRef,
          isExiting: (transitionGroupProps as { in?: boolean }).in === false,
          isEntered: status === "entered",
        })
      }
    </CSSTransition>
  );
}

/**
 * Track when a list of transitions are complete in a TransitionGroup. Useful
 * for showing/hiding a notification container while transitions are pending.
 */
export function useNotificationTransitionTracking() {
  const [transitionsPending, setTransitionsPending] = useState(0);
  const onTransitionPendingChange = (isTransitionPending: boolean) => {
    setTransitionsPending((prev) =>
      isTransitionPending ? prev + 1 : prev - 1,
    );
  };
  return {
    isTransitionPending: transitionsPending > 0,
    onTransitionPendingChange,
  };
}
