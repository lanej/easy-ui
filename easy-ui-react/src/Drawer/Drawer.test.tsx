import { screen } from "@testing-library/react";
import React, { useState } from "react";
import { vi } from "vitest";
import { Button } from "../Button";
import {
  disableReactTransitionGroup,
  enableReactTransitionGroup,
  mockGetComputedStyle,
  mockIntersectionObserver,
  render,
  userClick,
  userKeyboard,
} from "../utilities/test";
import {
  Drawer,
  DrawerContainer,
  DrawerProps,
  useDrawerTrigger,
} from "./Drawer";
import { DrawerTriggerProps } from "./DrawerTrigger";
import { VerticalStack } from "../VerticalStack";
import { HorizontalStack } from "../HorizontalStack";

describe("<Drawer />", () => {
  let restoreGetComputedStyle: () => void;
  let restoreIntersectionObserver: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    restoreGetComputedStyle = mockGetComputedStyle();
    restoreIntersectionObserver = mockIntersectionObserver();
    disableReactTransitionGroup();
  });

  afterEach(() => {
    restoreIntersectionObserver();
    restoreGetComputedStyle();
    vi.useRealTimers();
    enableReactTransitionGroup();
  });

  it("should render a Drawer", async () => {
    const [{ user }] = renderDrawer();

    const openButton = screen.getByRole("button", { name: "Open drawer" });
    await userClick(user, openButton);

    expect(screen.getByText("Drawer content")).toBeInTheDocument();
    expect(screen.getByText("Drawer title")).toBeInTheDocument();
  });

  it("should be dismissable by close button", async () => {
    const [{ user }] = await renderAndOpenDrawer();
    const closeButton = screen.getByRole("button", { name: "Close drawer" });
    expect(closeButton).toHaveAttribute("type", "button");
    await userClick(user, closeButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should be dismissable by esc key", async () => {
    const [{ user }] = await renderAndOpenDrawer();
    await userKeyboard(user, "{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should support being nondismissable", async () => {
    const [{ user }] = await renderAndOpenDrawer({ isDismissable: false });
    expect(
      screen.queryByRole("button", { name: "Close drawer" }),
    ).not.toBeInTheDocument();
    await userKeyboard(user, "{Escape}");
    expect(screen.queryByRole("dialog")).toBeInTheDocument();
  });

  it("should support default open", () => {
    renderDrawer({ defaultOpen: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("should support being controlled", () => {
    renderDrawer({ isOpen: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("retains right placement by default and links its trigger", async () => {
    await renderAndOpenDrawer();
    const dialog = screen.getByRole("dialog", { name: "Drawer title" });
    expect(dialog.closest("[data-placement]")).toHaveAttribute(
      "data-placement",
      "right",
    );
    expect(
      screen.getByRole("button", { name: "Open drawer", hidden: true }),
    ).toHaveAttribute("aria-controls", dialog.id);
  });

  it.each(["left", "right"] as const)(
    "supports %s placement and numeric widths on triggers",
    async (placement) => {
      render(
        <Drawer.Trigger placement={placement} width={280} defaultOpen>
          <Button>Open navigation</Button>
          <Drawer aria-label="Workspace navigation">
            <Drawer.Body>
              <Button>Overview</Button>
            </Drawer.Body>
          </Drawer>
        </Drawer.Trigger>,
      );
      const dialog = screen.getByRole("dialog", {
        name: "Workspace navigation",
      });
      const overlay = dialog.closest("[data-placement]");
      expect(overlay).toHaveAttribute("data-placement", placement);
      expect(overlay).toHaveStyle({ "--ezui-c-drawer-width": "280px" });
    },
  );

  it("supports externally labelled and described headerless drawers", () => {
    render(
      <>
        <span id="navigation-name">Workspace navigation</span>
        <span id="navigation-help">Choose a destination</span>
        <Drawer.Container>
          <Drawer
            aria-labelledby="navigation-name"
            aria-describedby="navigation-help"
          >
            <Drawer.Body>Overview</Drawer.Body>
          </Drawer>
        </Drawer.Container>
      </>,
    );
    const dialog = screen.getByRole("dialog", { name: "Workspace navigation" });
    expect(dialog).toHaveAccessibleDescription("Choose a destination");
  });

  it("notifies the controlled owner without closing itself and supports reopening", async () => {
    const onDismiss = vi.fn();
    const content = (
      <Drawer aria-label="Workspace navigation">
        <Drawer.Body>
          <Button>Overview</Button>
        </Drawer.Body>
      </Drawer>
    );
    const { user, rerender } = render(
      <Drawer.Container placement="left" width="280px" onDismiss={onDismiss}>
        {content}
      </Drawer.Container>,
    );
    expect(screen.getByRole("dialog").closest("[data-placement]")).toHaveStyle({
      "--ezui-c-drawer-width": "280px",
    });
    await userKeyboard(user, "{Escape}");
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerender(<Drawer.Container onDismiss={onDismiss}>{null}</Drawer.Container>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(
      <Drawer.Container placement="right" width="90vw" onDismiss={onDismiss}>
        {content}
      </Drawer.Container>,
    );
    const overlay = screen.getByRole("dialog").closest("[data-placement]");
    expect(overlay).toHaveAttribute("data-placement", "right");
    expect(overlay).toHaveStyle({ "--ezui-c-drawer-width": "90vw" });
  });

  it("supports controlled Trigger reopening and non-dismissable Containers", async () => {
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <Drawer.Trigger
          placement="left"
          width="280px"
          isOpen={open}
          onOpenChange={setOpen}
        >
          <Button>Open navigation</Button>
          <Drawer aria-label="Workspace navigation">
            <Drawer.Body>
              <Button>Overview</Button>
            </Drawer.Body>
          </Drawer>
        </Drawer.Trigger>
      );
    }
    const { user, unmount } = render(<Controlled />);
    const opener = screen.getByRole("button", { name: "Open navigation" });
    await userClick(user, opener);
    await userKeyboard(user, "{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userClick(user, opener);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    unmount();
    const onDismiss = vi.fn();
    render(
      <Drawer.Container isDismissable={false} onDismiss={onDismiss}>
        <Drawer aria-label="Navigation">
          <Drawer.Body>Overview</Drawer.Body>
        </Drawer>
      </Drawer.Container>,
    );
    await userKeyboard(user, "{Escape}");
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("should support rendering in a container", async () => {
    function CustomDrawer() {
      const modalTrigger = useDrawerTrigger();
      return (
        <Drawer aria-label="Custom drawer">
          <Drawer.Body>
            <div>Content</div>
            <Button
              onPress={() => {
                modalTrigger.close();
              }}
            >
              Close drawer
            </Button>
          </Drawer.Body>
        </Drawer>
      );
    }

    const handleDismiss = vi.fn();
    const { user, rerender } = render(
      <DrawerContainer onDismiss={handleDismiss}>
        {true ? <CustomDrawer /> : null}
      </DrawerContainer>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userClick(user, screen.getByRole("button", { name: "Close drawer" }));
    expect(handleDismiss).toBeCalled();

    rerender(
      <DrawerContainer onDismiss={handleDismiss}>
        {false ? <CustomDrawer /> : null}
      </DrawerContainer>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

function renderDrawer({
  defaultOpen,
  isOpen,
  isDismissable,
}: Partial<DrawerProps> & Partial<DrawerTriggerProps> = {}) {
  const onOpenChange = vi.fn();
  const renderResult = render(
    <Drawer.Trigger
      defaultOpen={defaultOpen}
      isOpen={isOpen}
      isDismissable={isDismissable}
      onOpenChange={onOpenChange}
    >
      <Button>Open drawer</Button>
      <Drawer>
        <Drawer.Body>
          <Drawer.StandaloneContentArea>
            <VerticalStack gap="2">
              <HorizontalStack align="space-between" blockAlign="center">
                <Drawer.Title>Drawer title</Drawer.Title>
                <Drawer.CloseButton />
              </HorizontalStack>
              <div>Drawer content</div>
            </VerticalStack>
          </Drawer.StandaloneContentArea>
        </Drawer.Body>
      </Drawer>
    </Drawer.Trigger>,
  );
  return [renderResult, { onOpenChange }] as const;
}

async function renderAndOpenDrawer(args = {}) {
  const response = renderDrawer(args);
  const [{ user }] = response;
  const openButton = screen.getByRole("button", { name: "Open drawer" });
  await userClick(user, openButton);
  expect(screen.queryByRole("dialog")).toBeInTheDocument();
  return response;
}
