// @vitest-environment jsdom
import type { ReactElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import UiButton from "@/components/ui/UiButton";
import UiBadge, { type UiBadgeVariant } from "@/components/ui/UiBadge";

afterEach(cleanup);

describe("UiButton adapter", () => {
  it("keeps the legacy native type default of button", () => {
    render(<UiButton>Default type</UiButton>);

    expect((screen.getByRole("button", { name: "Default type" }) as HTMLButtonElement).type).toBe("button");
  });

  it("forwards an explicit type and native props", () => {
    render(
      <UiButton type="submit" aria-label="Submit form" data-field="save">
        Save
      </UiButton>,
    );

    const button = screen.getByRole("button", { name: "Submit form" }) as HTMLButtonElement;
    expect(button.type).toBe("submit");
    expect(button.getAttribute("data-field")).toBe("save");
  });

  /** 适配层只做 API 映射：产出的变体类应与 shadcn Button 对应变体完全一致。 */
  function classesFor(ui: ReactElement, expected: ReactElement): [string, string] {
    const uiView = render(ui);
    const uiClass = screen.getByRole("button").className;
    uiView.unmount();
    cleanup();
    render(expected);
    const expectedClass = screen.getByRole("button").className;
    cleanup();
    return [uiClass, expectedClass];
  }

  it("maps primary to the accent variant", () => {
    const [uiClass, expectedClass] = classesFor(
      <UiButton variant="primary">Primary</UiButton>,
      <Button variant="default">Primary</Button>,
    );
    expect(uiClass).toBe(expectedClass);
    expect(uiClass).toContain("bg-[var(--accent)]");
  });

  it("maps default to the neutral control variant", () => {
    const [uiClass, expectedClass] = classesFor(
      <UiButton variant="default">Neutral</UiButton>,
      <Button variant="secondary">Neutral</Button>,
    );
    expect(uiClass).toBe(expectedClass);
    expect(uiClass).not.toContain("bg-[var(--accent)]");
  });

  it("keeps destructive, outline, and ghost variant classes", () => {
    for (const variant of ["destructive", "outline", "ghost"] as const) {
      const [uiClass, expectedClass] = classesFor(
        <UiButton variant={variant}>{variant}</UiButton>,
        <Button variant={variant}>{variant}</Button>,
      );
      expect(uiClass).toBe(expectedClass);
    }
  });

  it("maps sm, md, and lg sizes to the shared size scale", () => {
    const sizeMap = { sm: "sm", md: "default", lg: "lg" } as const;
    for (const size of ["sm", "md", "lg"] as const) {
      const [uiClass, expectedClass] = classesFor(
        <UiButton size={size}>{size}</UiButton>,
        <Button variant="secondary" size={sizeMap[size]}>{size}</Button>,
      );
      expect(uiClass).toBe(expectedClass);
    }
  });

  it("applies block width and merges caller classes", () => {
    render(
      <UiButton block className="custom-button">
        Full width
      </UiButton>,
    );

    const className = screen.getByRole("button", { name: "Full width" }).className;
    expect(className).toContain("w-full");
    expect(className).toContain("custom-button");
  });

  it("preserves native click semantics and the disabled guard", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { unmount } = render(<UiButton onClick={onClick}>Activate</UiButton>);

    await user.click(screen.getByRole("button", { name: "Activate" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    unmount();
    render(
      <UiButton disabled onClick={onClick}>
        Blocked
      </UiButton>,
    );
    const disabled = screen.getByRole("button", { name: "Blocked" }) as HTMLButtonElement;
    expect(disabled.disabled).toBe(true);
    await user.click(disabled);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("UiBadge adapter", () => {
  it("keeps the ok to success variant mapping and other legacy variants", () => {
    const cases: Array<[UiBadgeVariant, string]> = [
      ["default", "badge--info"],
      ["secondary", "badge--neutral"],
      ["outline", "badge--outline"],
      ["ok", "badge--success"],
      ["warn", "badge--warning"],
      ["muted", "badge--muted"],
      ["destructive", "badge--danger"],
    ];

    for (const [variant, expectedClass] of cases) {
      const label = `${variant}-badge`;
      const view = render(
        <UiBadge variant={variant} title={label}>
          {label}
        </UiBadge>,
      );
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.getByTitle(label).className).toContain(expectedClass);
      view.unmount();
    }
  });

  it("defaults to the secondary variant and forwards attributes and caller classes", () => {
    render(
      <UiBadge title="Status" data-kind="federation" className="custom-badge">
        Enabled
      </UiBadge>,
    );

    const badge = screen.getByTitle("Status");
    expect(badge.className).toContain("badge--neutral");
    expect(badge.className).toContain("custom-badge");
    expect(badge.getAttribute("data-kind")).toBe("federation");
    expect(screen.getByText("Enabled")).toBeTruthy();
  });
});
