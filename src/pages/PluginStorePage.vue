<script setup lang="ts">
import { computed, onDeactivated, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import {
  fetchCommunityPluginStore,
  fetchOfficialExtensions,
  fetchPluginStoreChangelog,
  fetchPluginStoreReadme,
  fetchPlugins,
  installCommunityPluginAsync,
  installOfficialExtensionAsync,
  openPluginInstallJobEventSource,
  refreshPluginStore,
  refreshPluginUpdateSnapshot,
  uninstallCommunityPlugin,
  uninstallOfficialExtension,
  updateCommunityPlugin,
  updateOfficialExtension,
} from "@/api/consoleApi";
import type {
  CommunityPluginRow,
  CommunityPluginStoreData,
  CommunityPluginActionResult,
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
import ConsoleHubFilterBar from "@/components/ConsoleHubFilterBar.vue";
import GitMirrorDialog from "@/components/GitMirrorDialog.vue";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import type { ConsoleNavIconId } from "@/config/consoleNavIcons";
import ConsoleHubSearch from "@/components/ConsoleHubSearch.vue";
import ConsoleHubToolbarStrip from "@/components/ConsoleHubToolbarStrip.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import ReadmeMarkdown from "@/components/ReadmeMarkdown.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiDialog from "@/components/ui/UiDialog.vue";
import UiInput from "@/components/ui/UiInput.vue";
import PluginStoreCard from "@/components/PluginStoreCard.vue";
import type { PluginStoreMenuItem } from "@/components/PluginStoreCard.vue";
import PluginStoreCardSkeleton from "@/components/PluginStoreCardSkeleton.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { trackRestartFromPluginResult, useBotSystemRestart } from "@/composables/useBotSystemRestart";
import { axiosErrorDetail } from "@/api/http";
import { copyTextToClipboard } from "@/utils/clipboard";
import { waitForInstallJob } from "@/utils/installJobStream";
import {
  readmeMarkdownToSafeHtml,
} from "@/utils/pluginReadme";
import {
  resolveOfficialExtensionDescription,
  resolveOfficialExtensionSubtitle,
  resolveOfficialExtensionTitle,
} from "@/utils/officialExtensionMeta";
import {
  resolveCommunityPluginIconUrlWithBust,
  resolveOfficialExtensionIconUrl,
  withPluginIconCacheBust,
  communityPluginIconBustKey,
} from "@/utils/pluginIconUrl";
import {
  formatPluginStoreActiveHint,
  formatPluginStoreBatchCompleteHint,
  formatPluginStoreEnqueuedHint,
  formatPluginStoreInstallProgressHint,
  isPluginStoreTaskQueued,
  type PluginStoreQueueAction,
  type PluginStoreQueueKind,
  withPluginStoreQueueSuffix,
} from "@/utils/pluginStoreActionQueue";

type StoreSection = "official" | "community" | "local";
type StoreTab = "all" | "installed" | "available";
type DetailKind = "official" | "community";

const COMMUNITY_INDEX_REPO_URL = "https://github.com/PallasBot/community-plugin-index";

interface IndexSourceDisplay {
  label: string;
  href: string | null;
}

interface StoreDetail {
  kind: DetailKind;
  id: string;
  title: string;
  subtitle: string;
  description: string;
  repositoryUrl: string | null;
  official?: OfficialExtensionRow;
  community?: CommunityPluginRow;
}

interface OfficialInstallUpdateQueueEntry {
  kind: "official";
  action: PluginStoreQueueAction;
  restart: boolean;
  row: OfficialExtensionRow;
}

interface CommunityInstallUpdateQueueEntry {
  kind: "community";
  action: PluginStoreQueueAction;
  restart: boolean;
  row: CommunityPluginRow;
}

type InstallUpdateQueueEntry = OfficialInstallUpdateQueueEntry | CommunityInstallUpdateQueueEntry;

const panelNavIcon = usePanelNavIcon();
const router = useRouter();
const pageReady = ref(false);
const loading = ref(false);
const checkingUpdate = ref(false);
const storeSection = ref<StoreSection>("official");
const rows = ref<OfficialExtensionRow[]>([]);
const communityStore = ref<CommunityPluginStoreData | null>(null);
const localPlugins = ref<PluginRow[]>([]);
const storeErr = ref("");
const storeCopyHint = ref("");
const storeActionHint = ref("");
const storeActionNeedsRestart = ref(false);
const {
  restartBusy,
  restartErr,
  restartProgressLabel,
  restartInProgress,
  restartAvailable: systemRestartAvailable,
  shardedRuntime,
  ensureRestartContext,
  restartBot,
} = useBotSystemRestart();
async function restartBotNow(workersOnly = false) {
  storeErr.value = "";
  const ok = await restartBot(workersOnly);
  if (ok) {
    storeActionNeedsRestart.value = false;
    storeActionHint.value = restartProgressLabel.value || "Bot 已恢复在线。";
  } else if (restartErr.value) {
    storeErr.value = restartErr.value;
  }
}

async function noteStoreActionResult(
  message: string,
  result: {
    needs_restart?: boolean;
    restart_scheduled?: boolean;
    activation_action?: string | null;
  } | null,
  queuePending = 0,
) {
  await ensureRestartContext();
  const needsRestart = Boolean(
    systemRestartAvailable.value
    && result
    && extensionResultNeedsRestart(result),
  );
  if (result?.restart_scheduled) {
    storeActionHint.value = message;
    storeActionNeedsRestart.value = false;
    const ok = await trackRestartFromPluginResult(result);
    if (ok) {
      storeActionHint.value = "Bot 已恢复在线。";
    }
    return;
  }
  if (queuePending > 0 || installUpdateQueue.value.length > 0) {
    installUpdateQueueDeferredRestart.value = installUpdateQueueDeferredRestart.value || needsRestart;
    return;
  }
  storeActionHint.value = message;
  storeActionNeedsRestart.value = needsRestart || installUpdateQueueDeferredRestart.value;
  installUpdateQueueDeferredRestart.value = false;
}
const storeBusyPackage = ref("");
const storeBusyPluginId = ref("");
type StoreBusyAction = "" | "install" | "update" | "uninstall";
const storeBusyOfficialAction = ref<StoreBusyAction>("");
const storeBusyCommunityAction = ref<StoreBusyAction>("");
const installUpdateQueue = ref<InstallUpdateQueueEntry[]>([]);
const installUpdateQueueRunning = ref(false);
const installUpdateQueueDeferredRestart = ref(false);
const storeActionInProgress = computed(
  () => Boolean(
    storeBusyOfficialAction.value
    || storeBusyCommunityAction.value
    || gitInstallBusy.value
    || installUpdateQueue.value.length > 0
    || installUpdateQueueRunning.value,
  ),
);
const searchQuery = ref("");
const activeTab = ref<StoreTab>("all");
const officialActionState = ref<Record<string, OfficialExtensionInstallResult>>({});
const communityActionState = ref<Record<string, CommunityPluginActionResult>>({});

type DetailTab = "readme" | "changelog";

const detailOpen = ref(false);
const detailTarget = ref<StoreDetail | null>(null);
const detailTab = ref<DetailTab>("readme");
const detailReadmeHtml = ref("");
const detailReadmeLoading = ref(false);
const detailReadmeErr = ref("");
const detailChangelogHtml = ref("");
const detailChangelogLoading = ref(false);
const detailChangelogErr = ref("");
const detailChangelogSource = ref<"changelog" | "git" | "">("");
const detailChangelogLoaded = ref(false);

const gitInstallOpen = ref(false);
const gitMirrorOpen = ref(false);
const gitPluginId = ref("");
const gitRepositoryUrl = ref("");
const gitRef = ref("main");
const gitInstallBusy = ref(false);

const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

const sectionOptions: { value: StoreSection; label: string; icon: ConsoleNavIconId }[] = [
  { value: "official", label: "官方插件", icon: "plugin" },
  { value: "community", label: "社区插件", icon: "globe" },
  { value: "local", label: "本地插件", icon: "terminal" },
];

const tabOptions: { value: StoreTab; label: string; icon: ConsoleNavIconId }[] = [
  { value: "all", label: "全部插件", icon: "list" },
  { value: "installed", label: "已安装", icon: "plugin" },
  { value: "available", label: "可安装", icon: "download" },
];

const webuiInstallEnabled = computed(() => rows.value.some((row) => row.webui_install));
const restartAvailable = computed(() => rows.value.some((row) => row.restart_available));
const communityRows = computed(() => communityStore.value?.plugins ?? []);
const communityRestartAvailable = computed(() => Boolean(communityStore.value?.restart_available));
const communityExtraDirsReady = computed(() => communityStore.value?.extra_plugin_dirs_ready !== false);
const communityIndexError = computed(() => (communityStore.value?.error || "").trim());
const communityIndexSourceDisplay = computed((): IndexSourceDisplay | null => {
  const raw = (communityStore.value?.source || "").trim();
  return resolveCommunityIndexSourceDisplay(raw);
});

const communityWebuiInstallEnabled = computed(() => communityStore.value?.webui_install !== false);

const gitInstallValid = computed(() => {
  const id = gitPluginId.value.trim();
  const repo = gitRepositoryUrl.value.trim();
  return Boolean(id && PLUGIN_ID_PATTERN.test(id) && repo);
});

const communityIndexUpdatedAt = computed(() => {
  const meta = communityStore.value?.meta;
  if (!meta || typeof meta !== "object") return "";
  const raw = (meta as { updated_at?: unknown }).updated_at;
  return raw != null ? String(raw).trim() : "";
});

function resolveCommunityIndexSourceDisplay(source: string): IndexSourceDisplay | null {
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
  if (body.includes("data/pallas_config")) {
    return { label: "本地覆盖索引", href: null };
  }
  if (body.includes("community_plugin_index")) {
    return { label: "内置索引", href: null };
  }
  const name = body.split("/").pop() || body;
  return { label: name, href: null };
}

function officialRowTitle(row: OfficialExtensionRow): string {
  return resolveOfficialExtensionTitle(row.package, row.display_name);
}

function officialRowSubtitle(row: OfficialExtensionRow): string {
  return resolveOfficialExtensionSubtitle(row.package, row.display_name);
}

function officialRowDescription(row: OfficialExtensionRow): string {
  return resolveOfficialExtensionDescription(row.package, row.description);
}

function officialRowPluginId(row: OfficialExtensionRow): string {
  return (row.plugin_ids?.[0] || row.package || "").trim();
}

function officialRowIconUrl(row: OfficialExtensionRow): string {
  return resolveOfficialExtensionIconUrl(row);
}

function officialRowAvatarUrl(_row: OfficialExtensionRow): string | null {
  return null;
}

function extensionInstalled(row: OfficialExtensionRow): boolean {
  return Boolean(
    row.installed || row.status === "installed" || row.pip_installed || row.status === "pip_installed",
  );
}

function communityRowIconUrl(row: CommunityPluginRow): string {
  return resolveCommunityPluginIconUrlWithBust(row, communityIndexUpdatedAt.value);
}

function communityRowAvatarUrl(row: CommunityPluginRow): string | null {
  const fromApi = (row.avatar || "").trim();
  const bust = communityPluginIconBustKey(row, communityIndexUpdatedAt.value);
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

function communityInstalled(row: CommunityPluginRow): boolean {
  return Boolean(row.loaded || row.local_installed || row.status === "loaded" || row.status === "installed");
}

function extensionResultState(row: OfficialExtensionRow): OfficialExtensionInstallResult | null {
  return officialActionState.value[row.package] ?? null;
}

function communityResultState(row: CommunityPluginRow): CommunityPluginActionResult | null {
  return communityActionState.value[row.plugin_id] ?? null;
}

function resultNeedsRestart(result: Parameters<typeof extensionResultNeedsRestart>[0]): boolean {
  return extensionResultNeedsRestart(result);
}

function resultAction(result: Parameters<typeof extensionResultAction>[0]) {
  return extensionResultAction(result);
}

function actionStateLabel(
  policy: Parameters<typeof extensionActionStateLabel>[0],
  result: Parameters<typeof extensionActionStateLabel>[1],
): string {
  return extensionActionStateLabel(policy, result);
}

function officialActivationHint(row: OfficialExtensionRow): string {
  return extensionActivationDetailHint(row.activation_policy);
}

function communityActivationHint(row: CommunityPluginRow): string {
  return communityActivationDetailHint(row.activation_policy);
}

function officialInstalledVersionLabel(row: OfficialExtensionRow): string {
  const result = extensionResultState(row);
  if (resultAction(result) === "hot-reload" && row.latest_ref) return row.latest_ref;
  return (row.installed_ref || "").trim();
}

function officialLatestVersionLabel(row: OfficialExtensionRow): string {
  const result = extensionResultState(row);
  if (resultAction(result) === "hot-reload") return "";
  const latest = (row.latest_ref || "").trim();
  const installed = officialInstalledVersionLabel(row);
  return latest && latest !== installed ? latest : "";
}

function communityInstalledVersionLabel(row: CommunityPluginRow): string {
  const result = communityResultState(row);
  if (resultAction(result) === "hot-reload" && row.latest_ref) return row.latest_ref;
  return (row.installed_ref || "").trim();
}

function communityLatestVersionLabel(row: CommunityPluginRow): string {
  const result = communityResultState(row);
  if (resultAction(result) === "hot-reload") return "";
  const latest = (row.latest_ref || "").trim();
  const installed = communityInstalledVersionLabel(row);
  return latest && latest !== installed ? latest : "";
}

const filteredRows = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  let list = rows.value;
  if (activeTab.value === "installed") {
    list = list.filter((row) => extensionInstalled(row) || row.bundled_in_repo);
  } else if (activeTab.value === "available") {
    list = list.filter((row) => row.can_install);
  }
  if (!q) return list;
  return list.filter((row) => {
    const title = officialRowTitle(row).toLowerCase();
    const subtitle = officialRowSubtitle(row).toLowerCase();
    const pkg = row.package.toLowerCase();
    const ids = row.plugin_ids.join(" ").toLowerCase();
    const desc = officialRowDescription(row).toLowerCase();
    return title.includes(q) || subtitle.includes(q) || pkg.includes(q) || ids.includes(q) || desc.includes(q);
  });
});

const filteredCommunityRows = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  let list = communityRows.value;
  if (activeTab.value === "installed") {
    list = list.filter((row) => communityInstalled(row));
  } else if (activeTab.value === "available") {
    list = list.filter((row) => row.can_install);
  }
  if (!q) return list;
  return list.filter((row) => {
    const id = row.plugin_id.toLowerCase();
    const name = (row.name || "").toLowerCase();
    const desc = (row.description || "").toLowerCase();
    const tags = (row.tags || []).join(" ").toLowerCase();
    return id.includes(q) || name.includes(q) || desc.includes(q) || tags.includes(q);
  });
});

