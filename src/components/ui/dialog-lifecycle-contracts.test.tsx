// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogBody, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function installCssEscapeShim() {
  Object.defineProperty(globalThis, "CSS", {
    configurable: true,
    value: Object.assign(globalThis.CSS ?? {}, { escape: (value: string) => value }),
  });
}

beforeEach(installCssEscapeShim);
afterEach(cleanup);

async function flushAnimationFrames() {
  const nextFrame = () => new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else window.setTimeout(resolve, 0);
  });
  await nextFrame();
  await nextFrame();
}

it("bridges controlled triggers and close requests to the owner", async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  const view = render(<Dialog open={false} onOpenChange={onOpenChange}>
    <DialogTrigger>Open settings</DialogTrigger>
    <DialogContent><DialogTitle>Settings</DialogTitle><DialogClose>Done</DialogClose></DialogContent>
  </Dialog>);

  await user.click(screen.getByRole("button", { name: "Open settings" }));
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  expect(screen.queryByRole("dialog")).toBeNull();

  view.rerender(<Dialog open onOpenChange={onOpenChange}>
    <DialogTrigger>Open settings</DialogTrigger>
    <DialogContent><DialogTitle>Settings</DialogTitle><DialogClose>Done</DialogClose></DialogContent>
  </Dialog>);
  await user.click(screen.getByRole("button", { name: "Done" }));
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole("dialog")).toBeTruthy();
});

