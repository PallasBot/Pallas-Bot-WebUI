import type { PluginConfigField } from "@/api/pallasTypes";

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
