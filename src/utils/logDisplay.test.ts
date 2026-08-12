import { describe, expect, it } from "vitest";

import {
  formatLogScopeBadge,
  logEntryMatchesSource,
  logEntrySourceKey,
  logScopeBadgeColorKey,
  splitLogMessagePrefix,
  splitLogScope,
} from "./logDisplay";

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

describe("message business prefix", () => {
  it("splits a leading bracket label from the message body", () => {
    expect(splitLogMessagePrefix("[WorkAux] claimed [3] jobs by owner [host:1:0]")).toEqual({
      prefix: "WorkAux",
      body: "claimed [3] jobs by owner [host:1:0]",
    });
  });

  it("keeps messages without a leading bracket untouched", () => {
    expect(splitLogMessagePrefix("plain event happened")).toEqual({ prefix: "", body: "plain event happened" });
    expect(splitLogMessagePrefix("")).toEqual({ prefix: "", body: "" });
  });

  it("does not treat message-body brackets like [Bot 1111] as a business prefix", () => {
    expect(splitLogMessagePrefix("[Bot 1111] [群 22] [用户 333] 正文")).toEqual({
      prefix: "",
      body: "[Bot 1111] [群 22] [用户 333] 正文",
    });
    expect(splitLogMessagePrefix("[群 1103771828] 消息")).toEqual({ prefix: "", body: "[群 1103771828] 消息" });
    expect(splitLogMessagePrefix("[image:file=a.gif] xxx")).toEqual({ prefix: "", body: "[image:file=a.gif] xxx" });
  });
});