it("bridges uncontrolled triggers and close requests", async () => {
  const user = userEvent.setup();
  render(<Dialog defaultOpen={false}>
    <DialogTrigger>Open settings</DialogTrigger>
    <DialogContent><DialogTitle>Settings</DialogTitle><DialogClose>Done</DialogClose></DialogContent>
  </Dialog>);
  await user.click(screen.getByRole("button", { name: "Open settings" }));
  expect(await screen.findByRole("dialog")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("keeps a controlled dialog open when the owner vetoes Escape and outside close requests", async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  render(<Dialog open onOpenChange={onOpenChange}>
    <DialogContent><DialogTitle>Settings</DialogTitle></DialogContent>
  </Dialog>);
  await user.keyboard("{Escape}");
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.pointerDown(document.body);
  fireEvent.click(document.body);
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole("dialog")).toBeTruthy();
});

it("honors Escape and outside callback preventDefault semantics", async () => {
  const user = userEvent.setup();
  const onEscapeKeyDown = vi.fn((event: KeyboardEvent) => event.preventDefault());
  const onPointerDownOutside = vi.fn((event: CustomEvent<{ originalEvent: PointerEvent }>) => event.preventDefault());
  const onInteractOutside = vi.fn((event: CustomEvent<{ originalEvent: PointerEvent | FocusEvent }>) => event.preventDefault());
  render(<Dialog defaultOpen>
    <DialogContent onEscapeKeyDown={onEscapeKeyDown} onPointerDownOutside={onPointerDownOutside} onInteractOutside={onInteractOutside}>
      <DialogTitle>Settings</DialogTitle>
    </DialogContent>
  </Dialog>);

  screen.getByRole("dialog").focus();
  await user.keyboard("{Escape}");
  expect(onEscapeKeyDown).toHaveBeenCalledOnce();
  expect(screen.getByRole("dialog")).toBeTruthy();
  const backdrop = document.querySelector<HTMLElement>('[data-slot="modal-backdrop"]');
  if (!backdrop) throw new Error("Dialog backdrop was not rendered");
  fireEvent.pointerDown(backdrop, { button: 0 });
  fireEvent.click(backdrop);
  expect(onPointerDownOutside).toHaveBeenCalledOnce();
  expect(onInteractOutside).toHaveBeenCalledOnce();
  expect(onPointerDownOutside.mock.calls[0][0]).toBe(onInteractOutside.mock.calls[0][0]);
  expect(screen.getByRole("dialog")).toBeTruthy();
});

it("forwards Dialog onOpenAutoFocus and lets it choose the initial focus target", async () => {
  const user = userEvent.setup();
  const onOpenAutoFocus = vi.fn((event: Event) => {
    event.preventDefault();
    document.getElementById("custom-dialog-focus")?.focus();
  });
  render(<Dialog>
    <DialogTrigger>Open settings</DialogTrigger>
    <DialogContent onOpenAutoFocus={onOpenAutoFocus}>
      <DialogTitle>Settings</DialogTitle>
      <button id="custom-dialog-focus" type="button">Custom focus</button>
    </DialogContent>
  </Dialog>);

  await user.click(screen.getByRole("button", { name: "Open settings" }));
  expect(await screen.findByRole("dialog", { name: "Settings" })).toBeTruthy();
  await waitFor(() => expect(onOpenAutoFocus).toHaveBeenCalledOnce());
  expect(onOpenAutoFocus.mock.calls[0][0].defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Custom focus" }));
});

it("keeps the trigger focused when Dialog onOpenAutoFocus vetoes without choosing a target", async () => {
  const user = userEvent.setup();
  const onOpenAutoFocus = vi.fn((event: Event) => event.preventDefault());
  render(<Dialog>
    <DialogTrigger>Open settings</DialogTrigger>
    <DialogContent onOpenAutoFocus={onOpenAutoFocus}>
      <DialogTitle>Settings</DialogTitle>
    </DialogContent>
  </Dialog>);

  const trigger = screen.getByRole("button", { name: "Open settings" });
  await user.click(trigger);
  expect(await screen.findByRole("dialog", { name: "Settings" })).toBeTruthy();
  await waitFor(() => expect(onOpenAutoFocus).toHaveBeenCalledOnce());
  expect(onOpenAutoFocus.mock.calls[0][0].defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(trigger);
});

it("keeps pointerdown veto until React Aria's document-capture check", () => {
  const originalPointerEvent = globalThis.PointerEvent;
  class PointerEventShim extends MouseEvent {
    readonly pointerId = 1;
    readonly pointerType = "mouse";
    readonly isPrimary = true;
  }
  Object.defineProperty(globalThis, "PointerEvent", { configurable: true, value: PointerEventShim });
  try {
    const onOpenChange = vi.fn();
    const onPointerDownOutside = vi.fn((event: CustomEvent<{ originalEvent: PointerEvent }>) => event.preventDefault());
    render(<Dialog open onOpenChange={onOpenChange}>
      <DialogContent onPointerDownOutside={onPointerDownOutside}><DialogTitle>Settings</DialogTitle></DialogContent>
    </Dialog>);

    const backdrop = document.querySelector<HTMLElement>('[data-slot="modal-backdrop"]');
    if (!backdrop) throw new Error("Dialog backdrop was not rendered");
    vi.useFakeTimers();
    const queueMicrotaskSpy = vi.spyOn(globalThis, "queueMicrotask").mockImplementation((callback) => callback());
    try {
      fireEvent.pointerDown(backdrop, { button: 0 });
      vi.advanceTimersByTime(1500);
    } finally {
      queueMicrotaskSpy.mockRestore();
      vi.useRealTimers();
    }
    fireEvent.click(backdrop, { button: 0 });

    expect(onPointerDownOutside).toHaveBeenCalledOnce();
    expect(onPointerDownOutside.mock.calls[0][0].detail.originalEvent).toBeInstanceOf(PointerEventShim);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  } finally {
    if (typeof originalPointerEvent === "undefined") Reflect.deleteProperty(globalThis, "PointerEvent");
    else Object.defineProperty(globalThis, "PointerEvent", { configurable: true, value: originalPointerEvent });
  }
});

it("keeps pointer veto across rerender from an inline outside callback", () => {
  const originalPointerEvent = globalThis.PointerEvent;
  class PointerEventShim extends MouseEvent {
    readonly pointerId = 1;
    readonly pointerType = "mouse";
    readonly isPrimary = true;
  }
  Object.defineProperty(globalThis, "PointerEvent", { configurable: true, value: PointerEventShim });
  try {
    const onOpenChange = vi.fn();
    const onPointerDownOutside = vi.fn((event: CustomEvent<{ originalEvent: PointerEvent }>) => event.preventDefault());
    function InlineVetoDialog() {
      const [count, setCount] = React.useState(0);
      return <Dialog open onOpenChange={onOpenChange}>
        <DialogContent onPointerDownOutside={(event) => {
          onPointerDownOutside(event);
          setCount(count + 1);
        }}>
          <DialogTitle>Settings</DialogTitle>
          <output>{count}</output>
        </DialogContent>
      </Dialog>;
    }

    render(<InlineVetoDialog />);
    const backdrop = document.querySelector<HTMLElement>('[data-slot="modal-backdrop"]');
    if (!backdrop) throw new Error("Dialog backdrop was not rendered");
    fireEvent.pointerDown(backdrop, { button: 0 });
    expect(screen.getByText("1")).toBeTruthy();
    fireEvent.click(backdrop, { button: 0 });

    expect(onPointerDownOutside).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
  } finally {
    if (typeof originalPointerEvent === "undefined") Reflect.deleteProperty(globalThis, "PointerEvent");
    else Object.defineProperty(globalThis, "PointerEvent", { configurable: true, value: originalPointerEvent });
  }
});

it("does not close on focus outside, right-click, or Ctrl-click", async () => {
  const onOpenChange = vi.fn();
  const { container } = render(<>
    <button type="button">Outside</button>
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent><DialogTitle>Settings</DialogTitle></DialogContent>
    </Dialog>
  </>);
  const outside = container.querySelector("button");
  if (!outside) throw new Error("Outside button was not rendered");
  fireEvent.focus(outside);
  const backdrop = document.querySelector<HTMLElement>('[data-slot="modal-backdrop"]');
  if (!backdrop) throw new Error("Dialog backdrop was not rendered");
  fireEvent.pointerDown(backdrop, { button: 2 });
  fireEvent.click(backdrop, { button: 2 });
  fireEvent.pointerDown(backdrop, { button: 0, ctrlKey: true });
  fireEvent.click(backdrop, { button: 0, ctrlKey: true });
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeTruthy();
});

it("lets the top nested dialog handle Escape without requesting parent close", async () => {
  const user = userEvent.setup();
  const onParentOpenChange = vi.fn();
  function NestedDialogs() {
    const [childOpen, setChildOpen] = React.useState(false);
    return <Dialog open onOpenChange={onParentOpenChange}>
      <DialogContent>
        <DialogTitle>Parent</DialogTitle>
        <button type="button" onClick={() => setChildOpen(true)}>Open child</button>
        <Dialog open={childOpen} onOpenChange={setChildOpen}>
          <DialogContent><DialogTitle>Child</DialogTitle></DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>;
  }
  render(<NestedDialogs />);
  await user.click(screen.getByRole("button", { name: "Open child" }));
  const child = await screen.findByRole("dialog", { name: "Child" });
  child.focus();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Child" })).toBeNull());
  expect(screen.getByRole("dialog", { name: "Parent" })).toBeTruthy();
  expect(onParentOpenChange).not.toHaveBeenCalled();
});

it("does not request parent close when a child Popover opens", async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  render(<Dialog open onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogTitle>Parent</DialogTitle>
      <Popover>
        <PopoverTrigger>Open child popover</PopoverTrigger>
        <PopoverContent>Popover details</PopoverContent>
      </Popover>
    </DialogContent>
  </Dialog>);
  await user.click(screen.getByRole("button", { name: "Open child popover" }));
  expect(await screen.findByText("Popover details")).toBeTruthy();
  expect(onOpenChange).not.toHaveBeenCalled();
});

it("renders a described dialog through HeroUI Text without an asChild wrapper", () => {
  render(<Dialog open>
    <DialogContent>
      <DialogTitle>Settings</DialogTitle>
      <DialogDescription asChild><p id="settings-description">Description text</p></DialogDescription>
    </DialogContent>
  </Dialog>);
  const dialog = screen.getByRole("dialog", { name: "Settings" });
  const description = screen.getByText("Description text");
  expect(dialog.getAttribute("aria-describedby")).toBe("settings-description");
  expect(description.tagName).toBe("P");
  expect(description.getAttribute("data-slot")).toBe("description");
});

it("keeps the built-in close button focus-visible in forced-colors mode", () => {
  render(<Dialog open><DialogContent><DialogTitle>Settings</DialogTitle></DialogContent></Dialog>);
  const closeButton = screen.getByRole("button", { name: "关闭" });
  expect(closeButton.className).toContain("focus-visible:ring-1");
  expect(closeButton.className).toContain("forced-colors:focus-visible:outline-solid");
  expect(closeButton.className).toContain("forced-colors:focus-visible:outline-2");
  expect(closeButton.className).toContain("forced-colors:focus-visible:outline-offset-2");
  expect(closeButton.className).toContain("forced-colors:focus-visible:outline-[Highlight]");
});

it("uses only the direct asChild ID for dialog descriptions", () => {
  render(<Dialog open>
    <DialogContent>
      <DialogTitle>Settings</DialogTitle>
      <DialogDescription asChild>
        <div><span id="nested-description">Description text</span></div>
      </DialogDescription>
    </DialogContent>
  </Dialog>);

  const dialog = screen.getByRole("dialog", { name: "Settings" });
  const description = screen.getByText("Description text").parentElement;
  expect(description?.id).not.toBe("nested-description");
  expect(dialog.getAttribute("aria-describedby")).toBe(description?.id);
});

it("does not add a DOM wrapper for a closed Dialog root", () => {
  const { container } = render(<Dialog open={false}>
    <DialogTrigger>Open</DialogTrigger>
  </Dialog>);
  expect(container.children).toHaveLength(1);
  expect(container.firstElementChild?.tagName).toBe("BUTTON");
});

it("calls onCloseAutoFocus and honors its focus-restoration veto", async () => {
  const user = userEvent.setup();
  const returnFocus = document.createElement("button");
  returnFocus.textContent = "Return focus";
  document.body.append(returnFocus);
  const onCloseAutoFocus = vi.fn((event: Event) => {
    event.preventDefault();
    returnFocus.focus();
  });
  render(<Dialog defaultOpen>
    <DialogContent onCloseAutoFocus={onCloseAutoFocus}><DialogTitle>Settings</DialogTitle><DialogClose>Done</DialogClose></DialogContent>
  </Dialog>);
  await user.click(screen.getByRole("button", { name: "Done" }));
  await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledOnce());
  expect(onCloseAutoFocus.mock.calls[0][0].defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(returnFocus);
  returnFocus.remove();
});

it("lets preventDefault suppress default focus restoration without blurring", async () => {
  const user = userEvent.setup();
  const returnFocus = document.createElement("button");
  returnFocus.textContent = "Return focus";
  document.body.append(returnFocus);
  returnFocus.focus();
  const onCloseAutoFocus = vi.fn((event: Event) => event.preventDefault());
  render(<Dialog defaultOpen>
    <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
      <DialogTitle>Settings</DialogTitle><DialogClose>Done</DialogClose>
    </DialogContent>
  </Dialog>);
  await user.click(screen.getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onCloseAutoFocus).toHaveBeenCalledOnce();
  expect(document.activeElement).not.toBe(returnFocus);
  await flushAnimationFrames();
  expect(document.activeElement).not.toBe(returnFocus);
  expect(returnFocus.dispatchEvent(new Event("react-aria-focus-scope-restore", { cancelable: true }))).toBe(true);
  returnFocus.remove();
});

it("does not treat StrictMode effect replay as a close", async () => {
  const user = userEvent.setup();
  const onCloseAutoFocus = vi.fn();
  function StrictDialog() {
    const [open, setOpen] = React.useState(true);
    return <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <DialogTitle>Settings</DialogTitle><DialogClose>Done</DialogClose>
      </DialogContent>
    </Dialog>;
  }

  render(<React.StrictMode><StrictDialog /></React.StrictMode>);
  expect(onCloseAutoFocus).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Done" }));
  await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledOnce());
});

it("fires close autofocus on direct unmount and before a replacement modal restores focus", async () => {
  const onCloseAutoFocus = vi.fn();
  const view = render(<Dialog open>
    <DialogContent onCloseAutoFocus={onCloseAutoFocus}><DialogTitle>Temporary</DialogTitle></DialogContent>
  </Dialog>);
  view.unmount();
  await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledOnce());

  const user = userEvent.setup();
  const onFirstCloseAutoFocus = vi.fn();
  function ReplacingDialogs() {
    const [firstOpen, setFirstOpen] = React.useState(true);
    const [secondOpen, setSecondOpen] = React.useState(false);
    return <>
      <Dialog open={firstOpen} onOpenChange={setFirstOpen}>
        <DialogContent onCloseAutoFocus={onFirstCloseAutoFocus}>
          <DialogTitle>First</DialogTitle>
          <button type="button" onClick={() => { setFirstOpen(false); setSecondOpen(true); }}>Replace</button>
        </DialogContent>
      </Dialog>
      <Dialog open={secondOpen} onOpenChange={setSecondOpen}>
        <DialogContent><DialogTitle>Second</DialogTitle></DialogContent>
      </Dialog>
    </>;
  }
  render(<ReplacingDialogs />);
  await user.click(screen.getByRole("button", { name: "Replace" }));
  expect(await screen.findByRole("dialog", { name: "Second" })).toBeTruthy();
  await waitFor(() => expect(onFirstCloseAutoFocus).toHaveBeenCalledOnce());
  expect(screen.getByRole("dialog", { name: "Second" })).toBeTruthy();
});