const localRows = computed(() =>
  localPlugins.value.filter((p) => p.plugin_source === "local"),
);

/** 社区索引按 plugin_id 建表，用于识别「从社区商店下载」的本地插件。 */
const communityRowById = computed(() => {
  const map = new Map<string, CommunityPluginRow>();
  for (const row of communityRows.value) {
    const id = (row.plugin_id || "").trim();
    if (id) map.set(id, row);
  }
  return map;
});

/** 本地插件若命中社区索引（按 ID 或 local/plugins/<id> 目录名），返回对应社区行。 */
function localCommunityMatch(row: PluginRow): CommunityPluginRow | null {
  const map = communityRowById.value;
  if (!map.size) return null;
  const byName = map.get((row.name || "").trim());
  if (byName) return byName;
  const dir = (row.plugin_source_dir || "").trim().replace(/\/+$/, "");
  const base = dir.split("/").pop() || "";
  return base ? map.get(base) ?? null : null;
}

const filteredLocalRows = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  let list = localRows.value;
  if (activeTab.value === "available") return [];
  if (!q) return list;
  return list.filter((row) => {
    const name = (row.metadata?.name || row.name).toLowerCase();
    const id = row.name.toLowerCase();
    const desc = (row.metadata?.description || "").toLowerCase();
    return name.includes(q) || id.includes(q) || desc.includes(q);
  });
});

const resultCount = computed(() => {
  if (storeSection.value === "official") return filteredRows.value.length;
  if (storeSection.value === "community") return filteredCommunityRows.value.length;
  return filteredLocalRows.value.length;
});

const emptyHint = computed(() => {
  if (storeSection.value === "official") {
    if (searchQuery.value.trim()) return "试试更短的关键词，或切换「全部」筛选。";
    if (activeTab.value === "installed") return "已安装的官方插件会出现在这里。";
    if (activeTab.value === "available") return "当前没有可一键安装的官方插件。";
    return "官方插件列表为空。";
  }
  if (storeSection.value === "community") {
    if (searchQuery.value.trim()) return "换个关键词，或切到「全部」。";
    if (activeTab.value === "installed") return "已安装到本地的插件会出现在这里。";
    if (activeTab.value === "available") return "当前没有可安装的插件。";
    return "列表为空，请稍后再试。";
  }
  if (searchQuery.value.trim()) return "换个关键词试试。";
  if (!localRows.value.length) return "暂无本地插件，可将插件放入 local/plugins/ 目录。";
  return "";
});

function localPluginTitle(row: PluginRow): string {
  return localCommunityMatch(row)?.name || row.metadata?.name || row.name;
}

