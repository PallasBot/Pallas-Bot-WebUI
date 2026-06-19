import type { AiRuntimeState } from "@/config/aiRuntimeRegistry";

/**
 * AI 运行态 → 标签/样式 的唯一映射。
 *
 * 此前 AiHomePage、AiConfigRuntimeSection、AiRuntimeSummaryPanel 与
 * aiRuntimeResolver 各自维护一份 state→class / state→label 副本，行为略有出入
 * （例如 disabled 的圆点样式）。统一收敛到这里，避免再次漂移。
 */

/** 状态标签文案，对应 tag / 徽标。 */
export function runtimeStateLabel(state: AiRuntimeState): string {
  if (state === "healthy") return "正常";
  if (state === "degraded") return "降级";
  if (state === "disabled") return "未启用";
  return "待确认";
}

/** `tag tag--*` 用的状态修饰类。 */
export function runtimeStateClass(state: AiRuntimeState): string {
  if (state === "healthy") return "tag--ok";
  if (state === "degraded") return "tag--warn";
  return "tag--muted";
}

/** 圆点指示器修饰类（`ai-dot ai-dot--*`）；正常/未启用态返回空串沿用基础点样式。 */
export function runtimeStateDotClass(state: AiRuntimeState): string {
  if (state === "healthy") return "ai-dot--ok";
  if (state === "degraded") return "ai-dot--warn";
  if (state === "disabled") return "";
  return "ai-dot--warn";
}
