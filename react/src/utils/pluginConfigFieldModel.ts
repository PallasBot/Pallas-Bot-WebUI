/** 对齐 Vue `src/utils/pluginConfigFieldModel.ts`（React 侧自包含） */

import type { PluginConfigField } from "@/api/console";
import { isBinaryBoolEnum } from "@/utils/configFieldDisplay";

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

export function tagsFromJsonText(raw: string): string[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((x) => (x == null ? "" : String(x)));
  } catch {
    return text
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function tagsToJsonText(tags: string[]): string {
  return JSON.stringify(tags);
}
