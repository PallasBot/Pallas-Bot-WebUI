export interface AiConfigProfileDef {
  id: "at_chat" | "chat_repeater" | "full_learning";
  title: string;
  lead: string;
  patches: Record<string, string>;
}

/** Bot 对话策略一键预设（仅改 llm 通用配置段已知字段）。 */
export const AI_CONFIG_PROFILES: AiConfigProfileDef[] = [
  {
    id: "at_chat",
    title: "仅 @ 闲聊",
    lead: "只开智能对话；不接 AI 接话，也不收集反哺样本。",
    patches: {
      llm_chat_enabled: "true",
      llm_repeater_mode: "off",
      llm_repeater_feedback_enabled: "false",
      llm_repeater_bias_enabled: "false",
      llm_repeater_writeback_enabled: "false",
    },
  },
  {
    id: "chat_repeater",
    title: "@ + 智能接话",
    lead: "闲聊 + 语料选句 + 反哺自动学习与写回（大多数群推荐）。",
    patches: {
      llm_chat_enabled: "true",
      llm_repeater_mode: "select_polish_lite",
      llm_repeater_feedback_enabled: "true",
      llm_repeater_bias_enabled: "true",
      llm_repeater_writeback_enabled: "true",
      llm_vector_retrieve: "hybrid",
    },
  },
  {
    id: "full_learning",
    title: "完整学习闭环",
    lead: "与「@ + 智能接话」相同；强调反哺、弱打分、自动写回与向量近似。",
    patches: {
      llm_chat_enabled: "true",
      llm_repeater_mode: "select_polish_lite",
      llm_repeater_feedback_enabled: "true",
      llm_repeater_bias_enabled: "true",
      llm_repeater_writeback_enabled: "true",
      llm_vector_retrieve: "hybrid",
    },
  },
];
