/** AI 观测页分段（工具条 Select，对齐协议连接 / AI 配置） */

export type AiObservationSectionId = "statistics" | "session" | "tasks" | "logs";

/** 顶栏 Bot / 群过滤；未声明则不显示对应输入。 */
export type AiObservationScopeNeeds = {
  bot?: boolean;
  group?: boolean;
};

export type AiObservationSectionMeta = {
  id: AiObservationSectionId;
  label: string;
  lead: string;
  path: string;
  scope?: AiObservationScopeNeeds;
};

export const AI_OBSERVATION_DEFAULT_PATH = "/ai/statistics";

export const AI_OBSERVATION_SECTIONS: readonly AiObservationSectionMeta[] = [
  {
    id: "statistics",
    label: "统计",
    lead: "用量、费用、检索与调用结果。",
    path: "/ai/statistics",
  },
  {
    id: "session",
    label: "会话",
    lead: "回看对话、标注对错，或试聊与清空上下文。",
    path: "/ai/session",
    scope: { bot: true, group: true },
  },
  {
    id: "tasks",
    label: "任务",
    lead: "提醒与异步任务，默认看未完成。",
    path: "/ai/tasks",
    scope: { bot: true, group: true },
  },
  {
    id: "logs",
    label: "日志",
    lead: "媒体等扩展服务的运行日志。",
    path: "/ai/logs",
  },
] as const;

export function aiObservationSectionPath(id: AiObservationSectionId): string {
  return AI_OBSERVATION_SECTIONS.find((s) => s.id === id)?.path ?? AI_OBSERVATION_DEFAULT_PATH;
}

export function aiObservationSectionFromPath(pathname: string): AiObservationSectionId | null {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/ai" || p === "/ai/home" || p.startsWith("/ai/home/")) return "statistics";
  if (p === "/ai/statistics" || p.startsWith("/ai/statistics/")) return "statistics";
  if (p === "/ai/session" || p.startsWith("/ai/session/")) return "session";
  if (p === "/ai/history" || p.startsWith("/ai/history/")) return "session";
  if (p === "/ai/tasks" || p.startsWith("/ai/tasks/")) return "tasks";
  if (p === "/ai/logs" || p.startsWith("/ai/logs/")) return "logs";
  return null;
}

export function aiObservationMeta(id: AiObservationSectionId): AiObservationSectionMeta {
  return AI_OBSERVATION_SECTIONS.find((s) => s.id === id) ?? AI_OBSERVATION_SECTIONS[0];
}
