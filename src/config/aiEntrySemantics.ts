import { aiConfigSectionPath } from "@/config/aiConfigSections";

/** 配置 / 检测 / 运行态三类入口的统一说明与跳转目标 */
export const AI_ENTRY_RUNTIME = {
  label: "运行态观测",
  shortLead: "查看各 AI 能力是否健康、有无降级，以及媒体任务队列。",
  path: "/ai/home",
} as const;

export const AI_ENTRY_SITE_GATEWAY_CHECK = {
  label: "站点级网关检测",
  shortLead: "按通用配置中的服务网关地址，批量探测画画、点歌、MAA 等站点连通性。",
  path: "/common-config?section=service_gateways",
} as const;

export const AI_ENTRY_PLUGIN_CONFIG_CHECK = {
  label: "插件配置检测",
  shortLead: "按本页当前草稿配置，仅探测与该插件直接相关的网关或参数；不替代站点级检测或运行态总览。",
} as const;

export const AI_ENTRY_CONNECTION_DIAG = {
  label: "连接诊断",
  shortLead: "按当前填写的地址与 Token 探测 Pallas-Bot-AI 连通性；完整健康状态见运行态观测。",
  path: aiConfigSectionPath("connection"),
} as const;

export const AI_CONFIG_LAYER_LINKS = {
  runtime: { label: "运行模型", path: aiConfigSectionPath("runtime") },
  provider: { label: "上游 Provider", path: aiConfigSectionPath("provider") },
  routing: { label: "路由与分流", path: aiConfigSectionPath("routing") },
  strategy: { label: "Bot 对话策略", path: aiConfigSectionPath("strategy") },
} as const;
