import { describe, expect, it } from "vitest";
import type { LogEntry } from "@/api/pallasTypes";
import {
  formatLogScopeBadge,
  logEntrySourceKey,
  normalizeLogEntryDisplay,
  normalizeLogScope,
  scopeBadgeHue,
  shortenLogScopeModule,
  splitLogScope,
} from "@/utils/logDisplay";

describe("splitLogScope / normalizeLogScope", () => {
  it("splits worker-N/module", () => {
    expect(splitLogScope("worker-1/pallas")).toEqual({ source: "worker-1", module: "pallas" });
    expect(normalizeLogScope("worker-1/pallas")).toBe("worker-1/pallas");
  });

  it("normalizes historical embedded [worker-N] module", () => {
    expect(splitLogScope("[worker-1] pallas")).toEqual({ source: "worker-1", module: "pallas" });
    expect(normalizeLogScope("[worker-1] pallas")).toBe("worker-1/pallas");
  });

  it("keeps plain module without source", () => {
    expect(splitLogScope("pb_webui")).toEqual({ source: "", module: "pb_webui" });
    expect(normalizeLogScope("pb_webui")).toBe("pb_webui");
  });
});

describe("normalizeLogEntryDisplay embedded scope", () => {
  it("rewrites API scope [worker-1] pallas", () => {
    const row: LogEntry = {
      id: 1,
      time: "2026-07-28T10:38:16",
      level: "info",
      scope: "[worker-1] pallas",
      message: "hello",
    };
    expect(normalizeLogEntryDisplay(row).scope).toBe("worker-1/pallas");
  });

  it("parses raw line with embedded scope in body", () => {
    const row: LogEntry = {
      id: 2,
      time: "",
      level: "info",
      scope: "raw",
      message: "07-28 10:38:16 | INFO | [worker-2] nonebot:1 - ready",
    };
    const out = normalizeLogEntryDisplay(row);
    expect(out.scope).toBe("worker-2/nonebot");
    expect(out.message).toBe("ready");
    expect(logEntrySourceKey(out)).toBe("worker-2");
  });
});

describe("scopeBadgeHue", () => {
  it("is stable for the same scope and differs across scopes", () => {
    expect(scopeBadgeHue("pallas")).toBe(scopeBadgeHue("pallas"));
    expect(scopeBadgeHue("pallas")).not.toBe(scopeBadgeHue("pb_webui"));
    expect(scopeBadgeHue("pallas")).toBeGreaterThanOrEqual(0);
    expect(scopeBadgeHue("pallas")).toBeLessThan(360);
  });
});

describe("formatLogScopeBadge", () => {
  it("shortens pallas_plugin_* / nonebot_plugin_* to import id", () => {
    expect(shortenLogScopeModule("pallas_plugin_sing")).toBe("Sing");
    expect(shortenLogScopeModule("pallas_plugin_sing.handlers")).toBe("Sing");
    expect(shortenLogScopeModule("nonebot_plugin_foo")).toBe("Foo");
    expect(formatLogScopeBadge("pallas_plugin_sing")).toEqual({
      label: "Sing",
      title: "pallas_plugin_sing",
    });
  });

  it("keeps worker source and shortens module", () => {
    expect(formatLogScopeBadge("worker-1/pallas_plugin_sing")).toEqual({
      label: "Sing",
      title: "worker-1/pallas_plugin_sing",
    });
  });

  it("leaves core / pb_* scopes unchanged", () => {
    expect(formatLogScopeBadge("pallas")).toEqual({ label: "Core", title: "pallas" });
    expect(formatLogScopeBadge("pb_webui")).toEqual({ label: "Pb_webui", title: "pb_webui" });
  });
});
