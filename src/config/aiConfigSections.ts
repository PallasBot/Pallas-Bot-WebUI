import type { ConsoleNavIconId } from "@/config/consoleNavIcons";

export interface AiConfigSectionDef {
  id: string;
  label: string;
  lead: string;
  icon: ConsoleNavIconId;
}

export const AI_CONFIG_SECTIONS: AiConfigSectionDef[] = [
  {
    id: "runtime",
    label: "运行态总览",
    lead: "统一查看 LLM、画画、MAA、点歌与扩展连接的健康状态。",
    icon: "activity",
  },
  {
    id: "model",
    label: "模型与对话",
    lead: "Ollama 热切换、Provider 路由与 Bot 侧 LLM 开关。",
    icon: "sparkles",
  },
  {
    id: "persona",
    label: "牛格观测",
    lead: "按群号查看情感轴与分层人格编译结果。",
    icon: "users",
  },
  {
    id: "knowledge",
    label: "方舟知识库",
    lead: "干员/敌人结构化查询与接话语料入口。",
    icon: "database",
  },
  {
    id: "connection",
    label: "扩展连接",
    lead: "Bot 访问 Pallas-Bot-AI 的地址、Token 与健康检查。",
    icon: "radio",
  },
  {
    id: "ncm",
    label: "网易云",
    lead: "扩展服务内的 NCM 账号登录与状态。",
    icon: "globe",
  },
  {
    id: "logs",
    label: "扩展日志",
    lead: "读取扩展侧 uvicorn / celery 日志片段。",
    icon: "logs",
  },
];

export type AiConfigSectionId = (typeof AI_CONFIG_SECTIONS)[number]["id"];

const SECTION_BY_ID = new Map(AI_CONFIG_SECTIONS.map((s) => [s.id, s]));
const SECTION_IDS = new Set<string>(AI_CONFIG_SECTIONS.map((s) => s.id));

export const AI_CONFIG_SECTION_PATHS = AI_CONFIG_SECTIONS.map((s) => aiConfigSectionPath(s.id));

/** 侧栏唯一入口（子页由 Hub 内 Tab + `/ai/:section` 路由承载） */
export const AI_CONFIG_SIDEBAR_PATH = "/ai";

export const AI_CONFIG_HUB_LEAD =
  "运行态、模型、牛格、知识库与扩展连接的统一入口。";

export function aiConfigSectionPath(id: AiConfigSectionId): string {
  return `/ai/${id}`;
}

export const AI_CONFIG_MAIN_NAV_ITEM = {
  to: AI_CONFIG_SIDEBAR_PATH,
  label: "AI配置",
  icon: "sparkles" as ConsoleNavIconId,
  description: AI_CONFIG_HUB_LEAD,
  section: "模块与配置",
};

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
  const m = (path || "").match(/^\/ai\/([^/]+)\/?$/);
  if (!m) return null;
  return normalizeAiConfigSection(m[1]);
}
