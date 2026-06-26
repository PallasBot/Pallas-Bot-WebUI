import type { OfficialExtensionRow, PluginRow } from "@/api/pallasTypes";

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
