import type { LlmProviderRow } from "@/api/console";

export type LlmProviderPresetId =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "dashscope"
  | "siliconflow"
  | "custom";

export type LlmProviderPreset = {
  id: LlmProviderPresetId;
  label: string;
  kind: "openai-compatible" | "local";
  base_url: string;
  host_match: string[];
};

export const LLM_PROVIDER_PRESETS: readonly LlmProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai-compatible",
    base_url: "https://api.openai.com/v1",
    host_match: ["api.openai.com"],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    kind: "openai-compatible",
    base_url: "https://api.anthropic.com/v1",
    host_match: ["api.anthropic.com"],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    kind: "openai-compatible",
    base_url: "https://api.deepseek.com/v1",
    host_match: ["api.deepseek.com"],
  },
  {
    id: "dashscope",
    label: "通义 DashScope",
    kind: "openai-compatible",
    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    host_match: ["dashscope.aliyuncs.com"],
  },
  {
    id: "siliconflow",
    label: "硅基流动",
    kind: "openai-compatible",
    base_url: "https://api.siliconflow.cn/v1",
    host_match: ["api.siliconflow.cn"],
  },
  {
    id: "custom",
    label: "自定义（OpenAI 兼容）",
    kind: "openai-compatible",
    base_url: "",
    host_match: [],
  },
] as const;

export const LLM_TASK_ROUTE_LABELS: Record<string, string> = {
  llm_chat: "@ 对话",
  drunk: "醉聊",
  repeater_select: "接话选句",
  repeater_polish_lite: "接话轻润色",
  repeater_fallback: "接话兜底",
  repeater_polish: "接话完整润色",
  other: "其他",
};

export const DEFAULT_LLM_TASKS = [
  "llm_chat",
  "drunk",
  "repeater_select",
  "repeater_polish_lite",
  "repeater_polish",
  "repeater_fallback",
] as const;

export function llmTaskRouteLabel(task: string): string {
  return LLM_TASK_ROUTE_LABELS[task] ?? task;
}

export function findPresetByBaseUrl(url: string): LlmProviderPreset | undefined {
  const lower = (url || "").toLowerCase();
  return LLM_PROVIDER_PRESETS.find((p) => p.host_match.some((h) => lower.includes(h)));
}

export function applyPresetToDraft(
  presetId: LlmProviderPresetId,
  base: LlmProviderRow,
): LlmProviderRow {
  const preset =
    LLM_PROVIDER_PRESETS.find((p) => p.id === presetId) ??
    LLM_PROVIDER_PRESETS[LLM_PROVIDER_PRESETS.length - 1]!;
  return {
    ...base,
    kind: preset.kind === "local" ? "local" : "remote",
    base_url: preset.base_url || base.base_url,
  };
}

export function blankProvider(): LlmProviderRow {
  return {
    id: "",
    kind: "remote",
    base_url: "",
    api_key_env: "",
    api_key_set: false,
    default_model: "",
    enabled: true,
    task_models: {},
  };
}

export function pruneRoutingForProvider(
  routing: { chain_fallback: string[]; tasks: Record<string, string> },
  providerId: string,
) {
  const tasks: Record<string, string> = {};
  for (const [task, pid] of Object.entries(routing.tasks || {})) {
    if (pid !== providerId) tasks[task] = pid;
  }
  return {
    chain_fallback: (routing.chain_fallback || []).filter((id) => id !== providerId),
    tasks,
  };
}
