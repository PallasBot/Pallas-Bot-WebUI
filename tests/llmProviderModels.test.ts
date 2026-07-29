import { describe, expect, it } from "vitest";
import {
  modelAfterProviderChange,
  modelOptionsForProvider,
} from "../src/utils/llmProviderModels";

const providers = [
  {
    id: "deepseek",
    default_model: "deepseek-chat",
    task_models: { chat: "deepseek-reasoner" },
  },
  {
    id: "openai",
    default_model: "gpt-4o-mini",
    task_models: { chat: "gpt-4o" },
  },
];

const fetched = {
  deepseek: ["deepseek-chat", "deepseek-reasoner", "deepseek-v3"],
  openai: ["gpt-4o-mini", "gpt-4o", "o1-mini"],
};

describe("modelOptionsForProvider", () => {
  it("only returns models for the selected provider", () => {
    expect(modelOptionsForProvider("deepseek", providers, fetched)).toEqual([
      "deepseek-chat",
      "deepseek-reasoner",
      "deepseek-v3",
    ]);
    expect(modelOptionsForProvider("openai", providers, fetched)).toEqual([
      "gpt-4o-mini",
      "gpt-4o",
      "o1-mini",
    ]);
  });

  it("does not leak other providers' models even if they appear in global caches", () => {
    const polluted = {
      ...fetched,
      // 模拟旧逻辑把全员模型塞进某一侧缓存也不应跨提供方出现
    };
    const opts = modelOptionsForProvider("deepseek", providers, polluted);
    expect(opts).not.toContain("gpt-4o");
    expect(opts).not.toContain("o1-mini");
  });

  it("returns empty when provider is missing or blank", () => {
    expect(modelOptionsForProvider("", providers, fetched)).toEqual([]);
    expect(modelOptionsForProvider("ghost", providers, fetched)).toEqual([]);
  });
});

describe("modelAfterProviderChange", () => {
  it("keeps model when it belongs to the next provider", () => {
    expect(modelAfterProviderChange("openai", "gpt-4o", providers, fetched)).toBe("gpt-4o");
  });

  it("clears model when it does not belong to the next provider", () => {
    expect(modelAfterProviderChange("deepseek", "gpt-4o", providers, fetched)).toBe("");
  });
});
