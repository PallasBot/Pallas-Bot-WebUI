import type { ConsoleNavIconId } from "@/config/consoleNavIcons";

export interface AiObservationTabDef {
  id: "overview" | "statistics" | "history";
  label: string;
  lead: string;
  icon: ConsoleNavIconId;
  path: string;
  routeName: "ai-home" | "ai-statistics" | "ai-history";
}

export interface AiSidebarNavDef {
  id: "observe" | "wizard" | "config";
  label: string;
  lead: string;
  icon: ConsoleNavIconId;
  path: string;
}

/** AI 观测页内 tab（console-view-toggle） */
export const AI_OBSERVATION_TABS: AiObservationTabDef[] = [
  {
    id: "overview",
    label: "总览",
    lead: "运行健康、需关注项与运行诊断一屏掌握。",
    icon: "dashboard",
    path: "/ai/home",
    routeName: "ai-home",
  },
  {
    id: "statistics",
    label: "统计",
    lead: "调用量、成功率、上游 Provider 与 Token 消耗趋势。",
    icon: "charts",
    path: "/ai/statistics",
    routeName: "ai-statistics",
  },
  {
    id: "history",
    label: "历史",
    lead: "会话回放、规则维护与学习闭环，无需另开统计页。",
    icon: "logs",
    path: "/ai/history",
    routeName: "ai-history",
  },
];

/** 侧栏：观测 + 体检 + 配置 */
export const AI_SIDEBAR_NAV: AiSidebarNavDef[] = [
  {
    id: "observe",
    label: "AI 观测",
    lead: "运行总览、调用统计与会话历史。",
    icon: "dashboard",
    path: "/ai/home",
  },
  {
    id: "wizard",
    label: "AI 体检",
    lead: "连通性与开关联检，失败项一键跳转修复。",
    icon: "activity",
    path: "/ai/wizard",
  },
  {
    id: "config",
    label: "AI 配置",
    lead: "运行模型、Provider、路由、Bot 策略与扩展能力。",
    icon: "sparkles",
    path: "/ai/config/provider",
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
