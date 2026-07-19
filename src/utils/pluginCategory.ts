import type { OfficialExtensionRow, PluginRow } from "@/api/pallasTypes";
import type { ConsoleNavIconId } from "@/config/consoleNavIcons";

export type PluginCategory = "core" | "extra" | "local";

/**
 * 按插件来源归类：
 * - 内核(core)：core / main
 * - 拓展(extra)：仅官方插件（主仓扩展，或命中官方扩展库的包/插件 ID）
 * - 本地(local)：其余项（local、pip、未知、社区等）
 */
export function pluginCategory(
  plugin: Pick<
    PluginRow,
    "name" | "resolved_plugin_id" | "plugin_source" | "extra_package"
  >,
  official: OfficialExtensionRow[] = [],
): PluginCategory {
  const source = plugin.plugin_source;
  if (source === "core" || source === "main") return "core";

  const pluginId = (plugin.resolved_plugin_id || plugin.name).trim();
  const extraPackage = (plugin.extra_package || "").trim();
  const isOfficial =
    source === "extra" ||
    (extraPackage !== "" && official.some((item) => item.package === extraPackage)) ||
    official.some((item) => (item.plugin_ids || []).some((pid) => pid === pluginId || pid === plugin.name));
  if (isOfficial) return "extra";

  return "local";
}

export const PLUGIN_CATEGORY_LABELS: Record<PluginCategory, string> = {
  core: "内核",
  extra: "拓展",
  local: "本地",
};

export const PLUGIN_CATEGORY_ICONS: Record<PluginCategory, ConsoleNavIconId> = {
  core: "blocks",
  extra: "plugin",
  local: "terminal",
};

export const PLUGIN_LIST_CATEGORY_TABS: Array<{
  id: PluginCategory | "all";
  label: string;
  icon: ConsoleNavIconId;
}> = [
  { id: "all", label: "全部", icon: "list" },
  { id: "core", label: PLUGIN_CATEGORY_LABELS.core, icon: PLUGIN_CATEGORY_ICONS.core },
  { id: "extra", label: PLUGIN_CATEGORY_LABELS.extra, icon: PLUGIN_CATEGORY_ICONS.extra },
  { id: "local", label: PLUGIN_CATEGORY_LABELS.local, icon: PLUGIN_CATEGORY_ICONS.local },
];
