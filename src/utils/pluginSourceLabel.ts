import type { PluginRow, PluginSourceKind } from "@/api/pallasTypes";

export function pluginSourceLabel(source: PluginSourceKind | undefined): string {
  if (source === "local") return "站点 local";
  if (source === "pip") return "pip 包";
  if (source === "main") return "主仓";
  return "";
}

export function hasPluginSource(p: Pick<PluginRow, "plugin_source">): boolean {
  return Boolean(pluginSourceLabel(p.plugin_source));
}

export function pluginSourceDir(p: Pick<PluginRow, "plugin_source_dir">): string {
  return (p.plugin_source_dir || "").trim();
}

export function pluginSourceLine(p: Pick<PluginRow, "plugin_source" | "plugin_source_dir">): string {
  const label = pluginSourceLabel(p.plugin_source);
  if (!label) return "";
  const dir = pluginSourceDir(p);
  if (dir) return `来源：${label}\n${dir}`;
  return `来源：${label}`;
}

export function pluginSourceTitle(p: Pick<PluginRow, "plugin_source" | "plugin_source_dir">): string {
  return pluginSourceLine(p) || "";
}