function localPluginDescription(row: PluginRow): string {
  return (
    localCommunityMatch(row)?.description ||
    row.metadata?.description ||
    row.module ||
    ""
  );
}

/** plugin_source_dir 已是仓库相对路径（如 local/plugins/draw），直接展示，勿再拼接前缀。 */
function localPluginSourceDir(row: PluginRow): string {
  return (row.plugin_source_dir || "").trim();
}

/** 社区来源的本地插件显示作者，否则回退到目录路径。 */
function localPluginAuthor(row: PluginRow): string {
  const community = localCommunityMatch(row);
  if (community?.author) return `by ${community.author}`;
  return localPluginSourceDir(row);
}

function localPluginIconUrl(row: PluginRow): string {
  const rowIcon = ((row.cover || row.icon) || "").trim();
  if (rowIcon) return rowIcon;
  const community = localCommunityMatch(row);
  return community ? communityRowIconUrl(community) : "";
}

function localPluginAvatarUrl(row: PluginRow): string | null {
  const rowAvatar = (row.avatar || "").trim();
  if (rowAvatar) return rowAvatar;
  const community = localCommunityMatch(row);
  return community ? communityRowAvatarUrl(community) : null;
}

function localPluginRepoUrl(row: PluginRow): string | null {
  const community = localCommunityMatch(row);
  return community?.repository_url || null;
}

function officialUpdateEnabled(row: OfficialExtensionRow): boolean {
  const result = extensionResultState(row);
  if (resultAction(result) === "hot-reload" || resultNeedsRestart(result)) return false;
  return Boolean(row.can_update) && row.has_update === true;
}

function communityUpdateEnabled(row: CommunityPluginRow): boolean {
  const result = communityResultState(row);
  if (resultAction(result) === "hot-reload" || resultNeedsRestart(result)) return false;
  return Boolean(row.can_update) && row.has_update === true;
}

/** 未检查（has_update 为 null/undefined）显示「待检查」，已检查且最新显示「最新」。 */
function updateLatestLabel(row: { can_update?: boolean; has_update?: boolean | null }): string {
  if (!row.can_update) return "最新";
  return row.has_update == null ? "待检查" : "最新";
}

function officialStatusLabel(row: OfficialExtensionRow): string {
  const resultLabel = actionStateLabel(row.activation_policy, extensionResultState(row));
  if (resultLabel) return resultLabel;
  if (officialUpdateEnabled(row)) return "有新版本";
  return updateLatestLabel(row);
}

function communityStatusLabel(row: CommunityPluginRow): string {
  const resultLabel = actionStateLabel(row.activation_policy, communityResultState(row));
  if (resultLabel) return resultLabel;
  if (communityUpdateEnabled(row)) return "有新版本";
  return updateLatestLabel(row);
}

function officialUpdateLabel(row: OfficialExtensionRow): string {
  const result = extensionResultState(row);
  return resultNeedsRestart(result) ? "待重启" : "更新";
}

function communityUpdateLabel(row: CommunityPluginRow): string {
  return resultNeedsRestart(communityResultState(row)) ? "待重启" : "更新";
}

function officialMenuItems(row: OfficialExtensionRow): PluginStoreMenuItem[] {
  const items: PluginStoreMenuItem[] = [];
  const result = extensionResultState(row);
  if (row.can_install && row.restart_available) {
    items.push({ id: "install-restart", label: "安装并重启" });
  }
  if (row.can_uninstall && row.restart_available) {
    items.push({ id: "uninstall-restart", label: "卸载并重启", danger: true });
  }
  if (officialUpdateEnabled(row) && row.restart_available) {
    items.push({ id: "update-restart", label: "更新并重启" });
  }
  if (resultNeedsRestart(result) && row.restart_available) {
    items.push({ id: "restart-now", label: "立即重启" });
  }
  if (row.install_cli) {
    items.push({ id: "copy-cli", label: "复制安装命令" });
  }
  if (row.repository_url) {
    items.push({ id: "open-repo", label: "打开仓库" });
  }
  return items;
}

function communityMenuItems(row: CommunityPluginRow): PluginStoreMenuItem[] {
  const items: PluginStoreMenuItem[] = [];
  const result = communityResultState(row);
  if (row.can_install && communityRestartAvailable.value) {
    items.push({ id: "install-restart", label: "安装并重启" });
  }
  if (row.can_uninstall && communityRestartAvailable.value) {
    items.push({ id: "uninstall-restart", label: "删除并重启", danger: true });
  }
  if (communityUpdateEnabled(row) && communityRestartAvailable.value) {
    items.push({ id: "update-restart", label: "更新并重启" });
  }
  if (resultNeedsRestart(result) && communityRestartAvailable.value) {
    items.push({ id: "restart-now", label: "立即重启" });
  }
  if (row.homepage) {
    items.push({ id: "open-homepage", label: "打开主页" });
  }
  if (row.repository_url) {
    items.push({ id: "open-repo", label: "打开仓库" });
  }
  return items;
}

async function refreshOfficialStore() {
  rows.value = await fetchOfficialExtensions();
}

async function refreshCommunityStore(force = false) {
  communityStore.value = await fetchCommunityPluginStore({ refresh: force });
}

async function refreshLocalStore() {
  try {
    // 并行拉社区索引，用于识别并复用社区下载插件的图标/作者/仓库信息。
    const [plugins] = await Promise.all([
      fetchPlugins(),
      communityStore.value ? Promise.resolve() : refreshCommunityStore().catch(() => {}),
    ]);
    localPlugins.value = plugins;
  } catch {
    // keep previous list on error
  }
}

async function refreshStore(force = false) {
  loading.value = true;
  storeErr.value = "";
  try {
    if (force && storeSection.value !== "local") {
      const out = await refreshPluginStore();
      if (storeSection.value === "official") {
        await refreshOfficialStore();
      } else {
        await refreshCommunityStore(false);
      }
      const n = (out.store_assets.community_count ?? 0) + (out.store_assets.official_count ?? 0);
      storeActionHint.value = n ? `已同步 ${n} 个插件的商店资源。` : "已完成插件商店刷新。";
    } else if (storeSection.value === "official") {
      await refreshOfficialStore();
    } else if (storeSection.value === "community") {
      await refreshCommunityStore(force);
    } else {
      await refreshLocalStore();
    }
  } catch (e) {
    storeErr.value = axiosErrorDetail(e);
  } finally {
    loading.value = false;
  }
}

async function checkUpdates() {
  if (checkingUpdate.value) return;
  storeErr.value = "";
  storeActionHint.value = "";
  checkingUpdate.value = true;
  try {
    const out = await refreshPluginUpdateSnapshot();
    // 快照刷新后重新拉取列表，使 has_update 生效。
    if (storeSection.value === "official") {
      await refreshOfficialStore();
    } else if (storeSection.value === "community") {
      await refreshCommunityStore(true);
    }
    const n = (out.community_count ?? 0) + (out.official_count ?? 0);
    storeActionHint.value = n ? `已检查 ${n} 个插件的版本。` : "已完成版本检查。";
  } catch (e) {
    storeErr.value = axiosErrorDetail(e);
  } finally {
    checkingUpdate.value = false;
  }
}

function queueTaskDescriptor(entry: InstallUpdateQueueEntry): { kind: PluginStoreQueueKind; key: string; action: PluginStoreQueueAction } {
  if (entry.kind === "official") {
    return { kind: "official", key: entry.row.package, action: entry.action };
  }
  return { kind: "community", key: entry.row.plugin_id, action: entry.action };
}

function queueEntryLabel(entry: InstallUpdateQueueEntry): string {
  if (entry.kind === "official") {
    return officialRowTitle(entry.row);
  }
  return (entry.row.name || entry.row.plugin_id).trim();
}

function isInstallUpdateEntryQueued(entry: InstallUpdateQueueEntry): boolean {
  const descriptor = queueTaskDescriptor(entry);
  return isPluginStoreTaskQueued(
    installUpdateQueue.value.map(queueTaskDescriptor),
    descriptor,
  );
}

function isOfficialInstallUpdateQueued(packageName: string, action: PluginStoreQueueAction): boolean {
  return isPluginStoreTaskQueued(
    installUpdateQueue.value.map(queueTaskDescriptor),
    { kind: "official", key: packageName, action },
  );
}

function isCommunityInstallUpdateQueued(pluginId: string, action: PluginStoreQueueAction): boolean {
  return isPluginStoreTaskQueued(
    installUpdateQueue.value.map(queueTaskDescriptor),
    { kind: "community", key: pluginId, action },
  );
}

function isInstallUpdateEntryActive(entry: InstallUpdateQueueEntry): boolean {
  if (entry.kind === "official") {
    return storeBusyPackage.value === entry.row.package && storeBusyOfficialAction.value === entry.action;
  }
  return storeBusyPluginId.value === entry.row.plugin_id && storeBusyCommunityAction.value === entry.action;
}