it("forwards the content ref and resets scroll before notifying onScroll", () => {
  const ref = React.createRef<HTMLElement>();
  const onScroll = vi.fn();
  render(<Dialog open>
    <DialogContent ref={ref} onScroll={onScroll}><DialogTitle>Settings</DialogTitle></DialogContent>
  </Dialog>);
  expect(ref.current?.getAttribute("role")).toBe("dialog");
  if (!ref.current) throw new Error("DialogContent ref was not assigned");
  ref.current.scrollTop = 18;
  ref.current.scrollLeft = 7;
  fireEvent.scroll(ref.current);
  expect(ref.current.scrollTop).toBe(0);
  expect(ref.current.scrollLeft).toBe(0);
  expect(onScroll).toHaveBeenCalledOnce();
});

it("opens an uncontrolled alert trigger and does not close on an ordinary async confirmation failure", async () => {
  const user = userEvent.setup();
  const onFailure = vi.fn(async () => { throw new Error("request failed"); });
  render(<AlertDialog defaultOpen={false}>
    <AlertDialogTrigger>Open confirmation</AlertDialogTrigger>
    <AlertDialogContent><AlertDialogTitle>Confirm</AlertDialogTitle>
      <Button onClick={() => { void onFailure().catch(() => undefined); }}>Continue</Button>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
    </AlertDialogContent>
  </AlertDialog>);
  await user.click(screen.getByRole("button", { name: "Open confirmation" }));
  expect(await screen.findByRole("alertdialog")).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() => expect(onFailure).toHaveBeenCalledOnce());
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
});

