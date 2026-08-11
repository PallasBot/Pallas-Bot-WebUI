import type { PluginRow, PluginSourceKind } from "@/api/pallasTypes";

export type PluginSourceBadgeVariant = "neutral" | "info" | "success" | "warn" | "outline";

export function pluginSourceLabel(source: PluginSourceKind | undefined): string {
  if (source === "core" || source === "bundled" || source === "main") return "内置插件";
  if (source === "extra") return "官方插件";
  if (source === "community") return "社区插件";
  if (source === "local") return "本地插件";
  return "PyPI 包";
}

export function pluginSourceBadgeVariant(source: PluginSourceKind | undefined): PluginSourceBadgeVariant {
  if (source === "core" || source === "bundled" || source === "main") return "neutral";
  if (source === "extra") return "info";
  if (source === "community") return "success";
  if (source === "local") return "warn";
  return "outline";
}

export function hasPluginSource(p: Pick<PluginRow, "plugin_source">): boolean {
  return Boolean(pluginSourceLabel(p.plugin_source));
}

export function pluginVersionLabel(p: Pick<PluginRow, "plugin_version">): string {
  const version = (p.plugin_version || "").trim();
  return version ? `v${version}` : "";
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
