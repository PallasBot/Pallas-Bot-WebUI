import type { PluginRow } from "@/api/pallasTypes";
import { officialExtensionTitleForMatcherKey } from "@/utils/officialExtensionMeta";

function pluginRowMatchesKey(row: PluginRow, key: string): boolean {
  if (!key) return false;
  if (row.name === key) return true;
  if ((row.resolved_plugin_id || "").trim() === key) return true;
  if ((row.resolved_module || "").trim() === key) return true;
  if ((row.module || "").trim() === key) return true;
  if ((row.nb_plugin_name || "").trim() === key) return true;
  return false;
}

/** 优先展示帮助里的中文名，其次官方扩展标题，否则内部名。 */
export function matcherPluginDisplayName(internalName: string, plugins: PluginRow[] | undefined | null): string {
  const key = (internalName || "").trim();
  if (!key) return internalName;

  if (plugins?.length) {
    const hit = plugins.find((p) => pluginRowMatchesKey(p, key));
    if (hit) {
      const zh = hit.metadata?.name?.trim();
      if (zh) return zh;
      const nb = (hit.nb_plugin_name || "").trim();
      if (nb && nb !== key) return nb;
      if (hit.name?.trim()) return hit.name.trim();
    }
  }

  const official = officialExtensionTitleForMatcherKey(key);
  if (official) return official;

  return key;
}
