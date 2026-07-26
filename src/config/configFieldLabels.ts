/** 弹层定位：Bot 对话策略表单分组。 */

/** 后端未返回 label 时的字段标题兜底（与 Pallas-Bot field_labels.py 对齐）。 */
export const FALLBACK_FIELD_LABELS: Record<string, string> = {
  llm_chat_enabled: "启用智能对话",
  chat_enable: "启用酒后 RWKV（独立通道）",
  chat_tts_enable: "酒后对话附带语音",
  llm_repeater_mode: "接话时如何用智能对话",
  llm_polish_lite_sample_rate: "轻润色抽样比例",
  llm_session_enabled: "记住多轮上下文",
  llm_session_user_window: "用户上下文条数",
  llm_session_group_window: "群旁听上下文条数",
  llm_session_group_ambient_enabled: "注入群旁听上下文",
  llm_session_user_ttl_sec: "用户会话过期（秒）",
  llm_session_private_ttl_sec: "私聊会话过期（秒）",
  llm_session_max_content_len: "单条会话字数上限",
  llm_session_strip_vision_enabled: "写入会话时去掉图片",
  llm_session_summary_enabled: "会话过长时生成摘要",
  llm_session_summary_threshold: "触发摘要的消息条数",
  llm_session_summary_keep_messages: "摘要后保留近期条数",
  llm_chat_char_budget: "LLM 对话上下文字符预算",
  llm_tools_enabled: "允许调用工具",
  llm_tools_selective: "按意图筛选工具",
  llm_tools_soft_recall_enabled: "软召回工具候选",
  llm_tools_soft_recall_min_score: "软召回最低匹配分",
  llm_tools_soft_recall_max_candidates: "软召回最多候选数",
  llm_tools_max_rounds: "工具调用最多轮数",
  llm_tools_blacklist: "工具黑名单",
  llm_tools_desc_max_len: "工具描述最大长度",
  web_search_api_url: "搜索接口地址",
  tavily_api_key: "搜索接口密钥",
  llm_governance_enabled: "限制 LLM 对话频率与字数",
  conversation_feature_level: "对话能力档位",
  llm_repeater_feedback_enabled: "收集 LLM 对话反哺",
  llm_repeater_bias_enabled: "反哺参与接话打分",
  llm_repeater_writeback_enabled: "反哺写回接话语料",
  llm_memory_rag_enabled: "群记忆检索",
  llm_vector_retrieve: "记忆/知识检索模式",
  llm_embedding_model: "Embedding 模型",
  llm_memory_rag_top_k: "记忆检索条数",
  llm_memory_max_per_group: "每群记忆上限",
  llm_memory_content_max_len: "单条记忆字数上限",
  llm_memory_auto_episode_enabled: "自动沉淀会话为记忆",
  llm_memory_auto_episode_cooldown_sec: "自动沉淀冷却（秒）",
  llm_memory_graph_extract_enabled: "记忆图谱抽取",
  llm_memory_graph_extract_on_write: "写入后自动抽取图谱",
  llm_memory_hiergraph_max_layers: "分层图谱最大层数",
  llm_relationship_notes_enabled: "关系备注",
  llm_output_filter_enabled: "回复输出过滤",
  llm_output_filter_chat_hard_phrases: "LLM 对话硬拦截词",
  llm_output_filter_chat_soft_phrases: "LLM 对话软拦截词",
  llm_output_filter_polish_lite_hard_phrases: "轻润色硬拦截词",
  llm_output_filter_polish_lite_soft_phrases: "轻润色软拦截词",
  llm_chat_max_concurrency: "LLM 对话并发上限",
  llm_repeater_group_cooldown_sec: "接话群冷却（秒）",
  llm_repeater_max_inflight: "接话并发上限",
  llm_repeater_global_rpm: "接话全局限流（次/分）",
  llm_reply_gate_enabled: "过滤无意义 @",
  llm_chat_queue_merge: "冷却期合并多条 @",
  llm_reply_postprocess_enabled: "回复后处理",
  llm_reply_typo_enabled: "偶发近音错别字",
  llm_reply_typo_rate: "单字错别字概率",
  llm_reply_split_enabled: "按句拆成多条",
  llm_reply_split_max_chars: "拆条单段字数上限",
  llm_sticker_fit_enabled: "表情适配与反馈",
  llm_reply_effect_eval_enabled: "记录回复效果评分",
};

