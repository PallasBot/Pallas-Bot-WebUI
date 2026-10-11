// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function SelectFixture() {
  return (
    <Select aria-label="Fruit">
      <SelectTrigger aria-label="Fruit choices"><SelectValue placeholder="Choose fruit" /></SelectTrigger>
      <SelectContent>
        {Array.from({ length: 12 }, (_, index) => (
          <SelectItem key={index} value={`fruit-${index}`}>Fruit {index}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

describe("Select scroll contracts", () => {
  it("attaches scroll tracking when the list mounts after initially closed", async () => {
    const user = userEvent.setup();
    render(<SelectFixture />);

    await user.click(screen.getByRole("button", { name: /Fruit choices/ }));
    const list = await screen.findByRole("listbox");
    Object.defineProperties(list, {
      clientHeight: { configurable: true, value: 40 },
      scrollHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });

    fireEvent.scroll(list);
    expect((screen.getByRole("button", { name: "Scroll options down" }) as HTMLButtonElement).disabled).toBe(false);

    list.scrollTop = 20;
    fireEvent.scroll(list);
    expect((screen.getByRole("button", { name: "Scroll options up" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps an uncontrolled default selection and keyboard updates", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Select aria-label="Fruit" defaultValue="fruit-0" onValueChange={onValueChange}>
      <SelectTrigger aria-label="Fruit choices"><SelectValue placeholder="Choose fruit" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="fruit-0">Fruit 0</SelectItem>
        <SelectItem value="fruit-1">Fruit 1</SelectItem>
      </SelectContent>
    </Select>);

    const trigger = screen.getByRole("button", { name: /Fruit choices/ });
    expect(trigger.getAttribute("data-heroui-skin")).toBe("true");
    expect(trigger.textContent).toContain("Fruit 0");
    await user.click(trigger);
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.getAttribute("aria-selected"))).toEqual(["true", "false"]);
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onValueChange).toHaveBeenCalledWith("fruit-1");
    await waitFor(() => expect(trigger.textContent).toContain("Fruit 1"));
    expect(document.activeElement).toBe(trigger);
  });

  it("lets the list use HeroUI's available popover height in a short viewport", async () => {
    const originalDocumentHeight = Object.getOwnPropertyDescriptor(document.documentElement, "clientHeight");
    const originalWindowHeight = Object.getOwnPropertyDescriptor(window, "innerHeight");
    Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: 180 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 180 });
    try {
      const user = userEvent.setup();
      render(<SelectFixture />);
      const trigger = screen.getByRole("button", { name: /Fruit choices/ });
      vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 50, 120, 36));

      await user.click(trigger);
      const list = await screen.findByRole("listbox");
      const popover = list.closest<HTMLElement>('[data-slot="select-popover"]');
      await waitFor(() => expect(Number.parseFloat(popover?.style.maxHeight ?? "Infinity")).toBeLessThan(180));

      expect(popover?.className).toContain("flex-col");
      expect(list.className).toContain("flex-1");
      expect(list.className).toContain("overflow-auto");
    } finally {
      if (originalDocumentHeight) Object.defineProperty(document.documentElement, "clientHeight", originalDocumentHeight);
      else Reflect.deleteProperty(document.documentElement, "clientHeight");
      if (originalWindowHeight) Object.defineProperty(window, "innerHeight", originalWindowHeight);
    }
  });

  it("forwards close-autofocus callbacks and honors a focus veto", async () => {
    const user = userEvent.setup();
    const onCloseAutoFocus = vi.fn((event: Event) => {
      event.preventDefault();
      document.getElementById("focus-after-select")?.focus();
    });
    render(<>
      <Select aria-label="Fruit" defaultOpen>
        <SelectTrigger aria-label="Fruit choices"><SelectValue placeholder="Choose fruit" /></SelectTrigger>
        <SelectContent onCloseAutoFocus={onCloseAutoFocus}>
          <SelectItem value="apple">Apple</SelectItem>
        </SelectContent>
      </Select>
      <button id="focus-after-select" type="button">After select</button>
    </>);

    await screen.findByRole("option", { name: "Apple" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledOnce());
    expect(onCloseAutoFocus.mock.calls[0][0].defaultPrevented).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "After select" })));
  });
});
