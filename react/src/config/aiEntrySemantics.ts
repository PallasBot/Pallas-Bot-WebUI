import { aiConfigSectionPath } from "@/config/aiConfigSections";
import { AI_OBSERVATION_DEFAULT_PATH } from "@/config/aiObservationSections";

/** 配置 / 检测 / 运行态三类入口的统一说明与跳转目标 */
export const AI_ENTRY_RUNTIME = {
  label: "AI 观测",
  shortLead: "用量、会话与扩展日志；媒体启停见 AI 配置 · 媒体。",
  path: AI_OBSERVATION_DEFAULT_PATH,
} as const;

export const AI_ENTRY_SITE_GATEWAY_CHECK = {
  label: "站点级网关检测",
  shortLead: "按画画等服务网关地址，批量探测画画、点歌、MAA 等连通性。",
  path: aiConfigSectionPath("media", "draw"),
} as const;

export const AI_ENTRY_PLUGIN_CONFIG_CHECK = {
  label: "插件配置检测",
  shortLead: "按本页草稿，只探测与该插件相关的网关或参数。",
} as const;

export const AI_ENTRY_CONNECTION_DIAG = {
  label: "连接诊断",
  shortLead: "按当前地址与 Token 探测媒体服务（Pallas-Bot-AI）。",
  path: aiConfigSectionPath("media", "service"),
} as const;

/** task 相关配置分层说明（Provider / 路由页共用，避免同名 task 被当成同一项） */
export const AI_TASK_CONFIG_HINTS = {
  providerSection: "本页登记上游提供方；各场景用的模型在「任务编排」里指定。",
  providerIntro: "保存后通常无需重启。远程密钥可写环境变量名；明文密钥保存在本机配置。",
  providerTaskRoute: "选「自动」时按备用链路顺序解析；显式指定则固定走该提供方。",
  providerTaskModel: "写入对应提供方的任务模型表；未填则用提供方默认模型。",
  routingSection: "本页配置本机 Ollama 分档；云端任务见「任务编排」。",
  routingIntro: "单模型时跟随「运行模型」；开启多模型后可按档分流。",
  routingTaskModels: "已并入「任务编排」；旧环境变量仅作兼容回退。",
  routingProviderTaskReadonly: "只读摘要，来自提供方配置；请到「提供方」页修改。",
} as const;
