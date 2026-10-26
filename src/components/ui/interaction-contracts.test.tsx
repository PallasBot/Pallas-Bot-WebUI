// @vitest-environment jsdom
import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "./alert-dialog";
import { Calendar } from "./calendar";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

HTMLElement.prototype.scrollIntoView = vi.fn();
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("CSS", { ...globalThis.CSS, escape: globalThis.CSS?.escape ?? ((value: string) => value) });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Select", () => {
  it("updates the controlled value and exposes the selected option", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    function ControlledSelect() {
      const [value, setValue] = React.useState("apple");
      return (
        <Select value={value} onValueChange={(next) => { onValueChange(next); setValue(next); }}>
          <SelectTrigger aria-label="Fruit"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="pear">Pear</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    render(<ControlledSelect />);

    await user.click(screen.getByRole("combobox", { name: "Fruit" }));
    await user.click(await screen.findByRole("option", { name: "Pear" }));

    expect(onValueChange).toHaveBeenCalledWith("pear");
    const trigger = screen.getByRole("combobox", { name: "Fruit" });
    expect(trigger.textContent).toContain("Pear");
  });
});

describe("Popover", () => {
  it("opens from its trigger and dismisses with Escape", async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>Show options</PopoverTrigger>
        <PopoverContent>Popover details</PopoverContent>
      </Popover>,
    );

    await user.click(screen.getByRole("button", { name: "Show options" }));
    expect((await screen.findByRole("dialog")).textContent).toContain("Popover details");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Dialog", () => {
  it("exposes its title and description, then closes from the close control", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Open settings</DialogTrigger>
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Update preferences</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: "Open settings" }));
    const dialog = await screen.findByRole("dialog", { name: "Settings" });
    expect(dialog.textContent).toContain("Update preferences");
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("AlertDialog", () => {
  it("announces the alert and invokes its action before closing", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <AlertDialog>
        <AlertDialogTrigger>Delete item</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          <AlertDialogAction onClick={onAction}>Delete</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>,
    );

    await user.click(screen.getByRole("button", { name: "Delete item" }));
    const alert = await screen.findByRole("alertdialog", { name: "Confirm deletion" });
    expect(alert.textContent).toContain("This cannot be undone.");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("DropdownMenu", () => {
  it("activates a menu item from the keyboard", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem id="archive" textValue="Archive" onSelect={onSelect}>Archive</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(await screen.findByRole("menuitem", { name: "Archive" })).toBeTruthy();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("Tabs", () => {
  it("keeps selection and panel ARIA state synchronized", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    function ControlledTabs() {
      const [value, setValue] = React.useState("overview");
      return (
        <Tabs value={value} onValueChange={(next) => { onValueChange(next); setValue(next); }}>
          <TabsList aria-label="Account sections">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Overview panel</TabsContent>
          <TabsContent value="security">Security panel</TabsContent>
        </Tabs>
      );
    }
    render(<ControlledTabs />);

    const overview = screen.getByRole("tab", { name: "Overview" });
    const security = screen.getByRole("tab", { name: "Security" });
    expect(overview.getAttribute("aria-selected")).toBe("true");
    await user.click(security);

    expect(onValueChange).toHaveBeenCalledWith("security");
    expect(security.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toContain("Security panel");
  });
});

describe("Tooltip", () => {
  it("exposes its content when the trigger receives focus", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild><button type="button">Help</button></TooltipTrigger>
          <TooltipContent>Helpful information</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Help" }));
    expect((await screen.findByRole("tooltip")).textContent).toContain("Helpful information");
  });
});

describe("Calendar", () => {
  it("reports the selected date from a day button", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Calendar mode="single" defaultMonth={new Date(2025, 0, 1)} showOutsideDays={false} onSelect={onSelect} />);

    await user.click(screen.getByRole("gridcell", { name: "15" }));

    const selected = onSelect.mock.calls[0][0] as Date;
    expect([selected.getFullYear(), selected.getMonth(), selected.getDate()]).toEqual([2025, 0, 15]);
  });
});
