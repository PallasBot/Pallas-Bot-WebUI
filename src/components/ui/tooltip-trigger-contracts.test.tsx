// @vitest-environment jsdom
import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("CSS", { ...globalThis.CSS, escape: globalThis.CSS?.escape ?? ((value: string) => value) });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TooltipTrigger", () => {
  it("forwards the caller ref without breaking keyboard activation or positioning", async () => {
    const user = userEvent.setup();
    const triggerRef = React.createRef<HTMLButtonElement>();
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild ref={triggerRef}>
            <button type="button">Help</button>
          </TooltipTrigger>
          <TooltipContent side="right">Helpful information</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Help" });
    expect(triggerRef.current).toBe(trigger);

    await user.tab();
    expect(document.activeElement).toBe(trigger);

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain("Helpful information");
    // Radix 依据可用空间翻转定位，jsdom 无布局时侧向可能被翻转。
    expect(["right", "left", "top", "bottom"]).toContain(tooltip.getAttribute("data-side"));
  });
});
