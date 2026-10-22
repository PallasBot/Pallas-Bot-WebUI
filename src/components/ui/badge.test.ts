// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("retains content, supported variants, sizes, and forwarded attributes", () => {
    const variants = [
      ["default", "regular", "badge--info"],
      ["secondary", "compact", "badge--neutral"],
      ["destructive", "regular", "badge--danger"],
      ["danger", "compact", "badge--danger"],
      ["outline", "regular", "badge--outline"],
      ["success", "compact", "badge--success"],
      ["warn", "regular", "badge--warning"],
      ["muted", "compact", "badge--muted"],
      ["pending", "regular", "badge--pending"],
      ["info", "compact", "badge--info"],
      ["neutral", "regular", "badge--neutral"],
    ] as const;

    for (const [variant, size, variantClass] of variants) {
      const content = `${variant} ${size}`;
      const view = render(createElement(Badge, { variant, size, title: content, children: content }));
      expect(screen.getByText(content)).toBeTruthy();
      const badge = screen.getByTitle(content);
      expect(badge.classList).toContain(variantClass);
      expect(badge.classList).toContain(size === "compact" ? "badge--compact" : "badge--regular");
      view.unmount();
    }
    cleanup();
  });
});
