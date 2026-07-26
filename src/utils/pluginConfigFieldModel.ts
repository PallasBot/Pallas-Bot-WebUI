/** 弹层定位（React 侧自包含） */

import type { PluginConfigField } from "@/api/console";
import { isBinaryBoolEnum } from "@/utils/configFieldDisplay";

export type ConfigFieldLayout = "compact" | "standard" | "tall";

export function resolveConfigFieldLayout(field: PluginConfigField): ConfigFieldLayout {
  if (field.kind === "bool") return "compact";
  if (field.kind === "enum" && isBinaryBoolEnum(field)) return "compact";
  if (field.kind === "json" && (isStringListField(field) || isIdListField(field))) return "compact";
  if (field.kind === "json") return "tall";
  if (field.kind === "string" && field.multiline) return "tall";
  return "standard";
}

/**
 * 字段在分组内的「类型聚类」序号：开关 → 下拉 → 数字 → 文本 → JSON。
 */
export function fieldTypeClusterRank(field: PluginConfigField): number {
  if (field.kind === "bool") return 0;
  if (field.kind === "enum") return isBinaryBoolEnum(field) ? 0 : 1;
  if (field.kind === "int" || field.kind === "float" || field.kind === "number") return 2;
  if (field.kind === "json") return 4;
  return 3;
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

function isNumericEnumChoices(choices: string[] | undefined): boolean {
  if (!choices?.length) return false;
  return choices.every((c) => /^-?\d+$/.test(String(c).trim()));
}

function fieldChoices(f: PluginConfigField): string[] | undefined {
  if (f.choices?.length) return f.choices;
  if (!f.options?.length) return undefined;
  return f.options.map((o) => (typeof o === "string" ? o : o.value));
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
  if (f.kind === "float" || f.kind === "number") {
    const t = text.trim();
    if (!t) return f.default ?? 0;
    const n = parseFloat(t);
    if (!Number.isFinite(n)) throw new Error(`${f.name}: 请输入数字`);
    return n;
  }
  if (f.kind === "enum") {
    const t = text.trim();
    if (!t) return f.default ?? "";
    const choices = fieldChoices(f);
    if (isNumericEnumChoices(choices)) {
      const n = parseInt(t, 10);
      if (!Number.isFinite(n)) throw new Error(`${f.name}: 请选择有效选项`);
      return n;
    }
    return t;
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
    try {
      out[f.name] = fieldModel(f);
    } catch {
      out[f.name] = f.kind === "bool" ? "false" : f.kind === "json" ? "null" : "";
    }
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

/** QQ / 群号等数字 ID 列表（插件 config 里常见 list[int]）。 */
export function isIdListField(field: PluginConfigField): boolean {
  if (field.kind !== "json") return false;
  const samples = [field.current, field.default];
  let sawArray = false;
  for (const sample of samples) {
    if (sample === null || sample === undefined) continue;
    if (!Array.isArray(sample)) return false;
    sawArray = true;
    if (sample.length === 0) continue;
    if (!sample.every((item) => typeof item === "number" && Number.isFinite(item))) return false;
  }
  return sawArray;
}

export function isChipListField(field: PluginConfigField): boolean {
  return isStringListField(field) || isIdListField(field);
}

export function tagsFromJsonText(raw: string): string[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((x) => (x == null ? "" : String(x))).filter(Boolean);
  } catch {
    return text
      .split(/[\n,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function tagsToJsonText(tags: string[]): string {
  return JSON.stringify(tags);
}

/** 数字 ID 芯片：展示为字符串，落盘为 number[] JSON。 */
export function idTagsFromJsonText(raw: string): string[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      const out: string[] = [];
      const seen = new Set<string>();
      for (const item of parsed) {
        const n = typeof item === "number" ? item : parseInt(String(item).trim(), 10);
        if (!Number.isFinite(n) || n < 1) continue;
        const key = String(Math.trunc(n));
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(key);
      }
      return out;
    }
  } catch {
    // fall through
  }
  return text
    .split(/[\n,，\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s) && Number(s) >= 1)
    .filter((s, i, arr) => arr.indexOf(s) === i);
}

export function idTagsToJsonText(tags: string[]): string {
  const nums: number[] = [];
  const seen = new Set<number>();
  for (const tag of tags) {
    const n = parseInt(String(tag).trim(), 10);
    if (!Number.isFinite(n) || n < 1 || seen.has(n)) continue;
    seen.add(n);
    nums.push(n);
  }
  return JSON.stringify(nums);
}
