import type { LlmProviderRow } from "@/api/console";

export type LlmProviderPresetId =
  | "openai"
  | "anthropic"
  | "gemini"
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
  /** 应用预设时写入的请求方式 */
  request_method?: "chat_completions" | "responses" | "anthropic_messages";
};

export const LLM_PROVIDER_PRESETS: readonly LlmProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai-compatible",
    base_url: "https://api.openai.com/v1",
    host_match: ["api.openai.com"],
    request_method: "chat_completions",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    kind: "openai-compatible",
    base_url: "https://api.anthropic.com",
    host_match: ["api.anthropic.com"],
    request_method: "anthropic_messages",
  },
  {
    id: "gemini",
    label: "Gemini",
    kind: "openai-compatible",
    // Google OpenAI 兼容端点：/v1beta/openai/chat/completions
    base_url: "https://generativelanguage.googleapis.com/v1beta/openai",
    host_match: ["generativelanguage.googleapis.com"],
    request_method: "chat_completions",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    kind: "openai-compatible",
    base_url: "https://api.deepseek.com/v1",
    host_match: ["api.deepseek.com"],
    request_method: "chat_completions",
  },
  {
    id: "dashscope",
    label: "通义 DashScope",
    kind: "openai-compatible",
    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    host_match: ["dashscope.aliyuncs.com"],
    request_method: "chat_completions",
  },
  {
    id: "siliconflow",
    label: "硅基流动",
    kind: "openai-compatible",
    base_url: "https://api.siliconflow.cn/v1",
    host_match: ["api.siliconflow.cn"],
    request_method: "chat_completions",
  },
  {
    id: "custom",
    label: "自定义（OpenAI 兼容）",
    kind: "openai-compatible",
    base_url: "",
    host_match: [],
    request_method: "chat_completions",
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
  // 自定义：清空预设 URL，避免仍匹配上一厂商导致「自定义」选不中
  if (preset.id === "custom") {
    return {
      ...base,
      kind: "remote",
      base_url: "",
      request_method: "chat_completions",
    };
  }
  return {
    ...base,
    // 空 ID 时用预设 id（如 siliconflow），便于未保存草稿直接探测
    id: String(base.id || "").trim() || preset.id,
    kind: preset.kind === "local" ? "local" : "remote",
    base_url: preset.base_url || base.base_url,
    request_method: preset.request_method || "chat_completions",
  };
}

export const LLM_PROVIDER_CAPABILITIES = [
  { id: "text", label: "文本" },
  { id: "image", label: "图像" },
  { id: "audio", label: "音频" },
  { id: "video", label: "视频" },
] as const;

export const LLM_PROVIDER_MODEL_EFFORTS = [
  { id: "", label: "默认" },
  { id: "enable", label: "开启思考" },
  { id: "disable", label: "关闭思考" },
  { id: "minimal", label: "最低" },
  { id: "low", label: "低" },
  { id: "medium", label: "中" },
  { id: "high", label: "高" },
  { id: "xhigh", label: "最高" },
] as const;

export const LLM_PROVIDER_REQUEST_METHODS = [
  { id: "chat_completions", label: "Chat Completions" },
  { id: "responses", label: "Responses" },
  { id: "anthropic_messages", label: "Anthropic Messages" },
] as const;

export const LLM_LOCAL_BASE_URL_SUGGESTIONS: readonly string[] = [
  "http://127.0.0.1:11434",
  "http://localhost:11434",
  "http://127.0.0.1:11435",
];

export const LLM_BASE_URL_SUGGESTIONS: readonly string[] = [
  ...LLM_PROVIDER_PRESETS.map((p) => p.base_url).filter(Boolean),
  "http://127.0.0.1:11434/v1",
  "http://127.0.0.1:8000/v1",
];

export function blankProvider(): LlmProviderRow {
  return {
    id: "",
    kind: "remote",
    base_url: "",
    api_key_env: "",
    api_key_set: false,
    api_keys_count: 0,
    default_model: "",
    enabled: true,
    task_models: {},
    capabilities: ["text"],
    model_effort: "",
    request_method: "chat_completions",
    model_pricing: {},
  };
}

export function baseUrlHasTrailingSlash(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.length > 1 && trimmed.endsWith("/");
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
