import React, { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "../Select";
import { TabPanels } from "../TabPanels";
import {
  mockGetComputedStyle,
  mockIntersectionObserver,
} from "../utilities/test";
import { NetworkMapCellPopover } from "./NetworkMapCellPopover";

let restoreGetComputedStyle: () => void;
let restoreIntersectionObserver: () => void;

beforeEach(() => {
  restoreGetComputedStyle = mockGetComputedStyle();
  restoreIntersectionObserver = mockIntersectionObserver();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  restoreGetComputedStyle();
  restoreIntersectionObserver();
  vi.unstubAllGlobals();
});

it("lets an outside control hide the layer on its first pointer click", async () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  const onHide = vi.fn();
  const user = userEvent.setup();
  function Harness() {
    const [visible, setVisible] = useState(true);
    return (
      <div>
        <button
          onClick={() => {
            onHide();
            setVisible(false);
          }}
        >
          Hide layer
        </button>
        {visible && (
          <NetworkMapCellPopover
            x={20}
            y={20}
            pinned
            onClose={() => setVisible(false)}
            onPin={() => {}}
            onEnter={() => {}}
            onLeave={() => {}}
          >
            Cell observations
          </NetworkMapCellPopover>
        )}
      </div>
    );
  }
  render(<Harness />);
  await user.click(screen.getByRole("button", { name: "Hide layer" }));
  expect(onHide).toHaveBeenCalledOnce();
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
});

it("keeps a pinned inspector open when selecting a portalled option", async () => {
  const onClose = vi.fn();
  const onSelectionChange = vi.fn();
  const user = userEvent.setup();
  render(
    <div>
      <NetworkMapCellPopover
        x={20}
        y={20}
        pinned
        label="Overlay feature details"
        onClose={onClose}
        onPin={() => {}}
        onEnter={() => {}}
        onLeave={() => {}}
      >
        <Select
          label="Chart view"
          defaultSelectedKey="trend"
          onSelectionChange={onSelectionChange}
        >
          <Select.Option key="trend">Trend</Select.Option>
          <Select.Option key="bars">Daily bars</Select.Option>
        </Select>
      </NetworkMapCellPopover>
    </div>,
  );
  const inspector = screen.getByRole("region", {
    name: "Overlay feature details",
  });
  await user.click(screen.getByRole("button", { name: "Trend Chart view" }));
  await user.keyboard("{Escape}");
  expect(onClose).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Trend Chart view" }));
  const option = screen.getByRole("option", { name: "Daily bars" });
  expect(inspector.contains(option)).toBe(false);
  await user.click(option);
  expect(onSelectionChange).toHaveBeenCalledWith("bars");
  expect(onClose).not.toHaveBeenCalled();
  expect(
    screen.getByRole("region", { name: "Overlay feature details" }),
  ).toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("activates an outside ARIA tab exactly once on its first pointer click", async () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  const onSelectionChange = vi.fn();
  const user = userEvent.setup();
  render(
    <div>
      <TabPanels
        aria-label="Map views"
        keyboardActivation="manual"
        defaultSelectedKey="map"
        onSelectionChange={onSelectionChange}
      >
        <TabPanels.Tabs>
          <TabPanels.Item key="map">Map</TabPanels.Item>
          <TabPanels.Item key="data">Data</TabPanels.Item>
        </TabPanels.Tabs>
        <TabPanels.Panels>
          <TabPanels.Item key="map">Map view</TabPanels.Item>
          <TabPanels.Item key="data">Data view</TabPanels.Item>
        </TabPanels.Panels>
      </TabPanels>
      <NetworkMapCellPopover
        x={20}
        y={20}
        pinned
        onClose={() => {}}
        onPin={() => {}}
        onEnter={() => {}}
        onLeave={() => {}}
      >
        Cell observations
      </NetworkMapCellPopover>
    </div>,
  );
  await user.click(screen.getByRole("tab", { name: "Data" }));
  expect(screen.getByRole("tab", { name: "Data" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(onSelectionChange).toHaveBeenCalledExactlyOnceWith("data");
});

it("lets the map handle canvas and facility-marker clicks while an inspector is open", async () => {
  const onClose = vi.fn();
  const onMapClick = vi.fn();
  const user = userEvent.setup();
  const { container } = render(
    <div className="maplibregl-map">
      <canvas className="maplibregl-canvas" onClick={onMapClick} />
      <button className="maplibregl-marker" onClick={onMapClick}>
        <span>Chicago</span>
      </button>
      <NetworkMapCellPopover
        x={20}
        y={20}
        pinned
        onClose={onClose}
        onPin={() => {}}
        onEnter={() => {}}
        onLeave={() => {}}
      >
        <p>Daily parcels</p>
      </NetworkMapCellPopover>
    </div>,
  );
  await user.click(container.querySelector("canvas")!);
  expect(onMapClick).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
  await user.click(screen.getByText("Chicago"));
  expect(onMapClick).toHaveBeenCalledTimes(2);
  expect(onClose).not.toHaveBeenCalled();
});

it("closes once from the shared button and returns focus to the map canvas", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const { container } = render(
    <div>
      <canvas tabIndex={0} />
      <NetworkMapCellPopover
        x={20}
        y={20}
        pinned
        onClose={onClose}
        onPin={() => {}}
        onEnter={() => {}}
        onLeave={() => {}}
      >
        Cell observations
      </NetworkMapCellPopover>
    </div>,
  );
  const close = screen.getByRole("button", { name: "Close cell details" });
  await user.click(close);
  expect(onClose).toHaveBeenCalledOnce();
  expect(container.querySelector("canvas")).toHaveFocus();
});

it("updates a stable viewport card when source theme variables change or disappear", async () => {
  const source = document.createElement("div");
  source.style.setProperty("--ezui-color-neutral-000", "#ffffff");
  source.style.setProperty("--ezui-custom-token", "old");
  document.body.append(source);
  const content = <span>Stable content</span>;
  const { unmount } = render(
    <NetworkMapCellPopover
      x={20}
      y={20}
      pinned={false}
      positioning="viewport"
      styleSource={source}
      onClose={() => {}}
      onPin={() => {}}
      onEnter={() => {}}
      onLeave={() => {}}
    >
      {content}
    </NetworkMapCellPopover>,
  );
  const card = screen.getByRole("region");
  expect(card.style.getPropertyValue("--ezui-color-neutral-000")).toBe(
    "#ffffff",
  );
  source.style.setProperty("--ezui-color-neutral-000", "#101b2b");
  source.style.removeProperty("--ezui-custom-token");
  await waitFor(() =>
    expect(card.style.getPropertyValue("--ezui-color-neutral-000")).toBe(
      "#101b2b",
    ),
  );
  expect(card.style.getPropertyValue("--ezui-custom-token")).toBe("");
  unmount();
  source.remove();
});
