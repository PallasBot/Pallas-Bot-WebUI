import {
  AI_CONFIG_LEGACY_RUNTIME_REDIRECT,
  AI_PERSONA_OBSERVE_REDIRECT,
  aiConfigSectionPath,
} from "@/config/aiConfigSections";

/** 配置 / 检测 / 运行态三类入口的统一说明与跳转目标 */
export const AI_ENTRY_RUNTIME = {
  label: "运行总览",
  shortLead: "查看各 AI 能力是否健康、有无降级，以及媒体任务队列。",
  path: "/ai/home",
} as const;

export const AI_OBSERVATION_LINKS = {
  overview: { id: "overview", label: "运行总览", path: "/ai/home" },
  statistics: { id: "statistics", label: "调用统计", path: "/ai/statistics" },
  history: { id: "history", label: "会话历史", path: "/ai/history" },
  personaObserve: { id: "personaObserve", label: "牛格观测", path: AI_PERSONA_OBSERVE_REDIRECT },
  runtimeDiag: { id: "runtimeDiag", label: "运行诊断", path: AI_CONFIG_LEGACY_RUNTIME_REDIRECT },
} as const;

export const AI_OBSERVATION_LINKS_LIST = [
  AI_OBSERVATION_LINKS.overview,
  AI_OBSERVATION_LINKS.statistics,
  AI_OBSERVATION_LINKS.history,
] as const;

export const AI_ENTRY_SITE_GATEWAY_CHECK = {
  label: "站点级网关检测",
  shortLead: "按画画插件等服务网关地址，批量探测画画、点歌、MAA 等站点连通性。",
  path: aiConfigSectionPath("draw"),
} as const;

export const AI_ENTRY_PLUGIN_CONFIG_CHECK = {
  label: "插件配置检测",
  shortLead: "按本页当前草稿配置，仅探测与该插件直接相关的网关或参数；不替代站点级检测或运行态总览。",
} as const;

export const AI_ENTRY_CONNECTION_DIAG = {
  label: "连接诊断",
  shortLead: "按当前填写的地址与 Token 探测 Pallas-Bot-AI 连通性；完整健康状态见 AI 观测总览。",
  path: aiConfigSectionPath("connection"),
} as const;

export const AI_CONFIG_LAYER_LINKS = {
  provider: { label: "模型与 Provider", path: aiConfigSectionPath("provider") },
  strategy: { label: "Bot 对话策略", path: aiConfigSectionPath("strategy") },
} as const;

export type AiConfigLayerLinkId = keyof typeof AI_CONFIG_LAYER_LINKS;

/** task 相关配置分层说明（Provider / 路由页共用，避免同名 task 被当成同一项） */
export const AI_TASK_CONFIG_HINTS = {
  providerSection:
    "本页写入 Provider 配置：登记上游端点；专家模式下「任务路由与模型」矩阵统一指定各场景的上游与模型。",
  providerIntro:
    "保存 Provider 配置后通常无需重启后台任务；远程密钥以环境变量名引用，明文仍在 .env。",
  providerTaskRoute:
    "Provider 留「自动」时按备用链路顺序解析；显式指定则固定走该 Provider。",
  providerTaskModel:
    "模型写入对应 Provider 的任务模型表；未填则回退 Provider 默认模型。",
  routingSection:
    "本页写入 AI 服务 .env：默认本地模型与多模型分流；各场景的上游/模型见 Provider 矩阵。",
  routingIntro:
    "单模型模式下主本地 Provider 跟随「运行模型」；开启多模型分流后，分档与 Provider 默认模型可继续分流。",
  routingTaskModels:
    "已并入 Provider 区「Task 路由与模型」矩阵；.env 中旧项仅作兼容回退显示。",
  routingProviderTaskReadonly:
    "只读摘要，来自 Provider 配置；修改请在上游 Provider 页编辑对应 Provider。",
} as const;
