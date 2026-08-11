import { describe, expect, it } from "vitest";

import { formatLogScopeBadge, logEntryMatchesSource, logEntrySourceKey, logScopeBadgeColorKey, splitLogScope } from "./logDisplay";

describe("auxiliary log sources", () => {
  it("recognizes work and embed sources from structured log scopes", () => {
    expect(splitLogScope("work/bot_work")).toEqual({ source: "work", module: "bot_work" });
    expect(logEntrySourceKey({ scope: "embed/embedding", message: "ready" })).toBe("embed");
    expect(logEntryMatchesSource({ scope: "work/bot_work", message: "done" }, "work")).toBe(true);
    expect(logEntryMatchesSource({ scope: "work/bot_work", message: "done" }, "embed")).toBe(false);
  });
});

describe("log scope badges", () => {
  it("maps pallas modules to Core without repeating the process source", () => {
    expect(formatLogScopeBadge("hub/pallas.core.runtime")).toEqual({
      label: "Core",
      title: "hub/pallas.core.runtime",
    });
  });

  it("capitalizes other module badge names", () => {
    expect(formatLogScopeBadge("worker-1/repeater.learn_queue")).toEqual({
      label: "Repeater",
      title: "worker-1/repeater.learn_queue",
    });
  });

  it("uses the module name as the stable badge color key", () => {
    expect(logScopeBadgeColorKey("hub/pallas.core.runtime")).toBe("Core");
    expect(logScopeBadgeColorKey("worker-1/pallas.core.runtime")).toBe("Core");
  });
});
