import type { PluginConfigField } from "@/api/pallasTypes";

export interface PluginConfigGroupSummary {
  total: number;
  filled: number;
  required: number;
  requiredFilled: number;
}

export type PluginConfigTab = "runtime" | "perm" | "limit" | "config" | "readme";

export function fieldDisplayName(field: PluginConfigField): string {
  return (field.label || field.name).trim();
}

export function summarizeFieldValue(field: PluginConfigField, raw: string): string {
  const text = String(raw ?? "").trim();
  if (field.kind === "bool") {
    return text === "true" ? "开启" : "关闭";
  }
  if (!text) {
    if (field.kind === "json") return "未填写";
    return "空";
  }
  if (field.kind === "json") {
    return text.length > 48 ? `${text.slice(0, 48)}…` : text;
  }
  return text.length > 32 ? `${text.slice(0, 32)}…` : text;
}

export function fieldCompactMeta(field: PluginConfigField): string[] {
  const parts = [fieldTypeLabel(field)];
  if (field.required) parts.push("必填");
  if (field.kind === "json") parts.push("结构化");
  const range = fieldRangeLabel(field);
  if (range) parts.push(range);
  return parts;
}

/** int/float 字段的取值范围标签，如「范围 1–65535」；无界则返回空串。 */
export function fieldRangeLabel(field: PluginConfigField): string {
  if (field.kind !== "int" && field.kind !== "float") return "";
  const { min_value: lo, max_value: hi } = field;
  if (lo !== undefined && hi !== undefined) return `范围 ${lo}–${hi}`;
  if (lo !== undefined) return `≥ ${lo}`;
  if (hi !== undefined) return `≤ ${hi}`;
  return "";
}

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

export function buildGroupSummary(
  fields: PluginConfigField[],
  values: Record<string, string>,
): PluginConfigGroupSummary {
  let filled = 0;
  let required = 0;
  let requiredFilled = 0;
  for (const field of fields) {
    const text = String(values[field.name] ?? "").trim();
    const hasValue = text.length > 0;
    if (hasValue) filled += 1;
    if (field.required) {
      required += 1;
      if (hasValue) requiredFilled += 1;
    }
  }
  return {
    total: fields.length,
    filled,
    required,
    requiredFilled,
  };
}

export function resolveInitialPluginConfigTab(options: {
  hasPermConfig: boolean;
  hasLimitConfig: boolean;
  hasConfigFields: boolean;
}): PluginConfigTab {
  if (options.hasPermConfig) return "perm";
  if (options.hasLimitConfig) return "limit";
  if (options.hasConfigFields) return "config";
  return "runtime";
}
