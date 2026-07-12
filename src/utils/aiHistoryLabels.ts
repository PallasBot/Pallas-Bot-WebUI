/** AI 观测历史页：展示用中文映射（API value 仍为英文）。 */

export const BEHAVIOR_SCENE_OPTIONS = [
  { label: "全部场景", value: "" },
  { label: "挑衅", value: "provocation" },
  { label: "打趣", value: "banter" },
  { label: "闲聊", value: "smalltalk" },
  { label: "倾诉", value: "venting" },
  { label: "群话题串", value: "group_threading" },
  { label: "轻求助", value: "light_help" },
] as const;

export const BEHAVIOR_ACTION_OPTIONS = [
  { label: "轻调侃后收束", value: "light_tease_and_close" },
  { label: "先回应再短回", value: "ack_then_short_reply" },
  { label: "跟一次玩笑", value: "follow_joke_once" },
  { label: "共情不说教", value: "ack_emotion_no_lecture" },
  { label: "紧扣当前话题", value: "stay_on_current_topic" },
  { label: "避免硬扯话题", value: "avoid_forced_topic_shift" },
  { label: "多人话题轻锚定", value: "brief_multi_party_anchor" },
  { label: "简短帮忙后停下", value: "short_help_then_stop" },
] as const;

export const BEHAVIOR_OUTCOME_OPTIONS = [
  { label: "未判定", value: "" },
  { label: "接住了", value: "engaged" },
  { label: "一般", value: "neutral" },
  { label: "被无视", value: "ignored" },
  { label: "很尬", value: "awkward" },
  { label: "带偏了", value: "derailed" },
] as const;

export const PATTERN_SORT_OPTIONS = [
  { label: "自动分优先", value: "success_score" },
  { label: "人工分优先", value: "manual_score" },
  { label: "规则 ID 字母序", value: "pattern_id" },
] as const;

const SCENE_LABELS: Record<string, string> = Object.fromEntries(
  BEHAVIOR_SCENE_OPTIONS.filter((row) => row.value).map((row) => [row.value, row.label]),
);

const ACTION_LABELS: Record<string, string> = Object.fromEntries(
  BEHAVIOR_ACTION_OPTIONS.map((row) => [row.value, row.label]),
);

const OUTCOME_LABELS: Record<string, string> = Object.fromEntries(
  BEHAVIOR_OUTCOME_OPTIONS.map((row) => [row.value, row.label]),
);

export function labelScene(raw?: string | null): string {
  const key = String(raw || "").trim();
  if (!key) return "未标注";
  return SCENE_LABELS[key] || key;
}

export function labelAction(raw?: string | null): string {
  const key = String(raw || "").trim();
  if (!key) return "未选";
  return ACTION_LABELS[key] || key;
}

export function labelActions(raw?: string[] | null): string {
  const list = (raw || []).map((item) => labelAction(item)).filter(Boolean);
  return list.length ? list.join(" / ") : "未选";
}

export function labelOutcome(raw?: string | null): string {
  const key = String(raw || "").trim();
  if (!key) return "未判定";
  return OUTCOME_LABELS[key] || key;
}

export function labelFeatureLevel(raw?: string | null): string {
  const key = String(raw || "").trim().toLowerCase();
  if (!key) return "—";
  if (key === "full" || key === "complete") return "完整";
  if (key === "basic" || key === "minimal") return "基础";
  if (key === "standard" || key === "default") return "标准";
  if (key === "advanced") return "进阶";
  return String(raw);
}

export function labelRepeaterMode(raw?: string | null): string {
  const key = String(raw || "").trim().toLowerCase();
  if (!key) return "—";
  if (key === "off" || key === "disabled") return "关闭";
  if (key === "on" || key === "enabled") return "开启";
  if (key === "hybrid") return "混合";
  if (key === "llm_first") return "优先大模型";
  if (key === "corpus_first") return "优先语料";
  return String(raw);
}