function isInstallUpdatePipelineBusy(): boolean {
  if (installUpdateQueueRunning.value) return true;
  if (gitInstallBusy.value) return true;
  const official = storeBusyOfficialAction.value;
  if (official === "install" || official === "update") return true;
  const community = storeBusyCommunityAction.value;
  return community === "install" || community === "update";
}

function enqueueInstallUpdate(entry: InstallUpdateQueueEntry): void {
  if (isInstallUpdateEntryQueued(entry) || isInstallUpdateEntryActive(entry)) return;
  storeErr.value = "";
  storeActionNeedsRestart.value = false;
  if (isInstallUpdatePipelineBusy()) {
    installUpdateQueue.value.push(entry);
    storeActionHint.value = formatPluginStoreEnqueuedHint(
      entry.action,
      queueEntryLabel(entry),
      installUpdateQueue.value.length,
    );
    return;
  }
  void drainInstallUpdateQueue(entry);
}

async function drainInstallUpdateQueue(first?: InstallUpdateQueueEntry): Promise<void> {
  if (installUpdateQueueRunning.value) {
    if (first && !isInstallUpdateEntryQueued(first) && !isInstallUpdateEntryActive(first)) {
      installUpdateQueue.value.push(first);
    }
    return;
  }
  installUpdateQueueRunning.value = true;
  installUpdateQueueDeferredRestart.value = false;
  let current: InstallUpdateQueueEntry | undefined = first;
  let processedCount = 0;
  let batchHadUpdate = false;
  try {
    while (true) {
      if (!current) {
        current = installUpdateQueue.value.shift();
        if (!current) break;
      }
      const pendingAfter = installUpdateQueue.value.length;
      if (current.kind === "official") {
        if (current.action === "install") {
          await executeInstallExtension(current.row, current.restart, pendingAfter);
        } else {
          await executeUpdateExtension(current.row, current.restart, pendingAfter);
        }
      } else if (current.action === "install") {
        await executeInstallCommunity(current.row, current.restart, pendingAfter);
      } else {
        await executeUpdateCommunity(current.row, current.restart, pendingAfter);
      }
      if (current.action === "update") batchHadUpdate = true;
      processedCount += 1;
      current = undefined;
    }
    if (batchHadUpdate && !storeErr.value) {
      // 更新后版本快照仍是旧的：自动重算一次，避免刷新页面后仍显示可更新。
      await refreshUpdateSnapshotAfterUpdate();
      if (!storeErr.value) {
        const base = processedCount > 1 ? `已完成 ${processedCount} 项安装/更新。` : "更新完成，已刷新版本状态。";
        storeActionHint.value = storeActionNeedsRestart.value
          ? `${base}需重启 Bot 才能加载新版本。`
          : base;
      }
    } else {
      const batchHint = formatPluginStoreBatchCompleteHint(processedCount);
      if (batchHint && !storeErr.value) {
        storeActionHint.value = batchHint;
      }
    }
  } finally {
    installUpdateQueueRunning.value = false;
    installUpdateQueueDeferredRestart.value = false;
  }
}

async function refreshUpdateSnapshotAfterUpdate(): Promise<void> {
  try {
    await refreshPluginUpdateSnapshot();
    if (storeSection.value === "official") {
      await refreshOfficialStore();
    } else if (storeSection.value === "community") {
      await refreshCommunityStore(true);
    }
  } catch {
    // 快照刷新失败不阻断更新结果，保留上一步的提示
  }
}

async function installExtension(row: OfficialExtensionRow, restart = false) {
  enqueueInstallUpdate({ kind: "official", action: "install", restart, row });
}

async function executeInstallExtension(
  row: OfficialExtensionRow,
  restart: boolean,
  queuePending = 0,
) {
  storeErr.value = "";
  storeActionHint.value = withPluginStoreQueueSuffix("正在排队安装…", queuePending);
  storeActionNeedsRestart.value = false;
  storeBusyPackage.value = row.package;
  storeBusyOfficialAction.value = "install";
  const label = officialRowTitle(row);
  try {
    const job = await installOfficialExtensionAsync(row.package, { restart });
    storeActionHint.value = withPluginStoreQueueSuffix(
      formatPluginStoreActiveHint("install", label),
      queuePending,
    );
    const payload = await waitForInstallJob(job.job_id, openPluginInstallJobEventSource, (message) => {
      storeActionHint.value = withPluginStoreQueueSuffix(
        formatPluginStoreInstallProgressHint(message, label, row.package, "install"),
        queuePending,
      );
    });
    const result = payload.result as OfficialExtensionInstallResult | undefined;
    if (result) {
      officialActionState.value = { ...officialActionState.value, [row.package]: result };
      await noteStoreActionResult(result.message || payload.message || "安装完成。", result, queuePending);
    } else {
      await noteStoreActionResult(payload.message || "安装完成。", null, queuePending);
    }
    await refreshOfficialStore();
  } catch (e) {
    storeErr.value = axiosErrorDetail(e);
  } finally {
    storeBusyPackage.value = "";
    storeBusyOfficialAction.value = "";
  }
}

async function uninstallExtension(row: OfficialExtensionRow, restart = false) {
  if (storeBusyPackage.value) return;
  const ok = window.confirm(
    restart
      ? `确定卸载 ${row.package} 并重启 Bot？`
      : `确定卸载 ${row.package}？卸载后需重启 Bot，且不会删除 local/plugins 副本。`,
  );
  if (!ok) return;
  storeErr.value = "";
  storeActionHint.value = "";
  storeActionNeedsRestart.value = false;
  storeBusyPackage.value = row.package;
  storeBusyOfficialAction.value = "uninstall";
  storeActionHint.value = `正在卸载 ${row.package}…`;
  try {
    const out = await uninstallOfficialExtension(row.package, { restart });
    officialActionState.value = { ...officialActionState.value, [row.package]: out };
    await noteStoreActionResult(
      out.message || (restart ? "已卸载。" : "已卸载，请重启 Bot。"),
      out,
    );
    await refreshOfficialStore();
  } catch (e) {
    storeErr.value = axiosErrorDetail(e);
  } finally {
    storeBusyPackage.value = "";
    storeBusyOfficialAction.value = "";
  }
}

async function updateExtension(row: OfficialExtensionRow, restart = false) {
  enqueueInstallUpdate({ kind: "official", action: "update", restart, row });
}

async function executeUpdateExtension(
  row: OfficialExtensionRow,
  restart: boolean,
  queuePending = 0,
) {
  storeErr.value = "";
  storeActionNeedsRestart.value = false;
  storeBusyPackage.value = row.package;
  storeBusyOfficialAction.value = "update";
  const label = officialRowTitle(row);
  storeActionHint.value = withPluginStoreQueueSuffix(formatPluginStoreActiveHint("update", label), queuePending);
  try {
    const out = await updateOfficialExtension(row.package, { restart });
    officialActionState.value = { ...officialActionState.value, [row.package]: out };
    await noteStoreActionResult(out.message || "更新完成。", out, queuePending);
    await refreshOfficialStore();
  } catch (e) {
    storeErr.value = axiosErrorDetail(e);
  } finally {
    storeBusyPackage.value = "";
    storeBusyOfficialAction.value = "";
  }
}

function openGitInstallDialog() {
  gitPluginId.value = "";
  gitRepositoryUrl.value = "";
  gitRef.value = "main";
  gitInstallOpen.value = true;
}

function closeGitInstallDialog() {
  if (gitInstallBusy.value) return;
  gitInstallOpen.value = false;
}

async function installCommunityFromGit(restart = false) {
  if (gitInstallBusy.value || !gitInstallValid.value) return;
  storeErr.value = "";
  storeActionHint.value = "正在排队安装…";
  storeActionNeedsRestart.value = false;
  gitInstallBusy.value = true;
  storeBusyPluginId.value = gitPluginId.value.trim();
  const pluginId = gitPluginId.value.trim();
  try {
    const job = await installCommunityPluginAsync(pluginId, {
      restart,
      repositoryUrl: gitRepositoryUrl.value.trim(),
      ref: gitRef.value.trim() || "main",
    });
    const payload = await waitForInstallJob(job.job_id, openPluginInstallJobEventSource, (message) => {
      storeActionHint.value = message;
    });
    const out = (payload.result ?? {}) as CommunityPluginActionResult;
    communityActionState.value = { ...communityActionState.value, [pluginId]: out };
    await noteStoreActionResult(out.message || payload.message || "安装完成。", out);
    gitInstallOpen.value = false;
    await refreshCommunityStore();
  } catch (e) {
    storeErr.value = axiosErrorDetail(e);
  } finally {
    gitInstallBusy.value = false;
    storeBusyPluginId.value = "";
  }
}

