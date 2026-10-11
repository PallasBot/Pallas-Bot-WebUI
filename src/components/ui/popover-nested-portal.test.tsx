// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

afterEach(cleanup);

function NestedPopoverDemo() {
  const [parentOpen, setParentOpen] = useState(false);
  const [childOpen, setChildOpen] = useState(false);

  return (
    <>
      <Popover open={parentOpen} onOpenChange={setParentOpen}>
        <PopoverTrigger>Open parent</PopoverTrigger>
        <PopoverContent>
          Parent details
          <Popover open={childOpen} onOpenChange={setChildOpen}>
            <PopoverTrigger>Open nested</PopoverTrigger>
            <PopoverContent>
              Nested details
              <button type="button">Nested action</button>
            </PopoverContent>
          </Popover>
        </PopoverContent>
      </Popover>
      <button type="button">Outside</button>
    </>
  );
}

describe("nested Popover portal dismissal", () => {
  it("keeps the parent open when a nested portaled popover is clicked", async () => {
    const user = userEvent.setup();
    render(<NestedPopoverDemo />);

    const parentTrigger = screen.getByRole("button", { name: "Open parent" });
    await user.click(parentTrigger);
    await user.click(screen.getByRole("button", { name: "Open nested" }));

    const parentDialog = screen.getByText("Parent details").closest('[role="dialog"]');
    const nestedDialog = screen.getByText("Nested details").closest('[role="dialog"]');
    expect(parentDialog).not.toBeNull();
    expect(nestedDialog).not.toBeNull();
    expect(parentDialog?.contains(nestedDialog)).toBe(false);

    await user.click(screen.getByRole("button", { name: "Nested action" }));

    expect(parentTrigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Parent details")).toBeTruthy();
  });

  it("still closes the parent on a true outside pointer click", async () => {
    const user = userEvent.setup();
    render(<NestedPopoverDemo />);

    const parentTrigger = screen.getByRole("button", { name: "Open parent" });
    await user.click(parentTrigger);
    expect(parentTrigger.getAttribute("aria-expanded")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Outside" }));

    await waitFor(() => expect(parentTrigger.getAttribute("aria-expanded")).toBe("false"));
  });
});
