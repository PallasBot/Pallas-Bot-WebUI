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
  { id: "extension", label: "扩展服务" },
];

export const AI_CONFIG_SECTIONS: AiConfigSectionDef[] = [
  {
    id: "runtime",
    label: "运行模型",
    lead: "热切换本地 Ollama 模型与 GPU 层数；决定当前进程实际加载哪一套权重。",
    icon: "server",
    groupId: "dialogue",
  },
  {
    id: "provider",
    label: "上游 Provider",
    lead: "登记 OpenAI 兼容、本地 Ollama 等上游端点，并做连通性检测。",
    icon: "radio",
    groupId: "dialogue",
  },
  {
    id: "routing",
    label: "路由与分流",
    lead: "配置 task 路由、本地 MoE 与多模型分流策略；决定请求走哪条模型链路。",
    icon: "activity",
    groupId: "dialogue",
  },
  {
    id: "strategy",
    label: "Bot 对话策略",
    lead: "Bot 侧总开关、接话模式与限流；保存后热载，不直接改动上游模型。",
    icon: "sparkles",
    groupId: "dialogue",
  },
  {
    id: "knowledge",
    label: "方舟知识库",
    lead: "查询干员与敌人数据，管理接话语料入口。",
    icon: "database",
    groupId: "observe",
  },
  {
    id: "connection",
    label: "扩展连接",
    lead: "配置 Bot 访问 Pallas-Bot-AI 的地址、Token，并检查连通性。",
    icon: "radio",
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
    lead: "查看扩展侧 uvicorn / celery 的日志片段。",
    icon: "logs",
    groupId: "extension",
  },
];

export type AiConfigSectionId = (typeof AI_CONFIG_SECTIONS)[number]["id"];

/** 旧分区 id → 现行分区（信息架构收口后保留书签兼容） */
const LEGACY_SECTION_ALIASES: Record<string, AiConfigSectionId> = {
  model: "runtime",
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
    path: "/ai/config/runtime",
  },
];

const SECTION_BY_ID = new Map(AI_CONFIG_SECTIONS.map((s) => [s.id, s]));
const SECTION_IDS = new Set<string>(AI_CONFIG_SECTIONS.map((s) => s.id));
const GROUP_BY_ID = new Map(AI_CONFIG_NAV_GROUPS.map((g) => [g.id, g]));

export const AI_CONFIG_SECTION_PATHS = AI_CONFIG_SECTIONS.map((s) => aiConfigSectionPath(s.id));
export const AI_TOP_LEVEL_PATHS = AI_TOP_LEVEL_NAV.map((s) => s.path);

/** AI 配置主入口（默认落在「运行模型」） */
export const AI_CONFIG_SIDEBAR_PATH = "/ai/config/runtime";

export const AI_CONFIG_HUB_LEAD =
  "左侧选择要修改的分层；对话链路、观测内容与扩展服务互不混用，保存范围一目了然。";

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
  return "runtime";
}

/** 旧 runtime 分区与独立 Runtime 页已并入 AI 观测总览。 */
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
