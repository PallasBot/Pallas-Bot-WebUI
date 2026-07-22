export type AiConfigSectionId =
  | "provider"
  | "strategy"
  | "knowledge"
  | "connection"
  | "capabilities"
  | "draw"
  | "ncm"
  | "logs"
  | "kernel"
  | "behavior";

export type AiConfigSectionDef = {
  id: AiConfigSectionId;
  label: string;
  lead: string;
  groupId: "dialogue" | "observe" | "extension" | "advanced";
};

export const AI_CONFIG_SECTIONS: AiConfigSectionDef[] = [
  { id: "provider", label: "接入", lead: "Provider、本地路由与模型管理。", groupId: "dialogue" },
  { id: "strategy", label: "对话", lead: "Bot 接话策略与 LLM 通用项。", groupId: "dialogue" },
  { id: "kernel", label: "会话内核", lead: "决策轨迹、记忆与关系笔记。", groupId: "observe" },
  { id: "behavior", label: "行为调试", lead: "行为样本、复读反馈与运行时回放。", groupId: "observe" },
  { id: "knowledge", label: "知识库", lead: "方舟 KB 与语料源。", groupId: "observe" },
  { id: "connection", label: "媒体服务", lead: "扩展连接、安装与运行时。", groupId: "extension" },
  { id: "capabilities", label: "能力包", lead: "媒体资产、唱歌与 TTS。", groupId: "extension" },
  { id: "draw", label: "画画", lead: "draw 插件网关配置。", groupId: "extension" },
  { id: "ncm", label: "网易云", lead: "扩展内网易云登录。", groupId: "extension" },
  { id: "logs", label: "扩展日志", lead: "uvicorn / celery 日志。", groupId: "extension" },
];

const LEGACY_ALIASES: Record<string, AiConfigSectionId> = {
  model: "provider",
  runtime: "connection",
  routing: "provider",
};

export function normalizeAiConfigSection(raw: unknown): AiConfigSectionId {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (AI_CONFIG_SECTIONS.some((row) => row.id === s)) return s as AiConfigSectionId;
  if (s && LEGACY_ALIASES[s]) return LEGACY_ALIASES[s];
  return "provider";
}

export function aiConfigSectionPath(id: AiConfigSectionId): string {
  return `/ai/config/${id}`;
}
