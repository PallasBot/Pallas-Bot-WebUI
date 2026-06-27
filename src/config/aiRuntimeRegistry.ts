import type { ConsoleNavIconId } from "@/config/consoleNavIcons";
import {
  AI_PERSONA_OBSERVE_REDIRECT,
  aiConfigSectionPath,
  type AiConfigSectionId,
} from "@/config/aiConfigSections";

export type AiRuntimeState = "healthy" | "degraded" | "disabled" | "unknown";
export type AiRuntimeGroupId = "extension" | "dialogue" | "media" | "automation";
export type AiRuntimeCapabilityId =
  | "ai_extension.runtime"
  | "llm.chat"
  | "image.generate"
  | "media.sing"
  | "automation.maa";
export type AiRuntimeSourceKind = "service_gateway" | "ai_extension_test";

export interface AiRuntimeStatusCopy {
  title: string;
  short: string;
}

export interface AiRuntimeGroupDef {
  id: AiRuntimeGroupId;
  title: string;
  description: string;
  icon: ConsoleNavIconId;
  section: AiConfigSectionId;
}

export interface AiRuntimeCapabilityDef {
  id: AiRuntimeCapabilityId;
  title: string;
  description: string;
  groupId: AiRuntimeGroupId;
  icon: ConsoleNavIconId;
  section: AiConfigSectionId;
  aliases: string[];
  sourceKinds: AiRuntimeSourceKind[];
  statusCopy: Record<AiRuntimeState, AiRuntimeStatusCopy>;
  defaultActions?: Array<{
    idSuffix: string;
    label: string;
    section?: AiConfigSectionId;
    path?: string;
    priority?: number;
    surfaces?: Array<"page" | "card" | "quick">;
  }>;
}

export interface AiRuntimeActionDef {
  id: string;
  kind: "navigate";
  label: string;
  section: AiConfigSectionId;
  to: string;
  priority: number;
  surfaces: Array<"page" | "card" | "quick">;
}

const DEFAULT_STATUS_COPY: Record<AiRuntimeState, AiRuntimeStatusCopy> = {
  healthy: { title: "运行正常", short: "正常" },
  degraded: { title: "运行降级", short: "降级" },
  disabled: { title: "未启用", short: "未启用" },
  unknown: { title: "状态待确认", short: "待确认" },
};

export const AI_RUNTIME_GROUPS: AiRuntimeGroupDef[] = [
  {
    id: "extension",
    title: "AI 扩展",
    description: "Pallas-Bot-AI 本体、连接探活与扩展入口。",
    icon: "radio",
    section: "connection",
  },
  {
    id: "dialogue",
    title: "对话能力",
    description: "LLM Provider、模型路由与聊天主链路。",
    icon: "sparkles",
    section: "runtime",
  },
  {
    id: "media",
    title: "媒体能力",
    description: "画画、点歌等内容生成与媒体调用。",
    icon: "globe",
    section: "ncm",
  },
  {
    id: "automation",
    title: "自动化能力",
    description: "MAA 等自动执行能力与任务型链路。",
    icon: "activity",
    section: "connection",
  },
];

