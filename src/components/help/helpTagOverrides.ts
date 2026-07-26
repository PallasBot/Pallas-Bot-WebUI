/** 与 packages/help/help_tags.py HELP_TAG_LABELS 对齐 */

export const HELP_TAG_OVERRIDES_FIELD = "help_tag_overrides";

export const HELP_TAG_PRESETS: { value: string; label: string }[] = [
  { value: "core", label: "内核" },
  { value: "chat", label: "聊天" },
  { value: "ai", label: "AI" },
  { value: "fun", label: "娱乐" },
  { value: "tool", label: "工具" },
  { value: "admin", label: "管理" },
  { value: "other", label: "其他" },
];

export const PRESET_TAG_VALUES = HELP_TAG_PRESETS.map((t) => t.value);

export const DEFAULT_HELP_TAG = "other";

export function helpTagLabel(tag: string): string {
  const key = String(tag || "")
    .trim()
    .toLowerCase();
  const hit = HELP_TAG_PRESETS.find((t) => t.value === key);
  if (hit) return hit.label;
  return key || DEFAULT_HELP_TAG;
}

export function parseHelpTagOverrides(raw: unknown): Record<string, string> {
  if (raw == null) return {};
  let data: unknown = raw;
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return {};
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      return {};
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    const name = String(k || "").trim();
    const tag = String(v ?? "")
      .trim()
      .toLowerCase();
    if (name && tag) out[name] = tag;
  }
  return out;
}

export function serializeHelpTagOverrides(map: Record<string, string>): string {
  const keys = Object.keys(map).sort((a, b) => a.localeCompare(b));
  const ordered: Record<string, string> = {};
  for (const k of keys) ordered[k] = map[k];
  return JSON.stringify(ordered);
}

export function overridesFromHelpConfigFields(
  fields: Array<{ name: string; current?: unknown }> | undefined,
): Record<string, string> {
  const field = (fields || []).find((f) => f.name === HELP_TAG_OVERRIDES_FIELD);
  return parseHelpTagOverrides(field?.current);
}

export function defaultHelpTagFromExtra(extra: Record<string, unknown> | null | undefined): string {
  if (!extra || typeof extra !== "object") return DEFAULT_HELP_TAG;
  const raw = extra.help_tag;
  const tag = String(raw ?? "")
    .trim()
    .toLowerCase();
  return tag || DEFAULT_HELP_TAG;
}
