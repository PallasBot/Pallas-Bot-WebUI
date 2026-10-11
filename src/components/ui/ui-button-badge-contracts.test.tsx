// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("maps primary to the accent variant", () => {
    render(<UiButton variant="primary">Primary</UiButton>);

    const className = screen.getByRole("button", { name: "Primary" }).className;
    expect(className).toContain("button--primary");
    expect(className).not.toContain("button--secondary");
  });

  it("maps default to the neutral control variant", () => {
    render(<UiButton variant="default">Neutral</UiButton>);

    const className = screen.getByRole("button", { name: "Neutral" }).className;
    expect(className).toContain("button--secondary");
    expect(className).not.toContain("button--primary");
  });

  it("keeps destructive, outline, and ghost variant classes", () => {
    render(
      <>
        <UiButton variant="destructive">Delete</UiButton>
        <UiButton variant="outline">Outline</UiButton>
        <UiButton variant="ghost">Ghost</UiButton>
      </>,
    );

    const deleteClass = screen.getByRole("button", { name: "Delete" }).className;
    const outlineClass = screen.getByRole("button", { name: "Outline" }).className;
    const ghostClass = screen.getByRole("button", { name: "Ghost" }).className;
    expect(deleteClass).toContain("button--danger");
    expect(deleteClass).not.toContain("button--primary");
    expect(outlineClass).toContain("button--outline");
    expect(outlineClass).not.toContain("button--primary");
    expect(ghostClass).toContain("button--ghost");
    expect(ghostClass).not.toContain("button--primary");
  });

  it("maps sm, md, and lg sizes to the shared size scale", () => {
    render(
      <>
        <UiButton size="sm">Small</UiButton>
        <UiButton size="md">Medium</UiButton>
        <UiButton size="lg">Large</UiButton>
      </>,
    );

    expect(screen.getByRole("button", { name: "Small" }).className).toContain("button--sm");
    expect(screen.getByRole("button", { name: "Medium" }).className).toContain("button--md");
    expect(screen.getByRole("button", { name: "Large" }).className).toContain("button--lg");
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
