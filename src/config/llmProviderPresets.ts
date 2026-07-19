import type { LlmProviderConfigRow } from "@/api/pallasTypes";

export type LlmProviderPresetId =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "dashscope"
  | "siliconflow"
  | "custom";

export interface LlmProviderPreset {
  id: LlmProviderPresetId;
  label: string;
  kind: "openai-compatible" | "local";
  base_url: string;
  default_model: string;
  auth_hint: string;
  /** Host substrings for findPresetByBaseUrl */
  host_match: string[];
}

export const LLM_PROVIDER_PRESETS: readonly LlmProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai-compatible",
    base_url: "https://api.openai.com/v1",
    default_model: "",
    auth_hint: "API Key（Bearer）",
    host_match: ["api.openai.com"],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    kind: "openai-compatible",
    base_url: "https://api.anthropic.com/v1",
    default_model: "",
    auth_hint: "若网关不兼容可改自定义 Base URL",
    host_match: ["api.anthropic.com"],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    kind: "openai-compatible",
    base_url: "https://api.deepseek.com/v1",
    default_model: "",
    auth_hint: "API Key",
    host_match: ["api.deepseek.com"],
  },
  {
    id: "dashscope",
    label: "通义 DashScope",
    kind: "openai-compatible",
    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    default_model: "",
    auth_hint: "DashScope API Key",
    host_match: ["dashscope.aliyuncs.com"],
  },
  {
    id: "siliconflow",
    label: "硅基流动",
    kind: "openai-compatible",
    base_url: "https://api.siliconflow.cn/v1",
    default_model: "",
    auth_hint: "API Key",
    host_match: ["api.siliconflow.cn"],
  },
  {
    id: "custom",
    label: "自定义（OpenAI 兼容）",
    kind: "openai-compatible",
    base_url: "",
    default_model: "",
    auth_hint: "任意 OpenAI 兼容网关",
    host_match: [],
  },
] as const;

export function applyPresetToDraft(
  presetId: LlmProviderPresetId,
  base: LlmProviderConfigRow,
): LlmProviderConfigRow {
  const preset =
    LLM_PROVIDER_PRESETS.find((p) => p.id === presetId) ??
    LLM_PROVIDER_PRESETS[LLM_PROVIDER_PRESETS.length - 1]!;
  return {
    ...base,
    kind: preset.kind,
    base_url: preset.base_url || base.base_url,
    // 云端不预填 gpt-4o-mini 等示例模型名，由用户刷新列表后自选
    default_model: base.default_model,
  };
}

export function findPresetByBaseUrl(url: string): LlmProviderPreset | undefined {
  const lower = (url || "").toLowerCase();
  return LLM_PROVIDER_PRESETS.find((p) => p.host_match.some((h) => lower.includes(h)));
}
