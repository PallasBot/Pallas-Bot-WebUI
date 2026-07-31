import type { PluginRow } from "@/api/pallasTypes";

const TECHNICAL_MODULE_PREFIXES = ["pallas_plugin_", "nonebot_plugin_"] as const;

export function isTechnicalPluginModuleName(name: string): boolean {
  const normalized = (name || "").trim().toLowerCase();
  if (!normalized) return false;
  return TECHNICAL_MODULE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function pluginResolvedId(plugin: PluginRow): string {
  return (plugin.resolved_plugin_id || plugin.name || "").trim();
}

export function pluginDisplayTitle(plugin: PluginRow): string {
  const metaName = (plugin.metadata?.name || "").trim();
  if (metaName) return metaName;
  return (plugin.nb_plugin_name || plugin.name || "").trim();
}

export function pluginDisplaySubtitle(plugin: PluginRow): string {
  const id = pluginResolvedId(plugin);
  const title = pluginDisplayTitle(plugin);
  if (!id || id === title) return "";

  /* pip 外部包：始终展示包名/模块 id，避免卡片标题下空一行 */
  if (plugin.plugin_source === "pip") {
    const pkg = (plugin.extra_package || "").trim();
    if (pkg && pkg !== title) return pkg;
    return id;
  }

  if (isTechnicalPluginModuleName(id)) return "";
  const nb = (plugin.nb_plugin_name || "").trim();
  if (nb && id === nb && isTechnicalPluginModuleName(nb)) return "";
  return id;
}

export function pluginDisplayDescription(plugin: PluginRow): string {
  const desc = (plugin.metadata?.description || "").trim();
  if (desc) return desc;
  return (plugin.module || "").trim();
}
