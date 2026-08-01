import type {
  CommunityPluginActionResult,
  CommunityPluginRow,
  OfficialExtensionInstallResult,
  OfficialExtensionRow,
  PluginRow,
} from "@/api/pallasTypes";
import {
  communityActivationDetailHint,
  extensionActionStateLabel,
  extensionActivationDetailHint,
  extensionResultAction,
  extensionResultNeedsRestart,
} from "@/config/extensionActivationSemantics";
import {
  resolveOfficialExtensionDescription,
  resolveOfficialExtensionTitle,
} from "@/utils/officialExtensionMeta";
import {
  communityPluginIconBustKey,
  resolveCommunityPluginIconUrlWithBust,
  resolveOfficialExtensionIconUrl,
  withPluginIconCacheBust,
} from "@/utils/pluginIconUrl";

export type StoreSection = "official" | "community" | "local";
export type StoreTab = "all" | "installed" | "available" | "updates";

export const COMMUNITY_INDEX_REPO_URL = "https://github.com/PallasBot/community-plugin-index";
export const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export function resolveCommunityIndexSourceDisplay(source: string): { label: string; href: string | null } | null {
  if (!source || source === "error") return null;
  const body = source.startsWith("url:")
    ? source.slice(4)
    : source.startsWith("file:")
      ? source.slice(5)
      : source;
  if (body.startsWith("http://") || body.startsWith("https://")) {
    if (body.includes("community-plugin-index")) {
      return { label: "社区插件索引", href: COMMUNITY_INDEX_REPO_URL };
    }
    try {
      const host = new URL(body).hostname;
      return { label: host || "远程索引", href: body };
    } catch {
      return { label: "远程索引", href: body };
    }
  }
  if (body.includes("data/pallas_config")) return { label: "本地覆盖索引", href: null };
  if (body.includes("community_plugin_index")) return { label: "内置索引", href: null };
  const name = body.split("/").pop() || body;
  return { label: name, href: null };
}

export function officialRowTitle(row: OfficialExtensionRow): string {
  return resolveOfficialExtensionTitle(row.package, row.display_name);
}

export function officialRowDescription(row: OfficialExtensionRow): string {
  return resolveOfficialExtensionDescription(row.package, row.description);
}

export function officialRowPluginId(row: OfficialExtensionRow): string {
  return (row.plugin_ids?.[0] || row.package || "").trim();
}

export function officialRowIconUrl(row: OfficialExtensionRow): string {
  return resolveOfficialExtensionIconUrl(row);
}

export function extensionInstalled(row: OfficialExtensionRow): boolean {
  return Boolean(
    row.installed || row.status === "installed" || row.pip_installed || row.status === "pip_installed",
  );
}

export function communityRowIconUrl(row: CommunityPluginRow, indexUpdatedAt: string): string {
  return resolveCommunityPluginIconUrlWithBust(row, indexUpdatedAt);
}

