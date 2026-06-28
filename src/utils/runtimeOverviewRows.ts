import type { LlmRuntimeOverviewData } from "@/api/pallasTypes";
import {
  aiCircuitStateLabel,
  aiDegradedStateLabel,
  aiFailureClassLabel,
  aiHealthStateLabel,
} from "@/utils/aiHealthLabel";

export interface RuntimeOverviewRow {
  id: string;
  title: string;
  healthState: string;
  healthStateRaw: string;
  circuitState: string;
  circuitStateRaw: string;
  degradedState: string;
  degradedStateRaw: string;
  detail: string;
  queueDepth?: number;
  activeTasks?: number;
}

function labelOrDash(value?: string | null): string {
  const text = String(value ?? "").trim();
  return text || "—";
}

function overviewStateFields(
  health?: string | null,
  circuit?: string | null,
  degraded?: string | null,
): Pick<
  RuntimeOverviewRow,
  "healthState" | "healthStateRaw" | "circuitState" | "circuitStateRaw" | "degradedState" | "degradedStateRaw"
> {
  return {
    healthState: aiHealthStateLabel(health),
    healthStateRaw: labelOrDash(health),
    circuitState: aiCircuitStateLabel(circuit),
    circuitStateRaw: labelOrDash(circuit),
    degradedState: aiDegradedStateLabel(degraded),
    degradedStateRaw: labelOrDash(degraded),
  };
}

export function buildRuntimeOverviewRows(
  overview: LlmRuntimeOverviewData | null | undefined,
): RuntimeOverviewRow[] {
  if (!overview?.health) return [];
  const health = overview.health;
  const rows: RuntimeOverviewRow[] = [];

  if (health.llm_health) {
    const llm = health.llm_health;
    const providers = llm.provider_status ?? [];
    const reachable = providers.filter((item) => item.reachable).length;
    rows.push({
      id: "llm.chat",
      title: "LLM 对话",
      ...overviewStateFields(llm.health_state, llm.circuit_state, llm.degraded_state),
      detail: `上游 ${reachable}/${providers.length} 可用`
        + (llm.consecutive_failures ? ` · 连续失败 ${llm.consecutive_failures}` : "")
        + (llm.recent_failure_class ? ` · 最近失败 ${aiFailureClassLabel(llm.recent_failure_class)}` : ""),
    });
  }

  if (health.image_health) {
    const image = health.image_health;
    rows.push({
      id: "image.generate",
      title: "绘图运行时",
      ...overviewStateFields(image.health_state, image.circuit_state, image.degraded_state),
      detail: `连续失败 ${image.consecutive_failures ?? 0}`
        + (image.recent_failure_class ? ` · ${aiFailureClassLabel(image.recent_failure_class)}` : ""),
    });
  }

  if (health.media_tasks) {
    const media = health.media_tasks;
    rows.push({
      id: "media.tasks",
      title: "媒体任务平台",
      ...overviewStateFields(media.health_state, media.circuit_state, media.degraded_state),
      detail: `队列 ${media.queue_depth ?? 0} · 执行中 ${media.active_tasks ?? 0} · 累计 ${media.total_tasks ?? 0}`,
      queueDepth: Number(media.queue_depth ?? 0),
      activeTasks: Number(media.active_tasks ?? 0),
    });
    for (const cap of media.capabilities ?? []) {
      const capability = String(cap.capability ?? "").trim();
      if (!capability) continue;
      rows.push({
        id: capability,
        title: capability === "media.sing" ? "点歌运行时" : capability,
        ...overviewStateFields(cap.health_state, null, null),
        detail: `队列 ${cap.queue_depth ?? 0} · 执行中 ${cap.active_tasks ?? 0}`,
        queueDepth: Number(cap.queue_depth ?? 0),
        activeTasks: Number(cap.active_tasks ?? 0),
      });
    }
  }

  if (health.tts_health) {
    const tts = health.tts_health;
    rows.push({
      id: "tts.synthesize",
      title: "TTS 合成",
      ...overviewStateFields(tts.health_state, tts.circuit_state, tts.degraded_state),
      detail: tts.celery_enabled == null ? "—" : tts.celery_enabled ? "后台任务已启用" : "后台任务未启用",
    });
  }

  return rows;
}

export function runtimeOverviewHeadline(
  overview: LlmRuntimeOverviewData | null | undefined,
): { ok: boolean; title: string; detail: string } {
  if (!overview?.health) {
    return { ok: false, title: "暂无运行态数据", detail: "请刷新或检查 AI 服务连接。" };
  }
  const health = overview.health;
  if (!health.ok) {
    return {
      ok: false,
      title: "AI 服务不可达",
      detail: health.error || health.llm_runtime_detail || "健康检查失败",
    };
  }
  const rows = buildRuntimeOverviewRows(overview);
  const degraded = rows.filter((row) => {
    const hs = row.healthStateRaw.toLowerCase();
    const cs = row.circuitStateRaw.toLowerCase();
    return hs === "degraded" || hs === "unhealthy" || cs === "open" || cs === "half_open";
  }).length;
  if (degraded > 0) {
    return {
      ok: true,
      title: `${degraded} 项需关注`,
      detail: health.llm_runtime_detail || "部分能力降级或熔断，请查看下表。",
    };
  }
  return {
    ok: true,
    title: "全局运行正常",
    detail: health.llm_runtime_detail || "LLM / 媒体 / 绘图运行态均已接通。",
  };
}
