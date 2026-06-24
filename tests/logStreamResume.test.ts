import { describe, expect, it, beforeEach } from "vitest";
import {
  loadLogsLastEventId,
  logsStreamResumeKey,
  persistLogsLastEventId,
} from "@/utils/logStreamResume";

describe("logStreamResume", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("builds stable resume keys", () => {
    expect(logsStreamResumeKey("all", "all")).toBe("all:all");
    expect(logsStreamResumeKey("hub", "worker-1")).toBe("hub:worker-1");
  });

  it("persists and loads last event id per scope/source", () => {
    persistLogsLastEventId("all", "all", 42);
    expect(loadLogsLastEventId("all", "all")).toBe(42);
    expect(loadLogsLastEventId("hub", "all")).toBe(0);
  });

  it("ignores invalid stored values", () => {
    sessionStorage.setItem("pallas:logs:last-event-id:all:all", "bad");
    expect(loadLogsLastEventId("all", "all")).toBe(0);
  });
});
