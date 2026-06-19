import type { ConsoleNavIconId } from "@/config/consoleNavIcons";

export interface AiConfigSectionDef {
  id: string;
  label: string;
  lead: string;
  icon: ConsoleNavIconId;
}

export interface AiTopLevelNavDef {
  id: "home" | "statistics" | "history" | "config";
  label: string;
  lead: string;
  icon: ConsoleNavIconId;
  path: string;
}

export const AI_CONFIG_SECTIONS: AiConfigSectionDef[] = [
  {
    id: "runtime",
    label: "运行态总览",
    lead: "一屏查看 LLM、画画、MAA、点歌与扩展连接是否正常。",
    icon: "activity",
  },
  {
    id: "model",
    label: "模型与对话",
    lead: "切换 Ollama 模型、配置 Provider 路由，并控制 Bot 的 LLM 开关。",
    icon: "sparkles",
  },
  {
    id: "persona",
    label: "牛格观测",
    lead: "按群号查看情感轴与分层人格的编译结果。",
    icon: "users",
  },
  {
    id: "knowledge",
    label: "方舟知识库",
    lead: "查询干员与敌人数据，管理接话语料入口。",
    icon: "database",
  },
  {
    id: "connection",
    label: "扩展连接",
    lead: "配置 Bot 访问 Pallas-Bot-AI 的地址、Token，并检查连通性。",
    icon: "radio",
  },
  {
    id: "ncm",
    label: "网易云",
    lead: "在扩展服务内登录网易云账号并查看状态。",
    icon: "globe",
  },
  {
    id: "logs",
    label: "扩展日志",
    lead: "查看扩展侧 uvicorn / celery 的日志片段。",
    icon: "logs",
  },
];

export type AiConfigSectionId = (typeof AI_CONFIG_SECTIONS)[number]["id"];

export const AI_TOP_LEVEL_NAV: AiTopLevelNavDef[] = [
  {
    id: "home",
    label: "AI 首页",
    lead: "运行总览、需要处理的降级项、LLM 调用走向与快速入口。",
    icon: "dashboard",
    path: "/ai/home",
  },
  {
    id: "statistics",
    label: "AI 统计",
    lead: "调用量、成功失败、回复路径，以及 Provider / 模型与 Token 消耗。",
    icon: "charts",
    path: "/ai/statistics",
  },
  {
    id: "history",
    label: "AI 历史",
    lead: "每日走势、最近会话与完整来回对话。",
    icon: "logs",
    path: "/ai/history",
  },
  {
    id: "config",
    label: "AI 配置",
    lead: "模型、连接、知识库、媒体任务与扩展能力的配置中心。",
    icon: "sparkles",
    path: "/ai/config/model",
  },
];

const SECTION_BY_ID = new Map(AI_CONFIG_SECTIONS.map((s) => [s.id, s]));
const SECTION_IDS = new Set<string>(AI_CONFIG_SECTIONS.map((s) => s.id));

export const AI_CONFIG_SECTION_PATHS = AI_CONFIG_SECTIONS.map((s) => aiConfigSectionPath(s.id));
export const AI_TOP_LEVEL_PATHS = AI_TOP_LEVEL_NAV.map((s) => s.path);

/** AI 配置主入口（配置页本身，不再承载首页） */
export const AI_CONFIG_SIDEBAR_PATH = "/ai/config/model";

export const AI_CONFIG_HUB_LEAD =
  "模型、牛格、知识库与扩展连接的统一配置入口，选择上方分区开始。";

export function aiConfigSectionPath(id: AiConfigSectionId): string {
  return `/ai/config/${id}`;
}

export const AI_CONFIG_MAIN_NAV_ITEM = AI_TOP_LEVEL_NAV[3];

/** 兼容旧 ?tab= / ?section= 与非法值 */
export function normalizeAiConfigSection(raw: unknown): AiConfigSectionId {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (SECTION_IDS.has(s)) return s as AiConfigSectionId;
  return "runtime";
}

export function aiConfigSectionMeta(id: AiConfigSectionId): AiConfigSectionDef {
  return SECTION_BY_ID.get(id) ?? AI_CONFIG_SECTIONS[0];
}

export function aiConfigSectionPathFromRoute(path: string): AiConfigSectionId | null {
  const m = (path || "").match(/^\/ai\/config\/([^/]+)\/?$/);
  if (!m) return null;
  return normalizeAiConfigSection(m[1]);
}