async function installCommunity(row: CommunityPluginRow, restart = false) {
  enqueueInstallUpdate({ kind: "community", action: "install", restart, row });
}

async function executeInstallCommunity(
  row: CommunityPluginRow,
  restart: boolean,
  queuePending = 0,
) {
  storeErr.value = "";
  storeActionHint.value = withPluginStoreQueueSuffix("正在排队安装…", queuePending);
  storeActionNeedsRestart.value = false;
  storeBusyPluginId.value = row.plugin_id;
  storeBusyCommunityAction.value = "install";
  const label = (row.name || row.plugin_id).trim();
  try {
    const job = await installCommunityPluginAsync(row.plugin_id, {
      restart,
      repositoryUrl: row.repository_url || undefined,
      ref: row.ref,
    });
    storeActionHint.value = withPluginStoreQueueSuffix(
      formatPluginStoreActiveHint("install", label),
      queuePending,
    );
    const payload = await waitForInstallJob(job.job_id, openPluginInstallJobEventSource, (message) => {
      storeActionHint.value = withPluginStoreQueueSuffix(
        formatPluginStoreInstallProgressHint(message, label, row.plugin_id, "install"),
        queuePending,
      );
    });
    const out = (payload.result ?? {}) as CommunityPluginActionResult;
    communityActionState.value = { ...communityActionState.value, [row.plugin_id]: out };
    await noteStoreActionResult(
      out.message || payload.message || "安装完成。",
      out,
      queuePending,
    );
    await refreshCommunityStore();
  } catch (e) {
    storeErr.value = axiosErrorDetail(e);
  } finally {
    storeBusyPluginId.value = "";
    storeBusyCommunityAction.value = "";
  }
}

async function uninstallCommunity(row: CommunityPluginRow, restart = false) {
  if (storeBusyPluginId.value) return;
  const ok = window.confirm(
    restart
      ? `确定删除 local/plugins/${row.plugin_id} 并重启 Bot？`
      : `确定删除 local/plugins/${row.plugin_id}？删除后需重启 Bot。`,
  );
  if (!ok) return;
  storeErr.value = "";
  storeActionHint.value = "";
  storeActionNeedsRestart.value = false;
  storeBusyPluginId.value = row.plugin_id;
  storeBusyCommunityAction.value = "uninstall";
  storeActionHint.value = `正在删除 ${row.plugin_id}…`;
  try {
    const out = await uninstallCommunityPlugin(row.plugin_id, { restart });
    communityActionState.value = { ...communityActionState.value, [row.plugin_id]: out };
    await noteStoreActionResult(
      out.message || "已卸载。",
      out,
    );
    await refreshCommunityStore();
  } catch (e) {
    storeErr.value = axiosErrorDetail(e);
  } finally {
    storeBusyPluginId.value = "";
    storeBusyCommunityAction.value = "";
  }
}

async function updateCommunity(row: CommunityPluginRow, restart = false) {
  enqueueInstallUpdate({ kind: "community", action: "update", restart, row });
}

async function executeUpdateCommunity(
  row: CommunityPluginRow,
  restart: boolean,
  queuePending = 0,
) {
  storeErr.value = "";
  storeActionNeedsRestart.value = false;
  storeBusyPluginId.value = row.plugin_id;
  storeBusyCommunityAction.value = "update";
  const label = (row.name || row.plugin_id).trim();
  storeActionHint.value = withPluginStoreQueueSuffix(formatPluginStoreActiveHint("update", label), queuePending);
  try {
    const out = await updateCommunityPlugin(row.plugin_id, {
      restart,
      ref: row.ref,
    });
    communityActionState.value = { ...communityActionState.value, [row.plugin_id]: out };
    await noteStoreActionResult(
      out.message || "更新完成。",
      out,
      queuePending,
    );
    await refreshCommunityStore();
  } catch (e) {
    storeErr.value = axiosErrorDetail(e);
  } finally {
    storeBusyPluginId.value = "";
    storeBusyCommunityAction.value = "";
  }
}

async function copyInstallCli(row: OfficialExtensionRow) {
  const cmd = (row.install_cli || "").trim();
  if (!cmd) return;
  if (await copyTextToClipboard(cmd)) {
    storeCopyHint.value = `已复制安装命令：${row.package}`;
    window.setTimeout(() => {
      storeCopyHint.value = "";
    }, 2500);
  }
}

function openExternalUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function handleOfficialMenu(row: OfficialExtensionRow, actionId: string) {
  if (actionId === "install-restart") void installExtension(row, true);
  if (actionId === "uninstall-restart") void uninstallExtension(row, true);
  if (actionId === "update-restart") void updateExtension(row, true);
  if (actionId === "restart-now") void restartBotNow();
  if (actionId === "copy-cli") void copyInstallCli(row);
  if (actionId === "open-repo" && row.repository_url) openExternalUrl(row.repository_url);
}

function handleCommunityMenu(row: CommunityPluginRow, actionId: string) {
  if (actionId === "install-restart") void installCommunity(row, true);
  if (actionId === "uninstall-restart") void uninstallCommunity(row, true);
  if (actionId === "update-restart") void updateCommunity(row, true);
  if (actionId === "restart-now") void restartBotNow(Boolean(shardedRuntime.value));
  if (actionId === "open-homepage" && row.homepage) openExternalUrl(row.homepage);
  if (actionId === "open-repo" && row.repository_url) openExternalUrl(row.repository_url);
}

function closeDetail() {
  detailOpen.value = false;
  detailTarget.value = null;
  detailTab.value = "readme";
  detailReadmeHtml.value = "";
  detailReadmeErr.value = "";
  detailChangelogHtml.value = "";
  detailChangelogErr.value = "";
  detailChangelogSource.value = "";
  detailChangelogLoaded.value = false;
}

async function loadDetailChangelog() {
  const target = detailTarget.value;
  if (!target || detailChangelogLoaded.value || detailChangelogLoading.value) return;
  detailChangelogLoaded.value = true;
  detailChangelogLoading.value = true;
  detailChangelogHtml.value = "";
  detailChangelogErr.value = "";
  detailChangelogSource.value = "";
  const repositoryUrl = target.repositoryUrl;
  try {
    const data = await fetchPluginStoreChangelog(target.kind, target.id, { repositoryUrl });
    const markdown = (data.markdown || "").trim();
    if (markdown) {
      detailChangelogHtml.value = readmeMarkdownToSafeHtml(data.markdown, repositoryUrl);
      detailChangelogSource.value = data.source;
    }
  } catch (e) {
    detailChangelogLoaded.value = false;
    detailChangelogErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    detailChangelogLoading.value = false;
  }
}

function selectDetailTab(tab: DetailTab) {
  detailTab.value = tab;
  if (tab === "changelog") void loadDetailChangelog();
}

async function loadDetailReadme(repositoryUrl: string | null) {
  detailTab.value = "readme";
  detailChangelogHtml.value = "";
  detailChangelogErr.value = "";
  detailChangelogSource.value = "";
  detailChangelogLoaded.value = false;
  detailReadmeLoading.value = true;
  detailReadmeHtml.value = "";
  detailReadmeErr.value = "";
  const target = detailTarget.value;
  if (!repositoryUrl || !target) {
    detailReadmeErr.value = "该条目未提供仓库链接";
    detailReadmeLoading.value = false;
    return;
  }
  try {
    const md = await fetchPluginStoreReadme(target.kind, target.id, {
      repositoryUrl: repositoryUrl || target.repositoryUrl,
    });
    detailReadmeHtml.value = readmeMarkdownToSafeHtml(md, repositoryUrl);
  } catch (e) {
    detailReadmeErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    detailReadmeLoading.value = false;
  }
}

async function openOfficialReadme(row: OfficialExtensionRow) {
  detailTarget.value = {
    kind: "official",
    id: row.package,
    title: officialRowTitle(row),
    subtitle: officialRowSubtitle(row) || row.package,
    description: officialRowDescription(row),
    repositoryUrl: row.repository_url || null,
    official: row,
  };
  detailOpen.value = true;
  await loadDetailReadme(row.repository_url || null);
}

async function openCommunityReadme(row: CommunityPluginRow) {
  detailTarget.value = {
    kind: "community",
    id: row.plugin_id,
    title: row.name || row.plugin_id,
    subtitle: row.plugin_id,
    description: row.description || "",
    repositoryUrl: row.repository_url || null,
    community: row,
  };
  detailOpen.value = true;
  await loadDetailReadme(row.repository_url || null);
}

watch(storeSection, () => {
  activeTab.value = "all";
  searchQuery.value = "";
  storeActionHint.value = "";
  storeActionNeedsRestart.value = false;
  closeDetail();
  void refreshStore();
});

onMounted(async () => {
  void ensureRestartContext();
  try {
    await refreshOfficialStore();
  } finally {
    pageReady.value = true;
  }
});