it("lets AlertDialog onOpenAutoFocus override the default Cancel focus", async () => {
  const user = userEvent.setup();
  const onOpenAutoFocus = vi.fn((event: Event) => {
    event.preventDefault();
    document.getElementById("custom-alert-focus")?.focus();
  });
  render(<AlertDialog defaultOpen={false}>
    <AlertDialogTrigger>Open confirmation</AlertDialogTrigger>
    <AlertDialogContent onOpenAutoFocus={onOpenAutoFocus}>
      <AlertDialogTitle>Confirm</AlertDialogTitle>
      <button id="custom-alert-focus" type="button">Custom focus</button>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
    </AlertDialogContent>
  </AlertDialog>);

  await user.click(screen.getByRole("button", { name: "Open confirmation" }));
  expect(await screen.findByRole("alertdialog")).toBeTruthy();
  expect(onOpenAutoFocus).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Custom focus" }));
});

it("keeps the trigger focused when AlertDialog onOpenAutoFocus vetoes without choosing a target", async () => {
  const user = userEvent.setup();
  const onOpenAutoFocus = vi.fn((event: Event) => event.preventDefault());
  render(<AlertDialog>
    <AlertDialogTrigger>Open confirmation</AlertDialogTrigger>
    <AlertDialogContent onOpenAutoFocus={onOpenAutoFocus}>
      <AlertDialogTitle>Confirm</AlertDialogTitle>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
    </AlertDialogContent>
  </AlertDialog>);

  const trigger = screen.getByRole("button", { name: "Open confirmation" });
  await user.click(trigger);
  expect(await screen.findByRole("alertdialog")).toBeTruthy();
  await waitFor(() => expect(onOpenAutoFocus).toHaveBeenCalledOnce());
  expect(onOpenAutoFocus.mock.calls[0][0].defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(trigger);
});

it("does not auto-close an alert when an ordinary confirmation button is clicked", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(<AlertDialog open><AlertDialogContent><AlertDialogTitle>Confirm</AlertDialogTitle><Button onClick={onConfirm}>Continue</Button></AlertDialogContent></AlertDialog>);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("alertdialog")).toBeTruthy();
});

