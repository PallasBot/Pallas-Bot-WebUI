import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("牛格 UI 清理", () => {
  it("账号编辑不再展示旧 seed、length 字段", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/BotConfigModal.tsx"), "utf8");
    expect(source).not.toContain("seedPrefs");
    expect(source).not.toContain("length_pref");
  });

  it("群表达成为语义风格唯一管理入口", () => {
    const behavior = readFileSync(
      resolve(process.cwd(), "src/pages/ai/sections/AiConfigBehaviorSection.tsx"),
      "utf8",
    );
    expect(behavior).not.toContain("postLlmRepeaterSemanticStyleManage");
    expect(behavior).toContain("群表达");
  });

  it("群表达只展示最终契约字段且不输出原始 JSON", () => {
    const persona = readFileSync(
      resolve(process.cwd(), "src/pages/ai/governance/GovernanceStyleTab.tsx"),
      "utf8",
    );
    expect(persona).not.toContain("length_pref");
    expect(persona).not.toContain("outcome_counts");
    expect(persona).not.toContain("reuse_counts");
    expect(persona).not.toContain("interaction_counts");
    expect(persona).not.toContain("semantic_counts");
    expect(persona).not.toContain("String(data.status");
    expect(persona).not.toContain("JSON.stringify(data");
    const formatter = readFileSync(resolve(process.cwd(), "src/utils/groupExpressionModel.ts"), "utf8");
    expect(formatter).toContain("label_version");
    expect(formatter).toContain("positive_bot_style_count");
  });
});
