import { describe, expect, it } from "vitest";
import {
  LLM_PROVIDER_PRESETS,
  applyPresetToDraft,
  findPresetByBaseUrl,
} from "../src/config/llmProviderPresets";

describe("llmProviderPresets", () => {
  it("includes required vendor ids", () => {
    const ids = LLM_PROVIDER_PRESETS.map((p) => p.id);
    expect(ids).toEqual([
      "openai",
      "anthropic",
      "gemini",
      "deepseek",
      "dashscope",
      "siliconflow",
      "custom",
    ]);
  });

  it("applyPresetToDraft custom clears base_url and sets remote kind", () => {
    const base = {
      id: "custom-1",
      kind: "local" as const,
      base_url: "https://gateway.example/v1",
      api_key_env: "MY_KEY",
      default_model: "my-model",
      enabled: true,
      task_models: {},
    };
    const row = applyPresetToDraft("custom", base);
    expect(row.base_url).toBe("");
    expect(row.default_model).toBe("my-model");
    expect(row.kind).toBe("remote");
    expect(row.id).toBe("custom-1");
  });

  it("applyPresetToDraft fills remote defaults and empty id", () => {
    const row = applyPresetToDraft("siliconflow", {
      id: "",
      kind: "local",
      base_url: "",
      api_key_env: "",
      default_model: "",
      enabled: true,
      task_models: {},
    });
    expect(row.kind).toBe("remote");
    expect(row.id).toBe("siliconflow");
    expect(row.base_url).toContain("siliconflow");
    expect(row.default_model).toBe("");
  });

  it("applyPresetToDraft keeps existing id when set", () => {
    const row = applyPresetToDraft("deepseek", {
      id: "deepseek-1",
      kind: "local",
      base_url: "",
      api_key_env: "",
      default_model: "",
      enabled: true,
      task_models: {},
    });
    expect(row.id).toBe("deepseek-1");
    expect(row.kind).toBe("remote");
    expect(row.base_url).toContain("deepseek");
  });

  it("findPresetByBaseUrl matches known hosts", () => {
    expect(findPresetByBaseUrl("https://api.deepseek.com/v1")?.id).toBe("deepseek");
    expect(findPresetByBaseUrl("https://api.siliconflow.cn/v1")?.id).toBe("siliconflow");
  });
});
