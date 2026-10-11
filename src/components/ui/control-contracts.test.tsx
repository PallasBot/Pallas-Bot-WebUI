// @vitest-environment jsdom
import * as React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

afterEach(cleanup);
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("CSS", { ...window.CSS, escape: (value: string) => value });
});
afterEach(() => vi.unstubAllGlobals());

describe("Select", () => {
  it("selects by keyboard, reports open state, and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const openChanges: boolean[] = [];
    function ControlledSelect() {
      const [value, setValue] = React.useState("apple");
      return (
        <Select aria-label="Fruit" value={value} onValueChange={(next) => { onValueChange(next); setValue(next); }} onOpenChange={(open) => openChanges.push(open)}>
          <SelectTrigger aria-label="Fruit choices" title="Fruit selection"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="pear">Pear</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    render(<ControlledSelect />);

    const trigger = screen.getByRole("button", { name: /Fruit choices/ });
    expect(trigger.getAttribute("title")).toBe("Fruit selection");
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(await screen.findByRole("option", { name: "Apple" })).toBeTruthy();
    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith("pear"));
    expect(openChanges).toEqual([true, false]);
    expect(document.activeElement).toBe(trigger);
  });
});

describe("Tabs", () => {
  it("exposes selected state and its associated panel", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    function ControlledTabs() {
      const [value, setValue] = React.useState("overview");
      return (
        <Tabs value={value} onValueChange={(next) => { onValueChange(next); setValue(next); }}>
          <TabsList aria-label="Sections">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Overview panel</TabsContent>
          <TabsContent value="details">Details panel</TabsContent>
        </Tabs>
      );
    }
    render(<ControlledTabs />);

    const details = screen.getByRole("tab", { name: "Details" });
    await user.click(details);
    expect(onValueChange).toHaveBeenCalledWith("details");
    expect(details.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toContain("Details panel");
  });

});

describe("Tooltip", () => {
  it("opens on focus and restores the asChild trigger", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild><button type="button">Help</button></TooltipTrigger>
          <TooltipContent side="top">Helpful information</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    await user.tab();
    const trigger = screen.getByRole("button", { name: "Help" });
    expect(document.activeElement).toBe(trigger);
    expect((await screen.findByRole("tooltip")).textContent).toContain("Helpful information");
  });
});

describe("DropdownMenu", () => {
  it("uses stable identity and visible typeahead text, and closes after selection", async () => {
    const user = userEvent.setup();
    const sequence: string[] = [];
    const onSelect = vi.fn((event: Event) => sequence.push(event.type));
    render(
      <DropdownMenu onOpenChange={(open) => { if (!open) sequence.push("close"); }}>
        <DropdownMenuTrigger asChild><button type="button">Actions</button></DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem id="folder-open" textValue="Open directory" onSelect={onSelect}>
            <span aria-hidden="true">▣</span><span>Open directory</span>
          </DropdownMenuItem>
          <DropdownMenuItem id="folder-rename" textValue="Rename directory">Rename directory</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    const item = await screen.findByRole("menuitem", { name: "Open directory" });
    expect(item.getAttribute("data-key")).toBe("folder-open");
    await user.keyboard("o{Enter}");

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(sequence).toEqual(["menu-item-select", "close"]);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("does not close when onSelect cancels activation", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn((event: Event) => event.preventDefault());
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem id="keep-open" textValue="Keep open" onSelect={onSelect}>Keep open</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("calls pointer onClick and onSelect once before closing", async () => {
    const user = userEvent.setup();
    const sequence: string[] = [];
    render(
      <DropdownMenu onOpenChange={(open) => { if (!open) sequence.push("close"); }}>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            id="archive"
            textValue="Archive"
            onClick={() => sequence.push("click")}
            onSelect={() => sequence.push("select")}
          >
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Archive" }));
    expect(sequence).toEqual(["click", "select", "close"]);
  });
});
