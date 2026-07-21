import { describe, expect, it } from "vitest";
import type { LogEntry } from "@/api/pallasTypes";
import { logEntrySourceKey, mergeLogEntryContinuations } from "@/utils/logDisplay";

function entry(partial: Partial<LogEntry> & Pick<LogEntry, "scope" | "message" | "level">): LogEntry {
  return {
    id: partial.id ?? 1,
    time: partial.time ?? "05-21 22:44:15",
    level: partial.level,
    scope: partial.scope,
    message: partial.message,
  };
}

describe("mergeLogEntryContinuations worker isolation", () => {
  it("extracts worker source key from scope", () => {
    expect(logEntrySourceKey({ scope: "worker-1/load", message: "x" })).toBe("worker-1");
    expect(logEntrySourceKey({ scope: "hub/nonebot", message: "x" })).toBe("hub");
  });

  it("does not glue traceback onto another worker info", () => {
    const rows = [
      entry({
        scope: "worker-1/load",
        level: "error",
        message: "Failed to load plugin",
      }),
      entry({
        scope: "worker-5/nonebot",
        level: "info",
        message: "Succeeded to load plugin foo",
      }),
      entry({
        scope: "worker-1",
        level: "error",
        message: "Traceback (most recent call last):",
      }),
      entry({
        scope: "worker-1",
        level: "error",
        message: '  File "/path/load.py", line 50, in load_plugin',
      }),
      entry({
        scope: "worker-6/nonebot",
        level: "info",
        message: "bot_worker ready",
      }),
      entry({
        scope: "worker-1",
        level: "error",
        message: "RuntimeError: Module src.plugins.sing is not loaded",
      }),
    ];
    const merged = mergeLogEntryContinuations(rows);
    expect(merged).toHaveLength(3);
    expect(merged[0].scope).toContain("worker-1");
    expect(merged[0].message).toContain("Traceback");
    expect(merged[0].message).toContain("RuntimeError");
    expect(merged[1].message).toContain("Succeeded to load");
    expect(merged[1].message).not.toContain("Traceback");
    expect(merged[2].message).toContain("bot_worker ready");
  });

  it("still merges same-worker tree dump", () => {
    const rows = [
      entry({
        scope: "worker-99/nonebot",
        level: "info",
        message: "Event will be handled",
      }),
      entry({
        scope: "worker-99",
        level: "info",
        message: "|  L {'k': 1}",
      }),
      entry({
        scope: "worker-99",
        level: "info",
        message: "|  L {'k': 2}",
      }),
    ];
    const merged = mergeLogEntryContinuations(rows);
    expect(merged).toHaveLength(1);
    expect(merged[0].message).toContain("|  L {'k': 1}");
    expect(merged[0].message).toContain("|  L {'k': 2}");
  });
});