it("forwards alert close-autofocus callbacks and their preventDefault state", async () => {
  const user = userEvent.setup();
  const onCloseAutoFocus = vi.fn((event: Event) => event.preventDefault());
  render(<AlertDialog defaultOpen>
    <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
      <AlertDialogTitle>Confirm</AlertDialogTitle>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
    </AlertDialogContent>
  </AlertDialog>);
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledOnce());
  expect(onCloseAutoFocus.mock.calls[0][0].defaultPrevented).toBe(true);
});

it("keeps AlertDialog outside dismissal disabled while honoring preventable Escape", async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  const onEscapeKeyDown = vi.fn((event: KeyboardEvent) => event.preventDefault());
  render(<AlertDialog open onOpenChange={onOpenChange}>
    <AlertDialogContent onEscapeKeyDown={onEscapeKeyDown}>
      <AlertDialogTitle>Confirm</AlertDialogTitle>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
    </AlertDialogContent>
  </AlertDialog>);
  const backdrop = document.querySelector<HTMLElement>('[data-slot="alert-dialog-backdrop"]');
  if (!backdrop) throw new Error("AlertDialog backdrop was not rendered");
  fireEvent.pointerDown(backdrop);
  fireEvent.click(backdrop);
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  expect(onOpenChange).not.toHaveBeenCalled();

  screen.getByRole("alertdialog").focus();
  await user.keyboard("{Escape}");
  expect(onEscapeKeyDown).toHaveBeenCalledOnce();
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
});

