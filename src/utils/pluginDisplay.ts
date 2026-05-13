import type { PluginRow } from "@/api/pallasTypes";

export type PluginPickItem = { name: string; label: string };

function pluginDisplayLabel(p: PluginRow): string {
  const raw = p.metadata?.name;
  const zh = raw != null ? String(raw).trim() : "";
  return zh || p.name;
}

export function pluginPickListFromRows(rows: PluginRow[]): PluginPickItem[] {
  const seen = new Set<string>();
  const out: PluginPickItem[] = [];
  for (const p of rows) {
    if (!p.name || seen.has(p.name)) continue;
    seen.add(p.name);
    out.push({ name: p.name, label: pluginDisplayLabel(p) });
  }
  out.sort((a, b) => a.label.localeCompare(b.label, "zh-CN") || a.name.localeCompare(b.name));
  return out;
}

export function formatDisabledPluginIds(ids: string[] | undefined, rows: PluginRow[]): string {
  if (!ids?.length) return "—";
  const map = new Map(rows.map((p) => [p.name, pluginDisplayLabel(p)]));
  return ids.map((id) => map.get(id) ?? id).join("、");
}
