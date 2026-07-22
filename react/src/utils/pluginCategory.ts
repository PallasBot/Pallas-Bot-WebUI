import type { OfficialExtensionRow, PluginRow } from "@pallas-vue/api/pallasTypes";

export type PluginCategory = "core" | "extra" | "local";

export function pluginCategory(plugin: PluginRow, official: OfficialExtensionRow[] = []): PluginCategory {
  const source = (plugin.plugin_source || "").trim();
  if (source === "core" || source === "main") return "core";

  const pluginId = plugin.name.trim();
  const isOfficial =
    source === "extra" ||
    official.some((item) => item.package === pluginId) ||
    official.some((item) => (item.plugin_ids || []).some((pid) => pid === pluginId));
  if (isOfficial) return "extra";

  return "local";
}

export const PLUGIN_LIST_CATEGORY_TABS: Array<{
  id: PluginCategory | "all";
  label: string;
}> = [
  { id: "all", label: "全部" },
  { id: "core", label: "内核" },
  { id: "extra", label: "拓展" },
  { id: "local", label: "本地" },
];
