import { ref } from "vue";
import { fetchLlmModelAdminStatus, fetchLlmProviderModels } from "@/api/consoleApi";
import type { LlmProviderConfigRow } from "@/api/pallasTypes";
import {
  buildLlmModelSelectGroups,
  type LlmModelSelectGroup,
} from "@/utils/llmModelOptionSources";

export function useLlmModelPickerOptions() {
  const runtimeModel = ref("");
  const discoveredModels = ref<Record<string, string[]>>({});
  const discoveringModels = ref(false);

  async function loadRuntimeModel() {
    try {
      const admin = await fetchLlmModelAdminStatus();
      runtimeModel.value = (admin.model || "").trim();
    } catch {
      runtimeModel.value = "";
    }
  }

  async function discoverProviderModels(providerList: LlmProviderConfigRow[]) {
    discoveringModels.value = true;
    const enabled = providerList.filter((row) => row.enabled);
    const results = await Promise.allSettled(
      enabled.map(async (provider) => {
        const result = await fetchLlmProviderModels(provider.id);
        return { id: provider.id, models: result.models ?? [] };
      }),
    );
    const next: Record<string, string[]> = {};
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      next[result.value.id] = result.value.models;
    }
    discoveredModels.value = next;
    discoveringModels.value = false;
  }

  async function refreshPickerContext(providers: LlmProviderConfigRow[]) {
    await Promise.all([loadRuntimeModel(), discoverProviderModels(providers)]);
  }

  function buildGroups(params: {
    providers: LlmProviderConfigRow[];
    savedValues?: string[];
    discoveredByProvider?: Record<string, string[]>;
  }): LlmModelSelectGroup[] {
    return buildLlmModelSelectGroups({
      providers: params.providers,
      runtimeModel: runtimeModel.value,
      discoveredByProvider: params.discoveredByProvider ?? discoveredModels.value,
      savedValues: params.savedValues,
    });
  }

  return {
    runtimeModel,
    discoveredModels,
    discoveringModels,
    loadRuntimeModel,
    discoverProviderModels,
    refreshPickerContext,
    buildGroups,
  };
}
