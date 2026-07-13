import { describe, expect, it } from "vitest";
import { llmBotFieldGroupsForMode } from "../src/config/configFieldLabels";

describe("configFieldLabels", () => {
  it("keeps simple dialogue mode focused on switches and learning loop", () => {
    const groups = llmBotFieldGroupsForMode(true);

    expect(groups.map((group) => group.title)).toEqual(["功能开关", "学习闭环"]);
    expect(groups.every((group) => group.tier === "essential")).toBe(true);
    expect(groups.flatMap((group) => group.keys)).not.toContain("ai_server_host");
    expect(groups.flatMap((group) => group.keys)).not.toContain("ai_server_port");
  });
});