export type LlmBotFieldGroupTier = "essential" | "advanced";

export interface LlmBotFieldGroupDef {
  title: string;
  keys: readonly string[];
  tier: LlmBotFieldGroupTier;
  hint?: string;
  anchorId?: string;
}

/** 策略表单：会话/记忆细项已拆到对话子面板，此处只留总开关级入口。 */
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
      "llm_tools_selective",
      "llm_tools_soft_recall_enabled",
      "llm_tools_soft_recall_min_score",
      "llm_tools_soft_recall_max_candidates",
      "llm_tools_max_rounds",
      "llm_tools_blacklist",
      "llm_tools_desc_max_len",
      "llm_governance_enabled",
      "conversation_feature_level",
    ],
    hint: "总开关、接话方式与工具策略。会话与记忆见同页其它分区；联网搜索见下方分组。",
  },
  {
    title: "联网搜索",
    tier: "essential",
    anchorId: "llm-web-search",
    keys: ["web_search_api_url", "tavily_api_key"],
    hint: "供 web.search 调用。两项都填才会真正联网；留空时群里搜网页会如实说搜不了。",
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
    hint: "在会话页排除坏回复或填期望回复；写回语料为进阶选项。",
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

export const LLM_SESSION_DETAIL_KEYS = [
  "llm_session_user_window",
  "llm_session_group_window",
  "llm_session_group_ambient_enabled",
  "llm_session_user_ttl_sec",
  "llm_session_private_ttl_sec",
  "llm_session_max_content_len",
  "llm_session_strip_vision_enabled",
  "llm_session_summary_enabled",
  "llm_session_summary_threshold",
  "llm_session_summary_keep_messages",
] as const;

export const LLM_MEMORY_DETAIL_KEYS = [
  "llm_vector_retrieve",
  "llm_embedding_model",
  "llm_memory_rag_top_k",
  "llm_memory_max_per_group",
  "llm_memory_content_max_len",
  "llm_memory_auto_episode_enabled",
  "llm_memory_auto_episode_cooldown_sec",
  "llm_memory_graph_extract_enabled",
  "llm_memory_graph_extract_on_write",
  "llm_memory_hiergraph_max_layers",
  "llm_relationship_notes_enabled",
] as const;

export const LLM_BUDGET_DETAIL_KEYS = ["llm_chat_char_budget"] as const;

/** 媒体地址已迁到「媒体」分段；会话/记忆/预算细项在专面，策略表单隐藏避免重复。 */
export const HIDDEN_LLM_STRATEGY_FIELDS = new Set([
  "ai_server_host",
  "ai_server_port",
  "llm_session_enabled",
  "llm_session_user_window",
  "llm_session_group_window",
  "llm_session_group_ambient_enabled",
  "llm_session_user_ttl_sec",
  "llm_session_private_ttl_sec",
  "llm_session_max_content_len",
  "llm_session_strip_vision_enabled",
  "llm_session_summary_enabled",
  "llm_session_summary_threshold",
  "llm_session_summary_keep_messages",
  "llm_chat_char_budget",
  "llm_memory_rag_enabled",
  "llm_vector_retrieve",
  "llm_embedding_model",
  "llm_memory_rag_top_k",
  "llm_memory_max_per_group",
  "llm_memory_content_max_len",
  "llm_memory_auto_episode_enabled",
  "llm_memory_auto_episode_cooldown_sec",
  "llm_memory_graph_extract_enabled",
  "llm_memory_graph_extract_on_write",
  "llm_memory_hiergraph_max_layers",
  "llm_relationship_notes_enabled",
]);

export function llmBotFieldGroupsForMode(isSimpleMode: boolean): ReadonlyArray<LlmBotFieldGroupDef> {
  if (!isSimpleMode) return LLM_BOT_FIELD_GROUPS;
  return LLM_BOT_FIELD_GROUPS.filter((group) => group.tier === "essential");
}