onDeactivated(() => {
  closeDetail();
});
</script>

<template>
  <div class="console-hub-page plugin-store-page plugin-store-page--hub">
    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="2"
    />
    <template v-else>
      <ConsoleHubMasthead :icon="panelNavIcon">
        <template #title>
          插件商店
        </template>
        <template #lead>
          <template v-if="storeSection === 'official'">
            浏览并安装 Pallas 官方插件（<span class="console-hub-chip">uv run pallas ext install</span>）。
            <template v-if="webuiInstallEnabled">
              <template v-if="restartAvailable">
                支持一键安装；结果会按扩展生效策略提示（可热更新 / 重启分片节点 / 重启全部进程）。
              </template>
              <template v-else>安装后请按页面提示重启或手动生效。</template>
            </template>
            <template v-else>
              当前环境不支持 WebUI 安装，可复制命令或放入 <span class="console-hub-chip">local/plugins/</span>。
            </template>
          </template>
          <template v-else-if="storeSection === 'community'">
            浏览
            <a
              :href="COMMUNITY_INDEX_REPO_URL"
              target="_blank"
              rel="noopener noreferrer"
            >社区插件索引</a>
            中的策展插件，或使用「从 Git 安装」粘贴仓库地址；同名时优先于官方插件。
          </template>
          <template v-else>
            <code>local/plugins/</code> 目录下已加载的本地插件；可直接放入插件文件夹，重启后生效。
          </template>
        </template>
        <template #actions>
          <div class="console-hub-toolbar-strip__masthead-actions">
            <UiButton
              variant="outline"
              @click="gitMirrorOpen = true"
            >
              镜像源
            </UiButton>
            <UiButton
              v-if="storeSection === 'community' && communityWebuiInstallEnabled"
              variant="outline"
              @click="openGitInstallDialog"
            >
              从 Git 安装
            </UiButton>
            <UiButton
              variant="outline"
              :busy="checkingUpdate"
              :disabled="checkingUpdate || loading"
              v-if="storeSection !== 'local'"
              @click="checkUpdates"
            >
              {{ checkingUpdate ? "检查中…" : "检查更新" }}
            </UiButton>
            <RefreshIconButton
              embedded
              :busy="loading"
              label="刷新列表"
              @click="refreshStore(true)"
            />
          </div>
        </template>
      </ConsoleHubMasthead>

      <ConsoleHubSearch
        v-model="searchQuery"
        class="hub-search-wide-only"
        :placeholder="storeSection === 'official' ? '搜索扩展包名或插件 ID…' : '搜索社区插件名、ID 或标签…'"
      />

      <ConsoleHubToolbarStrip>
        <template #search>
          <ConsoleHubSearch
            v-model="searchQuery"
            :placeholder="storeSection === 'official' ? '搜索扩展包名或插件 ID…' : '搜索社区插件名、ID 或标签…'"
          />
        </template>
        <template #middle>
          <UiButton
            variant="outline"
            class="plugin-store-page__strip-btn"
            @click="gitMirrorOpen = true"
          >
            镜像源
          </UiButton>
          <UiButton
            v-if="storeSection === 'community' && communityWebuiInstallEnabled"
            variant="outline"
            class="plugin-store-page__strip-btn"
            @click="openGitInstallDialog"
          >
            Git 安装
          </UiButton>
          <UiButton
            v-if="storeSection !== 'local'"
            variant="outline"
            class="plugin-store-page__strip-btn"
            :busy="checkingUpdate"
            :disabled="checkingUpdate || loading"
            @click="checkUpdates"
          >
            {{ checkingUpdate ? "检查中…" : "检查更新" }}
          </UiButton>
        </template>
        <template #actions>
          <RefreshIconButton
            embedded
            :busy="loading"
            label="刷新列表"
            @click="refreshStore(true)"
          />
        </template>
      </ConsoleHubToolbarStrip>

      <ConsoleHubFilterBar>
        <template #primary>
          <div
            class="console-view-toggle console-view-toggle--full"
            role="tablist"
            aria-label="商店类型"
          >
            <button
              v-for="sec in sectionOptions"
              :key="sec.value"
              type="button"
              role="tab"
              :class="{ 'is-on': storeSection === sec.value }"
              :aria-selected="storeSection === sec.value"
              @click="storeSection = sec.value"
            >
              <ConsoleNavIcon
                :name="sec.icon"
                :size="16"
              />
              <span>{{ sec.label }}</span>
            </button>
          </div>
        </template>
        <template #secondary>
          <div
            class="console-view-toggle"
            role="tablist"
            aria-label="列表筛选"
          >
            <button
              v-for="tab in tabOptions"
              :key="tab.value"
              type="button"
              role="tab"
              :class="{ 'is-on': activeTab === tab.value }"
              :aria-selected="activeTab === tab.value"
              @click="activeTab = tab.value"
            >
              <ConsoleNavIcon
                :name="tab.icon"
                :size="16"
              />
              <span>{{ tab.label }}</span>
            </button>
          </div>
        </template>
        <template #meta>
          <p
            v-if="pageReady && !loading"
            class="console-hub-page__result-count muted"
          >
            共 {{ resultCount }} 项
          </p>
        </template>
      </ConsoleHubFilterBar>

      <p
        v-if="storeSection === 'community' && communityIndexSourceDisplay"
        class="muted plugin-store-page__hint"
        role="status"
      >
        索引来源：
        <a
          v-if="communityIndexSourceDisplay.href"
          :href="communityIndexSourceDisplay.href"
          target="_blank"
          rel="noopener noreferrer"
        >{{ communityIndexSourceDisplay.label }}</a>
        <span v-else>{{ communityIndexSourceDisplay.label }}</span>
      </p>
      <p
        v-if="storeSection === 'community' && !communityExtraDirsReady"
        class="alert plugin-store-page__hint"
        role="status"
      >
        尚未配置本地插件目录。安装后请重启 Bot；若未自动加载，可在
        <span class="plugin-store-page__chip">pallas.toml</span>
        中设置
        <span class="plugin-store-page__chip">extra_plugin_dirs</span>。
      </p>
      <p
        v-if="storeSection === 'community' && communityIndexError"
        class="alert alert--err plugin-store-page__hint"
      >
        索引加载失败：{{ communityIndexError }}
      </p>
      <div
        v-if="storeActionHint"
        class="plugin-store-page__action-hint"
        role="status"
      >
        <p class="muted plugin-store-page__hint plugin-store-page__hint--ok">
          {{ restartInProgress ? (restartProgressLabel || storeActionHint) : storeActionHint }}
        </p>
        <div
          v-if="storeActionInProgress && !restartInProgress"
          class="plugin-store-page__action-progress"
          aria-hidden="true"
        />
        <UiButton
          v-if="storeActionNeedsRestart"
          variant="outline"
          :busy="restartBusy || restartInProgress"
          :disabled="restartBusy || restartInProgress"
          @click="() => restartBotNow()"
        >
          {{ restartInProgress ? "重启中…" : "立即重启 Bot" }}
        </UiButton>
      </div>
      <p
        v-if="storeCopyHint"
        class="muted plugin-store-page__hint plugin-store-page__hint--ok"
        role="status"
      >
        {{ storeCopyHint }}
      </p>
      <div
        v-if="storeErr"
        class="alert alert--err plugin-store-page__hint"
      >
        {{ storeErr }}
      </div>

      <template v-if="storeSection === 'official'">
        <div
          v-if="loading && !rows.length"
          class="plugin-store-page__grid"
        >
          <PluginStoreCardSkeleton
            v-for="idx in 8"
            :key="idx"
          />
        </div>
        <div
          v-else-if="!filteredRows.length"
          class="panel plugin-store-page__empty-panel"
        >
          <div class="panel__bd plugin-store-page__empty">
            <div
              class="plugin-store-page__empty-icon"
              aria-hidden="true"
            >
              <ConsoleNavIcon name="store" :size="22" />
            </div>
            <p class="plugin-store-page__empty-title">
              {{ searchQuery ? "没有匹配的扩展" : activeTab === "installed" ? "暂无已安装扩展" : activeTab === "available" ? "暂无可安装扩展" : "暂无扩展" }}
            </p>
            <p class="muted plugin-store-page__empty-hint">
              {{ emptyHint }}
            </p>
          </div>
        </div>
        <div
          v-else
          class="plugin-store-page__grid"
        >
          <PluginStoreCard
            v-for="row in filteredRows"
            :key="row.package"
            :title="officialRowTitle(row)"
            subtitle=""
            :description="officialRowDescription(row)"
            :plugin-id="officialRowPluginId(row)"
            :icon-url="officialRowIconUrl(row)"
            :avatar-url="officialRowAvatarUrl(row)"
            author="by PallasBot"
            :installed="extensionInstalled(row)"
            :install-busy="storeBusyPackage === row.package && storeBusyOfficialAction === 'install'"
            :update-busy="storeBusyPackage === row.package && storeBusyOfficialAction === 'update'"
            :uninstall-busy="storeBusyPackage === row.package && storeBusyOfficialAction === 'uninstall'"
            :install-queued="isOfficialInstallUpdateQueued(row.package, 'install')"
            :update-queued="isOfficialInstallUpdateQueued(row.package, 'update')"
            :repo-url="row.repository_url || null"
            meta-link-label="GitHub"
            :meta-link-url="row.repository_url || null"
            :menu-items="officialMenuItems(row)"
            :show-install="Boolean(row.can_install)"
            :show-uninstall="Boolean(row.can_uninstall)"
            :show-update="officialUpdateEnabled(row)"
            install-label="安装"
            uninstall-label="卸载"
            :update-label="officialUpdateLabel(row)"
            :latest-label="updateLatestLabel(row)"
            :status-label="officialStatusLabel(row)"
            :installed-version-label="officialInstalledVersionLabel(row)"
            :latest-version-label="officialLatestVersionLabel(row)"
            detail-label="仓库"
            :can-open="Boolean(row.repository_url)"
            @open="openOfficialReadme(row)"
            @install="installExtension(row, false)"
            @update="updateExtension(row, false)"
            @uninstall="uninstallExtension(row, false)"
            @menu-action="handleOfficialMenu(row, $event)"
          />
        </div>
      </template>

      <template v-else-if="storeSection === 'community'">
        <div
          v-if="loading && !communityRows.length"
          class="plugin-store-page__grid"
        >
          <PluginStoreCardSkeleton
            v-for="idx in 8"
            :key="idx"
          />
        </div>
        <div
          v-else-if="!filteredCommunityRows.length"
          class="panel plugin-store-page__empty-panel"
        >
          <div class="panel__bd plugin-store-page__empty">
            <div
              class="plugin-store-page__empty-icon"
              aria-hidden="true"
            >
              <ConsoleNavIcon name="store" :size="22" />
            </div>
            <p class="plugin-store-page__empty-title">
              {{ searchQuery ? "没有匹配的插件" : activeTab === "installed" ? "暂无已安装" : activeTab === "available" ? "暂无可安装" : "列表为空" }}
            </p>
            <p class="muted plugin-store-page__empty-hint">
              {{ emptyHint }}
            </p>
            <p
              v-if="!searchQuery && activeTab !== 'installed'"
              class="muted plugin-store-page__empty-link"
            >
              列表由
              <a
                :href="COMMUNITY_INDEX_REPO_URL"
                target="_blank"
                rel="noopener noreferrer"
              >社区插件索引</a>
              维护。
            </p>
          </div>
        </div>
        <div
          v-else
          class="plugin-store-page__grid"
        >
          <PluginStoreCard
            v-for="row in filteredCommunityRows"
            :key="row.plugin_id"
            :title="row.name || row.plugin_id"
            subtitle=""
            :description="row.description || row.plugin_id"
            :author="row.author ? `by ${row.author}` : ''"
            :plugin-id="row.plugin_id"
            :icon-url="communityRowIconUrl(row)"
            :avatar-url="communityRowAvatarUrl(row)"
            :installed="communityInstalled(row)"
            :install-busy="storeBusyPluginId === row.plugin_id && storeBusyCommunityAction === 'install'"
            :update-busy="storeBusyPluginId === row.plugin_id && storeBusyCommunityAction === 'update'"
            :uninstall-busy="storeBusyPluginId === row.plugin_id && storeBusyCommunityAction === 'uninstall'"
            :install-queued="isCommunityInstallUpdateQueued(row.plugin_id, 'install')"
            :update-queued="isCommunityInstallUpdateQueued(row.plugin_id, 'update')"
            :repo-url="row.repository_url || null"
            meta-link-label="GitHub"
            :meta-link-url="row.repository_url || row.homepage || null"
            :menu-items="communityMenuItems(row)"
            :show-install="Boolean(row.can_install)"
            :show-uninstall="Boolean(row.can_uninstall)"
            :show-update="communityUpdateEnabled(row)"
            install-label="安装"
            uninstall-label="删除"
            :update-label="communityUpdateLabel(row)"
            :latest-label="updateLatestLabel(row)"
            :status-label="communityStatusLabel(row)"
            :installed-version-label="communityInstalledVersionLabel(row)"
            :latest-version-label="communityLatestVersionLabel(row)"
            detail-label="仓库"
            :can-open="Boolean(row.repository_url)"
            @open="openCommunityReadme(row)"
            @install="installCommunity(row, false)"
            @update="updateCommunity(row, false)"
            @uninstall="uninstallCommunity(row, false)"
            @menu-action="handleCommunityMenu(row, $event)"
          />
        </div>
      </template>

      <template v-else>
        <div
          v-if="loading && !localRows.length"
          class="plugin-store-page__grid"
        >
          <PluginStoreCardSkeleton
            v-for="idx in 4"
            :key="idx"
          />
        </div>
        <div
          v-else-if="!filteredLocalRows.length"
          class="panel plugin-store-page__empty-panel"
        >
          <div class="panel__bd plugin-store-page__empty">
            <div
              class="plugin-store-page__empty-icon"
              aria-hidden="true"
            >
              <ConsoleNavIcon name="store" :size="22" />
            </div>
            <p class="plugin-store-page__empty-title">
              {{ searchQuery ? "没有匹配的插件" : "暂无本地插件" }}
            </p>
            <p class="muted plugin-store-page__empty-hint">
              {{ emptyHint }}
            </p>
            <p
              v-if="!searchQuery && !localRows.length"
              class="muted plugin-store-page__empty-link"
            >
              将插件文件夹放入 <code>local/plugins/&lt;ID&gt;/</code>，重启 Bot 后即出现在这里。
            </p>
          </div>
        </div>
        <div
          v-else
          class="plugin-store-page__grid"
        >
          <PluginStoreCard
            v-for="row in filteredLocalRows"
            :key="row.name"
            :title="localPluginTitle(row)"
            subtitle=""
            :description="localPluginDescription(row)"
            :author="localPluginAuthor(row)"
            :plugin-id="row.name"
            :icon-url="localPluginIconUrl(row)"
            :avatar-url="localPluginAvatarUrl(row)"
            :installed="true"
            :busy="false"
            :repo-url="localPluginRepoUrl(row)"
            meta-link-label="GitHub"
            :meta-link-url="localPluginRepoUrl(row)"
            :menu-items="[]"
            :show-install="false"
            :show-uninstall="false"
            :show-update="false"
            detail-label="配置"
            :can-open="true"
            @open="router.push({ name: 'plugins', params: { name: row.name } })"
          />
        </div>
      </template>
    </template>

    <UiDialog
      :open="detailOpen && !!detailTarget"
      title-id="plugin-store-detail-title"
      panel-class="plugin-store-page__detail-dialog"
      body-class="plugin-store-page__detail-bd"
      @close="closeDetail"
    >
      <template #header>
        <div class="console-modal__head-text">
          <h2
            id="plugin-store-detail-title"
            class="console-modal__title"
          >
            {{ detailTarget?.title }}
          </h2>
          <p class="console-modal__subtitle">
            <code>{{ detailTarget?.subtitle }}</code>
            <span
              v-if="detailTarget?.description"
              class="plugin-store-page__detail-sub"
            > · {{ detailTarget.description }}</span>
          </p>
          <p
            v-if="detailTarget?.kind === 'official' && detailTarget.official"
            class="plugin-store-page__detail-activation"
          >
            {{ officialActivationHint(detailTarget.official) }}
          </p>
          <p
            v-if="detailTarget?.kind === 'community' && detailTarget.community"
            class="plugin-store-page__detail-activation"
          >
            {{ communityActivationHint(detailTarget.community) }}
          </p>
        </div>
        <button
          type="button"
          class="console-modal__close"
          aria-label="关闭"
          @click="closeDetail"
        >
          ×
        </button>
      </template>
      <template v-if="detailTarget">
        <div
          class="plugin-store-page__detail-tabs console-view-toggle"
          role="tablist"
          aria-label="详情分栏"
        >
          <button
            type="button"
            role="tab"
            :class="{ 'is-on': detailTab === 'readme' }"
            :aria-selected="detailTab === 'readme'"
            @click="selectDetailTab('readme')"
          >
            README
          </button>
          <button
            type="button"
            role="tab"
            :class="{ 'is-on': detailTab === 'changelog' }"
            :aria-selected="detailTab === 'changelog'"
            @click="selectDetailTab('changelog')"
          >
            更新日志
          </button>
        </div>

        <template v-if="detailTab === 'readme'">
          <div
            v-if="detailReadmeLoading"
            class="plugin-store-page__detail-skeleton"
          >
            <div class="plugin-store-page__detail-skel-line" />
            <div class="plugin-store-page__detail-skel-line plugin-store-page__detail-skel-line--short" />
            <div class="plugin-store-page__detail-skel-line" />
            <div class="plugin-store-page__detail-skel-line plugin-store-page__detail-skel-line--medium" />
          </div>
          <p
            v-else-if="detailReadmeErr"
            class="muted plugin-store-page__detail-fallback"
          >
            {{ detailReadmeErr }}
          </p>
          <ReadmeMarkdown
            v-else-if="detailReadmeHtml"
            :html="detailReadmeHtml"
          />
          <p
            v-else
            class="muted plugin-store-page__detail-fallback"
          >
            暂无 README 内容
          </p>
        </template>

        <template v-else>
          <div
            v-if="detailChangelogLoading"
            class="plugin-store-page__detail-skeleton"
          >
            <div class="plugin-store-page__detail-skel-line" />
            <div class="plugin-store-page__detail-skel-line plugin-store-page__detail-skel-line--short" />
            <div class="plugin-store-page__detail-skel-line" />
            <div class="plugin-store-page__detail-skel-line plugin-store-page__detail-skel-line--medium" />
          </div>
          <p
            v-else-if="detailChangelogErr"
            class="muted plugin-store-page__detail-fallback"
          >
            {{ detailChangelogErr }}
          </p>
          <template v-else-if="detailChangelogHtml">
            <p
              v-if="detailChangelogSource === 'git'"
              class="muted plugin-store-page__changelog-note"
            >
              该插件未提供 CHANGELOG.md，以下为根据 git 提交历史自动生成。
            </p>
            <ReadmeMarkdown :html="detailChangelogHtml" />
          </template>
          <p
            v-else
            class="muted plugin-store-page__detail-fallback"
          >
            暂无更新日志
          </p>
        </template>
      </template>
      <template
        v-if="detailTarget"
        #footer
      >
        <div
          class="plugin-store-page__detail-foot"
          @click.stop
        >
          <template v-if="detailTarget.kind === 'official' && detailTarget.official">
            <UiButton
              v-if="detailTarget.official.can_install"
              variant="primary"
              :disabled="isOfficialInstallUpdateQueued(detailTarget.official.package, 'install')
                || (storeBusyPackage === detailTarget.official.package && storeBusyOfficialAction === 'install')"
              @click="installExtension(detailTarget.official, false)"
            >
              一键安装
            </UiButton>
            <UiButton
              v-if="officialUpdateEnabled(detailTarget.official)"
              variant="primary"
              :disabled="isOfficialInstallUpdateQueued(detailTarget.official.package, 'update')
                || (storeBusyPackage === detailTarget.official.package && storeBusyOfficialAction === 'update')"
              @click="updateExtension(detailTarget.official, false)"
            >
              更新
            </UiButton>
            <UiButton
              v-if="detailTarget.official.can_uninstall"
              variant="destructive"
              :disabled="storeBusyPackage === detailTarget.official.package && storeBusyOfficialAction === 'uninstall'"
              @click="uninstallExtension(detailTarget.official, false)"
            >
              卸载
            </UiButton>
          </template>
          <template v-else-if="detailTarget.kind === 'community' && detailTarget.community">
            <UiButton
              v-if="detailTarget.community.can_install"
              variant="primary"
              :disabled="isCommunityInstallUpdateQueued(detailTarget.community.plugin_id, 'install')
                || (storeBusyPluginId === detailTarget.community.plugin_id && storeBusyCommunityAction === 'install')"
              @click="installCommunity(detailTarget.community, false)"
            >
              安装
            </UiButton>
            <UiButton
              v-if="communityUpdateEnabled(detailTarget.community)"
              variant="primary"
              :disabled="isCommunityInstallUpdateQueued(detailTarget.community.plugin_id, 'update')
                || (storeBusyPluginId === detailTarget.community.plugin_id && storeBusyCommunityAction === 'update')"
              @click="updateCommunity(detailTarget.community, false)"
            >
              更新
            </UiButton>
            <UiButton
              v-if="detailTarget.community.can_uninstall"
              variant="destructive"
              :disabled="storeBusyPluginId === detailTarget.community.plugin_id && storeBusyCommunityAction === 'uninstall'"
              @click="uninstallCommunity(detailTarget.community, false)"
            >
              删除
            </UiButton>
          </template>
          <UiButton
            v-if="detailTarget.repositoryUrl"
            variant="outline"
            :href="detailTarget.repositoryUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            打开仓库
          </UiButton>
        </div>
      </template>
    </UiDialog>

    <UiDialog
      :open="gitInstallOpen"
      title-id="plugin-store-git-install-title"
      panel-class="plugin-store-page__git-dialog"
      body-class="plugin-store-page__git-bd"
      @close="closeGitInstallDialog"
    >
      <template #header>
        <div class="console-modal__head-text">
          <h2
            id="plugin-store-git-install-title"
            class="console-modal__title"
          >
            从 Git 安装
          </h2>
          <p class="console-modal__subtitle">
            无需收录到社区索引，直接 clone 到 <code>local/plugins/&lt;ID&gt;/</code>
          </p>
        </div>
        <button
          type="button"
          class="console-modal__close"
          aria-label="关闭"
          :disabled="gitInstallBusy"
          @click="closeGitInstallDialog"
        >
          ×
        </button>
      </template>
      <div class="plugin-store-page__git-form">
        <label class="plugin-store-page__git-field">
          <span class="plugin-store-page__git-label">插件 ID</span>
          <UiInput
            v-model="gitPluginId"
            class="plugin-store-page__git-input"
            type="text"
            autocomplete="off"
            spellcheck="false"
            placeholder="小写字母开头，如 my_plugin"
            :disabled="gitInstallBusy"
          />
          <span class="muted plugin-store-page__git-hint">须与目录名一致，安装路径为 local/plugins/&lt;ID&gt;/</span>
        </label>
        <label class="plugin-store-page__git-field">
          <span class="plugin-store-page__git-label">Git 仓库</span>
          <UiInput
            v-model="gitRepositoryUrl"
            class="plugin-store-page__git-input"
            type="url"
            autocomplete="off"
            spellcheck="false"
            placeholder="https://github.com/org/repo.git"
            :disabled="gitInstallBusy"
          />
        </label>
        <label class="plugin-store-page__git-field">
          <span class="plugin-store-page__git-label">分支 / Tag</span>
          <UiInput
            v-model="gitRef"
            class="plugin-store-page__git-input"
            type="text"
            autocomplete="off"
            spellcheck="false"
            placeholder="main"
            :disabled="gitInstallBusy"
          />
        </label>
      </div>
      <template #footer>
        <div
          class="plugin-store-page__git-foot"
          @click.stop
        >
          <UiButton
            variant="outline"
            :disabled="gitInstallBusy"
            @click="closeGitInstallDialog"
          >
            取消
          </UiButton>
          <UiButton
            variant="primary"
            :disabled="!gitInstallValid || gitInstallBusy"
            @click="installCommunityFromGit(false)"
          >
            {{ gitInstallBusy ? "安装中…" : "安装" }}
          </UiButton>
          <UiButton
            v-if="communityRestartAvailable"
            variant="primary"
            :disabled="!gitInstallValid || gitInstallBusy"
            @click="installCommunityFromGit(true)"
          >
            安装并重启
          </UiButton>
        </div>
      </template>
    </UiDialog>

    <GitMirrorDialog
      :open="gitMirrorOpen"
      @close="gitMirrorOpen = false"
    />
  </div>
</template>

<style scoped>
.plugin-store-page__detail-tabs {
  margin-bottom: 14px;
}
.plugin-store-page__changelog-note {
  margin: 0 0 10px;
  font-size: 13px;
}
@media (max-width: 560px) {
  .plugin-store-page__detail-tabs {
    width: 100%;
  }
  .plugin-store-page__detail-tabs button {
    flex: 1 1 0;
  }
}
.plugin-store-page__action-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  margin-bottom: 8px;
}
.plugin-store-page__action-hint .plugin-store-page__hint {
  margin: 0;
  flex: 1 1 auto;
}
.plugin-store-page__action-progress {
  flex: 1 1 100%;
  height: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 24%, transparent);
  overflow: hidden;
  position: relative;
}
.plugin-store-page__action-progress::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 42%;
  border-radius: inherit;
  background: var(--accent);
  animation: plugin-store-action-progress 1.1s ease-in-out infinite;
}
@keyframes plugin-store-action-progress {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(280%); }
}
@media (max-width: 560px) {
  .plugin-store-page__action-hint {
    flex-direction: column;
    align-items: stretch;
  }
  .plugin-store-page__action-hint > .btn {
    width: 100%;
  }
}
</style>
