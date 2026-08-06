import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/pages/ai/sections/AiConfigBehaviorSection.tsx"),
  "utf8",
);

describe("行为配置复读面板", () => {
  it("只维护语义风格，不重复管理会话反馈", () => {
    expect(source).toContain('aria-label="语义风格"');
    expect(source).not.toContain("fetchLlmRepeaterFeedback");
    expect(source).not.toContain("fetchLlmRepeaterFeedbackSummary");
    expect(source).not.toContain("postLlmRepeaterFeedbackManage");
  });
});
