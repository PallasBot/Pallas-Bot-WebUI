import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("AI provider expert layout", () => {
  it("keeps expert mode as one panel with upstream/tasks/local tabs", () => {
    const source = readSource("src/components/ai-config/AiConfigProviderSection.vue");
    expect(source).toContain("AiExtensionStatusBar");
    expect(source).toContain("expertTab === 'upstream'");
    expect(source).toContain("expertTab === 'tasks'");
    expect(source).toContain("expertTab === 'local'");
    expect(source).toContain("<LocalModelRoutingPanel compact />");
    expect(source).toContain("<ModelAdminPanel embedded />");
    expect(source).toContain(":panel=\"expertTab === 'tasks' ? 'tasks' : 'upstream'\"");
  });

  it("wires provider presets into add/edit and provider cards", () => {
    const dialog = readSource("src/components/ai-config/providers/ProviderEditDialog.vue");
    const manager = readSource("src/components/ai-config/providers/ProviderManager.vue");

    expect(dialog).toContain("ProviderPresetPicker");
    expect(dialog).toContain("applyPresetToDraft");
    expect(dialog).toContain("@select=\"selectPreset\"");
    expect(manager).toContain("findPresetByBaseUrl");
    expect(manager).toContain("providerPresetLabel");
    expect(manager).toContain("row.kind === \"local\") return \"本地\"");
  });

  it("uses task rows and fallback chips as the provider routing primary UI", () => {
    const editor = readSource("src/components/ai-config/providers/ProviderRoutingEditor.vue");
    const taskRows = readSource("src/components/ai-config/providers/TaskRouteRows.vue");
    const fallbackChips = readSource("src/components/ai-config/providers/ChainFallbackChips.vue");

    expect(editor).toContain("TaskRouteRows");
    expect(editor).toContain("ChainFallbackChips");
    expect(editor).toContain("<details class=\"routing-editor__matrix-details\"");
    expect(taskRows).toContain("LlmModelSelect");
    expect(taskRows).toContain("跟随默认");
    expect(taskRows).toContain("\"set-task-model\": [task: string, providerId: string, model: string]");
    expect(fallbackChips).toContain("@/utils/chainFallbackOrder");
    expect(fallbackChips).toContain("moveFallbackIndex");
    expect(fallbackChips).toContain("addFallbackId");
    expect(fallbackChips).toContain("removeFallbackId");
  });
});
