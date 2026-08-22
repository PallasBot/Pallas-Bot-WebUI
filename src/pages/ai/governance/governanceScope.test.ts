import { describe, expect, it } from "vitest";
import {
  buildGovernanceSearch,
  parseGovernanceScope,
  replyProfileSummary,
} from "./governanceScope";

describe("governance scope", () => {
  it("parses a complete positive group-chat scope", () => {
    const parsed = parseGovernanceScope({ bot: "10001", group: "20002", scene: "group_chat" });
    expect(parsed.ready).toBe(true);
    expect(parsed.scope).toEqual({ botId: 10001, groupId: 20002, scene: "group_chat" });
  });

  it("is ready with a bot but no group (global tabs)", () => {
    const parsed = parseGovernanceScope({ bot: "10001", scene: "group_chat" });
    expect(parsed.ready).toBe(true);
    expect(parsed.scope).toEqual({ botId: 10001, groupId: null, scene: "group_chat" });
  });

  it("is not ready without a bot", () => {
    expect(parseGovernanceScope({ group: "20002", scene: "group_chat" }).ready).toBe(false);
  });

  it("builds the canonical governance search", () => {
    expect(
      buildGovernanceSearch({ botId: 10001, groupId: 20002, scene: "group_chat" }).toString(),
    ).toBe("bot=10001&group=20002&scene=group_chat");
  });

  it("omits group from the search when it is not set", () => {
    expect(
      buildGovernanceSearch({ botId: 10001, groupId: null, scene: "group_chat" }).toString(),
    ).toBe("bot=10001&scene=group_chat");
  });

  it("does not infer a profile when its factual cards are empty", () => {
    expect(replyProfileSummary({ style: null, expressionCount: 0, memoryCount: 0 })).toContain(
      "尚无足够数据",
    );
  });
});
