import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "../Select";
import { NetworkMapCellPopover } from "./NetworkMapCellPopover";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

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
