// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListBox, Select as HeroSelect } from "@heroui/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConsolePagerBar from "@/components/ConsolePagerBar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, renderSelectTrigger } from "./select";

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

// getByRole's `name` option runs the accessible-name computation the browser exposes;
// matching the field label exactly fails if the name collapsed to the selected value.
describe("Select accessible name (legacy wrapper trigger aria-label)", () => {
  it("names the trigger by its aria-label when a value is selected", () => {
    render(<WrapperSelect />);

    expect(screen.getByRole("button", { name: "每页条数" }).textContent).toContain("25");
  });

  it("keeps the field name after the selected value changes", async () => {
    const user = userEvent.setup();
    render(<WrapperSelect />);

    await user.click(screen.getByRole("button", { name: "每页条数" }));
    await user.click(await screen.findByRole("option", { name: "50" }));

    expect(screen.getByRole("button", { name: "每页条数" }).textContent).toContain("50");
  });

  it("still names the production pager while it shows the page size", () => {
    render(
      <ConsolePagerBar page={1} pageSize={25} total={200} onPageChange={() => {}} onPageSizeChange={() => {}} />,
    );

    expect(screen.getByRole("button", { name: "每页条数" }).textContent).toContain("25");
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

    expect(screen.getByRole("button", { name: "请求方式" }).textContent).toContain("Chat Completions");
  });

  it("names the trigger by a root-only aria-label without appending the selected value", () => {
    render(
      <Select aria-label="请求方式" defaultValue="chat_completions">
        <SelectTrigger><SelectValue placeholder="Chat Completions" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="chat_completions">Chat Completions</SelectItem>
          <SelectItem value="responses">Responses</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByRole("button", { name: "请求方式" }).textContent).toContain("Chat Completions");
  });

  it("keeps a root aria-labelledby after the generated value token is cleared", () => {
    render(
      <>
        <span id="root-field-label">请求方式</span>
        <Select aria-labelledby="root-field-label" defaultValue="chat_completions">
          <SelectTrigger><SelectValue placeholder="Chat Completions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="chat_completions">Chat Completions</SelectItem>
            <SelectItem value="responses">Responses</SelectItem>
          </SelectContent>
        </Select>
      </>,
    );

    expect(screen.getByRole("button", { name: "请求方式" }).textContent).toContain("Chat Completions");
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

    expect(screen.getByRole("button", { name: "请求方式" }).textContent).toContain("Chat Completions");
  });

  it("falls back to the selected value when no field label is provided", () => {
    render(
      <Select defaultValue="chat_completions">
        <SelectTrigger><SelectValue placeholder="Chat Completions" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="chat_completions">Chat Completions</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByRole("button", { name: "Chat Completions" }).textContent).toContain("Chat Completions");
  });
});

describe("HeroUI Select accessible name (direct production usage)", () => {
  function LogsScopeSelect({ value }: { value: string }) {
    return (
      <HeroSelect.Root value={value} aria-label="日志范围">
        <HeroSelect.Trigger render={renderSelectTrigger()}>
          <HeroSelect.Value>{({ selectedText }) => selectedText}</HeroSelect.Value>
          <HeroSelect.Indicator />
        </HeroSelect.Trigger>
        <HeroSelect.Popover>
          <ListBox>
            <ListBox.Item id="all" textValue="全部">全部</ListBox.Item>
            <ListBox.Item id="message" textValue="消息">消息</ListBox.Item>
          </ListBox>
        </HeroSelect.Popover>
      </HeroSelect.Root>
    );
  }

  it("names the trigger by its aria-label when the selected value is 全部", () => {
    render(<LogsScopeSelect value="all" />);

    expect(screen.getByRole("button", { name: "日志范围" }).textContent).toContain("全部");
  });

  it("names the trigger by its aria-label when the selected value is 消息", () => {
    render(<LogsScopeSelect value="message" />);

    expect(screen.getByRole("button", { name: "日志范围" }).textContent).toContain("消息");
  });
});
