import React, {
  HTMLAttributes,
  MutableRefObject,
  ReactNode,
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
} from "react";
import { useId } from "react-aria";
import { DisclosureState, useDisclosureState } from "react-stately";
import { Button, ButtonProps } from "../Button";
import { classNames } from "../utilities/css";

import styles from "./Disclosure.module.scss";

export type DisclosureProps = {
  /** One trigger and one content panel, with optional layout elements between them. */
  children: ReactNode;
  /** Whether the panel is expanded (controlled). */
  isExpanded?: boolean;
  /** Whether the panel starts expanded (uncontrolled). Defaults to false. */
  defaultExpanded?: boolean;
  /** Called with the requested next expanded state. */
  onExpandedChange?: (isExpanded: boolean) => void;
  /**
   * Whether closed content stays mounted. Preserving content retains local
   * form state and effects, including before the first expansion.
   *
   * @default "preserve"
   */
  mountPolicy?: "preserve" | "unmount";
};

export type DisclosureTriggerProps = Omit<
  ButtonProps,
  "href" | "id" | "type" | "aria-expanded" | "aria-controls" | "onPress"
>;

export type DisclosureContentProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "id" | "hidden" | "role"
> & {
  children: ReactNode;
  /** Optionally expose a named region. Its default label comes from the trigger. */
  role?: "region";
};

type DisclosureContextValue = {
  state: DisclosureState;
  mountPolicy: NonNullable<DisclosureProps["mountPolicy"]>;
  triggerId: string;
  contentId: string;
  // Button's existing public ref type is null; the mounted value is its button.
  triggerRef: MutableRefObject<null>;
};

const DisclosureContext = createContext<DisclosureContextValue | null>(null);

function useDisclosureContext() {
  const context = useContext(DisclosureContext);
  if (!context) {
    throw new Error(
      "Disclosure.Trigger and Disclosure.Content require Disclosure",
    );
  }
  return context;
}

/**
 * Shows supporting content on demand. Each disclosure manages its own state;
 * several panels can be expanded at once.
 *
 * @remarks
 * The root adds no DOM wrapper. Place exactly one `Disclosure.Trigger` and one
 * `Disclosure.Content` inside it, with any layout needed between them.
 *
 * @example
 * <Disclosure>
 *   <Disclosure.Trigger variant="link">Trends and factors</Disclosure.Trigger>
 *   <Disclosure.Content>Supporting evidence</Disclosure.Content>
 * </Disclosure>
 */
export function Disclosure(props: DisclosureProps) {
  const { children, mountPolicy = "preserve" } = props;
  const state = useDisclosureState(props);
  const id = useId();
  const triggerRef = useRef(null);
  return (
    <DisclosureContext.Provider
      value={{
        state,
        mountPolicy,
        triggerId: `${id}-trigger`,
        contentId: `${id}-content`,
        triggerRef,
      }}
    >
      {children}
    </DisclosureContext.Provider>
  );
}

function DisclosureTrigger(props: DisclosureTriggerProps) {
  const { state, triggerId, contentId, triggerRef } = useDisclosureContext();
  return (
    <Button
      {...props}
      ref={triggerRef}
      id={triggerId}
      type="button"
      href={undefined}
      aria-expanded={state.isExpanded}
      aria-controls={contentId}
      onPress={() => {
        if (!props.isDisabled) state.toggle();
      }}
    />
  );
}

function DisclosureContent({
  children,
  className,
  role,
  ...props
}: DisclosureContentProps) {
  const { state, mountPolicy, triggerId, contentId, triggerRef } =
    useDisclosureContext();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const removedFocus = useRef<Element | null>(null);

  useLayoutEffect(() => {
    const previouslyFocused = removedFocus.current;
    removedFocus.current = null;
    if (state.isExpanded || !previouslyFocused) return;

    const doc = previouslyFocused.ownerDocument;
    const active = doc.activeElement;
    // Preserve any focus deliberately moved elsewhere during this update.
    if (
      active !== previouslyFocused &&
      active !== doc.body &&
      active?.isConnected
    ) {
      return;
    }
    const trigger = triggerRef.current as HTMLButtonElement | null;
    if (trigger?.isConnected && !trigger.disabled) trigger.focus();
  }, [state.isExpanded, triggerRef]);

  return (
    <div
      {...props}
      ref={panelRef}
      id={contentId}
      role={role}
      aria-labelledby={
        props["aria-labelledby"] ??
        (role === "region" && !props["aria-label"] ? triggerId : undefined)
      }
      className={classNames(styles.Content, className)}
      hidden={!state.isExpanded}
    >
      {state.isExpanded && (
        <CaptureClosingFocus panelRef={panelRef} removedFocus={removedFocus} />
      )}
      {(state.isExpanded || mountPolicy === "preserve") && children}
    </div>
  );
}

/** Capture before sibling content is removed or the parent shell becomes hidden. */
function CaptureClosingFocus({
  panelRef,
  removedFocus,
}: {
  panelRef: MutableRefObject<HTMLDivElement | null>;
  removedFocus: MutableRefObject<Element | null>;
}) {
  useLayoutEffect(() => {
    return () => {
      // This child's mount effect runs before the panel ref attaches. Read the
      // retained shell at cleanup, before its hidden attribute changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const panel = panelRef.current;
      const active = panel?.ownerDocument.activeElement;
      if (active && panel?.contains(active)) removedFocus.current = active;
    };
  }, [panelRef, removedFocus]);
  return null;
}

/** A Button that owns the disclosure relationship and toggles its state. */
Disclosure.Trigger = DisclosureTrigger;

/** A stable panel shell with explicit content mounting behavior. */
Disclosure.Content = DisclosureContent;
