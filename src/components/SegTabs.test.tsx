// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import SegTabs from "@/components/SegTabs";

class ResizeObserverMock {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe() { this.callback([], this as unknown as ResizeObserver); }
  unobserve() {}
  disconnect() {}
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("slides one indicator to the active tab and recalculates after resize", async () => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  let rawWidth = 96;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.getAttribute("role") === "tablist") return rect(100, 20, 240, 40);
    if (this.textContent === "表单") return rect(108, 24, 84, 32);
    if (this.textContent === "Raw TOML") return rect(196, 24, rawWidth, 32);
    return rect(0, 0, 0, 0);
  });
  const user = userEvent.setup();
  const onValueChange = vi.fn();
  const { container, rerender } = render(
    <SegTabs
      value="form"
      onValueChange={onValueChange}
      options={[{ value: "form", label: "表单" }, { value: "raw", label: "Raw TOML" }]}
      ariaLabel="编辑模式"
    />,
  );

  const indicator = container.querySelector<HTMLElement>(".seg-tabs__indicator");
  expect(indicator).not.toBeNull();
  expect(container.querySelectorAll(".seg-tabs__indicator")).toHaveLength(1);
  await screen.findByRole("tab", { name: "表单" });
  expect(indicator?.style.left).toBe("8px");
  expect(indicator?.style.width).toBe("84px");

  await user.click(screen.getByRole("tab", { name: "Raw TOML" }));
  expect(onValueChange).toHaveBeenCalledWith("raw");
  rerender(
    <SegTabs
      value="raw"
      onValueChange={onValueChange}
      options={[{ value: "form", label: "表单" }, { value: "raw", label: "Raw TOML" }]}
      ariaLabel="编辑模式"
    />,
  );
  await waitFor(() => expect(indicator?.style.left).toBe("96px"));
  expect(screen.getByRole("tab", { name: "Raw TOML" }).getAttribute("data-state")).toBe("active");
  expect(indicator?.style.width).toBe("96px");

  rawWidth = 112;
  window.dispatchEvent(new Event("resize"));
  expect(indicator?.style.width).toBe("112px");
});
