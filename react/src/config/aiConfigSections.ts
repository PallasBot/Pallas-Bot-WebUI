import type { ConsoleNavIconId } from "@/config/consoleNavIcons";

export interface AiConfigNavGroupDef {
  id: string;
  label: string;
}

export interface AiConfigSectionDef {
  id: string;
  label: string;
  lead: string;
  icon: ConsoleNavIconId;
  groupId: string;
}

export interface AiConfigMoreNavItemDef {
  id: "more";
  label: string;
  lead: string;
  icon: ConsoleNavIconId;
  targetSectionId: AiConfigSectionId;
}

export interface AiTopLevelNavDef {
  id: "home" | "config";
  label: string;
  lead: string;
  icon: ConsoleNavIconId;
  path: string;
}

export const AI_CONFIG_NAV_GROUPS: AiConfigNavGroupDef[] = [
  { id: "dialogue", label: "对话链路" },
  { id: "observe", label: "观测与内容" },
  { id: "extension", label: "媒体与扩展" },
];

export const AI_CONFIG_SECTIONS: AiConfigSectionDef[] = [
  {
    id: "provider",
    label: "接入",
    lead: "连接模型服务，选择云端或本地模型。",
    icon: "server",
    groupId: "dialogue",
  },
  {
    id: "strategy",
    label: "对话",
    lead: "设置 Bot 如何接话、限流与热载开关。",
    icon: "sparkles",
    groupId: "dialogue",
  },
  {
    id: "knowledge",
    label: "知识库",
    lead: "查询方舟数据，管理接话语料入口。",
    icon: "database",
    groupId: "observe",
  },
  {
    id: "connection",
    label: "媒体服务",
    lead: "唱歌/TTS 等媒体任务；仅当 LLM 运行时选 AI 服务时才影响聊天。",
    icon: "radio",
    groupId: "extension",
  },
  {
    id: "capabilities",
    label: "能力包",
    lead: "对话用 LLM；唱歌/TTS 权重；遗留 RWKV 仅兼容。",
    icon: "layers",
    groupId: "extension",
  },
  {
    id: "draw",
    label: "画画",
    lead: "画画服务网关与连通性（与插件 draw 同一配置）。",
    icon: "palette",
    groupId: "extension",
  },
  {
    id: "ncm",
    label: "网易云",
    lead: "在扩展服务内登录网易云账号并查看状态。",
    icon: "globe",
    groupId: "extension",
  },
  {
    id: "logs",
    label: "扩展日志",
    lead: "拉取扩展侧日志；日常实时查看请用 AI 观测 · 服务日志。",
    icon: "logs",
    groupId: "extension",
  },
];

export type AiConfigSectionId = (typeof AI_CONFIG_SECTIONS)[number]["id"];

export const SIMPLE_AI_CONFIG_NAV_SECTION_IDS: AiConfigSectionId[] = [
  "provider",
  "strategy",
  "capabilities",
  "knowledge",
];

export const AI_CONFIG_MORE_NAV_ITEM: AiConfigMoreNavItemDef = {
  id: "more",
  label: "更多",
  lead: "媒体服务、画画、网易云与扩展日志",
  icon: "blocks",
  targetSectionId: "connection",
};

/** 旧分区 id → 现行分区 */
const LEGACY_SECTION_ALIASES: Record<string, AiConfigSectionId> = {
  model: "provider",
  runtime: "provider",
  routing: "provider",
};

/** @deprecated 侧栏已收口为 AI_SIDEBAR_NAV；保留供旧链接与迁移识别 */
export const AI_TOP_LEVEL_NAV: AiTopLevelNavDef[] = [
  {
    id: "home",
    label: "AI 观测",
    lead: "运行总览、调用统计与会话历史。",
    icon: "dashboard",
    path: "/ai/home",
  },
  {
    id: "config",
    label: "AI 配置",
    lead: "运行模型、Provider、路由、Bot 策略与扩展能力的分层配置中心。",
    icon: "sparkles",
    path: "/ai/config/provider",
  },
];

const SECTION_BY_ID = new Map(AI_CONFIG_SECTIONS.map((s) => [s.id, s]));
const SECTION_IDS = new Set<string>(AI_CONFIG_SECTIONS.map((s) => s.id));
const GROUP_BY_ID = new Map(AI_CONFIG_NAV_GROUPS.map((g) => [g.id, g]));

export const AI_CONFIG_SECTION_PATHS = AI_CONFIG_SECTIONS.map((s) => aiConfigSectionPath(s.id));
export const AI_TOP_LEVEL_PATHS = AI_TOP_LEVEL_NAV.map((s) => s.path);

/** AI 配置主入口（默认落在「模型与 Provider」） */
export const AI_CONFIG_SIDEBAR_PATH = "/ai/config/provider";

export const AI_CONFIG_HUB_LEAD =
  "左侧切换配置分区；不确定可从「诊断」或体检向导开始，高级项可稍后再动。";

export function aiConfigSectionPath(id: AiConfigSectionId): string {
  return `/ai/config/${id}`;
}

export const AI_CONFIG_MAIN_NAV_ITEM =
  AI_TOP_LEVEL_NAV.find((item) => item.id === "config") ?? AI_TOP_LEVEL_NAV[AI_TOP_LEVEL_NAV.length - 1];

export function aiConfigNavGroupMeta(groupId: string): AiConfigNavGroupDef {
  return GROUP_BY_ID.get(groupId) ?? AI_CONFIG_NAV_GROUPS[0];
}

/** 兼容旧 ?tab= / ?section= 与非法值；旧的 runtime 分区已并入 AI 首页。 */
export function normalizeAiConfigSection(raw: unknown): AiConfigSectionId {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (SECTION_IDS.has(s)) return s as AiConfigSectionId;
  if (s && LEGACY_SECTION_ALIASES[s]) return LEGACY_SECTION_ALIASES[s];
  return "provider";
}

/** 旧运行态分区已并入 AI 观测总览。 */
export const AI_CONFIG_LEGACY_RUNTIME_REDIRECT = "/ai/home?panel=runtime";

/** 牛格观测已迁入 AI 历史 · 群维护工作区。 */
export const AI_PERSONA_OBSERVE_REDIRECT = "/ai/history?workspace=maintain";

export function aiConfigSectionMeta(id: AiConfigSectionId): AiConfigSectionDef {
  return SECTION_BY_ID.get(id) ?? AI_CONFIG_SECTIONS[0];
}

export function aiConfigSectionPathFromRoute(path: string): AiConfigSectionId | null {
  const m = (path || "").match(/^\/ai\/config\/([^/]+)\/?$/);
  if (!m) return null;
  return normalizeAiConfigSection(m[1]);
}

export function aiConfigSectionsByGroup(): Array<{ group: AiConfigNavGroupDef; sections: AiConfigSectionDef[] }> {
  return AI_CONFIG_NAV_GROUPS.map((group) => ({
    group,
    sections: AI_CONFIG_SECTIONS.filter((section) => section.groupId === group.id),
  })).filter((row) => row.sections.length > 0);
}
