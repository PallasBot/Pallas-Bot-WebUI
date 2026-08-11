import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import StatusTone from "@/components/StatusTone";

describe("StatusTone", () => {
  it("用共享 Badge 表达连接、断开与探测状态", () => {
    const connected = renderToStaticMarkup(createElement(StatusTone, { ok: true, showDot: true }));
    const disconnected = renderToStaticMarkup(createElement(StatusTone, { ok: false }));
    const pending = renderToStaticMarkup(createElement(StatusTone, { pending: true }));

    expect(connected).toContain("badge--success");
    expect(connected).toContain("status-tone__dot");
    expect(disconnected).toContain("badge--neutral");
    expect(pending).toContain("badge--pending");
    expect(pending).toContain('aria-busy="true"');
  });
});
