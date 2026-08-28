import type {
  GroupExpressionProfile,
  LegacyGroupStyleProfile,
  SemanticStyleQualityData,
} from "@/api/pallasTypes";

type Pair = [label: string, value: string];

/** 分布条目：label 为展示名，ratio 为 0~1 占比（用于占比条），value 为数值文本。 */
export interface DistSlice {
  label: string;
  ratio: number;
  value: string;
}

export interface GroupExpressionView {
  meta: { windowHours: string; updatedAt: string };
  sampleGroup: Pair[];
  qualityGroup: Pair[];
  replyShape: Pair[];
  rhythm: DistSlice[];
  exampleScene: string;
  exampleGroup: Pair[];
  intensity: DistSlice[];
  forms: DistSlice[];
  /** 样本不足（后端 length_pref 为 any）。 */
  lowSample: boolean;
  summary: { length: string; rhythm: string; sample: string };
}

function shown(value: number | undefined, digits = 1): string {
  return Number.isFinite(value) ? Number(value).toFixed(digits).replace(/\.0$/, "") : "—";
}

function percent(value: number | undefined): string {
  return Number.isFinite(value) ? `${(Number(value) * 100).toFixed(1)}%` : "—";
}

function fmtIsoTime(value: unknown): string {
  if (value == null || value === "") return "—";
  const date =
    typeof value === "number"
      ? new Date(value < 1e12 ? value * 1000 : value)
      : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

const RHYTHM_LABELS: Record<string, string> = { single: "单条", multi: "多条" };
const INTENSITY_ORDER = ["quiet", "soft", "neutral", "sharp", "strong"];
const INTENSITY_LABELS: Record<string, string> = {
  quiet: "冷静",
  soft: "温和",
  neutral: "中性",
  sharp: "犀利",
  strong: "强烈",
};
const FORM_LABELS: Record<string, string> = { question: "提问" };
const LENGTH_PREF_TEXT: Record<string, string> = { short: "偏短促", medium: "适中", long: "偏完整" };

/**
 * 把 count / ratio 混布转成展示条目。后端节奏分布传归一化占比、强度与形式传计数，
 * 这里统一按总和归一，数值文本按 mode 展示。
 */
function distSlices(
  value: Record<string, number> | undefined,
  labels: Record<string, string>,
  mode: "ratio" | "count",
  order: string[] = [],
): DistSlice[] {
  const entries = Object.entries(value ?? {}).filter(([, v]) => Number.isFinite(v) && Number(v) > 0);
  const total = entries.reduce((sum, [, v]) => sum + Number(v), 0);
  if (!entries.length || total <= 0) return [];
  const rank = (key: string) => {
    const idx = order.indexOf(key);
    return idx === -1 ? order.length : idx;
  };
  return entries
    .map(([key, v]) => ({
      key,
      ratio: Number(v) / total,
      count: Number(v),
    }))
    .sort((a, b) => rank(a.key) - rank(b.key) || b.count - a.count)
    .map(({ key, ratio, count }) => ({
      label: labels[key] ?? key,
      ratio,
      value: mode === "ratio" ? `${Math.round(ratio * 100)}%` : shown(count, 0),
    }));
}

function legacyView(legacy: LegacyGroupStyleProfile): GroupExpressionView {
  const sample = legacy.sample ?? {};
  const raw = legacy.raw ?? {};
  return {
    meta: {
      windowHours: `${shown(sample.window_hours, 0)} 小时`,
      updatedAt: fmtIsoTime(legacy.updated_at),
    },
    sampleGroup: [
      ["观察窗口", `${shown(sample.window_hours, 0)} 小时`],
      ["消息 / 回答", `${shown(sample.message_count, 0)} / ${shown(sample.answer_count, 0)}`],
      ["回答率（回复 / 消息）", percent(raw.local_answer_ratio)],
      ["活跃时段每小时消息", shown(raw.msgs_per_hour_active)],
    ],
    qualityGroup: [["复读率", percent(raw.repeat_chain_rate)]],
    replyShape: [["平均 / P50 消息长度", `${shown(raw.avg_plain_len, 0)} / ${shown(raw.p50_plain_len, 0)}`]],
    rhythm: [],
    exampleScene: "",
    exampleGroup: [],
    intensity: [],
    forms: [],
    lowSample: false,
    summary: {
      length: "尚未形成稳定长度偏好",
      rhythm: "节奏尚未形成稳定偏好",
      sample: "暂未整理出足够的语义样本",
    },
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

  const lengthPref = LENGTH_PREF_TEXT[shape.length_pref];
  const contaminationTotal =
    Number(aggregate.contamination_skipped_messages ?? 0) + Number(aggregate.contamination_skipped_answers ?? 0);
  const rhythm = distSlices(shape.rhythm_distribution, RHYTHM_LABELS, "ratio");

  return {
    meta: {
      windowHours: `${shown(aggregate.window_hours, 0)} 小时`,
      updatedAt: fmtIsoTime(profile.updated_at),
    },
    sampleGroup: [
      ["样本数", shown(aggregate.sample_count, 0)],
      ["消息 / 回答", `${shown(aggregate.message_count, 0)} / ${shown(aggregate.answer_count, 0)}`],
      ["回答率（回复 / 消息）", percent(aggregate.answer_ratio)],
      ["活跃小时", shown(aggregate.active_hour_count, 0)],
      ["活跃时段每小时消息", shown(aggregate.messages_per_active_hour)],
    ],
    qualityGroup: [
      ["复读率", percent(aggregate.repetition_rate)],
      [
        "疑似污染已排除",
        contaminationTotal > 0
          ? `消息 ${shown(aggregate.contamination_skipped_messages, 0)} · 回复 ${shown(aggregate.contamination_skipped_answers, 0)}`
          : "无",
      ],
    ],
    replyShape: [
      ["每条回复段数", `${shown(shape.bubble_count_p50, 0)} ~ ${shown(shape.bubble_count_p90, 0)} 段`],
      [
        "每段字数",
        shape.segment_char_length_p50 === shape.segment_char_length_p90
          ? `约 ${shown(shape.segment_char_length_p50, 0)} 字`
          : `约 ${shown(shape.segment_char_length_p50, 0)} 字，偶尔到 ${shown(shape.segment_char_length_p90, 0)}`,
      ],
      ["整条消息字数 P50 / P90", `${shown(aggregate.message_length?.p50, 0)} / ${shown(aggregate.message_length?.p90, 0)}`],
    ],
    rhythm,
    exampleScene: examples.scene || "",
    exampleGroup: [
      ["语义样本", `${shown(examples.sample_count, 0)} 组`],
      ["直给样例", `${shown(examples.direct_example_count, 0)} · 其中配对 ${shown(examples.direct_pair_count, 0)}`],
      ["改写种子", shown(examples.rewrite_seed_count, 0)],
    ],
    intensity: distSlices(examples.intensity_counts, INTENSITY_LABELS, "count", INTENSITY_ORDER),
    forms: distSlices(examples.form_counts, FORM_LABELS, "count"),
    lowSample: shape.length_pref === "any",
    summary: {
      length: lengthPref ?? "尚未形成稳定长度偏好",
      rhythm: rhythmSummaryText(rhythm),
      sample:
        examples.sample_count && examples.sample_count > 0
          ? `已整理 ${shown(examples.sample_count, 0)} 组语义样本`
          : "暂未整理出足够的语义样本",
    },
  };
}

/** 供摘要使用：节奏以某形态为主。 */
export function rhythmSummaryText(slices: DistSlice[]): string {
  const top = slices[0];
  return top ? `节奏以${top.label}为主（${Math.round(top.ratio * 100)}%）` : "节奏尚未形成稳定偏好";
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
