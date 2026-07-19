import { describe, expect, it } from "vitest";
import type { LlmProviderConfigRow } from "../src/api/pallasTypes";
import { resolveProviderForModel } from "../src/utils/resolveProviderForModel";

function row(partial: Partial<LlmProviderConfigRow> & Pick<LlmProviderConfigRow, "id" | "kind">): LlmProviderConfigRow {
  return {
    base_url: "",
    api_key_env: "",
    default_model: "",
    enabled: true,
    task_models: {},
    ...partial,
  };
}

describe("resolveProviderForModel", () => {
  const providers = [
    row({ id: "openai", kind: "openai-compatible", default_model: "gpt-4o-mini" }),
    row({ id: "local", kind: "local", default_model: "qwen2.5:7b" }),
  ];

  it("prefers local provider that owns the model", () => {
    expect(resolveProviderForModel("qwen2.5:7b", providers)).toBe("local");
  });

  it("keeps preferred provider when it already has the model", () => {
    expect(
      resolveProviderForModel("qwen2.5:7b", providers, {
        preferredProviderId: "local",
        discoveredByProvider: { local: ["qwen2.5:7b", "llama3"] },
      }),
    ).toBe("local");
  });

  it("uses discovered models for local ownership", () => {
    expect(
      resolveProviderForModel("llama3", providers, {
        discoveredByProvider: { local: ["llama3"] },
      }),
    ).toBe("local");
  });
});
