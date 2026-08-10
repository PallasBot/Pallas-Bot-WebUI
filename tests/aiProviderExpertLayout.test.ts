import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("AI provider expert layout", () => {
  it("keeps the provider configuration section backed by the React provider form", () => {
    const section = readSource("src/pages/ai/sections/AiConfigProviderSection.tsx");
    const form = readSource("src/pages/ai/LlmProvidersForm.tsx");

    expect(section).toContain('import LlmProvidersForm from "@/pages/ai/LlmProvidersForm"');
    expect(section).toContain("<LlmProvidersForm />");
    expect(form).toContain('type Tab = "upstream" | "tasks" | "runtime" | "routing"');
    expect(form).toContain('id: "upstream"');
    expect(form).toContain('id: "tasks"');
    expect(form).toContain('id: "runtime"');
    expect(form).toContain('id: "routing"');
  });

  it("keeps task routing and local runtime configuration in the provider form", () => {
    const form = readSource("src/pages/ai/LlmProvidersForm.tsx");

    expect(form).toContain("TASK_ROUTE_META");
    expect(form).toContain("applyTaskRoutes");
    expect(form).toContain("applyTaskTiers");
    expect(form).toContain("AiModelAdminPanel");
    expect(form).toContain("fetchLlmLocalRoutingConfig");
  });

  it("keeps provider presets available while editing a provider", () => {
    const form = readSource("src/pages/ai/LlmProvidersForm.tsx");

    expect(form).toContain("LLM_PROVIDER_PRESETS");
    expect(form).toContain("applyPresetToDraft");
    expect(form).toContain("findPresetByBaseUrl");
  });
});
