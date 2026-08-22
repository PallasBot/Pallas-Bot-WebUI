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
});
