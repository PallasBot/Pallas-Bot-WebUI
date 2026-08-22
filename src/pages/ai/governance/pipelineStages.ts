export type PipelineStageId = "identity" | "when" | "shape" | "phrasing" | "deliver";

export type PipelineStageMeta = {
  id: PipelineStageId;
  label: string;
  order: string;
  lead: string;
  /** 该阶段从 llm 段内联编辑的字段 */
  fieldNames: readonly string[];
};

/** 回复流水线五阶段：控制发送给模型的推理链路的每个环节。 */
export const PIPELINE_STAGES: readonly PipelineStageMeta[] = [
  {
    id: "identity",
    label: "身份",
    order: "identity",
    lead: "人设基调与输出口径，决定 Bot 以什么身份、什么边界说话。",
    fieldNames: ["llm_persona_output_firewall", "llm_output_filter_enabled", "llm_output_filter_chat_hard_phrases", "llm_output_filter_chat_soft_phrases"],
  },
  {
    id: "when",
    label: "时机",
    order: "when",
    lead: "要不要说：回复门槛、氛围插嘴、闭嘴静默与消息排队。",
    fieldNames: [
      "llm_reply_gate_enabled",
      "llm_current_turn_decision_enabled",
      "llm_speak_perception_enabled",
      "llm_speak_mention_enabled",
      "llm_speak_ambient_enabled",
      "llm_speak_ambient_rate",
      "llm_speak_ambient_min_score",
      "llm_speak_ambient_cooldown_sec",
      "llm_speak_ambient_budget_limit",
      "llm_speak_ambient_budget_window_sec",
      "llm_speak_min_alias_len",
      "llm_speak_followup_enabled",
      "llm_speak_followup_window_sec",
      "llm_speak_followup_max_total_sec",
      "llm_shut_up_silence_enabled",
      "llm_shut_up_silence_min_sec",
      "llm_shut_up_silence_max_sec",
      "llm_chat_queue_enabled",
      "llm_chat_queue_max",
      "llm_chat_queue_wait_sec",
      "llm_chat_queue_merge",
    ],
  },
  {
    id: "shape",
    label: "形态",
    order: "shape",
    lead: "说几句、多长、要不要随机分条与后处理错字。",
    fieldNames: [
      "llm_reply_split_randomize_enabled",
      "llm_reply_split_randomize_keep_rate",
      "llm_reply_postprocess_enabled",
      "llm_reply_typo_enabled",
      "llm_reply_typo_rate",
    ],
  },
  {
    id: "phrasing",
    label: "措辞",
    order: "phrasing",
    lead: "表达学习与注入：群表达采集、注入与回填。",
    fieldNames: [
      "llm_expression_inject_enabled",
      "llm_expression_learn_enabled",
      "llm_expression_auto_promote_enabled",
      "llm_expression_retrieve_limit",
    ],
  },
  {
    id: "deliver",
    label: "发送",
    order: "deliver",
    lead: "气泡发送节奏：间隔基础、每字增量与抖动。",
    fieldNames: ["llm_bubble_delay_base_sec", "llm_bubble_delay_per_char", "llm_bubble_delay_jitter", "llm_sticker_fit_enabled"],
  },
];