export function communityRowAvatarUrl(row: CommunityPluginRow, indexUpdatedAt: string): string | null {
  const fromApi = (row.avatar || "").trim();
  const bust = communityPluginIconBustKey(row, indexUpdatedAt);
  if (fromApi) return withPluginIconCacheBust(fromApi, bust);
  const author = (row.author || "").trim().replace(/^@/, "");
  if (author && !author.includes("/")) {
    return `https://avatars.githubusercontent.com/${encodeURIComponent(author)}?s=64`;
  }
  const repo = (row.repository_url || "").trim();
  const match = repo.match(/github\.com[/:]([^/]+)\//i);
  if (match?.[1]) {
    return `https://avatars.githubusercontent.com/${encodeURIComponent(match[1])}?s=64`;
  }
  return null;
}

export function communityInstalled(row: CommunityPluginRow): boolean {
  return Boolean(row.loaded || row.local_installed || row.status === "loaded" || row.status === "installed");
}

export function resultNeedsRestart(result: Parameters<typeof extensionResultNeedsRestart>[0]): boolean {
  return extensionResultNeedsRestart(result);
}

export function resultAction(result: Parameters<typeof extensionResultAction>[0]) {
  return extensionResultAction(result);
}

export function actionStateLabel(
  policy: Parameters<typeof extensionActionStateLabel>[0],
  result: Parameters<typeof extensionActionStateLabel>[1],
): string {
  return extensionActionStateLabel(policy, result);
}

export function updateLatestLabel(row: { can_update?: boolean; has_update?: boolean | null }): string {
  if (!row.can_update) return "最新";
  return row.has_update == null ? "待检查" : "最新";
}

export function officialUpdateEnabled(
  row: OfficialExtensionRow,
  result: OfficialExtensionInstallResult | null,
): boolean {
  if (resultAction(result) === "hot-reload" || resultNeedsRestart(result)) return false;
  return Boolean(row.can_update) && row.has_update === true;
}

export function communityUpdateEnabled(
  row: CommunityPluginRow,
  result: CommunityPluginActionResult | null,
): boolean {
  if (resultAction(result) === "hot-reload" || resultNeedsRestart(result)) return false;
  return Boolean(row.can_update) && row.has_update === true;
}

export function officialInstalledVersionLabel(
  row: OfficialExtensionRow,
  result: OfficialExtensionInstallResult | null,
): string {
  if (resultAction(result) === "hot-reload" && row.latest_ref) return row.latest_ref;
  return (row.installed_ref || "").trim();
}

export function officialLatestVersionLabel(
  row: OfficialExtensionRow,
  result: OfficialExtensionInstallResult | null,
): string {
  if (resultAction(result) === "hot-reload") return "";
  const latest = (row.latest_ref || "").trim();
  const installed = officialInstalledVersionLabel(row, result);
  return latest && latest !== installed ? latest : "";
}

export function communityInstalledVersionLabel(
  row: CommunityPluginRow,
  result: CommunityPluginActionResult | null,
): string {
  if (resultAction(result) === "hot-reload" && row.latest_ref) return row.latest_ref;
  return (row.installed_ref || "").trim();
}

export function communityLatestVersionLabel(
  row: CommunityPluginRow,
  result: CommunityPluginActionResult | null,
): string {
  if (resultAction(result) === "hot-reload") return "";
  const latest = (row.latest_ref || "").trim();
  const installed = communityInstalledVersionLabel(row, result);
  return latest && latest !== installed ? latest : "";
}

export function officialStatusLabel(
  row: OfficialExtensionRow,
  result: OfficialExtensionInstallResult | null,
): string {
  const resultLabel = actionStateLabel(row.activation_policy, result);
  if (resultLabel) return resultLabel;
  if (officialUpdateEnabled(row, result)) return "有新版本";
  return updateLatestLabel(row);
}

export function communityStatusLabel(
  row: CommunityPluginRow,
  result: CommunityPluginActionResult | null,
): string {
  const resultLabel = actionStateLabel(row.activation_policy, result);
  if (resultLabel) return resultLabel;
  if (communityUpdateEnabled(row, result)) return "有新版本";
  return updateLatestLabel(row);
}

export function officialUpdateLabel(result: OfficialExtensionInstallResult | null): string {
  return resultNeedsRestart(result) ? "待重启" : "更新";
}

export function communityUpdateLabel(result: CommunityPluginActionResult | null): string {
  return resultNeedsRestart(result) ? "待重启" : "更新";
}

export function officialActivationHint(row: OfficialExtensionRow): string {
  return extensionActivationDetailHint(row.activation_policy);
}

export function communityActivationHint(row: CommunityPluginRow): string {
  return communityActivationDetailHint(row.activation_policy);
}

export function localCommunityMatch(
  row: PluginRow,
  communityRowById: Map<string, CommunityPluginRow>,
): CommunityPluginRow | null {
  if (!communityRowById.size) return null;
  const byName = communityRowById.get((row.name || "").trim());
  if (byName) return byName;
  const dir = (row.plugin_source_dir || "").trim().replace(/\/+$/, "");
  const base = dir.split("/").pop() || "";
  return base ? communityRowById.get(base) ?? null : null;
}

export function localPluginTitle(row: PluginRow, community: CommunityPluginRow | null): string {
  return community?.name || row.metadata?.name || row.name;
}

export function localPluginDescription(row: PluginRow, community: CommunityPluginRow | null): string {
  return community?.description || row.metadata?.description || row.module || "";
}

export function localPluginAuthor(row: PluginRow, community: CommunityPluginRow | null): string {
  if (community?.author) return `by ${community.author}`;
  return (row.plugin_source_dir || "").trim();
}

export function localPluginIconUrl(row: PluginRow, community: CommunityPluginRow | null, indexUpdatedAt: string): string {
  const rowIcon = ((row.cover || row.icon) || "").trim();
  if (rowIcon) return rowIcon;
  return community ? communityRowIconUrl(community, indexUpdatedAt) : "";
}

export function localPluginAvatarUrl(row: PluginRow, community: CommunityPluginRow | null, indexUpdatedAt: string): string | null {
  const rowAvatar = (row.avatar || "").trim();
  if (rowAvatar) return rowAvatar;
  return community ? communityRowAvatarUrl(community, indexUpdatedAt) : null;
}

export function localPluginRepoUrl(community: CommunityPluginRow | null): string | null {
  return community?.repository_url || null;
}
