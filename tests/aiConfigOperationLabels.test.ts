import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const providers = readFileSync(resolve(process.cwd(), "src/pages/ai/LlmProvidersForm.tsx"), "utf8");
const dialogue = readFileSync(resolve(process.cwd(), "src/pages/ai/sections/AiConfigDialogueSection.tsx"), "utf8");
const budget = readFileSync(resolve(process.cwd(), "src/pages/ai/sections/AiConfigBudgetSection.tsx"), "utf8");
const media = readFileSync(resolve(process.cwd(), "src/pages/ai/sections/AiConfigMediaSection.tsx"), "utf8");

describe("AI 配置操作文案", () => {
  it("makes save and test scopes explicit", () => {
    expect(providers).toContain("保存任务编排");
    expect(providers).toContain("保存提供方");
    expect(providers).toContain("测试所有提供方");
    expect(dialogue).toContain("保存对话配置");
    expect(budget).toContain("保存调用限额");
    expect(media).toContain("保存唱歌设置");
    expect(media).toContain("保存语音设置");
    expect(media).toContain("保存画画配置");
  });

  it("confirms destructive media operations", () => {
    expect(media).toContain("useConsoleConfirm");
    expect(media).toContain('title: "停止媒体服务"');
    expect(media).toContain('title: "删除媒体资产"');
  });
});
