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

export const LLM_BOT_FIELD_GROUPS: ReadonlyArray<{ title: string; keys: readonly string[] }> = [
  {
    title: "AI 服务连接",
    keys: ["ai_server_host", "ai_server_port"],
  },
  {
    title: "功能开关",
    keys: [
      "llm_chat_enabled",
      "llm_repeater_mode",
      "llm_session_enabled",
      "llm_tools_enabled",
      "llm_governance_enabled",
      "llm_memory_rag_enabled",
    ],
  },
  {
    title: "并发与限流",
    keys: [
      "llm_chat_max_concurrency",
      "llm_repeater_group_cooldown_sec",
      "llm_repeater_max_inflight",
      "llm_repeater_global_rpm",
      "llm_reply_gate_enabled",
      "llm_chat_queue_merge",
    ],
  },
];
