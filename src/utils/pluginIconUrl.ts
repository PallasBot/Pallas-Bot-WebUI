import type { CommunityPluginRow, OfficialExtensionRow, PluginSourceKind } from "@/api/pallasTypes";
import brandAvatarHdUrl from "@/assets/brand-avatar-hd.png?url";

/** 文档站同款牛牛 mascot（1024 透明 PNG，经构建 hash 后挂载于 /pallas/assets/） */
export const PALLAS_MASCOT_ICON_URL = brandAvatarHdUrl;

/** 与 Bot `plugin_matrix.CORE_PLUGIN_NAMES` 对齐 */
const CORE_PLUGIN_IDS = new Set([
  "pb_core",
  "repeater",
  "help",
  "pb_webui",
  "request_handler",
  "blacklist",
  "drink",
  "greeting",
  "roulette",
  "take_name",
  "llm_chat",
  "pb_stats",
]);

export function isCorePluginId(pluginId: string): boolean {
  return CORE_PLUGIN_IDS.has((pluginId || "").trim());
}

export function isPallasBrandedPlugin(pluginId: string, pluginSource?: PluginSourceKind): boolean {
  if (pluginSource === "core") return true;
  return isCorePluginId(pluginId);
}

export function resolveOfficialExtensionIconUrl(
  _row: Pick<OfficialExtensionRow, "package" | "icon">,
): string {
  return PALLAS_MASCOT_ICON_URL;
}

export function resolveCommunityPluginIconUrl(
  row: Pick<CommunityPluginRow, "plugin_id" | "icon">,
): string {
  return (row.icon || "").trim();
}

/** 索引或资源变更后追加查询参数，避免 raw.githubusercontent.com / 浏览器长期缓存旧图 */
export function withPluginIconCacheBust(url: string, bustKey: string): string {
  const base = (url || "").trim();
  const key = (bustKey || "").trim();
  if (!base || !key) return base;
  try {
    const u = new URL(base);
    u.searchParams.set("pb_icon_v", key);
    return u.toString();
  } catch {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}pb_icon_v=${encodeURIComponent(key)}`;
  }
}

export function communityPluginIconBustKey(
  row: Pick<CommunityPluginRow, "plugin_id" | "icon">,
  indexUpdatedAt?: string | null,
): string {
  const parts = [(indexUpdatedAt || "").trim(), (row.plugin_id || "").trim(), (row.icon || "").trim()].filter(
    Boolean,
  );
  return parts.join("|");
}

export function resolveCommunityPluginIconUrlWithBust(
  row: Pick<CommunityPluginRow, "plugin_id" | "icon">,
  indexUpdatedAt?: string | null,
): string {
  const raw = resolveCommunityPluginIconUrl(row);
  if (!raw) return "";
  return withPluginIconCacheBust(raw, communityPluginIconBustKey(row, indexUpdatedAt));
}

export function buildPluginIconMap(
  official: OfficialExtensionRow[],
  community: CommunityPluginRow[] | null | undefined,
  options?: { indexUpdatedAt?: string | null },
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of official) {
    for (const pid of row.plugin_ids || []) {
      const id = (pid || "").trim();
      if (id) map[id] = PALLAS_MASCOT_ICON_URL;
    }
  }
  const indexUpdatedAt = options?.indexUpdatedAt;
  for (const row of community || []) {
    const id = (row.plugin_id || "").trim();
    const icon = resolveCommunityPluginIconUrlWithBust(row, indexUpdatedAt);
    if (id && icon) map[id] = icon;
  }
  return map;
}

export function resolvePluginIconForRow(
  pluginId: string,
  pluginSource: PluginSourceKind | undefined,
  iconMap: Record<string, string>,
): string {
  const id = (pluginId || "").trim();
  if (!id) return "";
  if (isPallasBrandedPlugin(id, pluginSource)) {
    return PALLAS_MASCOT_ICON_URL;
  }
  return (iconMap[id] || "").trim();
}
