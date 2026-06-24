import type { PluginConfigField } from "@/api/pallasTypes";
import { isBinaryBoolEnum } from "@/utils/configFieldDisplay";

/** 配置字段在列表/grid 中的行型：紧凑开关、标准单行、高块（JSON/多行）。 */
export type ConfigFieldLayout = "compact" | "standard" | "tall";

export function resolveConfigFieldLayout(field: PluginConfigField): ConfigFieldLayout {
  if (field.kind === "bool") return "compact";
  if (field.kind === "enum" && isBinaryBoolEnum(field)) return "compact";
  if (field.kind === "json" && isStringListField(field)) return "compact";
  if (field.kind === "json") return "tall";
  if (field.kind === "string" && field.multiline) return "tall";
  return "standard";
}

export function fieldModel(f: PluginConfigField): string {
  const v = f.current;
  if (f.kind === "json") return JSON.stringify(v ?? null, null, 2);
  if (f.kind === "bool") {
    if (typeof v === "boolean") return v ? "true" : "false";
    const text = String(v ?? "").trim().toLowerCase();
    return text === "true" || text === "1" || text === "yes" || text === "on" ? "true" : "false";
  }
  return v === null || v === undefined ? "" : String(v);
}

export function parsePluginConfigField(f: PluginConfigField, raw: unknown): unknown {
  const text = String(raw ?? "");
  if (f.kind === "bool") return text === "true" || text === "1";
  if (f.kind === "int") {
    const t = text.trim();
    if (!t) return f.default ?? 0;
    const n = parseInt(t, 10);
    if (!Number.isFinite(n)) throw new Error(`${f.name}: 请输入整数`);
    return n;
  }
  if (f.kind === "float") {
    const t = text.trim();
    if (!t) return f.default ?? 0;
    const n = parseFloat(t);
    if (!Number.isFinite(n)) throw new Error(`${f.name}: 请输入数字`);
    return n;
  }
  if (f.kind === "json") {
    const t = text.trim();
    if (!t) {
      if (Array.isArray(f.default)) return [];
      if (f.default !== null && f.default !== undefined && typeof f.default === "object") {
        return f.default;
      }
      return Array.isArray(f.current) ? [] : (f.current ?? []);
    }
    return JSON.parse(text) as unknown;
  }
  return text;
}

export function fieldValuesFromConfig(fields: PluginConfigField[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    out[f.name] = fieldModel(f);
  }
  return out;
}

export function collectFieldValues(
  fields: PluginConfigField[],
  fieldValues: Record<string, string>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = fieldValues[f.name] ?? "";
    values[f.name] = parsePluginConfigField(f, raw);
  }
  return values;
}

/** 与 collectFieldValues 同一套解析规则，用于判断表单是否相对服务端有改动。 */
export function configValuesFingerprint(
  fields: PluginConfigField[],
  fieldValues: Record<string, string>,
): string {
  return JSON.stringify(collectFieldValues(fields, fieldValues));
}

export function savedConfigFingerprint(fields: PluginConfigField[]): string {
  return configValuesFingerprint(fields, fieldValuesFromConfig(fields));
}

/**
 * 判断一个 json 字段是否适合用「标签输入」编辑：
 * 其 default 与 current 若有值，必须是「字符串数组」（如群号列表、前缀列表）。
 * 空数组也视为标签场景；含对象/嵌套/数字数组的结构化 json 走 textarea。
 */
export function isStringListField(field: PluginConfigField): boolean {
  if (field.kind !== "json") return false;
  const samples = [field.current, field.default];
  let sawArray = false;
  for (const sample of samples) {
    if (sample === null || sample === undefined) continue;
    if (!Array.isArray(sample)) return false;
    sawArray = true;
    if (!sample.every((item) => typeof item === "string")) return false;
  }
  return sawArray;
}

/** 把 json 字段的字符串值（JSON 文本）解析为字符串数组；失败回退空数组。 */
export function tagsFromJsonText(raw: string): string[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((x) => (x == null ? "" : String(x)));
  } catch {
    // 非合法 JSON（如用户手输），按换行/逗号兜底切分
    return text
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** 把字符串数组序列化回 json 字段所需的 JSON 文本。 */
export function tagsToJsonText(tags: string[]): string {
  return JSON.stringify(tags);
}
