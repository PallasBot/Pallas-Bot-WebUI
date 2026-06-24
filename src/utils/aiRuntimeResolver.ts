import type { AiExtensionTestData, PluginConfigCheckResult } from "@/api/pallasTypes";
import {
  AI_RUNTIME_CAPABILITIES,
  AI_RUNTIME_GROUPS,
  aiRuntimeCapabilityMeta,
  aiRuntimeCapabilityIdFromKey,
  aiRuntimeDefaultActions,
  aiRuntimeGroupMeta,
  aiRuntimeStateLabel,
  aiRuntimeStateTitle,
  type AiRuntimeCapabilityId,
  type AiRuntimeState,
} from "@/config/aiRuntimeRegistry";
import type {
  AiRuntimeNormalizedSource,
  AiRuntimeOverview,
  AiRuntimeSnapshotGroup,
  AiRuntimeSnapshotItem,
} from "@/utils/aiRuntimeTypes";

type RuntimeRow = PluginConfigCheckResult["results"][number];

function normalizeState(state?: string | null): AiRuntimeState {
  if (state === "healthy" || state === "degraded" || state === "disabled") return state;
  return "unknown";
}

function runtimeRank(state: AiRuntimeState): number {
  if (state === "degraded") return 0;
  if (state === "disabled") return 1;
  if (state === "healthy") return 2;
  return 3;
}

function hasFallback(detail?: string | null, error?: string | null): boolean {
  return String(detail || error || "").includes("回退");
}

function compactDetail(row: RuntimeRow): string {
  const parts = [row.runtime_detail, row.error, row.queue_load_hint].filter(
    (item): item is string => Boolean(item && String(item).trim()),
  );
  if (row.circuit_state && row.circuit_state !== "closed") {
    parts.push(`熔断 ${row.circuit_state}`);
  }
  if (row.consecutive_failures != null && row.consecutive_failures > 0) {
    parts.push(`连续失败 ${row.consecutive_failures}`);
  }
  if (row.recent_failure_class) {
    parts.push(`最近错误 ${row.recent_failure_class}`);
  }
  if (!parts.length) return "无额外状态信息";
  return [...new Set(parts)].join(" · ");
}

function mergeSnapshotItems(items: AiRuntimeSnapshotItem[]): AiRuntimeSnapshotItem[] {
  const merged = new Map<AiRuntimeCapabilityId, AiRuntimeSnapshotItem>();
  for (const item of items) {
    const prev = merged.get(item.capabilityId);
    if (!prev) {
      merged.set(item.capabilityId, item);
      continue;
    }
    const state = runtimeRank(item.state) < runtimeRank(prev.state) ? item.state : prev.state;
    const detailParts = [prev.detail, item.detail].filter(Boolean);
    merged.set(item.capabilityId, {
      ...prev,
      state,
      statusLabel: aiRuntimeStateLabel(item.capabilityId, state),
      statusTitle: aiRuntimeStateTitle(item.capabilityId, state),
      detail: [...new Set(detailParts)].join(" · "),
      fallback: prev.fallback || item.fallback,
      sourceKinds: [...new Set([...prev.sourceKinds, ...item.sourceKinds])],
      sources: [...prev.sources, ...item.sources],
    });
  }
  return [...merged.values()];
}

function capabilityIdFromGatewayRow(row: RuntimeRow): AiRuntimeCapabilityId {
  const explicit = aiRuntimeCapabilityIdFromKey(String(row.capability_id || ""));
  if (explicit) return explicit;
  const haystack = `${row.category || ""} ${row.site || ""}`.toLowerCase();
  for (const capability of AI_RUNTIME_CAPABILITIES) {
    if (capability.sourceKinds.includes("service_gateway")) {
      if (capability.aliases.some((alias) => haystack.includes(alias.toLowerCase()))) {
        return capability.id;
      }
    }
  }
  return "llm.chat";
}

function buildExtensionSource(test: AiExtensionTestData): AiRuntimeNormalizedSource {
  return {
    kind: "ai_extension_test",
    key: "ai_extension_test:health",
    category: "AI扩展",
    site: "健康检查",
    latencyMs: null,
    statusCode: test.status_code ?? null,
    ok: test.ok,
    raw: test,
  };
}

