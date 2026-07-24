/** 弹层定位（React 侧自包含，避免 tsc 跨仓 @/） */

import type { PluginConfigField } from "@/api/console";
import { FALLBACK_FIELD_LABELS } from "@/config/configFieldLabels";

const FALLBACK_ENUM_LABELS: Record<string, string> = {
  auto: "自动",
  true: "开启",
  false: "关闭",
  keyword: "仅关键词（默认）",
  hybrid: "关键词 + 向量（推荐）",
  embedding: "纯向量",
  vector: "纯向量（同 embedding）",
  prefetch: "后台预取（推荐）",
  sync: "当场联网查询",
  "local,community": "先本机，再共享池",
  local: "只用本机",
  local_first: "本地优先",
  merge_counts: "合并使用次数",
  local_only: "仅使用本机语料",
  session: "本 worker 连接",
  fleet: "协议实例名册",
  connected: "全集群曾连 WS",
  off: "关闭 AI 接话",
  select: "命中语料时 AI 选句（推荐）",
  select_polish_lite: "选句为主，少数回复轻润色",
  select_fallback: "选句，语料缺失时现编",
  fallback: "仅语料缺失时 AI 现编",
  "": "自动推断（推荐）",
  legacy_repeater: "仅语料规则（legacy）",
  repeater_plus_decision: "语料 + 统一决策",
  full_conversation_kernel: "决策 + 生成 + 反馈全链路",
  "60": "1 分钟",
  "120": "2 分钟",
  "300": "5 分钟",
  "600": "10 分钟",
  "900": "15 分钟",
  "1800": "30 分钟",
  "3600": "1 小时",
};

export function fieldDisplayTitle(f: PluginConfigField): string {
  const fromApi = (f.label || "").trim();
  if (fromApi) return fromApi;
  return FALLBACK_FIELD_LABELS[f.name] || f.name;
}

export function fieldHasLocalizedTitle(f: PluginConfigField): boolean {
  return fieldDisplayTitle(f) !== f.name;
}

/** 弹层定位（插件配置帮助浮层） */
export function fieldTypeLabel(field: PluginConfigField): string {
  switch (field.kind) {
    case "bool":
      return "开关";
    case "enum":
      return "选项";
    case "int":
    case "float":
      return "数字";
    case "json":
      return "JSON";
    default:
      return "文本";
  }
}

/** 弹层定位 */
export function fieldHelpDefaultValue(field: PluginConfigField): string {
  const value = field.default;
  if (value == null || value === "") return "无";
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text.length > 96 ? `${text.slice(0, 96)}…` : text;
  } catch {
    return String(value);
  }
}

export function enumChoiceLabel(opt: string, field?: PluginConfigField): string {
  const key = String(opt).trim();
  if (field?.choice_labels?.[key]) return field.choice_labels[key];
  return FALLBACK_ENUM_LABELS[key] ?? key;
}

export function boolChoiceLabel(value: string): string {
  return value === "true" ? "开启" : "关闭";
}

const BOOL_TRUE_VALUES = new Set(["true", "1", "yes", "on", "enabled"]);
const BOOL_FALSE_VALUES = new Set(["false", "0", "no", "off", "disabled"]);

export function isBinaryBoolEnum(field: PluginConfigField): boolean {
  const choices = field.choices?.length
    ? field.choices
    : (field.options || []).map((o) => (typeof o === "string" ? o : o.value));
  if (field.kind !== "enum" || choices.length !== 2) return false;
  const normalized = choices.map((c) => String(c).trim().toLowerCase());
  return normalized.some((c) => BOOL_TRUE_VALUES.has(c)) && normalized.some((c) => BOOL_FALSE_VALUES.has(c));
}

function isBoolTrueChoice(value: string): boolean {
  return BOOL_TRUE_VALUES.has(String(value).trim().toLowerCase());
}

function fieldChoices(field: PluginConfigField): string[] {
  if (field.choices?.length) return field.choices;
  return (field.options || []).map((o) => (typeof o === "string" ? o : o.value));
}

export function binaryEnumOnChoice(field: PluginConfigField): string {
  const choices = fieldChoices(field);
  return choices.find((c) => isBoolTrueChoice(String(c))) ?? choices[0] ?? "true";
}

export function binaryEnumOffChoice(field: PluginConfigField): string {
  const choices = fieldChoices(field);
  return choices.find((c) => !isBoolTrueChoice(String(c))) ?? choices[1] ?? "false";
}

export function binaryEnumIsOn(field: PluginConfigField, value: string): boolean {
  const on = binaryEnumOnChoice(field);
  return String(value).trim() === String(on).trim();
}

export function binaryEnumSwitchLabel(field: PluginConfigField, value: string): string {
  return enumChoiceLabel(String(value).trim() || binaryEnumOffChoice(field), field);
}
