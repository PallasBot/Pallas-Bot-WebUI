/** AI 观测页分段（工具条 Select，对齐协议连接 / AI 配置） */

export type AiObservationSectionId =
  | "statistics"
  | "session"
  | "memory"
  | "persona"
  | "logs";

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
    lead: "Token、画画、RAG 与任务成功情况。",
    path: "/ai/statistics",
  },
  {
    id: "session",
    label: "会话",
    lead: "查看对话、标注回复、试聊或清空上下文。",
    path: "/ai/session",
    scope: { bot: true, group: true },
  },
  {
    id: "memory",
    label: "记忆",
    lead: "群内长期记忆：图谱、条目与偏好。",
    path: "/ai/memory",
    scope: { bot: true, group: true },
  },
  {
    id: "persona",
    label: "牛格",
    lead: "牛格状态、群风格画像，以及发给模型的人设。",
    path: "/ai/persona",
    // 群风格画像必须群号；导出需 Bot。
    scope: { bot: true, group: true },
  },
  {
    id: "logs",
    label: "日志",
    lead: "媒体服务等扩展运行日志。",
    path: "/ai/logs",
  },
] as const;

export function aiObservationSectionPath(id: AiObservationSectionId): string {
  return AI_OBSERVATION_SECTIONS.find((s) => s.id === id)?.path ?? AI_OBSERVATION_DEFAULT_PATH;
}

export function aiObservationSectionFromPath(pathname: string): AiObservationSectionId | null {
  const p = pathname.replace(/\/$/, "") || "/";
  // 旧总览入口并入统计
  if (p === "/ai" || p === "/ai/home" || p.startsWith("/ai/home/")) return "statistics";
  if (p === "/ai/statistics" || p.startsWith("/ai/statistics/")) return "statistics";
  // 旧「历史」并入会话
  if (p === "/ai/session" || p.startsWith("/ai/session/")) return "session";
  if (p === "/ai/history" || p.startsWith("/ai/history/")) return "session";
  if (p === "/ai/memory" || p.startsWith("/ai/memory/")) return "memory";
  if (p === "/ai/persona" || p.startsWith("/ai/persona/")) return "persona";
  if (p === "/ai/logs" || p.startsWith("/ai/logs/")) return "logs";
  return null;
}

export function aiObservationMeta(id: AiObservationSectionId): AiObservationSectionMeta {
  return AI_OBSERVATION_SECTIONS.find((s) => s.id === id) ?? AI_OBSERVATION_SECTIONS[0];
}
