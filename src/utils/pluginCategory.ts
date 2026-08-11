import type { OfficialExtensionRow, PluginRow } from "@/api/pallasTypes";

export type PluginCategory = "core" | "official" | "community" | "nonebot" | "local";

export function pluginCategory(plugin: PluginRow, official: OfficialExtensionRow[] = []): PluginCategory {
  const source = (plugin.plugin_source || "").trim();
  if (source === "core" || source === "main") return "core";
  if (source === "community") return "community";
  if (source === "nonebot") return "nonebot";

  const pluginId = plugin.name.trim();
  const isOfficial =
    source === "official" ||
    source === "extra" ||
    official.some((item) => item.package === pluginId) ||
    official.some((item) => (item.plugin_ids || []).some((pid) => pid === pluginId));
  if (isOfficial) return "official";

  return "local";
}

export const PLUGIN_LIST_CATEGORY_TABS: Array<{
  id: PluginCategory | "all";
  label: string;
}> = [
  { id: "all", label: "全部" },
  { id: "core", label: "内核" },
  { id: "official", label: "官方" },
  { id: "community", label: "社区" },
  { id: "nonebot", label: "NoneBot" },
  { id: "local", label: "本地" },
];
