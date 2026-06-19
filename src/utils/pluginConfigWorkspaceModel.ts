import type { PluginConfigField } from "@/api/pallasTypes";

export interface PluginConfigGroupSummary {
  total: number;
  filled: number;
  required: number;
  requiredFilled: number;
}

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
