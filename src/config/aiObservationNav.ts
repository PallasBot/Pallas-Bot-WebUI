import type { ConsoleNavIconId } from "@/config/consoleNavIcons";

export interface AiObservationTabDef {
  id: "overview" | "statistics" | "history";
  label: string;
  lead: string;
  path: string;
  routeName: "ai-home" | "ai-statistics" | "ai-history";
}

export interface AiSidebarNavDef {
  id: "observe" | "config";
  label: string;
  lead: string;
  icon: ConsoleNavIconId;
  path: string;
}

/** 观测 Hub 页内 tab（console-view-toggle） */
export const AI_OBSERVATION_TABS: AiObservationTabDef[] = [
  {
    id: "overview",
    label: "总览",
    lead: "运行健康、需关注项与 Runtime 诊断一屏掌握。",
    path: "/ai/home",
    routeName: "ai-home",
  },
  {
    id: "statistics",
    label: "统计",
    lead: "调用量、成功率、Provider / 模型与 Token 消耗趋势。",
    path: "/ai/statistics",
    routeName: "ai-statistics",
  },
  {
    id: "history",
    label: "历史",
    lead: "会话回放、规则维护与学习闭环，无需另开统计页。",
    path: "/ai/history",
    routeName: "ai-history",
  },
];

/** 侧栏仅保留观测 + 配置两个入口 */
export const AI_SIDEBAR_NAV: AiSidebarNavDef[] = [
  {
    id: "observe",
    label: "AI 观测",
    lead: "运行总览、调用统计与会话历史。",
    icon: "dashboard",
    path: "/ai/home",
  },
  {
    id: "config",
    label: "AI 配置",
    lead: "运行模型、Provider、路由、Bot 策略与扩展能力。",
    icon: "sparkles",
    path: "/ai/config/runtime",
  },
];

export const AI_OBSERVATION_SIDEBAR_PATH = AI_SIDEBAR_NAV[0].path;
export const AI_OBSERVATION_PATHS = AI_OBSERVATION_TABS.map((tab) => tab.path);

/** 旧侧栏多入口路径（迁移时移除） */
export const AI_LEGACY_SIDEBAR_PATHS = [
  "/ai/runtime",
  "/ai/statistics",
  "/ai/history",
] as const;

export function aiObservationTabByRouteName(name: unknown): AiObservationTabDef | undefined {
  if (typeof name !== "string") return undefined;
  return AI_OBSERVATION_TABS.find((tab) => tab.routeName === name);
}
