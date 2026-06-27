import { AI_PERSONA_OBSERVE_REDIRECT, aiConfigSectionPath } from "@/config/aiConfigSections";

export interface AiSetupGuideStep {
  label: string;
  detail: string;
  to: string;
}

export interface AiSetupGuidePath {
  id: "connect" | "improve";
  title: string;
  lead: string;
  steps: AiSetupGuideStep[];
}

/** 按场景拆成两条路径，避免把 8 个配置分区一次性堆给站长。 */
export const AI_SETUP_GUIDE_PATHS: AiSetupGuidePath[] = [
  {
    id: "connect",
    title: "先让 @ 能聊",
    lead: "首次部署按顺序做；多数站点只需这 4 步。",
    steps: [
      {
        label: "1. 扩展连接",
        detail: "填 Pallas-Bot-AI 地址与 Token，点连通性检测。",
        to: aiConfigSectionPath("connection"),
      },
      {
        label: "2. 运行模型",
        detail: "确认本地 Ollama / GPU 层数与当前加载模型。",
        to: aiConfigSectionPath("runtime"),
      },
      {
        label: "3. 上游 Provider",
        detail: "登记至少一个可用上游并测试连通。",
        to: aiConfigSectionPath("provider"),
      },
      {
        label: "4. 对话策略",
        detail: "开启「智能对话」等 Bot 侧总开关并保存。",
        to: aiConfigSectionPath("strategy"),
      },
      {
        label: "5. 历史验证",
        detail: "改完配置后 @ 试聊，并在会话里排除坏回复或填期望回复。",
        to: "/ai/history?workspace=sessions",
      },
    ],
  },
  {
    id: "improve",
    title: "让回复越聊越好",
    lead: "模型接通后再做；日常维护在观测区，不必反复改路由。",
    steps: [
      {
        label: "1. 开启学习闭环",
        detail: "对话策略里打开「收集反哺」与「参与弱打分」。",
        to: `${aiConfigSectionPath("strategy")}#learning-loop`,
      },
      {
        label: "2. 排除坏回复",
        detail: "AI 历史 · 会话里对助手回复点「排除」或填期望回复。",
        to: "/ai/history?workspace=sessions",
      },
      {
        label: "3. 观测与晋升",
        detail: "维护 tab 查看反哺样本；可选把好样本晋升进语料。",
        to: "/ai/history?workspace=maintain",
      },
      {
        label: "4. 牛格与人设",
        detail: "查看当前人设编译结果；口语教别名可在群里直接说。",
        to: AI_PERSONA_OBSERVE_REDIRECT,
      },
    ],
  },
];

export const AI_SETUP_GUIDE_DISMISS_KEY = "pallas.aiConfig.setupGuideDismissed";

export const AI_CONFIG_WIZARD_PATH = "/ai/wizard";
