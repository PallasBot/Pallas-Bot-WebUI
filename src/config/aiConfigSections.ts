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
  id: "runtime" | "home" | "statistics" | "history" | "config";
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
    id: "persona",
    label: "牛格观测",
    lead: "按群号查看情感轴与分层人格的编译结果。",
    icon: "users",
    groupId: "observe",
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

export const AI_TOP_LEVEL_NAV: AiTopLevelNavDef[] = [
  {
    id: "runtime",
    label: "Runtime 总览",
    lead: "一屏查看 LLM / 绘图 / 点歌 health、队列、降级与熔断。",
    icon: "activity",
    path: "/ai/runtime",
  },
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
  "按对话链路、观测内容与扩展服务分层配置；左侧选择分区，明确你改的是哪一层。";

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

/** 旧 runtime 分区已移除，其内容并入 Runtime 总览 /ai/runtime。 */
export const AI_CONFIG_LEGACY_RUNTIME_REDIRECT = "/ai/runtime";

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
