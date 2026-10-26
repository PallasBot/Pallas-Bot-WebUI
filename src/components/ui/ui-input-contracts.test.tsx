// @vitest-environment jsdom
import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import UiInput from "@/components/ui/UiInput";
import { Input } from "@/components/ui/input";

afterEach(cleanup);

describe("Input adapter", () => {
  it("keeps controlled value, native props, and change events", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Controlled() {
      const [value, setValue] = React.useState("first");
      return (
        <Input
          aria-label="Account name"
          placeholder="Name"
          value={value}
          data-field="account"
          onChange={(e) => {
            onChange(e.target.value);
            setValue(e.target.value);
          }}
        />
      );
    }
    render(<Controlled />);

    const input = screen.getByRole("textbox", { name: "Account name" }) as HTMLInputElement;
    expect(input.placeholder).toBe("Name");
    expect(input.value).toBe("first");
    expect(input.getAttribute("data-field")).toBe("account");
    await user.type(input, "2");
    expect(input.value).toBe("first2");
    expect(onChange).toHaveBeenLastCalledWith("first2");
  });

  it("forwards number attributes and disabled state", () => {
    render(<Input aria-label="Port" type="number" min={1} max={65535} disabled value="8080" onChange={() => {}} />);

    const input = screen.getByRole("spinbutton", { name: "Port" }) as HTMLInputElement;
    expect(input.type).toBe("number");
    expect(input.min).toBe("1");
    expect(input.max).toBe("65535");
    expect(input.disabled).toBe(true);
    expect(input.value).toBe("8080");
  });

  it("merges a caller className without dropping the control styling", () => {
    render(<Input aria-label="Merged" className="form-field__control" value="" onChange={() => {}} />);

    const input = screen.getByRole("textbox", { name: "Merged" });
    expect(input.classList).toContain("form-field__control");
    expect(input.classList).toContain("min-h-[var(--ui-ctrl-height,36px)]");
  });
});

describe("UiInput compatibility adapter", () => {
  it("keeps controlled value and emits string values through onValueChange", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    function Controlled() {
      const [value, setValue] = React.useState("");
      return <UiInput aria-label="Speaker" value={value} onValueChange={(next) => { onValueChange(next); setValue(next); }} />;
    }
    render(<Controlled />);

    const input = screen.getByLabelText("Speaker") as HTMLInputElement;
    await user.type(input, "abc");
    expect(input.value).toBe("abc");
    expect(onValueChange).toHaveBeenLastCalledWith("abc");
  });

  it("marks invalid state with aria-invalid and the destructive border", () => {
    render(<UiInput aria-label="Invalid" invalid value="" onValueChange={() => {}} />);

    const input = screen.getByLabelText("Invalid");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.classList).toContain("border-destructive");
  });

  it("toggles password visibility when revealable", async () => {
    const user = userEvent.setup();
    render(<UiInput aria-label="Token" type="password" revealable value="secret" onValueChange={() => {}} />);

    const input = screen.getByLabelText("Token") as HTMLInputElement;
    expect(input.type).toBe("password");
    const toggle = screen.getByRole("button", { name: "显示内容" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    await user.click(toggle);
    expect(input.type).toBe("text");
    expect(screen.getByRole("button", { name: "隐藏内容" }).getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByRole("button", { name: "隐藏内容" }));
    expect(input.type).toBe("password");
  });

  it("keeps a plain password field masked without a reveal control", () => {
    render(<UiInput aria-label="Plain password" type="password" value="secret" onValueChange={() => {}} />);

    expect((screen.getByLabelText("Plain password") as HTMLInputElement).type).toBe("password");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("disables both the field and the reveal control", () => {
    render(<UiInput aria-label="Disabled token" type="password" revealable disabled value="secret" onValueChange={() => {}} />);

    expect((screen.getByLabelText("Disabled token") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "显示内容" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("forwards native events and the wrapper className/style", async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    const onKeyDown = vi.fn();
    const { container } = render(
      <UiInput
        aria-label="Wrapped"
        wrapClassName="plugin-governance-panel__cmd-control"
        wrapStyle={{ maxWidth: 120 }}
        value=""
        onValueChange={() => {}}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />,
    );

    const wrapper = container.querySelector(".plugin-governance-panel__cmd-control") as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.style.maxWidth).toBe("120px");

    const input = screen.getByLabelText("Wrapped");
    input.focus();
    await user.keyboard("{Enter}");
    input.blur();
    expect(onKeyDown).toHaveBeenCalled();
    expect(onBlur).toHaveBeenCalled();
  });
});