function buildGatewaySource(row: RuntimeRow, capabilityId: AiRuntimeCapabilityId): AiRuntimeNormalizedSource {
  return {
    kind: "service_gateway",
    key: `${capabilityId}:${row.category || "service"}:${row.site}`,
    category: row.category,
    site: row.site,
    latencyMs: row.latency_ms ?? null,
    statusCode: row.status_code ?? null,
    ok: row.ok,
    raw: row,
  };
}

function itemFromExtensionTest(test: AiExtensionTestData): AiRuntimeSnapshotItem {
  const capabilityId: AiRuntimeCapabilityId = "ai_extension.runtime";
  const capability = aiRuntimeCapabilityMeta(capabilityId);
  const group = aiRuntimeGroupMeta(capability.groupId);
  const state: AiRuntimeState = test.ok ? "healthy" : "degraded";
  const actions = aiRuntimeDefaultActions(capabilityId);
  let detail = test.ok ? `健康检查成功（${test.health_url}）` : (test.error || "扩展连接不可用");
  const mediaTasks = test.media_tasks;
  if (mediaTasks) {
    detail = `${detail} · 媒体任务队列 ${mediaTasks.queue_depth} · 执行中 ${mediaTasks.active_tasks}`;
    const caps = mediaTasks.capabilities;
    if (caps?.length) {
      const capText = caps
        .map((item) => `${item.capability} ${item.queue_depth}/${item.active_tasks}`)
        .join(" · ");
      detail = `${detail} · ${capText}`;
    }
  }
  if (test.llm_detail) {
    detail = `${detail} · LLM ${test.llm_detail}`;
  }
  const llmHealth = test.llm_health;
  if (llmHealth?.circuit_state && llmHealth.circuit_state !== "closed") {
    detail = `${detail} · LLM 熔断 ${llmHealth.circuit_state}`;
  } else if (llmHealth?.recent_failure_class) {
    detail = `${detail} · LLM 最近错误 ${llmHealth.recent_failure_class}`;
  }
  const ttsHealth = test.tts_health;
  if (ttsHealth?.health_state && ttsHealth.health_state !== "healthy") {
    detail = `${detail} · TTS ${ttsHealth.health_state}`;
  } else if (ttsHealth?.celery_enabled === false) {
    detail = `${detail} · TTS worker 未注册`;
  }
  const imageCircuit = test.image_circuit;
  if (imageCircuit?.circuit_state && imageCircuit.circuit_state !== "closed") {
    detail = `${detail} · 图像熔断 ${imageCircuit.circuit_state}`;
  } else if (imageCircuit?.consecutive_failures && imageCircuit.consecutive_failures > 0) {
    detail = `${detail} · 图像连续失败 ${imageCircuit.consecutive_failures}`;
  }
  return {
    capabilityId,
    title: capability.title,
    description: capability.description,
    groupId: capability.groupId,
    groupTitle: group.title,
    groupDescription: group.description,
    groupIcon: group.icon,
    icon: capability.icon,
    section: capability.section,
    state,
    statusLabel: aiRuntimeStateLabel(capabilityId, state),
    statusTitle: aiRuntimeStateTitle(capabilityId, state),
    detail,
    fallback: hasFallback(detail, test.error),
    actions,
    sourceKinds: capability.sourceKinds,
    sources: [buildExtensionSource(test)],
  };
}

function itemFromGatewayRow(row: RuntimeRow): AiRuntimeSnapshotItem {
  const capabilityId = capabilityIdFromGatewayRow(row);
  const capability = aiRuntimeCapabilityMeta(capabilityId);
  const group = aiRuntimeGroupMeta(capability.groupId);
  const state = normalizeState(row.runtime_state);
  const actions = aiRuntimeDefaultActions(capabilityId);
  const detail = compactDetail(row);
  return {
    capabilityId,
    title: capability.title,
    description: capability.description,
    groupId: capability.groupId,
    groupTitle: group.title,
    groupDescription: group.description,
    groupIcon: group.icon,
    icon: capability.icon,
    section: capability.section,
    state,
    statusLabel: aiRuntimeStateLabel(capabilityId, state),
    statusTitle: aiRuntimeStateTitle(capabilityId, state),
    detail,
    fallback: hasFallback(row.runtime_detail, row.error),
    actions,
    sourceKinds: capability.sourceKinds,
    sources: [buildGatewaySource(row, capabilityId)],
  };
}

