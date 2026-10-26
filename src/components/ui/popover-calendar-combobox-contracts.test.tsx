// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Combobox } from "./combobox";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
vi.stubGlobal("CSS", { escape: (value: string) => value });
HTMLElement.prototype.scrollIntoView = vi.fn();

afterEach(cleanup);

describe("Popover and ComboBox contracts", () => {
  it("preserves a child combobox role and accessibility props while activating the popover", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const triggerRef = createRef<HTMLButtonElement>();
    render(
      <Popover>
        <PopoverTrigger asChild className="slot-trigger" style={{ color: "red" }}>
          <button
            ref={triggerRef}
            role="combobox"
            aria-label="Open choices"
            aria-describedby="help"
            className="child-trigger"
            style={{ backgroundColor: "blue" }}
            onClick={onClick}
          >
            Open
          </button>
        </PopoverTrigger>
        <PopoverContent>Popover details</PopoverContent>
      </Popover>,
    );

    const trigger = screen.getByRole("combobox", { name: "Open choices" });
    expect(trigger.getAttribute("aria-describedby")).toBe("help");
    expect(triggerRef.current).toBe(trigger);
    expect(trigger.classList.contains("slot-trigger")).toBe(true);
    expect(trigger.classList.contains("child-trigger")).toBe(true);
    expect((trigger as HTMLButtonElement).style.color).toBe("red");
    expect((trigger as HTMLButtonElement).style.backgroundColor).toBe("blue");
    await user.click(trigger);

    expect(onClick).toHaveBeenCalledOnce();
    expect(await screen.findByText("Popover details")).toBeTruthy();
  });

  it("forwards a ref from PopoverTrigger to its rendered button", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    render(
      <Popover>
        <PopoverTrigger ref={triggerRef}>Forwarded ref</PopoverTrigger>
        <PopoverContent>Details</PopoverContent>
      </Popover>,
    );

    expect(triggerRef.current).toBe(screen.getByRole("button", { name: "Forwarded ref" }));
  });

  it("preserves Radix Slot click ordering and cancellation behavior", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    render(
      <Popover>
        <PopoverTrigger asChild onClick={() => calls.push("wrapper")}>
          <button
            onClick={(event) => {
              calls.push("child");
              event.preventDefault();
            }}
          >
            Cancel open
          </button>
        </PopoverTrigger>
        <PopoverContent>Cancelled details</PopoverContent>
      </Popover>,
    );

    await user.click(screen.getByRole("button", { name: "Cancel open" }));

    expect(calls).toEqual(["child", "wrapper"]);
    expect(screen.queryByText("Cancelled details")).toBeNull();
  });

  it("gives a nonmodal popover dialog semantics and focuses its first control", async () => {
    const user = userEvent.setup();
    const inputRef = createRef<HTMLInputElement>();
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent id="options-dialog" aria-label="Options">
          <input ref={inputRef} aria-label="Search options" />
        </PopoverContent>
      </Popover>,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = await screen.findByRole("dialog", { name: "Options" });
    expect(dialog.id).toBe("options-dialog");
    await waitFor(() => expect(document.activeElement).toBe(inputRef.current));
  });

  it("honors canceled nonmodal autofocus and keeps Escape dismissal focus stable", async () => {
    const user = userEvent.setup();
    const onOpenAutoFocus = vi.fn((event: Event) => event.preventDefault());
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent onOpenAutoFocus={onOpenAutoFocus}>Details</PopoverContent>
      </Popover>,
    );

    const trigger = screen.getByRole("button", { name: "Open" });
    await user.click(trigger);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(onOpenAutoFocus).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("returns focus to the trigger when Escape closes a focused panel", async () => {
    const user = userEvent.setup();
    const inputRef = createRef<HTMLInputElement>();
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>
          <input ref={inputRef} aria-label="Search" />
        </PopoverContent>
      </Popover>,
    );

    const trigger = screen.getByRole("button", { name: "Open" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(document.activeElement).toBe(inputRef.current));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(dialog.contains(document.activeElement)).toBe(false);
  });

  it("moves focus out before content-triggered close finishes exiting", async () => {
    const user = userEvent.setup();
    function ControlledPopover() {
      const [open, setOpen] = useState(false);
      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>
            <button onClick={() => setOpen(false)}>Close from panel</button>
          </PopoverContent>
        </Popover>
      );
    }
    render(<ControlledPopover />);

    const trigger = screen.getByRole("button", { name: "Open" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");
    const closeButton = screen.getByRole("button", { name: "Close from panel" });
    await user.click(closeButton);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(dialog.contains(document.activeElement)).toBe(false);
  });

  it("dismisses a nonmodal popover on outside pointer interaction", async () => {
    const user = userEvent.setup();
    let outsideButton: HTMLButtonElement | null = null;
    render(
      <>
        <Popover>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>Details</PopoverContent>
        </Popover>
        <button ref={(button) => { outsideButton = button; }}>Outside</button>
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Outside" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(outsideButton);
  });

  it("keeps modal focus containment when a canceled callback focuses its input", async () => {
    const user = userEvent.setup();
    const inputRef = createRef<HTMLInputElement>();
    const outsideButton = createRef<HTMLButtonElement>();
    render(
      <>
        <Popover modal>
          <PopoverTrigger>Open modal</PopoverTrigger>
          <PopoverContent
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              inputRef.current?.focus();
            }}
          >
            <input ref={inputRef} aria-label="Modal input" />
            <button>Next</button>
          </PopoverContent>
        </Popover>
        <button ref={outsideButton}>Outside modal</button>
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Open modal" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.getAttribute("data-trigger")).not.toBe("PreviewTrigger");
    expect(document.activeElement).toBe(inputRef.current);
    outsideButton.current?.focus();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it("runs callback-ref cleanup for an asChild trigger", () => {
    const refCleanup = vi.fn();
    const triggerRef = vi.fn((element: HTMLButtonElement | null) => element ? refCleanup : undefined);
    const view = render(
      <Popover>
        <PopoverTrigger asChild>
          <button ref={triggerRef}>Callback ref</button>
        </PopoverTrigger>
        <PopoverContent>Details</PopoverContent>
      </Popover>,
    );

    expect(triggerRef).toHaveBeenCalledWith(screen.getByRole("button", { name: "Callback ref" }));
    view.unmount();
    expect(refCleanup).toHaveBeenCalledOnce();
  });

  it("keeps trigger labels while filtering by value and keywords", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Combobox
        value="one"
        onValueChange={onValueChange}
        options={[
          { value: "one", label: <span>One option</span>, triggerLabel: <strong>Selected one</strong> },
          { value: "gateway-id-2", label: <span>Two option</span>, keywords: "secondary" },
        ]}
        searchThreshold={1}
        ariaLabel="Choice"
        ariaDescribedBy="choice-help"
        title="Choose one"
        id="choice-trigger"
      />,
    );

    expect(screen.getByText("Selected one")).toBeTruthy();
    const trigger = screen.getByRole("combobox", { name: "Choice" });
    expect(trigger.id).toBe("choice-trigger");
    expect(trigger.getAttribute("aria-describedby")).toBe("choice-help");
    expect(trigger.getAttribute("title")).toBe("Choose one");
    await user.click(trigger);
    const search = await screen.findByPlaceholderText("搜索…");
    await user.type(search, "secondary");
    expect(screen.getByRole("option", { name: "Two option" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "One option" })).toBeNull();
    await user.clear(search);
    await user.type(search, "gateway-id");
    expect(screen.getByRole("option", { name: "Two option" })).toBeTruthy();
    await user.click(screen.getByRole("option", { name: "Two option" }));

    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith("gateway-id-2"));
  });
});
