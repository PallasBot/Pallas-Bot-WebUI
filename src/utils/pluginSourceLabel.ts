import type { PluginRow, PluginSourceKind } from "@/api/pallasTypes";

export type PluginSourceBadgeVariant = "neutral" | "info" | "success" | "warn" | "outline";

export function pluginSourceLabel(source: PluginSourceKind | undefined): string {
  if (source === "core" || source === "bundled" || source === "main") return "内置插件";
  if (source === "official" || source === "extra") return "官方插件";
  if (source === "community") return "社区插件";
  if (source === "nonebot") return "NoneBot 插件";
  if (source === "local") return "本地插件";
  return "未知来源";
}

export function pluginSourceBadgeVariant(source: PluginSourceKind | undefined): PluginSourceBadgeVariant {
  if (source === "core" || source === "bundled" || source === "main") return "neutral";
  if (source === "official" || source === "extra") return "info";
  if (source === "community") return "success";
  if (source === "nonebot") return "outline";
  if (source === "local") return "warn";
  return "outline";
}

export function hasPluginSource(p: Pick<PluginRow, "plugin_source">): boolean {
  return Boolean(pluginSourceLabel(p.plugin_source));
}

export function pluginVersionLabel(p: Pick<PluginRow, "plugin_version">): string {
  return shortPluginVersionLabel(p.plugin_version || "");
}

export function shortPluginVersionLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[0-9a-f]{6,40}$/i.test(trimmed)) return trimmed.slice(0, 5);
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
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
