import { describe, expect, it } from "vitest";

import { logEntryMatchesSource, logEntrySourceKey, splitLogScope } from "./logDisplay";

describe("auxiliary log sources", () => {
  it("recognizes work and embed sources from structured log scopes", () => {
    expect(splitLogScope("work/bot_work")).toEqual({ source: "work", module: "bot_work" });
    expect(logEntrySourceKey({ scope: "embed/embedding", message: "ready" })).toBe("embed");
    expect(logEntryMatchesSource({ scope: "work/bot_work", message: "done" }, "work")).toBe(true);
    expect(logEntryMatchesSource({ scope: "work/bot_work", message: "done" }, "embed")).toBe(false);
  });
});
