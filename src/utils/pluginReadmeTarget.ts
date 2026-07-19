import type { CommunityPluginRow, OfficialExtensionRow, PluginRow } from "@/api/pallasTypes";

export interface PluginReadmeTarget {
  kind: "official" | "community";
  id: string;
  repositoryUrl: string | null;
}

export function resolvePluginReadmeTarget(
  plugin: PluginRow,
  official: OfficialExtensionRow[],
  community: CommunityPluginRow[],
): PluginReadmeTarget {
  const pluginId = (plugin.resolved_plugin_id || plugin.name).trim();
  const extraPackage = (plugin.extra_package || "").trim();
  const sourceDir = (plugin.plugin_source_dir || "").trim().replace(/\/+$/, "");
  const dirName = sourceDir.split("/").pop() || "";

  const communityRow =
    community.find((row) => row.plugin_id === pluginId) ||
    community.find((row) => row.plugin_id === plugin.name) ||
    (dirName ? community.find((row) => row.plugin_id === dirName) : undefined);

  if (communityRow || plugin.plugin_source === "local") {
    const id = communityRow?.plugin_id || pluginId;
    return {
      kind: "community",
      id,
      repositoryUrl: communityRow?.repository_url || null,
    };
  }

  if (extraPackage) {
    const row = official.find((item) => item.package === extraPackage);
    return {
      kind: "official",
      id: extraPackage,
      repositoryUrl: row?.repository_url || null,
    };
  }

  const officialByPlugin = official.find((item) =>
    (item.plugin_ids || []).some((pid) => pid === pluginId || pid === plugin.name),
  );
  if (officialByPlugin) {
    return {
      kind: "official",
      id: officialByPlugin.package,
      repositoryUrl: officialByPlugin.repository_url || null,
    };
  }

  return {
    kind: "official",
    id: pluginId,
    repositoryUrl: null,
  };
}
