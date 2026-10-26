// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("CSS", { ...window.CSS, escape: (value: string) => value });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Select contracts", () => {
  it("keeps an uncontrolled default selection and keyboard updates", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Select defaultValue="fruit-0" onValueChange={onValueChange}>
        <SelectTrigger aria-label="Fruit choices"><SelectValue placeholder="Choose fruit" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="fruit-0">Fruit 0</SelectItem>
          <SelectItem value="fruit-1">Fruit 1</SelectItem>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole("combobox", { name: /Fruit choices/ });
    expect(trigger.textContent).toContain("Fruit 0");
    await user.click(trigger);
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.getAttribute("aria-selected"))).toEqual(["true", "false"]);
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onValueChange).toHaveBeenCalledWith("fruit-1");
    await waitFor(() => expect(trigger.textContent).toContain("Fruit 1"));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("marks the selected option and exposes its aria-selected state", async () => {
    const user = userEvent.setup();
    render(
      <Select defaultValue="fruit-0">
        <SelectTrigger aria-label="Fruit choices"><SelectValue placeholder="Choose fruit" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="fruit-0">Fruit 0</SelectItem>
          <SelectItem value="fruit-1">Fruit 1</SelectItem>
        </SelectContent>
      </Select>,
    );

    await user.click(screen.getByRole("combobox", { name: /Fruit choices/ }));
    const [selected, unselected] = await screen.findAllByRole("option");

    expect(selected.getAttribute("aria-selected")).toBe("true");
    expect(unselected.getAttribute("aria-selected")).toBe("false");
    expect(selected.querySelector("svg")).toBeTruthy();
    expect(unselected.querySelector("svg")).toBeNull();
  });

  it("forwards close-autofocus callbacks and honors a focus veto", async () => {
    const user = userEvent.setup();
    const onCloseAutoFocus = vi.fn((event: Event) => {
      event.preventDefault();
      document.getElementById("focus-after-select")?.focus();
    });
    render(
      <>
        <Select defaultOpen>
          <SelectTrigger aria-label="Fruit choices"><SelectValue placeholder="Choose fruit" /></SelectTrigger>
          <SelectContent onCloseAutoFocus={onCloseAutoFocus}>
            <SelectItem value="apple">Apple</SelectItem>
          </SelectContent>
        </Select>
        <button id="focus-after-select" type="button">After select</button>
      </>,
    );

    await screen.findByRole("option", { name: "Apple" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledOnce());
    expect(onCloseAutoFocus.mock.calls[0][0].defaultPrevented).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "After select" })));
  });
});
