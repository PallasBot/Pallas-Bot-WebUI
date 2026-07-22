/** 对齐 Vue `src/utils/configFieldDisplay.ts`（React 侧自包含，避免 tsc 跨仓 @/） */

import type { PluginConfigField } from "@/api/console";

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
};

export function fieldDisplayTitle(f: PluginConfigField): string {
  return (f.label || "").trim() || f.name;
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
