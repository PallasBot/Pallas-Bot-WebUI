import { computed, ref } from "vue";
import {
  fetchAiExtensionConfig,
  postAiExtensionTest,
  postServiceGatewaysConnectivityCheck,
} from "@/api/consoleApi";
import type { AiExtensionTestData, PluginConfigCheckResult } from "@/api/pallasTypes";
import type { AiRuntimePageAction, AiRuntimeQuickAction } from "@/utils/aiRuntimeTypes";
import {
  buildAiRuntimeOverview,
  groupAiRuntimeSnapshot,
  pickAiRuntimeFocusItems,
  resolveAiRuntimeSnapshot,
} from "@/utils/aiRuntimeResolver";

function quickActionRank(state: AiRuntimeQuickAction["state"]): number {
  if (state === "degraded") return 0;
  if (state === "disabled") return 1;
  if (state === "healthy") return 2;
  return 3;
}

function actionPriorityBoost(state: AiRuntimeQuickAction["state"]): number {
  if (state === "degraded") return 1000;
  if (state === "disabled") return 300;
  if (state === "healthy") return 0;
  return 100;
}

export function useAiRuntimeSnapshot() {
  const loading = ref(false);
  const err = ref("");
  const gatewayResults = ref<PluginConfigCheckResult["results"]>([]);
  const extensionTest = ref<AiExtensionTestData | null>(null);

  const items = computed(() =>
    resolveAiRuntimeSnapshot({
      gatewayResults: gatewayResults.value,
      extensionTest: extensionTest.value,
    }),
  );

  const groups = computed(() => groupAiRuntimeSnapshot(items.value));
  const overview = computed(() => buildAiRuntimeOverview(items.value));
  const focusItems = computed(() => pickAiRuntimeFocusItems(items.value));
  const quickActions = computed<AiRuntimeQuickAction[]>(() =>
    items.value
      .flatMap((item) =>
        item.actions
          .filter((action) => action.kind === "navigate" && action.to && action.surfaces.includes("quick"))
          .map((action) => ({
            id: action.id,
            title: action.label,
            description: item.description,
            state: item.state,
            capabilityId: item.capabilityId,
            capabilityTitle: item.title,
            action,
          })),
      )
      .sort((a, b) => {
        const priorityDiff =
          (b.action.priority + actionPriorityBoost(b.state))
          - (a.action.priority + actionPriorityBoost(a.state));
        if (priorityDiff !== 0) return priorityDiff;
        const rankDiff = quickActionRank(a.state) - quickActionRank(b.state);
        if (rankDiff !== 0) return rankDiff;
        const capabilityDiff = a.capabilityTitle.localeCompare(b.capabilityTitle);
        if (capabilityDiff !== 0) return capabilityDiff;
        return a.title.localeCompare(b.title);
      }),
  );

  const mediaTaskQueue = computed(() => extensionTest.value?.media_tasks ?? null);

  const mediaTaskCapabilities = computed(
    () => extensionTest.value?.media_tasks?.capabilities ?? [],
  );

  const llmProviderStatus = computed(
    () => extensionTest.value?.llm_health?.provider_status ?? [],
  );

  const ttsHealth = computed(() => extensionTest.value?.tts_health ?? null);

  const pageActions = computed<AiRuntimePageAction[]>(() => {
    const actions: AiRuntimePageAction[] = [
      {
        id: "runtime:refresh",
        label: loading.value ? "刷新中…" : "刷新状态",
        kind: "refresh",
        busy: loading.value,
      },
    ];
    for (const item of quickActions.value.filter((entry) => entry.action.surfaces.includes("page")).slice(0, 4)) {
      actions.push({
        id: `page:${item.id}`,
        label: item.title,
        kind: "navigate",
        to: item.action.to,
      });
    }
    return actions;
  });

  async function refresh() {
    loading.value = true;
    err.value = "";
    try {
      await fetchAiExtensionConfig();
      const [gateway, extension] = await Promise.all([
        postServiceGatewaysConnectivityCheck(),
        postAiExtensionTest(),
      ]);
      gatewayResults.value = gateway.results;
      extensionTest.value = extension;
    } catch (e) {
      err.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    err,
    items,
    groups,
    overview,
    focusItems,
    quickActions,
    pageActions,
    mediaTaskQueue,
    mediaTaskCapabilities,
    llmProviderStatus,
    ttsHealth,
    refresh,
  };
}