export const AI_RUNTIME_CAPABILITIES: AiRuntimeCapabilityDef[] = [
  {
    id: "ai_extension.runtime",
    title: "AI 扩展运行时",
    description: "Pallas-Bot-AI 的对外连接、健康检查与运行入口。",
    groupId: "extension",
    icon: "radio",
    section: "connection",
    aliases: ["ai扩展", "ai extension", "extension", "扩展", "health"],
    sourceKinds: ["ai_extension_test"],
    statusCopy: {
      ...DEFAULT_STATUS_COPY,
      degraded: { title: "扩展连接异常", short: "异常" },
    },
    defaultActions: [
      { idSuffix: "open-connection", label: "去连接页", section: "connection", priority: 100, surfaces: ["page", "card", "quick"] },
      { idSuffix: "open-logs", label: "查看扩展日志", section: "logs", priority: 95, surfaces: ["page", "card", "quick"] },
    ],
  },
  {
    id: "llm.chat",
    title: "对话运行时",
    description: "聊天主链路、Provider 路由与 LLM 能力。",
    groupId: "dialogue",
    icon: "sparkles",
    section: "runtime",
    aliases: ["llm", "chat", "对话", "模型"],
    sourceKinds: ["service_gateway"],
    statusCopy: DEFAULT_STATUS_COPY,
    defaultActions: [
      { idSuffix: "open-runtime", label: "去运行模型", section: "runtime", priority: 94, surfaces: ["page", "card", "quick"] },
      { idSuffix: "open-provider", label: "去 Provider", section: "provider", priority: 90, surfaces: ["card", "quick"] },
      { idSuffix: "open-routing", label: "去路由配置", section: "routing", priority: 88, surfaces: ["quick"] },
      { idSuffix: "open-persona", label: "查看牛格观测", path: AI_PERSONA_OBSERVE_REDIRECT, priority: 78, surfaces: ["quick"] },
    ],
  },
  {
    id: "image.generate",
    title: "绘图运行时",
    description: "Draw 能力与图像生成链路。",
    groupId: "media",
    icon: "palette",
    section: "connection",
    aliases: ["draw", "image", "paint", "画", "绘图", "图像"],
    sourceKinds: ["service_gateway"],
    statusCopy: DEFAULT_STATUS_COPY,
    defaultActions: [
      { idSuffix: "open-connection", label: "查看扩展连接", section: "connection", priority: 40, surfaces: ["card"] },
      { idSuffix: "open-ncm", label: "查看媒体侧页", section: "ncm", priority: 68, surfaces: ["quick"] },
    ],
  },
  {
    id: "media.sing",
    title: "点歌运行时",
    description: "点歌、播放与媒体消费链路。",
    groupId: "media",
    icon: "globe",
    section: "ncm",
    aliases: ["sing", "music", "song", "点歌", "音乐"],
    sourceKinds: ["service_gateway"],
    statusCopy: DEFAULT_STATUS_COPY,
    defaultActions: [
      { idSuffix: "open-ncm", label: "去网易云页", section: "ncm", priority: 82, surfaces: ["page", "card", "quick"] },
      { idSuffix: "open-connection", label: "查看扩展连接", section: "connection", priority: 36, surfaces: ["card"] },
    ],
  },
  {
    id: "automation.maa",
    title: "自动化运行时",
    description: "MAA 与任务型自动执行能力。",
    groupId: "automation",
    icon: "activity",
    section: "connection",
    aliases: ["maa", "automation", "auto", "自动", "任务"],
    sourceKinds: ["service_gateway"],
    statusCopy: DEFAULT_STATUS_COPY,
    defaultActions: [
      { idSuffix: "open-connection", label: "查看扩展连接", section: "connection", priority: 45, surfaces: ["card"] },
      { idSuffix: "open-connection", label: "查看扩展连接", section: "connection", priority: 74, surfaces: ["quick"] },
    ],
  },
];

const GROUP_BY_ID = new Map(AI_RUNTIME_GROUPS.map((item) => [item.id, item]));
const CAPABILITY_BY_ID = new Map(AI_RUNTIME_CAPABILITIES.map((item) => [item.id, item]));

export function aiRuntimeCapabilityIdFromKey(key: string): AiRuntimeCapabilityId | null {
  const normalized = key.trim();
  if (!normalized) return null;
  return CAPABILITY_BY_ID.has(normalized as AiRuntimeCapabilityId)
    ? (normalized as AiRuntimeCapabilityId)
    : null;
}

export function aiRuntimeGroupMeta(id: AiRuntimeGroupId): AiRuntimeGroupDef {
  return GROUP_BY_ID.get(id) ?? AI_RUNTIME_GROUPS[0];
}

export function aiRuntimeCapabilityMeta(id: AiRuntimeCapabilityId): AiRuntimeCapabilityDef {
  return CAPABILITY_BY_ID.get(id) ?? AI_RUNTIME_CAPABILITIES[0];
}

export function aiRuntimeStateLabel(
  capabilityId: AiRuntimeCapabilityId,
  state: AiRuntimeState,
): string {
  return aiRuntimeCapabilityMeta(capabilityId).statusCopy[state].short;
}

export function aiRuntimeStateTitle(
  capabilityId: AiRuntimeCapabilityId,
  state: AiRuntimeState,
): string {
  return aiRuntimeCapabilityMeta(capabilityId).statusCopy[state].title;
}

export function aiRuntimeDefaultActions(capabilityId: AiRuntimeCapabilityId): AiRuntimeActionDef[] {
  const meta = aiRuntimeCapabilityMeta(capabilityId);
  const actions = meta.defaultActions?.length
    ? meta.defaultActions
    : [{
        idSuffix: "open-section",
        label: `去看${meta.title.replace(/运行时$/, "")}`,
        section: meta.section,
        priority: 60,
        surfaces: ["page", "card", "quick"],
      }];
  return actions.map((action) => {
    const section = action.section ?? meta.section;
    const path = "path" in action ? action.path : undefined;
    return {
      id: `${capabilityId}:${action.idSuffix}`,
      kind: "navigate" as const,
      label: action.label,
      section,
      to: path ?? aiConfigSectionPath(section),
      priority: action.priority ?? 50,
      surfaces: (action.surfaces ?? ["page", "card", "quick"]) as Array<"page" | "card" | "quick">,
    };
  });
}
