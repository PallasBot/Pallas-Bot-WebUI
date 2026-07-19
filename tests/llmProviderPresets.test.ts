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
      "deepseek",
      "dashscope",
      "siliconflow",
      "custom",
    ]);
  });

  it("applyPresetToDraft custom preserves existing base_url and default_model", () => {
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
    expect(row.base_url).toBe("https://gateway.example/v1");
    expect(row.default_model).toBe("my-model");
    expect(row.kind).toBe("openai-compatible");
  });

  it("applyPresetToDraft fills openai-compatible remote defaults", () => {
    const row = applyPresetToDraft("deepseek", {
      id: "deepseek-1",
      kind: "local",
      base_url: "",
      api_key_env: "",
      default_model: "",
      enabled: true,
      task_models: {},
    });
    expect(row.kind).toBe("openai-compatible");
    expect(row.base_url).toContain("deepseek");
    expect(row.default_model).toBe("");
  });

  it("presets do not ship example cloud model names", () => {
    for (const preset of LLM_PROVIDER_PRESETS) {
      expect(preset.default_model).toBe("");
    }
  });

  it("findPresetByBaseUrl matches known hosts", () => {
    expect(findPresetByBaseUrl("https://api.deepseek.com/v1")?.id).toBe("deepseek");
  });
});
