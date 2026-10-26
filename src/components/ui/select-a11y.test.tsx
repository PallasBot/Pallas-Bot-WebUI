// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConsolePagerBar from "@/components/ConsolePagerBar";
import { Label } from "@/components/ui/label";
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

function WrapperSelect({ defaultValue = "25" }: { defaultValue?: string }) {
  return (
    <Select defaultValue={defaultValue}>
      <SelectTrigger aria-label="每页条数"><SelectValue placeholder="请选择" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="25">25</SelectItem>
        <SelectItem value="50">50</SelectItem>
      </SelectContent>
    </Select>
  );
}

// getByRole 的 `name` 走浏览器同款可访问名称计算；若名称塌缩成选中值则匹配失败。
describe("Select accessible name (trigger aria-label)", () => {
  it("names the trigger by its aria-label when a value is selected", () => {
    render(<WrapperSelect />);

    expect(screen.getByRole("combobox", { name: "每页条数" }).textContent).toContain("25");
  });

  it("keeps the field name after the selected value changes", async () => {
    const user = userEvent.setup();
    render(<WrapperSelect />);

    await user.click(screen.getByRole("combobox", { name: "每页条数" }));
    await user.click(await screen.findByRole("option", { name: "50" }));

    expect(screen.getByRole("combobox", { name: "每页条数" }).textContent).toContain("50");
  });

  it("still names the production pager while it shows the page size", () => {
    render(
      <ConsolePagerBar page={1} pageSize={25} total={200} onPageChange={() => {}} onPageSizeChange={() => {}} />,
    );

    expect(screen.getByRole("combobox", { name: "每页条数" }).textContent).toContain("25");
  });
});

describe("Select accessible name (explicit field label, not the selected value)", () => {
  it("names the trigger from an external <Label htmlFor>", () => {
    render(
      <>
        <Label htmlFor="request-method">请求方式</Label>
        <Select defaultValue="chat_completions">
          <SelectTrigger id="request-method">
            <SelectValue placeholder="Chat Completions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="chat_completions">Chat Completions</SelectItem>
            <SelectItem value="responses">Responses</SelectItem>
          </SelectContent>
        </Select>
      </>,
    );

    expect(screen.getByRole("combobox", { name: "请求方式" }).textContent).toContain("Chat Completions");
  });

  it("keeps an explicit trigger aria-labelledby", () => {
    render(
      <>
        <span id="trigger-field-label">请求方式</span>
        <Select defaultValue="chat_completions">
          <SelectTrigger aria-labelledby="trigger-field-label">
            <SelectValue placeholder="Chat Completions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="chat_completions">Chat Completions</SelectItem>
            <SelectItem value="responses">Responses</SelectItem>
          </SelectContent>
        </Select>
      </>,
    );

    expect(screen.getByRole("combobox", { name: "请求方式" }).textContent).toContain("Chat Completions");
  });

  it("renders the selected value inside the trigger when no field label is provided", () => {
    render(
      <Select defaultValue="chat_completions">
        <SelectTrigger><SelectValue placeholder="Chat Completions" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="chat_completions">Chat Completions</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByRole("combobox").textContent).toContain("Chat Completions");
  });
});