export function resolveAiRuntimeSnapshot(params: {
  gatewayResults: PluginConfigCheckResult["results"];
  extensionTest: AiExtensionTestData | null;
}): AiRuntimeSnapshotItem[] {
  const items: AiRuntimeSnapshotItem[] = [];
  if (params.extensionTest) items.push(itemFromExtensionTest(params.extensionTest));
  for (const row of params.gatewayResults) items.push(itemFromGatewayRow(row));
  return mergeSnapshotItems(items).slice().sort((a, b) => {
    const rankDiff = runtimeRank(a.state) - runtimeRank(b.state);
    if (rankDiff !== 0) return rankDiff;
    return `${a.groupId}:${a.capabilityId}`.localeCompare(`${b.groupId}:${b.capabilityId}`);
  });
}

export function groupAiRuntimeSnapshot(items: AiRuntimeSnapshotItem[]): AiRuntimeSnapshotGroup[] {
  return AI_RUNTIME_GROUPS.map((group) => {
    const groupItems = items
      .filter((item) => item.groupId === group.id)
      .slice()
      .sort((a, b) => {
        const rankDiff = runtimeRank(a.state) - runtimeRank(b.state);
        if (rankDiff !== 0) return rankDiff;
        return a.capabilityId.localeCompare(b.capabilityId);
      });
    const degradedCount = groupItems.filter((item) => item.state === "degraded").length;
    const disabledCount = groupItems.filter((item) => item.state === "disabled").length;
    const healthyCount = groupItems.filter((item) => item.state === "healthy").length;
    const fallbackCount = groupItems.filter((item) => item.fallback).length;
    const state: AiRuntimeState = degradedCount
      ? "degraded"
      : healthyCount
        ? "healthy"
        : disabledCount
          ? "disabled"
          : "unknown";
    const pieces: string[] = [];
    if (degradedCount) pieces.push(`${degradedCount} 项降级`);
    if (disabledCount) pieces.push(`${disabledCount} 项未启用`);
    if (healthyCount) pieces.push(`${healthyCount} 项正常`);
    if (fallbackCount) pieces.push(`${fallbackCount} 项带回退`);
    return {
      id: group.id,
      title: group.title,
      description: group.description,
      icon: group.icon,
      section: group.section,
      state,
      lead: pieces.join("，") || group.description,
      total: groupItems.length,
      degradedCount,
      disabledCount,
      healthyCount,
      fallbackCount,
      items: groupItems,
    };
  });
}

export function buildAiRuntimeOverview(items: AiRuntimeSnapshotItem[]): AiRuntimeOverview {
  const degradedCount = items.filter((item) => item.state === "degraded").length;
  const disabledCount = items.filter((item) => item.state === "disabled").length;
  const healthyCount = items.filter((item) => item.state === "healthy").length;
  const fallbackCount = items.filter((item) => item.fallback).length;
  const total = items.length;
  const state: AiRuntimeState = !items.length
    ? "unknown"
    : degradedCount
      ? "degraded"
      : healthyCount
        ? "healthy"
        : disabledCount
          ? "disabled"
          : "unknown";
  let title = "AI 运行时状态待确认";
  if (state === "degraded") title = "AI 运行中存在需要处理的降级能力";
  else if (state === "disabled") title = "当前 AI 运行时整体未启用";
  else if (state === "healthy") title = "AI 运行时已接通，核心能力可用";
  const parts: string[] = [];
  if (degradedCount) parts.push(`${degradedCount} 项降级`);
  if (disabledCount) parts.push(`${disabledCount} 项未启用`);
  if (healthyCount) parts.push(`${healthyCount} 项正常`);
  if (fallbackCount) parts.push(`${fallbackCount} 项带回退策略`);
  return {
    state,
    title,
    lead: total ? (parts.join("，") || "暂无可展示状态。") : "尚未拿到探测结果，请先刷新状态。",
    degradedCount,
    disabledCount,
    healthyCount,
    fallbackCount,
    total,
  };
}

export function pickAiRuntimeFocusItems(items: AiRuntimeSnapshotItem[]): AiRuntimeSnapshotItem[] {
  const degraded = items.filter((item) => item.state === "degraded");
  if (degraded.length) return degraded.slice(0, 4);
  const fallback = items.filter((item) => item.fallback);
  if (fallback.length) return fallback.slice(0, 4);
  return items.slice(0, 4);
}
