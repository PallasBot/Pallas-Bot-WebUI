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
    expect(source).toContain("expertTab === 'upstream'");
    expect(source).toContain("expertTab === 'tasks'");
    expect(source).toContain("expertTab === 'local'");
    expect(source).toContain("<LocalModelRoutingPanel compact />");
    expect(source).toContain("<ModelAdminPanel embedded />");
    expect(source).toContain(":panel=\"expertTab === 'tasks' ? 'tasks' : 'upstream'\"");
  });

  it("keeps the compact mode switch and content layout usable on narrow screens", () => {
    const toggle = readSource("src/components/ai-config/AiConfigExpertModeToggle.vue");
    const page = readSource("src/pages/AiExtensionPage.vue");
    const manager = readSource("src/components/ai-config/providers/ProviderManager.vue");
    const appStyles = readSource("src/styles/app.css");

    expect(toggle).toContain("ai-config-expert-toggle__controls console-view-toggle");
    expect(toggle).toContain("ai-config-expert-toggle__hint");
    expect(page).toContain("@media (max-width: 1024px)");
    expect(page).toContain("grid-template-columns: 1fr");
    expect(page).toContain("grid-template-columns: repeat(auto-fit, minmax(8.75rem, 1fr))");
    expect(manager).toContain(".provider-manager__card-main");
    expect(manager).toContain("overflow-wrap: anywhere");
    expect(appStyles).toContain(".plugin-config-page {\n  container-type: inline-size;");
    expect(appStyles).toContain("@container (min-width: 1100px)");
  });

  it("allows the expert provider panel to shrink within the narrow-screen viewport", () => {
    const section = readSource("src/components/ai-config/AiConfigProviderSection.vue");
    const page = readSource("src/pages/AiExtensionPage.vue");
    const manager = readSource("src/components/ai-config/providers/ProviderManager.vue");
    const modelAdmin = readSource("src/components/ai-config/ModelAdminPanel.vue");

    expect(section).toMatch(/\.ai-config-section__expert \{[\s\S]*?min-width: 0;/);
    expect(section).toMatch(/\.ai-config-section__tabs \{[\s\S]*?min-width: 0;/);
    expect(section).toMatch(/\.ai-config-section__tab-body \{[\s\S]*?min-width: 0;/);
    expect(page).toMatch(/@media \(max-width: 1024px\) \{[\s\S]*?\.ai-config-page__rail-scroll,\s+\.ai-config-page__rail-hits \{[\s\S]*?grid-template-columns: repeat\(auto-fit, minmax\(8\.75rem, 1fr\)\);/);
    expect(manager).toMatch(/@media \(max-width: 1024px\) \{[\s\S]*?\.provider-manager__card-actions \{[\s\S]*?max-width: 100%;/);
    expect(modelAdmin).toMatch(/@media \(max-width: 560px\) \{[\s\S]*?\.model-admin__actions\.row-actions \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
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
