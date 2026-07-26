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
  providerSection: "先在本页登记「从哪家调用模型」；具体哪种群聊场景用谁，到「任务编排」里指定。",
  providerIntro: "保存后一般不用重启 Bot。密钥可填环境变量名，也可以明文写在本机配置（勿泄露）。",
  providerTaskRoute: "「自动」=按备用链路依次试；选中某一提供方=这类任务固定走它。",
  providerTaskModel: "给该提供方的某类任务指定模型名；留空则用提供方默认模型。",
  routingSection: "只管本机 Ollama 高低档模型；云端/按任务细调请回「任务编排」。",
  routingIntro: "只用一个模型时跟「运行模型」；打开多模型后，可把重活、轻活分到不同本机模型。",
  routingTaskModels: "按任务选模型已并到「任务编排」；这里旧项仅作兼容回退。",
  routingProviderTaskReadonly: "只读摘要，改法：回到「提供方 / 任务编排」页。",
} as const;
