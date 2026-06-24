import { computed, ref } from "vue";
import {
  fetchAiExtensionConfig,
  fetchLlmRuntimeOverview,
  fetchLlmTaskStats,
  fetchLlmWizardStatus,
  postAiExtensionTest,
  postServiceGatewaysConnectivityCheck,
} from "@/api/consoleApi";
import type {
  AiExtensionTestData,
  LlmRuntimeOverviewData,
  LlmTaskStatsData,
  LlmWizardStatusData,
  PluginConfigCheckResult,
} from "@/api/pallasTypes";
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
  const llmTaskStats = ref<LlmTaskStatsData | null>(null);
  const runtimeOverview = ref<LlmRuntimeOverviewData | null>(null);
  const wizardStatus = ref<LlmWizardStatusData | null>(null);

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

  const mediaTaskCapabilities = computed(() => {
    const fromOverview = runtimeOverview.value?.health?.media_tasks?.capabilities;
    if (fromOverview?.length) return fromOverview;
    return extensionTest.value?.media_tasks?.capabilities ?? [];
  });

  const llmProviderStatus = computed(() => {
    const fromOverview = runtimeOverview.value?.health?.llm_health?.provider_status;
    if (fromOverview?.length) return fromOverview;
    return extensionTest.value?.llm_health?.provider_status ?? [];
  });

  const ttsHealth = computed(() => extensionTest.value?.tts_health ?? null);

  const llmRuntimeSummary = computed(() => {
    const ai = runtimeOverview.value?.task_stats?.ai ?? llmTaskStats.value?.ai;
    const stateCounts = ai?.state_counts ?? {};
    const routeCounts = Object.values(ai?.by_task ?? {}).reduce<Record<string, number>>((acc, row) => {
      for (const [route, count] of Object.entries(row.route_counts ?? {})) {
        acc[route] = (acc[route] ?? 0) + (Number(count) || 0);
      }
      return acc;
    }, {});
    const providers = Object.entries(ai?.provider_stats ?? {})
      .map(([key, row]) => ({
        key,
        requests: Number(row.requests ?? 0),
        failed: Number(row.failed ?? 0),
      }))
      .filter((row) => row.requests > 0)
      .sort((a, b) => b.requests - a.requests || b.failed - a.failed || a.key.localeCompare(b.key))
      .slice(0, 3);
    const failures = Object.entries(ai?.failure_counts ?? {})
      .map(([key, count]) => ({
        key,
        count: Number(count) || 0,
      }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
      .slice(0, 3);
    return {
      queued: Number(stateCounts.queued ?? 0),
      running: Number(stateCounts.running ?? 0),
      failed: Number(stateCounts.failed ?? 0),
      succeeded: Number(stateCounts.succeeded ?? 0),
      routeCounts,
      providers,
      failures,
    };
  });

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
      const [gatewayResult, extensionResult, llmStatsResult, runtimeOverviewResult, wizardResult] = await Promise.allSettled([
        postServiceGatewaysConnectivityCheck(),
        postAiExtensionTest(),
        fetchLlmTaskStats(),
        fetchLlmRuntimeOverview(),
        fetchLlmWizardStatus(),
      ]);
      if (gatewayResult.status !== "fulfilled") {
        throw gatewayResult.reason;
      }
      if (extensionResult.status !== "fulfilled") {
        throw extensionResult.reason;
      }
      gatewayResults.value = gatewayResult.value.results;
      extensionTest.value = extensionResult.value;
      llmTaskStats.value = llmStatsResult.status === "fulfilled" ? llmStatsResult.value : null;
      runtimeOverview.value = runtimeOverviewResult.status === "fulfilled" ? runtimeOverviewResult.value : null;
      wizardStatus.value = wizardResult.status === "fulfilled" ? wizardResult.value : null;
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
    llmRuntimeSummary,
    runtimeOverview,
    wizardStatus,
    ttsHealth,
    refresh,
  };
}
