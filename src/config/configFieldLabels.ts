/**
 * WebUI 配置展示映射。
 *
 * - 通用配置 enum：优先使用后端 API 返回的 choice_labels（见 Pallas-Bot enum_labels.py）
 * - FALLBACK_ENUM_LABELS：后端未附带时的本地兜底（插件配置等）
 * - LLM_*：AI 控制台专用，非通用配置 API 字段
 */

/** 后端未返回 choice_labels 时的通用枚举兜底（与 enum_labels.GLOBAL_CHOICE_LABELS 对齐） */
export const FALLBACK_ENUM_LABELS: Record<string, string> = {
  auto: "自动",
  true: "开启",
  false: "关闭",
  keyword: "仅关键词（默认）",
  hybrid: "关键词 + 向量（推荐）",
  embedding: "纯向量",
  vector: "纯向量（同 embedding）",
  prefetch: "后台预取（推荐）",
  sync: "当场联网查询",
  "local,community": "先本机，再共享池",
  local: "只用本机",
  local_first: "本地优先",
  merge_counts: "合并使用次数",
  local_only: "仅使用本机语料",
  session: "本 worker 连接",
  fleet: "协议实例名册",
  connected: "全集群曾连 WS",
  off: "关闭 AI 接话",
  select: "命中语料时 AI 选句（推荐）",
  select_polish_lite: "选句为主，少数回复轻润色",
  select_fallback: "选句，语料缺失时现编",
  fallback: "仅语料缺失时 AI 现编",
  "": "自动推断（推荐）",
  legacy_repeater: "仅语料规则（legacy）",
  repeater_plus_decision: "语料 + 统一决策",
  full_conversation_kernel: "决策 + 生成 + 反馈全链路",
  "60": "1 分钟",
  "120": "2 分钟",
  "300": "5 分钟",
  "600": "10 分钟",
  "900": "15 分钟",
  "1800": "30 分钟",
  "3600": "1 小时",
};

export const LLM_TASK_ROUTE_LABELS: Record<string, string> = {
  llm_chat: "@ 对话",
  drunk: "醉聊",
  repeater_select: "接话选句",
  repeater_polish_lite: "接话轻润色",
  repeater_fallback: "接话兜底",
  repeater_polish: "接话完整润色",
  other: "其他",
};

export function llmTaskRouteLabel(task: string): string {
  return LLM_TASK_ROUTE_LABELS[task] ?? task;
}

export const LLM_CLASSIFY_METRIC_LABELS: Record<string, string> = {
  tier_simple: "简单",
  tier_medium: "中等",
  tier_complex: "复杂",
  tools_on: "工具开",
  tools_off: "工具关",
  vision_on: "含图",
  vision_off: "纯文本",
};

export type LlmBotFieldGroupTier = "essential" | "advanced";

export interface LlmBotFieldGroupDef {
  title: string;
  keys: readonly string[];
  tier: LlmBotFieldGroupTier;
  hint?: string;
  anchorId?: string;
}

export const LLM_BOT_FIELD_GROUPS: ReadonlyArray<LlmBotFieldGroupDef> = [
  {
    title: "功能开关",
    tier: "essential",
    keys: [
      "llm_chat_enabled",
      "chat_enable",
      "chat_tts_enable",
      "llm_repeater_mode",
      "llm_polish_lite_sample_rate",
      "llm_tools_enabled",
      "llm_governance_enabled",
      "conversation_feature_level",
    ],
    hint: "总闸、接话方式与对话相关能力；各开关说明见字段旁帮助。会话 / 记忆见「对话」子分区。",
  },
  {
    title: "学习闭环",
    tier: "essential",
    anchorId: "learning-loop",
    keys: [
      "llm_repeater_feedback_enabled",
      "llm_repeater_bias_enabled",
      "llm_repeater_writeback_enabled",
    ],
    hint: "开启加权后，在 AI 历史里排除坏回复或填写期望回复；写回晋升为可选进阶。",
  },
  {
    title: "输出过滤",
    tier: "advanced",
    keys: [
      "llm_output_filter_enabled",
      "llm_output_filter_chat_hard_phrases",
      "llm_output_filter_chat_soft_phrases",
      "llm_output_filter_polish_lite_hard_phrases",
      "llm_output_filter_polish_lite_soft_phrases",
    ],
  },
  {
    title: "并发与限流",
    tier: "advanced",
    keys: [
      "llm_chat_max_concurrency",
      "llm_repeater_group_cooldown_sec",
      "llm_repeater_max_inflight",
      "llm_repeater_global_rpm",
      "llm_reply_gate_enabled",
      "llm_chat_queue_merge",
    ],
  },
  {
    title: "回复后处理",
    tier: "advanced",
    keys: [
      "llm_reply_postprocess_enabled",
      "llm_reply_typo_enabled",
      "llm_reply_typo_rate",
      "llm_reply_split_enabled",
      "llm_reply_split_max_chars",
      "llm_sticker_fit_enabled",
      "llm_reply_effect_eval_enabled",
    ],
  },
];

export function llmBotFieldGroupsForMode(isSimpleMode: boolean): ReadonlyArray<LlmBotFieldGroupDef> {
  if (!isSimpleMode) return LLM_BOT_FIELD_GROUPS;
  return LLM_BOT_FIELD_GROUPS.filter((group) => group.tier === "essential");
}
