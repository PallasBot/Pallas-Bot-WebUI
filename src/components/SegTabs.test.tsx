// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import SegTabs from "@/components/SegTabs";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("uses HeroUI's tab indicator and keeps controlled selection accessible", async () => {
  const user = userEvent.setup();
  const onValueChange = vi.fn();
  const { container, rerender } = render(
    <SegTabs
      value="form"
      onValueChange={onValueChange}
      options={[{ value: "form", label: "表单" }, { value: "raw", label: "Raw TOML" }]}
      ariaLabel="编辑模式"
    />,
  );
  const form = screen.getByRole("tab", { name: "表单" });
  const raw = screen.getByRole("tab", { name: "Raw TOML" });
  const tabList = screen.getByRole("tablist", { name: "编辑模式" });
  const indicator = tabList.querySelector('[data-slot="tabs-indicator"]');

  expect(form.getAttribute("aria-selected")).toBe("true");
  expect(tabList.querySelectorAll('[data-slot="tabs-indicator"]')).toHaveLength(1);
  expect(indicator?.parentElement).toBe(form);
  expect(container.querySelector(".seg-tabs__list, .seg-tabs__selection-indicator")).toBeNull();
  form.focus();
  await user.keyboard("{ArrowRight}");
  expect(onValueChange).toHaveBeenCalledWith("raw");
  await user.click(raw);
  expect(onValueChange).toHaveBeenCalledWith("raw");

  rerender(
    <SegTabs
      value="raw"
      onValueChange={onValueChange}
      options={[{ value: "form", label: "表单" }, { value: "raw", label: "Raw TOML" }]}
      ariaLabel="编辑模式"
    />,
  );
  expect(raw.getAttribute("aria-selected")).toBe("true");
  expect(raw.querySelector('[data-slot="tabs-indicator"]')).not.toBeNull();
});
