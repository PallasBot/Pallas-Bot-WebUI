import { describe, expect, it } from "vitest";
import {
  AI_CONFIG_MORE_NAV_ITEM,
  SIMPLE_AI_CONFIG_NAV_SECTION_IDS,
  aiConfigSectionMeta,
} from "../src/config/aiConfigSections";

describe("aiConfigSections", () => {
  it("keeps simple mode focused on access, dialogue, capabilities, knowledge, and more", () => {
    expect(SIMPLE_AI_CONFIG_NAV_SECTION_IDS.map((id) => aiConfigSectionMeta(id).label)).toEqual([
      "接入",
      "对话",
      "能力包",
      "知识库",
    ]);
    expect(AI_CONFIG_MORE_NAV_ITEM).toMatchObject({
      id: "more",
      label: "更多",
      targetSectionId: "connection",
    });
  });

  it("surfaces media services in extension group", () => {
    expect(aiConfigSectionMeta("connection")).toMatchObject({
      label: "媒体服务",
      groupId: "extension",
    });
  });
});
