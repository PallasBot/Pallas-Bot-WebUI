/** 简单模式：云端+本地都配好时的对话流量预设。 */

export type TrafficRoutePresetId = "all_cloud" | "all_local" | "default_split";

export const SIMPLE_TRAFFIC_TASKS = [
  "llm_chat",
  "drunk",
  "repeater_select",
  "repeater_polish_lite",
  "repeater_fallback",
  "repeater_polish",
] as const;

/** 与 AI Runtime 默认 LLM_CHAIN_LOCAL_TASKS 对齐。 */
export const DEFAULT_SPLIT_LOCAL_TASKS = new Set<string>(["llm_chat", "drunk"]);

export const TRAFFIC_ROUTE_PRESET_OPTIONS: ReadonlyArray<{
  id: TrafficRoutePresetId;
  label: string;
  hint: string;
}> = [
  { id: "all_cloud", label: "全部走云端", hint: "闲聊与接话都走云端" },
  { id: "all_local", label: "全部走本地", hint: "闲聊与接话都走本地" },
  { id: "default_split", label: "默认分流", hint: "闲聊本地，接话云端" },
];

export function buildTrafficRouteTasks(
  preset: TrafficRoutePresetId,
  cloudId: string,
  localId: string,
): Record<string, string> {
  const tasks: Record<string, string> = {};
  for (const task of SIMPLE_TRAFFIC_TASKS) {
    if (preset === "all_cloud") tasks[task] = cloudId;
    else if (preset === "all_local") tasks[task] = localId;
    else tasks[task] = DEFAULT_SPLIT_LOCAL_TASKS.has(task) ? localId : cloudId;
  }
  return tasks;
}

/** 链首：全本地 → 本地；其余预设 → 云端（默认分流里接话走云）。 */
export function buildTrafficChainFallback(
  preset: TrafficRoutePresetId,
  cloudId: string,
  localId: string,
  existing: readonly string[],
): string[] {
  const primary = preset === "all_local" ? localId : cloudId;
  const secondary = primary === cloudId ? localId : cloudId;
  const rest = existing.filter((id) => id !== primary && id !== secondary);
  return [primary, secondary, ...rest];
}

export function detectTrafficRoutePreset(
  tasks: Record<string, string>,
  cloudId: string,
  localId: string,
): TrafficRoutePresetId | "custom" {
  if (!cloudId || !localId) return "custom";
  // 未写任务路由时，运行时走 AI 默认分流（闲聊本地 / 接话云端）
  if (!Object.keys(tasks).length) return "default_split";

  for (const preset of ["all_cloud", "all_local", "default_split"] as const) {
    const expected = buildTrafficRouteTasks(preset, cloudId, localId);
    const matches = SIMPLE_TRAFFIC_TASKS.every((task) => (tasks[task] || "") === expected[task]);
    if (!matches) continue;
    const known = new Set<string>(SIMPLE_TRAFFIC_TASKS);
    const extra = Object.keys(tasks).some((task) => !known.has(task));
    if (!extra) return preset;
  }
  return "custom";
}

export function trafficPresetSummary(
  preset: TrafficRoutePresetId | "custom",
): string {
  if (preset === "all_cloud") return "对话流量：全部走云端";
  if (preset === "all_local") return "对话流量：全部走本地";
  if (preset === "default_split") return "对话流量：闲聊本地 · 接话云端";
  return "对话流量：自定义（专家模式）";
}
