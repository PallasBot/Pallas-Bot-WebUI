/** WebUI 配置字段展示：中文标题与枚举选项 */

import type { PluginConfigField } from "@/api/pallasTypes";
import { FALLBACK_ENUM_LABELS } from "@/config/configFieldLabels";

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

export function boolSwitchLabel(value: boolean, style: "onoff" | "yesno" = "onoff"): string {
  if (style === "yesno") return value ? "是" : "否";
  return value ? "开启" : "关闭";
}

export function isBinaryBoolEnum(field: PluginConfigField): boolean {
  if (field.kind !== "enum" || !field.choices?.length || field.choices.length !== 2) return false;
  const normalized = field.choices.map((c) => String(c).trim().toLowerCase());
  return normalized.some((c) => BOOL_TRUE_VALUES.has(c)) && normalized.some((c) => BOOL_FALSE_VALUES.has(c));
}

function isBoolTrueChoice(value: string): boolean {
  return BOOL_TRUE_VALUES.has(String(value).trim().toLowerCase());
}

export function binaryEnumOnChoice(field: PluginConfigField): string {
  const choices = field.choices ?? [];
  return choices.find((c) => isBoolTrueChoice(String(c))) ?? choices[0] ?? "true";
}

export function binaryEnumOffChoice(field: PluginConfigField): string {
  const choices = field.choices ?? [];
  return choices.find((c) => !isBoolTrueChoice(String(c))) ?? choices[1] ?? "false";
}

export function binaryEnumIsOn(field: PluginConfigField, value: string): boolean {
  const on = binaryEnumOnChoice(field);
  return String(value).trim() === String(on).trim();
}

export function binaryEnumSwitchLabel(field: PluginConfigField, value: string): string {
  return enumChoiceLabel(String(value).trim() || binaryEnumOffChoice(field), field);
}
