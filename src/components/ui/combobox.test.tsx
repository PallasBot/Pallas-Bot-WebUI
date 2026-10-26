// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Combobox } from "./combobox";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
HTMLElement.prototype.scrollIntoView = vi.fn();

describe("Combobox", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("restores a remembered selection when the controlled value is empty", async () => {
    localStorage.setItem("test-combobox", "10002");
    const onValueChange = vi.fn();

    render(
      <Combobox
        value=""
        onValueChange={onValueChange}
        options={[{ value: "10002", label: "二号群" }]}
        memoryKey="test-combobox"
      />,
    );

    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith("10002"));
  });

  it("selects the highlighted option with Enter before considering custom input", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <Combobox
        value=""
        onValueChange={onValueChange}
        options={[
          { value: "10001", label: "一号群", keywords: "一号群 10001" },
          { value: "10002", label: "二号群", keywords: "二号群 10002" },
        ]}
        allowCustom
        searchThreshold={1}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    const search = screen.getByPlaceholderText("搜索…");
    await user.type(search, "二号");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onValueChange).toHaveBeenCalledWith("10002");
  });

  it("moves one shared highlight with the same cmdk pointer and keyboard selection", async () => {
    const user = userEvent.setup();
    const rect = (top: number, width: number, height: number) => ({
      top,
      left: 0,
      right: width,
      bottom: top + height,
      width,
      height,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const value = this.getAttribute("data-value");
      if (value === "10001") return rect(8, 180, 32);
      if (value === "10002") return rect(44, 180, 32);
      if (this.hasAttribute("cmdk-list")) return rect(0, 200, 100);
      return rect(0, 0, 0);
    });

    render(
      <Combobox
        value=""
        onValueChange={vi.fn()}
        options={[
          { value: "10001", label: "一号群" },
          { value: "10002", label: "二号群" },
        ]}
        searchThreshold={1}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    const list = await screen.findByRole("listbox");
    const search = screen.getByPlaceholderText("搜索…");
    const first = screen.getByRole("option", { name: "一号群" });
    const second = screen.getByRole("option", { name: "二号群" });

    await user.click(search);
    await user.keyboard("{ArrowDown}");
    const initial = await waitFor(() => {
      const y = list.style.getPropertyValue("--command-highlight-y");
      expect(["8px", "44px"]).toContain(y);
      return y;
    });
    const initialOption = initial === "8px" ? first : second;
    const otherOption = initialOption === first ? second : first;
    const otherY = initial === "8px" ? "44px" : "8px";
    expect(initialOption.getAttribute("data-selected")).toBe("true");

    await user.hover(otherOption);
    await waitFor(() => expect(list.style.getPropertyValue("--command-highlight-y")).toBe(otherY));
    expect(otherOption.getAttribute("data-selected")).toBe("true");

    await user.keyboard(otherOption === second ? "{ArrowUp}" : "{ArrowDown}");
    await waitFor(() => expect(list.style.getPropertyValue("--command-highlight-y")).toBe(initial));
    expect(initialOption.getAttribute("data-selected")).toBe("true");
  });
});
