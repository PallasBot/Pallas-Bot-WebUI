import type { ConsoleNavIconId } from "@/config/consoleNavIcons";

export interface AiConfigSectionDef {
  id: string;
  label: string;
  lead: string;
  icon: ConsoleNavIconId;
}

/**
 * AI 配置一级分段（顶栏 Select）。
 * URL 仍用 id（如 dialogue），改展示文案不影响深链。
 */
export const AI_CONFIG_SECTIONS: AiConfigSectionDef[] = [
  {
    id: "provider",
    label: "接入",
    lead: "登记云端或本机 Ollama，并在任务编排里指定「谁负责哪种对话」。",
    icon: "server",
  },
  {
    id: "dialogue",
    label: "接话",
    lead: "群里怎么接话、记不记得上文、用不用记忆/工具，以及「搜一下」联网。",
    icon: "sparkles",
  },
  {
    id: "media",
    label: "媒体",
    lead: "唱歌、语音、画画、网易云等媒体能力（与文字聊天提供方分开）。",
    icon: "layers",
  },
  {
    id: "budget",
    label: "预算",
    lead: "各任务每日调用/输入上限与单次上下文预算，防止成本失控。",
    icon: "sliders",
  },
  ];

export type AiConfigSectionId = (typeof AI_CONFIG_SECTIONS)[number]["id"];

/** 旧分区 id → 现行分区（logs 不在此表，由配置页单独重定向到观测） */
const LEGACY_SECTION_ALIASES: Record<string, AiConfigSectionId> = {
  model: "provider",
  runtime: "provider",
  routing: "provider",
  strategy: "dialogue",
  knowledge: "dialogue",
  connection: "media",
  capabilities: "media",
  draw: "media",
  ncm: "media",
};

/** 旧分区 → 合并段内默认子面板（供深链） */
export const LEGACY_SECTION_DEFAULT_PANEL: Record<string, string> = {
  strategy: "form",
  knowledge: "arknights",
  connection: "service",
  capabilities: "assets",
  draw: "draw",
  ncm: "ncm",
};

/** @deprecated 侧栏已收口为 AI_SIDEBAR_NAV；保留供旧链接与迁移识别 */
export interface AiTopLevelNavDef {
  id: "home" | "config";
  label: string;
  lead: string;
  icon: ConsoleNavIconId;
  path: string;
}

/** @deprecated 侧栏已收口为 AI_SIDEBAR_NAV；保留供旧链接与迁移识别 */
export const AI_TOP_LEVEL_NAV: AiTopLevelNavDef[] = [
  {
    id: "home",
    label: "AI 观测",
    lead: "看用量、会话与日志；调参数请到 AI 配置。",
    icon: "dashboard",
    path: "/ai/statistics",
  },
  {
    id: "config",
    label: "AI 配置",
    lead: "接模型、调群聊策略、管媒体能力。",
    icon: "sparkles",
    path: "/ai/config/provider",
  },
];

const SECTION_BY_ID = new Map(AI_CONFIG_SECTIONS.map((s) => [s.id, s]));
const SECTION_IDS = new Set<string>(AI_CONFIG_SECTIONS.map((s) => s.id));

export const AI_CONFIG_SECTION_PATHS = AI_CONFIG_SECTIONS.map((s) => aiConfigSectionPath(s.id));
export const AI_TOP_LEVEL_PATHS = AI_TOP_LEVEL_NAV.map((s) => s.path);

/** AI 配置主入口（默认落在「接入」） */
export const AI_CONFIG_SIDEBAR_PATH = "/ai/config/provider";

export const AI_CONFIG_HUB_LEAD = "选择要配置的分段。";

/** 扩展日志已迁入 AI 观测 */
export const AI_CONFIG_LOGS_REDIRECT = "/ai/logs";

export function aiConfigSectionPath(id: AiConfigSectionId, panel?: string): string {
  const base = `/ai/config/${id}`;
  if (!panel) return base;
  return `${base}?panel=${encodeURIComponent(panel)}`;
}

export const AI_CONFIG_MAIN_NAV_ITEM =
  AI_TOP_LEVEL_NAV.find((item) => item.id === "config") ?? AI_TOP_LEVEL_NAV[AI_TOP_LEVEL_NAV.length - 1];

/** 兼容旧 ?tab= / ?section= 与非法值；旧的 runtime 分区已并入 AI 首页。 */
export function normalizeAiConfigSection(raw: unknown): AiConfigSectionId {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (SECTION_IDS.has(s)) return s as AiConfigSectionId;
  if (s && LEGACY_SECTION_ALIASES[s]) return LEGACY_SECTION_ALIASES[s];
  return "provider";
}

/** 从旧路径段解析合并后的默认子面板。 */
export function legacyAiConfigPanel(raw: unknown): string | undefined {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s ? LEGACY_SECTION_DEFAULT_PANEL[s] : undefined;
}

/** 旧运行态分区已并入 AI 观测 · 统计（媒体启停见 AI 配置 · 媒体服务）。 */
export const AI_CONFIG_LEGACY_RUNTIME_REDIRECT = "/ai/statistics";

/** 牛格观测已迁入 AI 历史 · 群维护工作区。 */
export const AI_PERSONA_OBSERVE_REDIRECT = "/ai/session";

export function aiConfigSectionMeta(id: AiConfigSectionId): AiConfigSectionDef {
  return SECTION_BY_ID.get(id) ?? AI_CONFIG_SECTIONS[0];
}

export function aiConfigSectionPathFromRoute(path: string): AiConfigSectionId | null {
  const m = (path || "").match(/^\/ai\/config\/([^/]+)\/?$/);
  if (!m) return null;
  return normalizeAiConfigSection(m[1]);
}
