import { describe, expect, it } from "vitest";
import { logEntryMatchesSource, logEntrySourceKey } from "@/utils/logDisplay";

describe("logEntryMatchesSource", () => {
  it("keeps only the selected worker", () => {
    const row = { scope: "worker-0/pallas", message: "hi" };
    expect(logEntryMatchesSource(row, "worker-0")).toBe(true);
    expect(logEntryMatchesSource(row, "worker-1")).toBe(false);
    expect(logEntryMatchesSource(row, "all")).toBe(true);
  });

  it("treats hub-file and untagged hub ring as hub", () => {
    expect(logEntryMatchesSource({ scope: "hub-file/packages", message: "x" }, "hub")).toBe(true);
    expect(logEntrySourceKey({ scope: "hub-file/packages", message: "x" })).toBe("hub");
    expect(logEntryMatchesSource({ scope: "packages", message: "x" }, "hub")).toBe(true);
    expect(logEntryMatchesSource({ scope: "packages", message: "x" }, "worker-0")).toBe(false);
  });
});
