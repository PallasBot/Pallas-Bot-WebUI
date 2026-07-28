import { describe, expect, it } from "vitest";
import type { LogEntry } from "@/api/pallasTypes";
import {
  logEntrySourceKey,
  normalizeLogEntryDisplay,
  normalizeLogScope,
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