it("closes AlertDialog on plain Escape while keeping outside dismissal disabled", async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  const onEscapeKeyDown = vi.fn();
  render(<AlertDialog open onOpenChange={onOpenChange}>
    <AlertDialogContent onEscapeKeyDown={onEscapeKeyDown}>
      <AlertDialogTitle>Confirm</AlertDialogTitle>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
    </AlertDialogContent>
  </AlertDialog>);

  const backdrop = document.querySelector<HTMLElement>('[data-slot="alert-dialog-backdrop"]');
  if (!backdrop) throw new Error("AlertDialog backdrop was not rendered");
  fireEvent.pointerDown(backdrop);
  fireEvent.click(backdrop);
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(screen.getByRole("alertdialog")).toBeTruthy();

  screen.getByRole("alertdialog").focus();
  await user.keyboard("{Escape}");
  expect(onEscapeKeyDown).toHaveBeenCalledOnce();
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
});

it("defaults AlertDialog action and cancel buttons to type button inside forms", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
  render(<AlertDialog open>
    <AlertDialogContent>
      <AlertDialogTitle>Confirm</AlertDialogTitle>
      <AlertDialogDescription>Confirm description</AlertDialogDescription>
      <form onSubmit={onSubmit}>
        <AlertDialogAction>Confirm action</AlertDialogAction>
        <AlertDialogCancel>Cancel action</AlertDialogCancel>
      </form>
    </AlertDialogContent>
  </AlertDialog>);
  const action = screen.getByRole("button", { name: "Confirm action" });
  const cancel = screen.getByRole("button", { name: "Cancel action" });
  expect(screen.getByRole("alertdialog", { name: "Confirm" }).getAttribute("aria-describedby")).toBe(
    screen.getByText("Confirm description").getAttribute("id"),
  );
  expect(action.getAttribute("type")).toBe("button");
  expect(cancel.getAttribute("type")).toBe("button");
  await user.click(action);
  expect(onSubmit).not.toHaveBeenCalled();
  await user.click(cancel);
  expect(onSubmit).not.toHaveBeenCalled();
});

it("renders the AlertDialog title, description and body text", () => {
  render(<AlertDialog open>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>卸载插件「牛牛唱歌」</AlertDialogTitle>
        <AlertDialogDescription>将删除源码目录。此操作不可撤销。</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogBody>
        <p>卸载会删除源码目录。确认后执行。</p>
      </AlertDialogBody>
      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>);

  const dialog = screen.getByRole("alertdialog", { name: "卸载插件「牛牛唱歌」" });
  const description = screen.getByText("将删除源码目录。此操作不可撤销。");
  expect(description.tagName).toBe("P");
  expect(screen.getByText("卸载会删除源码目录。确认后执行。")).toBeTruthy();
  expect(dialog.getAttribute("aria-describedby")).toBe(description.getAttribute("id"));
  expect(document.querySelector('[data-slot="alert-dialog-body"]')).toBeTruthy();
});
