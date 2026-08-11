import type {
  GroupExpressionProfile,
  LegacyGroupStyleProfile,
  SemanticStyleQualityData,
} from "@/api/pallasTypes";

type Pair = [label: string, value: string];

export interface GroupExpressionView {
  aggregate: Pair[];
  replyShape: Pair[];
  exampleSummary: Pair[];
  rhythm: string;
  intensity: string;
  forms: string;
}

function shown(value: number | undefined, digits = 1): string {
  return Number.isFinite(value) ? Number(value).toFixed(digits).replace(/\.0$/, "") : "—";
}

function percent(value: number | undefined): string {
  return Number.isFinite(value) ? `${(Number(value) * 100).toFixed(1)}%` : "—";
}

function distribution(value: Record<string, number> | undefined): string {
  return Object.entries(value ?? {})
    .map(([key, count]) => `${key} ${shown(count, 0)}`)
    .join(" · ") || "—";
}

function legacyView(legacy: LegacyGroupStyleProfile): GroupExpressionView {
  const sample = legacy.sample ?? {};
  const raw = legacy.raw ?? {};
  return {
    aggregate: [
      ["观察窗口", `${shown(sample.window_hours, 0)} 小时`],
      ["消息 / 回答", `${shown(sample.message_count, 0)} / ${shown(sample.answer_count, 0)}`],
      ["每活跃小时消息", shown(raw.msgs_per_hour_active)],
      ["平均 / P50 长度", `${shown(raw.avg_plain_len, 0)} / ${shown(raw.p50_plain_len, 0)}`],
      ["回答率", percent(raw.local_answer_ratio)],
      ["复读率", percent(raw.repeat_chain_rate)],
    ],
    replyShape: [],
    exampleSummary: [],
    rhythm: "—",
    intensity: "—",
    forms: "—",
  };
}

export function groupExpressionView(
  profile: GroupExpressionProfile | null,
  legacy: LegacyGroupStyleProfile = {},
): GroupExpressionView {
  if (!profile) return legacyView(legacy);
  const aggregate = profile.aggregate;
  const shape = profile.reply_shape;
  const examples = profile.examples_summary;
  return {
    aggregate: [
      ["样本数", shown(aggregate.sample_count, 0)],
      ["消息 / 回答", `${shown(aggregate.message_count, 0)} / ${shown(aggregate.answer_count, 0)}`],
      ["活跃小时", shown(aggregate.active_hour_count, 0)],
      ["每活跃小时消息", shown(aggregate.messages_per_active_hour)],
      ["消息长度 P50 / P90", `${shown(aggregate.message_length?.p50, 0)} / ${shown(aggregate.message_length?.p90, 0)}`],
      ["回答率", percent(aggregate.answer_ratio)],
      ["复读率", percent(aggregate.repetition_rate)],
      ["污染跳过（消息 / 回答）", `${shown(aggregate.contamination_skipped_messages, 0)} / ${shown(aggregate.contamination_skipped_answers, 0)}`],
    ],
    replyShape: [
      ["气泡 P50 / P90", `${shown(shape.bubble_count_p50, 0)} / ${shown(shape.bubble_count_p90, 0)}`],
      ["分段字数 P50 / P90", `${shown(shape.segment_char_length_p50, 0)} / ${shown(shape.segment_char_length_p90, 0)}`],
    ],
    exampleSummary: [
      ["场景", examples.scene || "—"],
      ["语义样本", shown(examples.sample_count, 0)],
      ["直给样例 / 配对", `${shown(examples.direct_example_count, 0)} / ${shown(examples.direct_pair_count, 0)}`],
      ["改写种子", shown(examples.rewrite_seed_count, 0)],
    ],
    rhythm: distribution(shape.rhythm_distribution),
    intensity: distribution(examples.intensity_counts),
    forms: distribution(examples.form_counts),
  };
}

export function semanticStyleQualityView(data: SemanticStyleQualityData): Pair[] {
  return [
    ["状态", data.status.enabled ? "已启用" : "已停用"],
    ["样例 / 画像", `${data.status.example_count} / ${data.status.profile_count}`],
    ["标签版本", String(data.label_version)],
    ["正向 Bot 风格", String(data.positive_bot_style_count)],
  ];
}

export interface ScopedSemanticStyleQuality {
  scopeKey: string;
  data: SemanticStyleQualityData;
}

export function semanticStyleScopeKey(botId: number, groupId: number | null): string {
  return `${botId}:${groupId ?? ""}`;
}

export function scopedSemanticStyleQuality(
  stored: ScopedSemanticStyleQuality | null,
  botId: number,
  groupId: number | null,
): SemanticStyleQualityData | null {
  return stored?.scopeKey === semanticStyleScopeKey(botId, groupId) ? stored.data : null;
}
