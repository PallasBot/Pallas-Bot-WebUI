// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { Combobox } from "./combobox";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
vi.stubGlobal("navigator", { ...window.navigator, userAgent: "Mozilla/5.0", platform: "Linux x86_64" });
vi.stubGlobal("CSS", { escape: (value: string) => value });
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

  it("exposes the selected display value while closed and clears it for searching", async () => {
    const user = userEvent.setup();

    render(
      <Combobox
        value="10002"
        onValueChange={vi.fn()}
        options={[
          { value: "10001", label: "一号群" },
          { value: "10002", label: "二号群", triggerLabel: <span>二号</span> },
        ]}
        searchThreshold={1}
      />,
    );

    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.value).toBe("二号");

    await user.click(input);
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("搜索…");

    await user.type(input, "一号");
    expect(input.value).toBe("一号");
    expect(screen.getByRole("option", { name: "一号群" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "二号群" })).toBeNull();
  });

  it("stays closed after Escape with a controlled value absent from the options", async () => {
    const user = userEvent.setup();

    render(
      <Combobox
        value="custom-existing"
        onValueChange={vi.fn()}
        options={[{ value: "known", label: "Known" }]}
        searchThreshold={1}
      />,
    );

    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.value).toBe("custom-existing");
    await user.click(input);
    await screen.findByRole("listbox");
    expect(input.getAttribute("aria-expanded")).toBe("true");

    await user.keyboard("{Escape}");
    await new Promise((resolve) => setTimeout(resolve, 550));
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.value).toBe("custom-existing");

    await user.keyboard("{Escape}");
    expect(input.getAttribute("aria-expanded")).toBe("false");

    await user.type(input, "k");
    await screen.findByRole("listbox");
    expect(input.value).toBe("k");
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
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("uses the native active option after End navigation", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <Combobox
        value=""
        onValueChange={onValueChange}
        options={[
          { value: "one", label: "One" },
          { value: "two", label: "Two" },
          { value: "three", label: "Three" },
        ]}
        searchThreshold={1}
      />,
    );

    const input = screen.getByRole("combobox");
    await user.click(input);
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}{End}");

    const thirdOption = screen.getByRole("option", { name: "Three" });
    expect(thirdOption.getAttribute("data-focused")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(thirdOption.id);

    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("three");
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("closes and displays the controlled selection after End and Enter", async () => {
    const user = userEvent.setup();
    const options = [
      { value: "one", label: "One" },
      { value: "two", label: "Two" },
      { value: "three", label: "Three" },
    ];
    const onValueChange = vi.fn();
    let applyControlledValue: ((value: string) => void) | undefined;
    function ControlledCombobox() {
      const [value, setValue] = React.useState("");
      return (
        <Combobox
          value={value}
          onValueChange={(nextValue) => {
            onValueChange(nextValue);
            applyControlledValue = setValue;
          }}
          options={options}
          searchThreshold={1}
        />
      );
    }

    render(<ControlledCombobox />);

    const input = screen.getByRole("combobox") as HTMLInputElement;
    await user.tab();
    await screen.findByRole("listbox");
    await user.keyboard("{ArrowDown}{End}{Enter}");

    expect(onValueChange).toHaveBeenCalledWith("three");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(input.getAttribute("aria-expanded")).toBe("false");
    act(() => applyControlledValue?.("three"));
    await waitFor(() => {
      expect(input.getAttribute("aria-expanded")).toBe("false");
      expect(input.value).toBe("Three");
    });
    expect(input.getAttribute("aria-activedescendant")).toBeNull();
  });

  it("allows a custom Enter value when matching options are disabled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <Combobox
        value=""
        onValueChange={onValueChange}
        options={[{ value: "blocked", label: "Blocked option", disabled: true }]}
        allowCustom
      />,
    );

    await user.click(screen.getByRole("combobox"));
    const search = screen.getByPlaceholderText("搜索…");
    await user.type(search, "Blocked");
    await user.keyboard("{Enter}");

    expect(onValueChange).toHaveBeenCalledWith("Blocked");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not select stale options while loading", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <Combobox
        value=""
        onValueChange={onValueChange}
        options={[{ value: "stale", label: "Stale option" }]}
        allowCustom
        loading
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await screen.findByText("正在加载…");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("does not submit pending custom input while loading", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const props = {
      value: "",
      onValueChange,
      options: [] as { value: string; label: string }[],
      allowCustom: true,
    };
    const { rerender } = render(<Combobox {...props} />);

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "pending");
    rerender(<Combobox {...props} loading />);
    await user.keyboard("{Enter}");

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("keeps focus in the combobox after custom submission resets the collection", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <>
        <Combobox value="" onValueChange={onValueChange} options={[]} allowCustom />
        <button>Next</button>
      </>,
    );

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "custom value");
    await user.keyboard("{Enter}");

    expect(onValueChange).toHaveBeenCalledWith("custom value");
    const trigger = document.querySelector<HTMLButtonElement>('button[data-slot="combo-box-trigger"]');
    expect(trigger).not.toBeNull();
    expect(document.activeElement).toBe(trigger);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next" }));
  });

  it("shares the active option between keyboard and pointer selection", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <Combobox
        value=""
        onValueChange={onValueChange}
        options={[
          { value: "10001", label: "一号群" },
          { value: "10002", label: "二号群" },
        ]}
        searchThreshold={1}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await screen.findByRole("listbox");
    const search = screen.getByPlaceholderText("搜索…");
    const second = screen.getByRole("option", { name: "二号群" });

    await user.click(search);
    await user.keyboard("{ArrowDown}");
    await user.hover(second);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith("10002"));
  });

  it("anchors the popover to the input group containing the input and trigger", async () => {
    const user = userEvent.setup();

    render(
      <Combobox
        value=""
        onValueChange={vi.fn()}
        options={[{ value: "10001", label: "一号群" }]}
      />,
    );

    const input = screen.getByRole("combobox");
    const inputGroup = input.closest('[data-slot="combo-box-input-group"]');
    expect(inputGroup).not.toBeNull();
    expect(inputGroup?.contains(input)).toBe(true);
    expect(inputGroup?.contains(screen.getByRole("button"))).toBe(true);

    await user.click(input);
    const list = await screen.findByRole("listbox");
    expect(list.closest('[data-slot="combo-box-popover"]')).not.toBeNull();
  });

  it("uses a system-color outline when the input group has keyboard focus", () => {
    render(<Combobox value="" onValueChange={vi.fn()} options={[]} allowCustom />);
    const input = screen.getByRole("combobox");
    const inputGroup = input.closest('[data-slot="combo-box-input-group"]');
    input.focus();

    expect(document.activeElement).toBe(input);
    expect(inputGroup?.className).toContain("forced-colors:focus-within:outline-2");
    expect(inputGroup?.className).toContain("forced-colors:focus-within:outline-offset-2");
    expect(inputGroup?.className).toContain("forced-colors:focus-within:outline-[Highlight]");
  });

  it("opens and selects an option when tabbing into the search input", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <Combobox
        value=""
        onValueChange={onValueChange}
        options={[
          { value: "10001", label: "一号群" },
          { value: "10002", label: "二号群" },
        ]}
        searchThreshold={1}
      />,
    );

    await user.tab();
    const input = screen.getByRole("combobox");
    expect(document.activeElement).toBe(input);
    await screen.findByRole("listbox");
    const firstOption = screen.getByRole("option", { name: "一号群" });
    expect(input.getAttribute("aria-activedescendant")).toBe(firstOption.id);
    await user.keyboard("{Enter}");

    expect(onValueChange).toHaveBeenCalledWith("10001");
  });

});
