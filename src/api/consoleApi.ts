import { isAxiosError } from "axios";
import { DB_BACKUP_TIMEOUT_MS, DB_HEAVY_READ_TIMEOUT_MS, http } from "./http";
import {
  consoleOpenapiDelete,
  consoleOpenapiGet,
  consoleOpenapiPatch,
  consoleOpenapiPost,
  consoleOpenapiPut,
  type ConsoleOpenapiPaths,
} from "./consoleOpenapiClient";
import { notifyInstancesCatalogUpdated } from "@/utils/catalogSync";
import { protocolAccountsSignature } from "@/utils/protocolUi";
import type { AiExtensionLogKind } from "@/config/aiConstants";
import type {
  UpdateCheckData,
  UpdateCheckAllData,
  UpdateApplyJobStartData,
  UpdateApplyJobSnapshot,
  BotUpdateCheckData,
  SystemRestartData,
  BotConfigMigrationCheckData,
  BotConfigMigrationApplyData,
  BotConfigPublic,
  BotRow,
  DbBackupInfo,
  DbBackupJobData,
  DbBackupBrowseData,
  DbBackupDeleteResult,
  DbBackupRunsData,
  DbBackendConfigData,
  DbBackendKind,
  DbBackendMongoConfig,
  DbBackendPostgresConfig,
  DbBackendProbeResult,
  DbBackendSaveResult,
  DbHealthData,
  DbMigrateMongoPgInfo,
  DbMigrateMongoPgJob,
  DbOverviewData,
  DbTableRowsData,
  DbTablesData,
  FriendListData,
  FriendOverviewData,
  RequestOverviewData,
  GroupConfigPublic,
  GroupListData,
  InstancesData,
  NapcatAccountRow,
  NapcatManagerSnapshot,
  LogScope,
  LogsData,
  PluginRow,
  OfficialExtensionRow,
  OfficialExtensionInstallResult,
  CommunityPluginStoreData,
  CommunityPluginActionResult,
  SystemData,
  UserConfigPublic,
  AiExtensionConfig,
  AiExtensionTestData,
  AiExtensionLogsData,
  AiProxyResult,
  GlobalPluginDisableData,
  GroupFleetWhitelistData,
  GroupFleetWhitelistEntry,
  HelpMenuVisibilityData,
  PluginConfigData,
  ExtensionInstallJobData,
  PluginCapabilitiesData,
  PluginGovernanceBody,
  PluginGovernanceData,
  PluginConfigCheckResult,
  CommonConfigSectionMeta,
  LlmModelAdminModelResult,
  LlmModelAdminStatus,
  LlmEmbeddingStatus,
  LlmRuntimeOverviewData,
  LlmLocalRoutingConfig,
  LlmProvidersConfig,
  LlmProvidersSaveResult,
  LlmProviderModelsResult,
  LlmProviderTestResult,
  LlmHistorySessionDetailData,
  LlmHistoryBehaviorRun,
  LlmRuntimeReplayResult,
  LlmRuntimeDebugData,
  LlmBehaviorPattern,
  LlmBehaviorPatternsData,
  LlmBehaviorRunsData,
  LlmHistorySessionsData,
  LlmRepeaterFeedbackData,
  LlmRepeaterFeedbackEntry,
  LlmRepeaterFeedbackSummary,
  LlmPromotionCandidate,
  LlmPromotionCandidatesData,
  ConversationKernelStatus,
  ConversationKernelKnowledgeSourcesData,
  KnowledgeSourceDetail,
  KnowledgeSourceRetrieveData,
  LlmToolCatalogData,
  ConversationKernelMemoryData,
  ConversationKernelRelationshipNotesData,
  ConversationKernelTracesData,
  LlmTaskStatsData,
  PersonaObserveData,
  SceneDialogueExample,
  SceneDialogueExamplesData,
  MessageStatsData,
  CommunityStatsData,
  CommunityConnectivityCheckData,
  CommunityCorpusHotData,
  CommunityHotMode,
  CommunityHotPeriod,
  CommunityHotTab,
  CorpusStatusData,
  FederationOnboardingData,
  ConsoleDailyStatsData,
  PluginRunStatsData,
  HomeOverviewData,
  IngressDispatchData,
  IngressDispatchHistoryData,
  ShardObservabilityData,
  ConsoleLoginChangeResult,
  ConsoleSetupStatus,
  GitMirrorInfo,
  GitMirrorApplySummary,
  GitMirrorProbeResult,
} from "./pallasTypes";

/**
 * 控制台只读资源跨页策略（内存级）：
 * - `/instances`、`/plugins`、`/bots`：新鲜期内直接返回；过期先返回旧快照并单飞刷新；写操作后对应 invalidate*。
 * - `/system`：不做 TTL 缓存（首页 5s 轮询需实时），仅合并并发请求。
 */
const CATALOG_FRESH_MS = 45_000;

let instancesCache: { data: InstancesData; ts: number } | null = null;
let instancesInflight: Promise<InstancesData> | null = null;
/** 写操作或强制刷新后递增，丢弃过期的在途响应写回 */
let instancesFetchGen = 0;
let lastPatchedProtocolAccountsSig = "";

function touchInstancesCache(data: InstancesData) {
  instancesCache = { data, ts: Date.now() };
  notifyInstancesCatalogUpdated();
}

/** 同步读取上次成功的实例快照（供首屏立即铺 UI，不等网络） */
export function peekInstancesCache(): InstancesData | null {
  return instancesCache?.data ?? null;
}

/** 实例缓存年龄（毫秒）；无缓存时返回 null */
export function peekInstancesCacheAgeMs(): number | null {
  if (!instancesCache) return null;
  return Date.now() - instancesCache.ts;
}

/** 数据库 Bot 配置等变更后调用，避免旧 /instances 缓存误导 */
export function invalidateInstancesCache() {
  instancesCache = null;
  instancesInflight = null;
  instancesFetchGen++;
  lastPatchedProtocolAccountsSig = "";
}

function patchProtocolSnapAccounts(
  snap: NapcatManagerSnapshot | null | undefined,
  accounts: NapcatAccountRow[],
): NapcatManagerSnapshot | null {
  if (!snap) return null;
  return { ...snap, accounts };
}

/** 协议端 /api/accounts 轮询后合并进全局 /instances 缓存，供其它 keep-alive 页同步 */
export function patchInstancesProtocolAccounts(
  accounts: NapcatAccountRow[],
  base?: InstancesData | null,
): void {
  const sig = protocolAccountsSignature(accounts);
  if (sig === lastPatchedProtocolAccountsSig) return;
  lastPatchedProtocolAccountsSig = sig;
  const cur = base ?? instancesCache?.data ?? null;
  if (!cur) return;
  const next: InstancesData = { ...cur };
  if (cur.pallas_protocol) {
    next.pallas_protocol = patchProtocolSnapAccounts(cur.pallas_protocol, accounts);
  } else if (cur.napcat) {
    next.napcat = patchProtocolSnapAccounts(cur.napcat, accounts);
  } else {
    return;
  }
  touchInstancesCache(next);
}

let instancesCatalogRefreshInflight: Promise<InstancesData> | null = null;

/** 路由切换等场景：单飞强制刷新 /instances */
export function refreshInstancesCatalogGlobal(): Promise<InstancesData> {
  if (instancesCatalogRefreshInflight) {
    return instancesCatalogRefreshInflight;
  }
  instancesCatalogRefreshInflight = fetchInstances({ bypassCache: true }).finally(() => {
    instancesCatalogRefreshInflight = null;
  });
  return instancesCatalogRefreshInflight;
}

async function fetchInstancesFromNetwork(): Promise<InstancesData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/instances"]["get"]>("/instances")) as InstancesData;
}

export type FetchInstancesOptions = {
  /** 跳过内存缓存并强制请求（用户刷新、写操作后等） */
  bypassCache?: boolean;
};

let systemInflight: Promise<SystemData> | null = null;

export async function fetchSystem(): Promise<SystemData> {
  if (!systemInflight) {
    systemInflight = (async () =>
      (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/system"]["get"]>("/system")) as SystemData)().finally(
      () => {
        systemInflight = null;
      },
    );
  }
  return systemInflight;
}

let pluginsCache: { data: PluginRow[]; ts: number } | null = null;
let pluginsInflight: Promise<PluginRow[]> | null = null;
let pluginsFetchGen = 0;

function touchPluginsCache(data: PluginRow[]) {
  pluginsCache = { data, ts: Date.now() };
}

export function peekPluginsCache(): PluginRow[] | null {
  return pluginsCache?.data ?? null;
}

export function invalidatePluginsCache() {
  pluginsCache = null;
  pluginsInflight = null;
  pluginsFetchGen++;
}

async function fetchPluginsFromNetwork(): Promise<PluginRow[]> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/plugins"]["get"]>("/plugins")) as PluginRow[];
}

export async function fetchPluginCapabilities(): Promise<PluginCapabilitiesData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/plugins/capabilities"]["get"]>(
    "/plugins/capabilities",
  )) as PluginCapabilitiesData;
}

export type FetchPluginsOptions = {
  bypassCache?: boolean;
};

export async function fetchPlugins(opts?: FetchPluginsOptions): Promise<PluginRow[]> {
  const bypass = Boolean(opts?.bypassCache);
  const now = Date.now();

  if (bypass) {
    const gen = pluginsFetchGen;
    const d = await fetchPluginsFromNetwork();
    if (gen === pluginsFetchGen) touchPluginsCache(d);
    return d;
  }

  if (pluginsInflight) {
    return pluginsInflight;
  }

  if (pluginsCache) {
    const age = now - pluginsCache.ts;
    if (age < CATALOG_FRESH_MS) {
      return pluginsCache.data;
    }
    const snap = pluginsCache.data;
    const gen = pluginsFetchGen;
    pluginsInflight = fetchPluginsFromNetwork()
      .then((d) => {
        if (gen === pluginsFetchGen) touchPluginsCache(d);
        return d;
      })
      .finally(() => {
        pluginsInflight = null;
      });
    return snap;
  }

  const gen = pluginsFetchGen;
  pluginsInflight = fetchPluginsFromNetwork()
    .then((d) => {
      if (gen === pluginsFetchGen) touchPluginsCache(d);
      return d;
    })
    .finally(() => {
      pluginsInflight = null;
    });
  return pluginsInflight;
}

/** 商店列表可能顺带刷新资源快照，冷启动时超过默认 20s */
export const PLUGIN_STORE_READ_TIMEOUT_MS = 90_000;

export async function fetchOfficialExtensions(options?: {
  skipAssets?: boolean;
}): Promise<OfficialExtensionRow[]> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/plugins/official-extensions"]["get"]>(
    "/plugins/official-extensions",
    {
      params: options?.skipAssets ? { skip_assets: 1 } : undefined,
      timeout: PLUGIN_STORE_READ_TIMEOUT_MS,
    },
  )) as OfficialExtensionRow[];
}

const EXTENSION_INSTALL_TIMEOUT_MS = 620_000;

export async function installOfficialExtension(
  packageName: string,
  options?: { restart?: boolean },
): Promise<OfficialExtensionInstallResult> {
  const out = await consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/plugins/official-extensions/install"]["post"]
  >(
    "/plugins/official-extensions/install",
    { package: packageName, restart: Boolean(options?.restart) },
    { timeout: EXTENSION_INSTALL_TIMEOUT_MS },
  );
  invalidatePluginsCache();
  return out as OfficialExtensionInstallResult;
}

export async function installOfficialExtensionAsync(
  packageName: string,
  options?: { restart?: boolean },
): Promise<ExtensionInstallJobData> {
  return consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/plugins/official-extensions/install-async"]["post"]
  >("/plugins/official-extensions/install-async", {
    package: packageName,
    restart: Boolean(options?.restart),
  });
}

export function openPluginInstallJobEventSource(jobId: string): EventSource {
  const root = ((import.meta.env.BASE_URL as string) || "/pallas/").replace(/\/$/, "");
  const apiBase = `${root}/api`;
  return new EventSource(
    `${apiBase}/plugins/store-jobs/${encodeURIComponent(jobId)}/stream`,
    { withCredentials: true },
  );
}

/** @deprecated 使用 openPluginInstallJobEventSource */
export function openExtensionInstallJobEventSource(jobId: string): EventSource {
  return openPluginInstallJobEventSource(jobId);
}

export async function uninstallOfficialExtension(
  packageName: string,
  options?: { restart?: boolean },
): Promise<OfficialExtensionInstallResult> {
  const out = await consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/plugins/official-extensions/uninstall"]["post"]
  >(
    "/plugins/official-extensions/uninstall",
    { package: packageName, restart: Boolean(options?.restart) },
    { timeout: 120_000 },
  );
  invalidatePluginsCache();
  return out as OfficialExtensionInstallResult;
}

export async function updateOfficialExtension(
  packageName: string,
  options?: { restart?: boolean },
): Promise<OfficialExtensionInstallResult> {
  const out = await consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/plugins/official-extensions/update"]["post"]
  >(
    "/plugins/official-extensions/update",
    { package: packageName, restart: Boolean(options?.restart) },
    { timeout: 600_000 },
  );
  invalidatePluginsCache();
  return out as OfficialExtensionInstallResult;
}

export async function updateOfficialExtensionAsync(
  packageName: string,
  options?: { restart?: boolean },
): Promise<ExtensionInstallJobData> {
  return (await consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/plugins/official-extensions/update-async"]["post"]
  >("/plugins/official-extensions/update-async", {
    package: packageName,
    restart: Boolean(options?.restart),
  })) as ExtensionInstallJobData;
}

export async function uninstallOfficialExtensionAsync(
  packageName: string,
  options?: { restart?: boolean },
): Promise<ExtensionInstallJobData> {
  return (await consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/plugins/official-extensions/uninstall-async"]["post"]
  >("/plugins/official-extensions/uninstall-async", {
    package: packageName,
    restart: Boolean(options?.restart),
  })) as ExtensionInstallJobData;
}

export async function fetchCommunityPluginStore(options?: {
  refresh?: boolean;
  skipAssets?: boolean;
}): Promise<CommunityPluginStoreData> {
  const params: Record<string, number> = {};
  if (options?.refresh) params.refresh = 1;
  if (options?.skipAssets) params.skip_assets = 1;
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/plugins/community-store"]["get"]>(
    "/plugins/community-store",
    {
      params: Object.keys(params).length ? params : undefined,
      timeout: PLUGIN_STORE_READ_TIMEOUT_MS,
    },
  )) as CommunityPluginStoreData;
}

export interface PluginUpdateSnapshotResult {
  checked_at?: number | null;
  community_count?: number;
  official_count?: number;
}

export interface PluginStoreRefreshResult {
  store_assets: PluginUpdateSnapshotResult;
  update_snapshot: PluginUpdateSnapshotResult;
}

export interface PluginStoreReadmeResult {
  kind: "official" | "community";
  id: string;
  markdown: string;
}

export interface PluginBundledReadmeResult {
  plugin: string;
  relative_path: string;
  markdown: string;
  source: "bundled";
}

export interface PluginStoreChangelogResult {
  kind: "official" | "community";
  id: string;
  markdown: string;
  /** changelog = 仓库 CHANGELOG.md；git = 由本地提交历史自动生成。 */
  source: "changelog" | "git";
}

export async function fetchPluginBundledReadme(pluginName: string): Promise<PluginBundledReadmeResult> {
  return (await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/plugins/{plugin_name}/readme"]["get"]
  >(`/plugins/${encodeURIComponent(pluginName)}/readme`)) as PluginBundledReadmeResult;
}

export async function refreshPluginUpdateSnapshot(): Promise<PluginUpdateSnapshotResult> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/plugins/update-snapshot/refresh"]["post"]>(
    "/plugins/update-snapshot/refresh",
    {},
    { timeout: 120_000 },
  );
}

export async function refreshPluginStore(): Promise<PluginStoreRefreshResult> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/plugins/store/refresh"]["post"]>(
    "/plugins/store/refresh",
    {},
    { timeout: 120_000 },
  );
}

export async function fetchPluginStoreReadme(
  kind: "official" | "community",
  id: string,
  options?: { repositoryUrl?: string | null },
): Promise<string> {
  const repositoryUrl = (options?.repositoryUrl || "").trim();
  let apiError: unknown = null;
  try {
    const data = (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/plugins/store/readme"]["get"]>(
      "/plugins/store/readme",
      {
        params: {
          kind,
          id,
          ...(repositoryUrl ? { repository_url: repositoryUrl } : {}),
        },
      },
    )) as PluginStoreReadmeResult;
    const markdown = (data.markdown || "").trim();
    if (markdown) return data.markdown;
  } catch (e) {
    apiError = e;
  }
  if (repositoryUrl) {
    const { fetchGithubReadme } = await import("@/utils/pluginReadme");
    return fetchGithubReadme(repositoryUrl);
  }
  if (apiError) throw apiError;
  throw new Error("README 不可用");
}

export async function fetchPluginStoreChangelog(
  kind: "official" | "community",
  id: string,
  options?: { repositoryUrl?: string | null },
): Promise<PluginStoreChangelogResult> {
  const repositoryUrl = (options?.repositoryUrl || "").trim();
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/plugins/store/changelog"]["get"]>(
    "/plugins/store/changelog",
    {
      params: {
        kind,
        id,
        ...(repositoryUrl ? { repository_url: repositoryUrl } : {}),
      },
    },
  )) as PluginStoreChangelogResult;
}

const COMMUNITY_INSTALL_TIMEOUT_MS = 320_000;

export async function installCommunityPluginAsync(
  pluginId: string,
  options?: { restart?: boolean; repositoryUrl?: string; ref?: string },
): Promise<ExtensionInstallJobData> {
  return consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/plugins/community-plugins/install-async"]["post"]
  >("/plugins/community-plugins/install-async", {
    plugin_id: pluginId,
    repository_url: options?.repositoryUrl,
    ref: options?.ref,
    restart: Boolean(options?.restart),
  });
}

export async function installCommunityPlugin(
  pluginId: string,
  options?: { restart?: boolean; repositoryUrl?: string; ref?: string },
): Promise<CommunityPluginActionResult> {
  const out = await consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/plugins/community-plugins/install"]["post"]
  >(
    "/plugins/community-plugins/install",
    {
      plugin_id: pluginId,
      repository_url: options?.repositoryUrl,
      ref: options?.ref,
      restart: Boolean(options?.restart),
    },
    { timeout: COMMUNITY_INSTALL_TIMEOUT_MS },
  );
  invalidatePluginsCache();
  return out as CommunityPluginActionResult;
}

export async function uninstallCommunityPlugin(
  pluginId: string,
  options?: { restart?: boolean },
): Promise<CommunityPluginActionResult> {
  const out = await consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/plugins/community-plugins/uninstall"]["post"]
  >(
    "/plugins/community-plugins/uninstall",
    { plugin_id: pluginId, restart: Boolean(options?.restart) },
    { timeout: 120_000 },
  );
  invalidatePluginsCache();
  return out as CommunityPluginActionResult;
}

export async function updateCommunityPlugin(
  pluginId: string,
  options?: { restart?: boolean; ref?: string },
): Promise<CommunityPluginActionResult> {
  const out = await consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/plugins/community-plugins/update"]["post"]
  >(
    "/plugins/community-plugins/update",
    {
      plugin_id: pluginId,
      ref: options?.ref,
      restart: Boolean(options?.restart),
    },
    { timeout: COMMUNITY_INSTALL_TIMEOUT_MS },
  );
  invalidatePluginsCache();
  return out as CommunityPluginActionResult;
}

export async function updateCommunityPluginAsync(
  pluginId: string,
  options?: { restart?: boolean; ref?: string },
): Promise<ExtensionInstallJobData> {
  return (await consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/plugins/community-plugins/update-async"]["post"]
  >("/plugins/community-plugins/update-async", {
    plugin_id: pluginId,
    ref: options?.ref,
    restart: Boolean(options?.restart),
  })) as ExtensionInstallJobData;
}

export async function uninstallCommunityPluginAsync(
  pluginId: string,
  options?: { restart?: boolean },
): Promise<ExtensionInstallJobData> {
  return (await consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/plugins/community-plugins/uninstall-async"]["post"]
  >("/plugins/community-plugins/uninstall-async", {
    plugin_id: pluginId,
    restart: Boolean(options?.restart),
  })) as ExtensionInstallJobData;
}

let botsCache: { data: BotRow[]; ts: number } | null = null;
let botsInflight: Promise<BotRow[]> | null = null;
let botsFetchGen = 0;

function touchBotsCache(data: BotRow[]) {
  botsCache = { data, ts: Date.now() };
}

export function peekBotsCache(): BotRow[] | null {
  return botsCache?.data ?? null;
}

export function invalidateBotsCache() {
  botsCache = null;
  botsInflight = null;
  botsFetchGen++;
}

async function fetchBotsFromNetwork(): Promise<BotRow[]> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/bots"]["get"]>("/bots")) as BotRow[];
}

export type FetchBotsOptions = {
  bypassCache?: boolean;
};

export async function fetchBots(opts?: FetchBotsOptions): Promise<BotRow[]> {
  const bypass = Boolean(opts?.bypassCache);
  const now = Date.now();

  if (bypass) {
    const gen = botsFetchGen;
    const d = await fetchBotsFromNetwork();
    if (gen === botsFetchGen) touchBotsCache(d);
    return d;
  }

  if (botsInflight) {
    return botsInflight;
  }

  if (botsCache) {
    const age = now - botsCache.ts;
    if (age < CATALOG_FRESH_MS) {
      return botsCache.data;
    }
    const snap = botsCache.data;
    const gen = botsFetchGen;
    botsInflight = fetchBotsFromNetwork()
      .then((d) => {
        if (gen === botsFetchGen) touchBotsCache(d);
        return d;
      })
      .finally(() => {
        botsInflight = null;
      });
    return snap;
  }

  const gen = botsFetchGen;
  botsInflight = fetchBotsFromNetwork()
    .then((d) => {
      if (gen === botsFetchGen) touchBotsCache(d);
      return d;
    })
    .finally(() => {
      botsInflight = null;
    });
  return botsInflight;
}

export function buildHelpPreviewUrl(opts: {
  level?: "menu" | "plugin" | "function";
  page?: number;
  plugin?: string;
  function?: string;
  cacheBust?: number;
}): string {
  const base = (import.meta.env.BASE_URL as string) || "/pallas/";
  const apiBase = `${base.replace(/\/$/, "")}/api`;
  const params = new URLSearchParams();
  params.set("level", opts.level || "menu");
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  if (opts.plugin) params.set("plugin", opts.plugin);
  if (opts.function) params.set("function", opts.function);
  if (opts.cacheBust) params.set("_", String(opts.cacheBust));
  return `${apiBase}/help/preview?${params.toString()}`;
}

export async function fetchHelpPreviewBlob(opts: {
  level?: "menu" | "plugin" | "function";
  page?: number;
  plugin?: string;
  function?: string;
}): Promise<Blob> {
  const level = opts.level || "menu";
  const params = new URLSearchParams();
  params.set("level", level);
  if (level === "menu" && opts.page && opts.page > 1) {
    params.set("page", String(opts.page));
  }
  if (level !== "menu" && opts.plugin) {
    params.set("plugin", opts.plugin);
  }
  if (level === "function" && opts.function) {
    params.set("function", opts.function);
  }
  try {
    const { data } = await http.get<Blob>(`/help/preview?${params.toString()}`, {
      responseType: "blob",
      timeout: 120_000,
    });
    return data;
  } catch (e) {
    if (isAxiosError(e) && e.response?.data instanceof Blob) {
      const text = await e.response.data.text();
      try {
        const parsed = JSON.parse(text) as { detail?: string };
        if (typeof parsed.detail === "string" && parsed.detail.trim()) {
          throw new Error(parsed.detail.trim());
        }
      } catch (inner) {
        if (inner instanceof Error && inner.message !== text) throw inner;
      }
      if (text.trim()) throw new Error(text.trim());
    }
    throw e;
  }
}

export async function fetchPluginsHelpMenuVisibility(): Promise<HelpMenuVisibilityData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/plugins/help-menu-visibility"]["get"]>(
    "/plugins/help-menu-visibility",
  )) as HelpMenuVisibilityData;
}

export async function putPluginsHelpMenuVisibility(hiddenPlugins: string[]): Promise<{ hidden_plugins: string[] }> {
  const out = await consoleOpenapiPut<ConsoleOpenapiPaths["/pallas/api/plugins/help-menu-visibility"]["put"]>(
    "/plugins/help-menu-visibility",
    { hidden_plugins: hiddenPlugins },
  );
  invalidatePluginsCache();
  return out;
}

export async function fetchPluginsGlobalDisable(): Promise<GlobalPluginDisableData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/plugins/global-disable"]["get"]>(
    "/plugins/global-disable",
  )) as GlobalPluginDisableData;
}

export async function putPluginsGlobalDisable(
  disabledPlugins: string[],
): Promise<GlobalPluginDisableData> {
  const out = (await consoleOpenapiPut<ConsoleOpenapiPaths["/pallas/api/plugins/global-disable"]["put"]>(
    "/plugins/global-disable",
    { disabled_plugins: disabledPlugins },
  )) as GlobalPluginDisableData;
  invalidatePluginsCache();
  return out;
}

export async function fetchPluginsGroupFleetWhitelist(): Promise<GroupFleetWhitelistData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/plugins/group-fleet-whitelist"]["get"]>(
    "/plugins/group-fleet-whitelist",
  )) as GroupFleetWhitelistData;
}

export async function putPluginsGroupFleetWhitelist(
  entries: GroupFleetWhitelistEntry[],
): Promise<GroupFleetWhitelistData> {
  const out = (await consoleOpenapiPut<ConsoleOpenapiPaths["/pallas/api/plugins/group-fleet-whitelist"]["put"]>(
    "/plugins/group-fleet-whitelist",
    { entries },
  )) as GroupFleetWhitelistData;
  invalidatePluginsCache();
  return out;
}

export async function fetchPluginConfig(pluginName: string): Promise<PluginConfigData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/plugins/{plugin_name}/config"]["get"]>(
    `/plugins/${encodeURIComponent(pluginName)}/config`,
  )) as unknown as PluginConfigData;
}

export async function putPluginConfig(
  pluginName: string,
  values: Record<string, unknown>,
): Promise<PluginConfigData> {
  const out = (await consoleOpenapiPut<ConsoleOpenapiPaths["/pallas/api/plugins/{plugin_name}/config"]["put"]>(
    `/plugins/${encodeURIComponent(pluginName)}/config`,
    { values },
  )) as unknown as PluginConfigData;
  invalidatePluginsCache();
  return out;
}

export async function fetchPluginConfigRaw(pluginName: string): Promise<string> {
  const out = await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/plugins/{plugin_name}/config/raw"]["get"]
  >(`/plugins/${encodeURIComponent(pluginName)}/config/raw`);
  return out.toml;
}

export async function putPluginConfigRaw(pluginName: string, toml: string): Promise<PluginConfigData> {
  const out = (await consoleOpenapiPut<ConsoleOpenapiPaths["/pallas/api/plugins/{plugin_name}/config/raw"]["put"]>(
    `/plugins/${encodeURIComponent(pluginName)}/config/raw`,
    { toml },
  )) as unknown as PluginConfigData;
  invalidatePluginsCache();
  return out;
}

export async function postPluginConfigCheck(
  pluginName: string,
  values?: Record<string, unknown>,
): Promise<PluginConfigCheckResult> {
  return (await consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/plugins/{plugin_name}/config-check"]["post"]>(
    `/plugins/${encodeURIComponent(pluginName)}/config-check`,
    values ? { values } : {},
  )) as PluginConfigCheckResult;
}

export async function fetchPluginGovernance(pluginName: string): Promise<PluginGovernanceData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/plugins/{plugin_name}/governance"]["get"]>(
    `/plugins/${encodeURIComponent(pluginName)}/governance`,
  )) as unknown as PluginGovernanceData;
}

export async function putPluginGovernance(
  pluginName: string,
  body: PluginGovernanceBody,
): Promise<PluginGovernanceData> {
  const out = (await consoleOpenapiPut<ConsoleOpenapiPaths["/pallas/api/plugins/{plugin_name}/governance"]["put"]>(
    `/plugins/${encodeURIComponent(pluginName)}/governance`,
    body,
  )) as unknown as PluginGovernanceData;
  invalidatePluginsCache();
  return out;
}

export async function fetchCommonConfigSections(): Promise<CommonConfigSectionMeta[]> {
  return consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/common-config/sections"]["get"]>(
    "/common-config/sections",
  );
}

export async function fetchCommonConfig(sectionId: string): Promise<PluginConfigData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/common-config/{section_id}"]["get"]>(
    `/common-config/${encodeURIComponent(sectionId)}`,
  )) as unknown as PluginConfigData;
}

export async function putCommonConfig(
  sectionId: string,
  values: Record<string, unknown>,
): Promise<PluginConfigData> {
  return (await consoleOpenapiPut<ConsoleOpenapiPaths["/pallas/api/common-config/{section_id}"]["put"]>(
    `/common-config/${encodeURIComponent(sectionId)}`,
    { values },
  )) as unknown as PluginConfigData;
}

export async function fetchCommonConfigRaw(sectionId: string): Promise<string> {
  const out = await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/common-config/{section_id}/raw"]["get"]>(
    `/common-config/${encodeURIComponent(sectionId)}/raw`,
  );
  return out.toml;
}

export async function putCommonConfigRaw(sectionId: string, toml: string): Promise<PluginConfigData> {
  return (await consoleOpenapiPut<ConsoleOpenapiPaths["/pallas/api/common-config/{section_id}/raw"]["put"]>(
    `/common-config/${encodeURIComponent(sectionId)}/raw`,
    { toml },
  )) as unknown as PluginConfigData;
}

export async function postServiceGatewaysConnectivityCheck(
  values?: Record<string, unknown>,
): Promise<PluginConfigCheckResult> {
  return (await consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/common-config/service_gateways/connectivity-check"]["post"]
  >("/common-config/service_gateways/connectivity-check", values ? { values } : {})) as PluginConfigCheckResult;
}

export async function fetchLlmProvidersConfig(): Promise<LlmProvidersConfig> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/common-config/llm/providers"]["get"]>(
    "/common-config/llm/providers",
  )) as LlmProvidersConfig;
}

export async function fetchLlmLocalRoutingConfig(): Promise<LlmLocalRoutingConfig> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/common-config/llm/local-routing"]["get"]>(
    "/common-config/llm/local-routing",
  )) as LlmLocalRoutingConfig;
}

export async function putLlmLocalRoutingConfig(
  body: LlmLocalRoutingConfig,
): Promise<LlmLocalRoutingConfig> {
  return (await consoleOpenapiPut<ConsoleOpenapiPaths["/pallas/api/common-config/llm/local-routing"]["put"]>(
    "/common-config/llm/local-routing",
    body,
  )) as LlmLocalRoutingConfig;
}

export async function putLlmProvidersConfig(
  body: LlmProvidersConfig,
): Promise<LlmProvidersSaveResult> {
  const payload = {
    providers: body.providers.map((row) => {
      const raw = row as {
        id: string;
        kind?: string;
        base_url?: string;
        api_key?: string;
        api_keys?: string[];
        api_key_env?: string;
        default_model?: string;
        enabled?: boolean;
        task_models?: Record<string, string>;
        capabilities?: string[];
        model_effort?: string;
        request_method?: string;
      };
      const apiKeys = (Array.isArray(raw.api_keys) ? raw.api_keys : [])
        .map((k: string) => String(k || "").trim())
        .filter(Boolean);
      const apiKey = String(raw.api_key ?? "").trim() || apiKeys[0] || "";
      const apiKeyEnv = String(raw.api_key_env ?? "").trim();
      const item: Record<string, unknown> = {
        id: raw.id,
        kind: raw.kind,
        base_url: raw.base_url,
        api_key_env: apiKeyEnv,
        default_model: raw.default_model,
        enabled: raw.enabled,
        task_models: raw.task_models,
        capabilities: Array.isArray(raw.capabilities) ? raw.capabilities : [],
        model_effort: raw.model_effort ?? "",
        request_method: raw.request_method || "chat_completions",
      };
      // 空密钥不传，避免后端误清空已保存密钥
      if (apiKeys.length) item.api_keys = apiKeys;
      if (apiKey) item.api_key = apiKey;
      return item;
    }),
    routing: body.routing,
  };
  return consoleOpenapiPut(
    "/common-config/llm/providers",
    payload,
  ) as Promise<LlmProvidersSaveResult>;
}

/** 只保存单个提供方，避免整表 PUT 误擦其他提供方已存密钥。 */
export async function putLlmProvider(row: {
  id: string;
  kind?: string;
  base_url?: string;
  api_key?: string;
  api_keys?: string[];
  api_key_env?: string;
  default_model?: string;
  enabled?: boolean;
  task_models?: Record<string, string>;
  capabilities?: string[];
  model_effort?: string;
  request_method?: string;
}): Promise<LlmProvidersSaveResult> {
  const id = String(row.id || "").trim();
  if (!id) throw new Error("provider id is required");
  const apiKeys = (Array.isArray(row.api_keys) ? row.api_keys : [])
    .map((k: string) => String(k || "").trim())
    .filter(Boolean);
  const apiKey = String(row.api_key ?? "").trim() || apiKeys[0] || "";
  const apiKeyEnv = String(row.api_key_env ?? "").trim();
  const payload: Record<string, unknown> = {
    id,
    kind: row.kind,
    base_url: row.base_url,
    api_key_env: apiKeyEnv,
    default_model: row.default_model,
    enabled: row.enabled,
    task_models: row.task_models,
    capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
    model_effort: row.model_effort ?? "",
    request_method: row.request_method || "chat_completions",
  };
  if (apiKeys.length) payload.api_keys = apiKeys;
  if (apiKey) payload.api_key = apiKey;
  return consoleOpenapiPut(
    `/common-config/llm/providers/${encodeURIComponent(id)}`,
    payload,
  ) as Promise<LlmProvidersSaveResult>;
}

/** Provider 在线模型发现（Bot 直连上游；可传草稿 base_url / api_key）。 */
export async function fetchLlmProviderModels(
  providerId: string,
  opts?: {
    base_url?: string;
    api_key?: string;
    api_key_env?: string;
    kind?: string;
    request_method?: string;
  },
): Promise<LlmProviderModelsResult> {
  const path = `/common-config/llm/providers/${encodeURIComponent(providerId)}/models`;
  const body = {
    base_url: opts?.base_url ?? "",
    api_key: opts?.api_key ?? "",
    api_key_env: opts?.api_key_env ?? "",
    kind: opts?.kind ?? "",
    request_method: opts?.request_method ?? "",
  };
  const { data } = await http.post<{ ok: boolean; data: LlmProviderModelsResult }>(path, body);
  if (!data?.ok || !data.data) {
    throw new Error(`${path}: 响应异常`);
  }
  return data.data;
}

/** 实时测试指定 Provider 的连通性（Bot 直连上游，不经 AI Runtime；可传草稿凭证）。 */
export async function postLlmProviderTest(
  providerId: string,
  opts?: {
    base_url?: string;
    api_key?: string;
    api_key_env?: string;
    kind?: string;
    request_method?: string;
  },
): Promise<LlmProviderTestResult> {
  const path = `/common-config/llm/providers/${encodeURIComponent(providerId)}/test`;
  const body = {
    base_url: opts?.base_url ?? "",
    api_key: opts?.api_key ?? "",
    api_key_env: opts?.api_key_env ?? "",
    kind: opts?.kind ?? "",
    request_method: opts?.request_method ?? "",
  };
  const { data } = await http.post<{ ok: boolean; data: LlmProviderTestResult }>(path, body);
  if (!data?.ok || !data.data) {
    throw new Error(`${path}: 响应异常`);
  }
  return data.data;
}

export async function fetchLlmTaskStats(params?: {
  start?: string;
  end?: string;
}): Promise<LlmTaskStatsData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/common-config/llm/task-stats"]["get"]>(
    "/common-config/llm/task-stats",
    {
      params: {
        ...(params?.start ? { start: params.start } : {}),
        ...(params?.end ? { end: params.end } : {}),
      },
    },
  )) as LlmTaskStatsData;
}

export async function fetchLlmRuntimeOverview(): Promise<LlmRuntimeOverviewData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/common-config/llm/runtime-overview"]["get"]>(
    "/common-config/llm/runtime-overview",
  )) as LlmRuntimeOverviewData;
}

export async function fetchLlmHistorySessions(params?: {
  botId?: number | null;
  groupId?: number | null;
  userId?: number | null;
  limit?: number;
}): Promise<LlmHistorySessionsData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/common-config/llm/history/sessions"]["get"]>(
    "/common-config/llm/history/sessions",
    {
      params: {
        ...(params?.botId != null && params.botId > 0 ? { bot_id: params.botId } : {}),
        ...(params?.groupId != null && params.groupId >= 0 ? { group_id: params.groupId } : {}),
        ...(params?.userId != null && params.userId > 0 ? { user_id: params.userId } : {}),
        ...(params?.limit ? { limit: params.limit } : {}),
      },
    },
  )) as LlmHistorySessionsData;
}

export async function fetchLlmHistorySession(params: {
  botId: number;
  groupId?: number | null;
  userId: number;
  limit?: number;
}): Promise<LlmHistorySessionDetailData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/common-config/llm/history/session"]["get"]>(
    "/common-config/llm/history/session",
    {
      params: {
        bot_id: params.botId,
        ...(params.groupId != null && params.groupId >= 0 ? { group_id: params.groupId } : {}),
        user_id: params.userId,
        ...(params.limit ? { limit: params.limit } : {}),
      },
    },
  )) as LlmHistorySessionDetailData;
}

export async function postLlmHistoryBehaviorAnnotate(body: {
  requestId: string;
  labels: string[];
  finalOutcome?: string | null;
  disabled?: boolean;
}): Promise<LlmHistoryBehaviorRun> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/common-config/llm/history/behavior/annotate"]["post"]>(
    "/common-config/llm/history/behavior/annotate",
    {
      request_id: body.requestId,
      labels: body.labels,
      ...(body.finalOutcome ? { final_outcome: body.finalOutcome } : {}),
      ...(typeof body.disabled === "boolean" ? { disabled: body.disabled } : {}),
    },
  );
}

export async function fetchLlmBehaviorRuns(params?: {
  groupId?: number | null;
  scene?: string | null;
  finalOutcome?: string | null;
  includeDisabled?: boolean;
  limit?: number;
}): Promise<LlmBehaviorRunsData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/common-config/llm/behavior/runs"]["get"]>(
    "/common-config/llm/behavior/runs",
    {
      params: {
        ...(params?.groupId != null && params.groupId > 0 ? { group_id: params.groupId } : {}),
        ...(params?.scene ? { scene: params.scene } : {}),
        ...(params?.finalOutcome ? { final_outcome: params.finalOutcome } : {}),
        ...(typeof params?.includeDisabled === "boolean" ? { include_disabled: params.includeDisabled } : {}),
        ...(params?.limit ? { limit: params.limit } : {}),
      },
    },
  )) as LlmBehaviorRunsData;
}

export async function fetchLlmRuntimeReplay(
  requestId: string,
  mode = "mock_tools",
): Promise<Record<string, unknown>> {
  const path = `/common-config/llm/runtime-debug/${encodeURIComponent(requestId)}/replay`;
  return (await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/common-config/llm/runtime-debug/{request_id}/replay"]["get"]
  >(path, { params: { mode } })) as Record<string, unknown>;
}

export async function fetchLlmRuntimeDebug(requestId: string): Promise<LlmRuntimeDebugData> {
  const path = `/common-config/llm/runtime-debug/${encodeURIComponent(requestId)}`;
  return (await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/common-config/llm/runtime-debug/{request_id}"]["get"]
  >(path)) as LlmRuntimeDebugData;
}

export async function postLlmRuntimeReplayRun(
  requestId: string,
  mode = "mock_tools",
): Promise<LlmRuntimeReplayResult> {
  const path = `/common-config/llm/runtime-debug/${encodeURIComponent(requestId)}/replay/run`;
  return consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/common-config/llm/runtime-debug/{request_id}/replay/run"]["post"]
  >(path, { mode });
}

export async function fetchLlmBehaviorPatterns(params?: {
  groupId?: number | null;
  scene?: string | null;
  includeDisabled?: boolean;
}): Promise<LlmBehaviorPatternsData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/common-config/llm/behavior/patterns"]["get"]>(
    "/common-config/llm/behavior/patterns",
    {
      params: {
        ...(params?.groupId != null && params.groupId > 0 ? { group_id: params.groupId } : {}),
        ...(params?.scene ? { scene: params.scene } : {}),
        ...(typeof params?.includeDisabled === "boolean" ? { include_disabled: params.includeDisabled } : {}),
      },
    },
  )) as LlmBehaviorPatternsData;
}

export async function postLlmBehaviorPatternUpsert(
  body: LlmBehaviorPattern,
): Promise<LlmBehaviorPattern> {
  return consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/common-config/llm/behavior/patterns/upsert"]["post"]
  >("/common-config/llm/behavior/patterns/upsert", body);
}

export async function postLlmBehaviorPatternDelete(patternId: string): Promise<{ pattern_id: string }> {
  return consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/common-config/llm/behavior/patterns/delete"]["post"]
  >("/common-config/llm/behavior/patterns/delete", { pattern_id: patternId });
}

export async function fetchLlmRepeaterFeedback(params: {
  groupId: number;
  limit?: number;
}): Promise<LlmRepeaterFeedbackData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/llm/repeater-feedback"]["get"]>(
    "/llm/repeater-feedback",
    {
      params: {
        group_id: params.groupId,
        ...(params.limit ? { limit: params.limit } : {}),
      },
    },
  )) as LlmRepeaterFeedbackData;
}

export async function fetchLlmRepeaterFeedbackSummary(params: {
  groupId: number;
  limit?: number;
}): Promise<LlmRepeaterFeedbackSummary> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/llm/repeater-feedback/summary"]["get"]>(
    "/llm/repeater-feedback/summary",
    {
      params: {
        group_id: params.groupId,
        ...(params.limit ? { limit: params.limit } : {}),
      },
    },
  )) as LlmRepeaterFeedbackSummary;
}

export async function postLlmRepeaterFeedbackManage(body: {
  entryId?: string;
  requestId?: string;
  action: "invalidate" | "restore" | "delete" | "correct" | "clear_correction";
  correctedReplyText?: string;
  botId?: number;
  groupId?: number;
  userId?: number;
  userText?: string;
  replyText?: string;
  llmRoute?: string;
  behaviorScene?: string;
}): Promise<LlmRepeaterFeedbackEntry | { deleted: true; entry_id: string }> {
  return consoleOpenapiPost("/llm/repeater-feedback/manage", {
    entry_id: body.entryId ?? "",
    request_id: body.requestId ?? "",
    action: body.action,
    corrected_reply_text: body.correctedReplyText ?? "",
    bot_id: body.botId,
    group_id: body.groupId,
    user_id: body.userId,
    user_text: body.userText ?? "",
    reply_text: body.replyText ?? "",
    llm_route: body.llmRoute ?? "",
    behavior_scene: body.behaviorScene ?? "",
  }) as Promise<LlmRepeaterFeedbackEntry | { deleted: true; entry_id: string }>;
}

export async function fetchLlmPromotionCandidates(params: {
  groupId: number;
  limit?: number;
  includeResolved?: boolean;
}): Promise<LlmPromotionCandidatesData> {
  return (await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/llm/repeater-feedback/promotion-candidates"]["get"]
  >("/llm/repeater-feedback/promotion-candidates", {
    params: {
      group_id: params.groupId,
      limit: params.limit ?? 20,
      include_resolved: Boolean(params.includeResolved),
    },
  })) as LlmPromotionCandidatesData;
}

export async function postLlmPromotionCandidateResolve(body: {
  candidateId: string;
  action: "promote" | "reject";
  reason?: string;
}): Promise<LlmPromotionCandidate> {
  return consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/llm/repeater-feedback/promotion-candidates/resolve"]["post"]
  >("/llm/repeater-feedback/promotion-candidates/resolve", {
    candidate_id: body.candidateId,
    action: body.action,
    reason: body.reason ?? "",
  });
}

export async function fetchConversationKernelStatus(): Promise<ConversationKernelStatus> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/llm/conversation-kernel/status"]["get"]>(
    "/llm/conversation-kernel/status",
  )) as ConversationKernelStatus;
}

export async function fetchConversationKernelTraces(params?: {
  groupId?: number | null;
  botId?: number | null;
  kind?: string;
  limit?: number;
}): Promise<ConversationKernelTracesData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/llm/conversation-kernel/traces"]["get"]>(
    "/llm/conversation-kernel/traces",
    {
      params: {
        kind: params?.kind || "decision",
        limit: params?.limit ?? 30,
        ...(params?.groupId != null && params.groupId > 0 ? { group_id: params.groupId } : {}),
        ...(params?.botId != null && params.botId > 0 ? { bot_id: params.botId } : {}),
      },
    },
  )) as ConversationKernelTracesData;
}

export async function fetchConversationKernelMemory(params: {
  botId: number;
  groupId?: number | null;
  query?: string;
  limit?: number;
}): Promise<ConversationKernelMemoryData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/llm/conversation-kernel/memory"]["get"]>(
    "/llm/conversation-kernel/memory",
    {
      params: {
        bot_id: params.botId,
        ...(params.groupId != null && params.groupId > 0 ? { group_id: params.groupId } : {}),
        ...(params.query?.trim() ? { query: params.query.trim() } : {}),
        limit: params.limit ?? 50,
      },
    },
  )) as ConversationKernelMemoryData;
}

export async function postConversationKernelMemoryDelete(body: {
  id: number;
  botId: number;
}): Promise<{ id: number }> {
  return consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/llm/conversation-kernel/memory/delete"]["post"]
  >("/llm/conversation-kernel/memory/delete", { id: body.id, bot_id: body.botId });
}

export async function postConversationKernelMemory(body: {
  botId: number;
  groupId?: number | null;
  content: string;
}): Promise<{ bot_id: number; group_id: number | null }> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/llm/conversation-kernel/memory"]["post"]>(
    "/llm/conversation-kernel/memory",
    {
      bot_id: body.botId,
      content: body.content,
      ...(body.groupId != null && body.groupId >= 0 ? { group_id: body.groupId } : {}),
    },
  );
}

export async function fetchLlmHistoryStats(params?: {
  botId?: number | null;
  groupId?: number | null;
  limit?: number;
}): Promise<Record<string, unknown>> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/common-config/llm/history/stats"]["get"]>(
    "/common-config/llm/history/stats",
    {
      params: {
        ...(params?.botId != null && params.botId > 0 ? { bot_id: params.botId } : {}),
        ...(params?.groupId != null && params.groupId >= 0 ? { group_id: params.groupId } : {}),
        ...(params?.limit ? { limit: params.limit } : {}),
      },
    },
  )) as Record<string, unknown>;
}

export async function postLlmHistorySessionClear(body: {
  botId: number;
  groupId?: number | null;
  userId?: number | null;
}): Promise<Record<string, unknown>> {
  return consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/common-config/llm/history/session/clear"]["post"]
  >("/common-config/llm/history/session/clear", {
    bot_id: body.botId,
    ...(body.groupId != null && body.groupId >= 0 ? { group_id: body.groupId } : {}),
    ...(body.userId != null && body.userId > 0 ? { user_id: body.userId } : {}),
  });
}

export async function postLlmHistorySessionInject(body: {
  botId: number;
  groupId?: number | null;
  userId: number;
  content: string;
  role?: "user" | "assistant";
}): Promise<Record<string, unknown>> {
  return consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/common-config/llm/history/session/inject"]["post"]
  >("/common-config/llm/history/session/inject", {
    bot_id: body.botId,
    user_id: body.userId,
    content: body.content,
    role: body.role ?? "user",
    ...(body.groupId != null && body.groupId >= 0 ? { group_id: body.groupId } : {}),
  });
}

export async function fetchConversationKernelMemoryStats(params?: {
  botId?: number | null;
  groupId?: number | null;
}): Promise<Record<string, unknown>> {
  return (await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/llm/conversation-kernel/memory/stats"]["get"]
  >("/llm/conversation-kernel/memory/stats", {
    params: {
      ...(params?.botId != null && params.botId > 0 ? { bot_id: params.botId } : {}),
      ...(params?.groupId != null && params.groupId >= 0 ? { group_id: params.groupId } : {}),
    },
  })) as Record<string, unknown>;
}

export async function postConversationKernelMemoryRetrieve(body: {
  botId: number;
  groupId?: number | null;
  query: string;
}): Promise<Record<string, unknown>> {
  return consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/llm/conversation-kernel/memory/retrieve"]["post"]
  >("/llm/conversation-kernel/memory/retrieve", {
    bot_id: body.botId,
    query: body.query,
    ...(body.groupId != null && body.groupId >= 0 ? { group_id: body.groupId } : {}),
  });
}

export async function postConversationKernelMemoryClear(body: {
  botId: number;
  groupId?: number | null;
  dryRun?: boolean;
}): Promise<Record<string, unknown>> {
  return consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/llm/conversation-kernel/memory/clear"]["post"]
  >("/llm/conversation-kernel/memory/clear", {
    bot_id: body.botId,
    dry_run: Boolean(body.dryRun),
    ...(body.groupId != null && body.groupId >= 0 ? { group_id: body.groupId } : {}),
  });
}

export async function postConversationKernelMemoryLifecycle(body: {
  id: number;
  action: "reinforce" | "weaken" | "freeze" | "unfreeze" | "forget";
  entityTags?: string[];
}): Promise<Record<string, unknown>> {
  return consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/llm/conversation-kernel/memory/lifecycle"]["post"]
  >("/llm/conversation-kernel/memory/lifecycle", {
    id: body.id,
    action: body.action,
    ...(body.entityTags ? { entity_tags: body.entityTags } : {}),
  });
}

export async function fetchConversationKernelMemoryPreferences(params?: {
  botId?: number | null;
  groupId?: number | null;
  limit?: number;
}): Promise<{ items: Array<Record<string, unknown>>; count: number }> {
  return (await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/llm/conversation-kernel/memory/preferences"]["get"]
  >("/llm/conversation-kernel/memory/preferences", {
    params: {
      ...(params?.botId != null && params.botId > 0 ? { bot_id: params.botId } : {}),
      ...(params?.groupId != null && params.groupId >= 0 ? { group_id: params.groupId } : {}),
      ...(params?.limit ? { limit: params.limit } : {}),
    },
  })) as { items: Array<Record<string, unknown>>; count: number };
}

export async function postConversationKernelMemoryPreference(body: {
  botId: number;
  groupId?: number | null;
  rule: string;
  polarity?: string;
  context?: string;
  id?: string;
  isActive?: boolean;
}): Promise<Record<string, unknown>> {
  return consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/llm/conversation-kernel/memory/preferences"]["post"]
  >("/llm/conversation-kernel/memory/preferences", {
    bot_id: body.botId,
    rule: body.rule,
    polarity: body.polarity ?? "do",
    context: body.context ?? "",
    is_active: body.isActive ?? true,
    ...(body.groupId != null && body.groupId >= 0 ? { group_id: body.groupId } : {}),
    ...(body.id ? { id: body.id } : {}),
  });
}

export async function fetchConversationKernelMidTerm(params: {
  botId: number;
  groupId?: number | null;
  userId?: number | null;
  limit?: number;
}): Promise<{ items: Array<Record<string, unknown>>; count: number }> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/llm/conversation-kernel/mid-term"]["get"]>(
    "/llm/conversation-kernel/mid-term",
    {
      params: {
        bot_id: params.botId,
        ...(params.groupId != null && params.groupId >= 0 ? { group_id: params.groupId } : {}),
        ...(params.userId != null && params.userId > 0 ? { user_id: params.userId } : {}),
        ...(params.limit ? { limit: params.limit } : {}),
      },
    },
  )) as { items: Array<Record<string, unknown>>; count: number };
}

export async function fetchLlmSessionOpsConfig(): Promise<Record<string, unknown>> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/common-config/llm/session"]["get"]>(
    "/common-config/llm/session",
  )) as Record<string, unknown>;
}

export async function putLlmSessionOpsConfig(values: Record<string, unknown>): Promise<Record<string, unknown>> {
  return consoleOpenapiPut<ConsoleOpenapiPaths["/pallas/api/common-config/llm/session"]["put"]>(
    "/common-config/llm/session",
    values,
  );
}

export async function fetchLlmMemoryOpsConfig(): Promise<Record<string, unknown>> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/common-config/llm/memory"]["get"]>(
    "/common-config/llm/memory",
  )) as Record<string, unknown>;
}

export async function putLlmMemoryOpsConfig(values: Record<string, unknown>): Promise<Record<string, unknown>> {
  return consoleOpenapiPut<ConsoleOpenapiPaths["/pallas/api/common-config/llm/memory"]["put"]>(
    "/common-config/llm/memory",
    values,
  );
}

export async function fetchLlmPersonaExport(params: {
  botId: number;
  groupId?: number | null;
  plainText?: string;
  purpose?: string;
}): Promise<Record<string, unknown>> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/common-config/llm/persona/export"]["get"]>(
    "/common-config/llm/persona/export",
    {
      params: {
        bot_id: params.botId,
        ...(params.groupId != null && params.groupId >= 0 ? { group_id: params.groupId } : {}),
        ...(params.plainText ? { plain_text: params.plainText } : {}),
        ...(params.purpose ? { purpose: params.purpose } : {}),
      },
    },
  )) as Record<string, unknown>;
}

export async function fetchLlmPersonaGroupStyle(params: {
  groupId: number;
  windowHours?: number;
}): Promise<Record<string, unknown>> {
  return (await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/common-config/llm/persona/group-style"]["get"]
  >("/common-config/llm/persona/group-style", {
    params: {
      group_id: params.groupId,
      ...(params.windowHours ? { window_hours: params.windowHours } : {}),
    },
  })) as Record<string, unknown>;
}

export async function fetchSceneDialogueExamples(botId: number): Promise<SceneDialogueExamplesData> {
  return (await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/common-config/llm/persona/scene-dialogue-examples"]["get"]
  >("/common-config/llm/persona/scene-dialogue-examples", { params: { bot_id: botId } })) as SceneDialogueExamplesData;
}

export async function postSceneDialogueExample(
  body: Omit<SceneDialogueExample, "schema_version" | "example_id" | "created_at" | "updated_at">,
): Promise<SceneDialogueExample> {
  return consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/common-config/llm/persona/scene-dialogue-examples"]["post"]
  >("/common-config/llm/persona/scene-dialogue-examples", body) as Promise<SceneDialogueExample>;
}

export async function putSceneDialogueExample(
  exampleId: string,
  body: Partial<Pick<SceneDialogueExample, "scene" | "user_cue" | "positive" | "negative" | "enabled" | "order">>,
): Promise<SceneDialogueExample> {
  return consoleOpenapiPut<
    ConsoleOpenapiPaths["/pallas/api/common-config/llm/persona/scene-dialogue-examples/{example_id}"]["put"]
  >(`/common-config/llm/persona/scene-dialogue-examples/${encodeURIComponent(exampleId)}`, body) as Promise<SceneDialogueExample>;
}

export async function deleteSceneDialogueExample(exampleId: string): Promise<{ id: string }> {
  return consoleOpenapiDelete<
    ConsoleOpenapiPaths["/pallas/api/common-config/llm/persona/scene-dialogue-examples/{example_id}"]["delete"]
  >(`/common-config/llm/persona/scene-dialogue-examples/${encodeURIComponent(exampleId)}`) as Promise<{ id: string }>;
}

export async function fetchConversationKernelRelationshipNotes(params: {
  botId: number;
  groupId?: number | null;
  query?: string;
  limit?: number;
}): Promise<ConversationKernelRelationshipNotesData> {
  return (await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/llm/conversation-kernel/relationship-notes"]["get"]
  >("/llm/conversation-kernel/relationship-notes", {
    params: {
      bot_id: params.botId,
      ...(params.groupId != null && params.groupId > 0 ? { group_id: params.groupId } : {}),
      ...(params.query?.trim() ? { query: params.query.trim() } : {}),
      limit: params.limit ?? 50,
    },
  })) as ConversationKernelRelationshipNotesData;
}

export async function postConversationKernelRelationshipNoteDelete(body: {
  id: number;
  botId: number;
}): Promise<{ id: number }> {
  return consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/llm/conversation-kernel/relationship-notes/delete"]["post"]
  >("/llm/conversation-kernel/relationship-notes/delete", { id: body.id, bot_id: body.botId });
}

export async function fetchConversationKernelKnowledgeSources(): Promise<ConversationKernelKnowledgeSourcesData> {
  return (await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/llm/conversation-kernel/knowledge-sources"]["get"]
  >("/llm/conversation-kernel/knowledge-sources")) as ConversationKernelKnowledgeSourcesData;
}

export async function fetchConversationKernelKnowledgeSourceDetail(
  sourceId: string,
  params?: { previewLimit?: number; previewContentLen?: number },
): Promise<KnowledgeSourceDetail> {
  return (await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/llm/conversation-kernel/knowledge-sources/{source_id}"]["get"]
  >(`/llm/conversation-kernel/knowledge-sources/${encodeURIComponent(sourceId)}`, {
    params: {
      ...(params?.previewLimit ? { preview_limit: params.previewLimit } : {}),
      ...(params?.previewContentLen ? { preview_content_len: params.previewContentLen } : {}),
    },
  })) as KnowledgeSourceDetail;
}

export async function postConversationKernelKnowledgeSourceRetrieve(body: {
  query: string;
  sourceId?: string | null;
  topK?: number | null;
}): Promise<KnowledgeSourceRetrieveData> {
  return (await consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/llm/conversation-kernel/knowledge-sources/retrieve"]["post"]
  >("/llm/conversation-kernel/knowledge-sources/retrieve", {
    query: body.query,
    ...(body.sourceId ? { source_id: body.sourceId } : {}),
    ...(body.topK != null && body.topK > 0 ? { top_k: body.topK } : {}),
  })) as KnowledgeSourceRetrieveData;
}

export async function fetchLlmToolsCatalog(): Promise<LlmToolCatalogData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/llm/tools"]["get"]>(
    "/llm/tools",
  )) as LlmToolCatalogData;
}

export async function previewLlmToolIntent(text: string): Promise<import("./pallasTypes").LlmToolIntentPreview> {
  return (await consoleOpenapiPost("/llm/tools/preview", { text })) as import("./pallasTypes").LlmToolIntentPreview;
}

export async function patchLlmToolOverride(
  toolName: string,
  patch: import("./pallasTypes").LlmToolOverridePatch,
): Promise<LlmToolCatalogData> {
  return (await consoleOpenapiPatch(
    `/llm/tools/overrides/${encodeURIComponent(toolName)}`,
    patch,
  )) as LlmToolCatalogData;
}

export async function fetchLlmPersonaObserve(params?: {
  groupId?: number | null;
  accounts?: number[];
}): Promise<PersonaObserveData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/common-config/llm/persona-observe"]["get"]>(
    "/common-config/llm/persona-observe",
    {
      params: {
        ...(params?.groupId != null && params.groupId > 0 ? { group_id: params.groupId } : {}),
        ...(params?.accounts?.length ? { accounts: params.accounts.join(",") } : {}),
      },
    },
  )) as PersonaObserveData;
}

export async function fetchLlmModelAdminStatus(): Promise<LlmModelAdminStatus> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/common-config/llm/model-admin"]["get"]>(
    "/common-config/llm/model-admin",
  )) as LlmModelAdminStatus;
}

export async function fetchLlmEmbeddingStatus(): Promise<LlmEmbeddingStatus> {
  return (await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/common-config/llm/embedding-status"]["get"]
  >("/common-config/llm/embedding-status")) as LlmEmbeddingStatus;
}

export async function postLlmEmbeddingProbe(text = "ping"): Promise<LlmEmbeddingStatus> {
  return (await consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/common-config/llm/embedding-status/probe"]["post"]
  >("/common-config/llm/embedding-status/probe", { text }, { timeout: 30_000 })) as LlmEmbeddingStatus;
}

export async function postLlmModelAdminSwitch(
  model: string,
  pull = true,
): Promise<LlmModelAdminModelResult> {
  const body = { model, pull };
  const postPaths = [
    "/common-config/llm/model-admin/switch",
    "/common-config/llm/model-admin",
  ] as const;
  let lastErr: unknown;
  for (const path of postPaths) {
    try {
      return await consoleOpenapiPost<
        ConsoleOpenapiPaths["/pallas/api/common-config/llm/model-admin/switch"]["post"]
      >(path, body);
    } catch (e) {
      lastErr = e;
      if (!isAxiosError(e) || (e.response?.status !== 404 && e.response?.status !== 405)) {
        throw e;
      }
    }
  }
  try {
    return await consoleOpenapiPut<ConsoleOpenapiPaths["/pallas/api/common-config/llm/model-admin"]["put"]>(
      "/common-config/llm/model-admin",
      body,
    );
  } catch (e) {
    throw lastErr ?? e;
  }
}

/** @deprecated 使用 postLlmModelAdminSwitch；部分环境 PUT 请求体可能被丢弃 */
export async function putLlmModelAdminModel(
  model: string,
  pull = true,
): Promise<LlmModelAdminModelResult> {
  return postLlmModelAdminSwitch(model, pull);
}

export async function postLlmModelAdminReload(): Promise<LlmModelAdminModelResult> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/common-config/llm/model-admin/reload"]["post"]>(
    "/common-config/llm/model-admin/reload",
    {},
  );
}

export async function postLlmModelAdminUnload(): Promise<{ status: string }> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/common-config/llm/model-admin/unload"]["post"]>(
    "/common-config/llm/model-admin/unload",
    {},
  );
}

export async function postLlmModelAdminNumGpu(
  numGpu: number,
): Promise<LlmModelAdminModelResult> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/common-config/llm/model-admin/num-gpu"]["post"]>(
    "/common-config/llm/model-admin/num-gpu",
    { num_gpu: numGpu },
  );
}

export async function changeConsoleLogin(newPassword: string): Promise<ConsoleLoginChangeResult> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/security/console-login"]["post"]>(
    "/security/console-login",
    { new_password: newPassword },
  );
}

export async function fetchConsoleSetupStatus(): Promise<ConsoleSetupStatus> {
  return consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/auth/setup-status"]["get"]>("/auth/setup-status");
}

export async function fetchLogs(
  n: number,
  scope: LogScope = "all",
  source?: string,
  options?: { bypassCache?: boolean },
): Promise<LogsData> {
  const src = source && source !== "all" ? source : "all";
  const cacheKey = `${n}:${scope}:${src}`;
  const bypass = options?.bypassCache === true;
  const now = Date.now();
  const cached = logsCache.get(cacheKey);
  if (!bypass && cached && now - cached.ts < LOGS_FRESH_MS) {
    return cached.data;
  }
  if (!bypass && cached && now - cached.ts < LOGS_STALE_MS) {
    const snap = cached.data;
    if (!logsInflight.has(cacheKey)) {
      const refresh = fetchLogsFromNetwork(n, scope, src)
        .then((data) => {
          logsCache.set(cacheKey, { data, ts: Date.now() });
          return data;
        })
        .finally(() => {
          logsInflight.delete(cacheKey);
        });
      logsInflight.set(cacheKey, refresh);
    }
    return snap;
  }
  let inflight = logsInflight.get(cacheKey);
  if (!inflight) {
    inflight = fetchLogsFromNetwork(n, scope, src)
      .then((data) => {
        logsCache.set(cacheKey, { data, ts: Date.now() });
        return data;
      })
      .finally(() => {
        logsInflight.delete(cacheKey);
      });
    logsInflight.set(cacheKey, inflight);
  }
  return inflight;
}

const LOGS_FRESH_MS = 900;
const LOGS_STALE_MS = 5_000;
const logsCache = new Map<string, { data: LogsData; ts: number }>();
const logsInflight = new Map<string, Promise<LogsData>>();

async function fetchLogsFromNetwork(n: number, scope: LogScope, source: string): Promise<LogsData> {
  const params: { n: number; scope: LogScope; source?: string } = { n, scope };
  if (source !== "all") params.source = source;
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/logs"]["get"]>("/logs", { params })) as LogsData;
}

export function invalidateLogsCache(): void {
  logsCache.clear();
  logsInflight.clear();
}

/** 分片 hub 实时日志 SSE（合并 hub 环与各 worker 落盘增量） */
export function openLogsEventSource(
  scope: LogScope = "all",
  source?: string,
  lastEventId?: number,
): EventSource {
  const root = ((import.meta.env.BASE_URL as string) || "/pallas/").replace(/\/$/, "");
  const apiBase = `${root}/api`;
  const qs = new URLSearchParams({ scope });
  if (source && source !== "all") qs.set("source", source);
  if (lastEventId != null && lastEventId > 0) qs.set("last_event_id", String(lastEventId));
  return new EventSource(`${apiBase}/logs/stream?${qs.toString()}`, { withCredentials: true });
}

const messageStatsInflight = new Map<string, Promise<MessageStatsData>>();
const messageStatsCache = new Map<string, { data: MessageStatsData; ts: number }>();
const MESSAGE_STATS_FRESH_MS = 2_500;
const MESSAGE_STATS_STALE_MS = 12_000;

export async function fetchMessageStats(
  selfId?: number,
  options?: { bypassCache?: boolean },
): Promise<MessageStatsData> {
  const key = selfId != null ? String(selfId) : "all";
  const bypass = options?.bypassCache === true;
  const now = Date.now();
  const cached = messageStatsCache.get(key);
  if (!bypass && cached && now - cached.ts < MESSAGE_STATS_FRESH_MS) {
    return cached.data;
  }
  if (!bypass && cached && now - cached.ts < MESSAGE_STATS_STALE_MS) {
    const snap = cached.data;
    if (!messageStatsInflight.has(key)) {
      const refresh = fetchMessageStatsFromNetwork(selfId)
        .then((data) => {
          messageStatsCache.set(key, { data, ts: Date.now() });
          return data;
        })
        .finally(() => {
          messageStatsInflight.delete(key);
        });
      messageStatsInflight.set(key, refresh);
    }
    return snap;
  }
  let inflight = messageStatsInflight.get(key);
  if (!inflight) {
    inflight = fetchMessageStatsFromNetwork(selfId)
      .then((data) => {
        messageStatsCache.set(key, { data, ts: Date.now() });
        return data;
      })
      .finally(() => {
        messageStatsInflight.delete(key);
      });
    messageStatsInflight.set(key, inflight);
  }
  return inflight;
}

async function fetchMessageStatsFromNetwork(selfId?: number): Promise<MessageStatsData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/message-stats"]["get"]>(
    "/message-stats",
    { params: selfId ? { self_id: selfId } : {} },
  )) as MessageStatsData;
}


const COMMUNITY_STATS_FRESH_MS = 60_000;

let communityStatsCache: { data: CommunityStatsData; ts: number } | null = null;
let communityStatsInflight: Promise<CommunityStatsData> | null = null;

export function peekCommunityStatsCache(): CommunityStatsData | null {
  return communityStatsCache?.data ?? null;
}

export async function fetchCommunityStats(options?: { bypassCache?: boolean }): Promise<CommunityStatsData> {
  const bypass = options?.bypassCache === true;
  const now = Date.now();
  if (!bypass && communityStatsCache && now - communityStatsCache.ts < COMMUNITY_STATS_FRESH_MS) {
    return communityStatsCache.data;
  }
  if (!communityStatsInflight) {
    communityStatsInflight = (async () => {
      const parsed = (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/community-stats"]["get"]>(
        "/community-stats",
      )) as CommunityStatsData;
      communityStatsCache = { data: parsed, ts: Date.now() };
      return parsed;
    })().finally(() => {
      communityStatsInflight = null;
    });
  }
  return communityStatsInflight;
}

/** Bot 进程侧探测社区中心 HTTPS（主/备）并返回上报诊断包。 */
export async function probeCommunityConnectivity(): Promise<CommunityConnectivityCheckData> {
  return (await consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/community-stats/connectivity-check"]["post"]
  >("/community-stats/connectivity-check", {})) as CommunityConnectivityCheckData;
}

const CORPUS_HOT_FRESH_MS = 120_000;
const corpusHotCache = new Map<string, { data: CommunityCorpusHotData; ts: number }>();
const corpusHotInflight = new Map<string, Promise<CommunityCorpusHotData>>();
const localCorpusHotCache = new Map<string, { data: CommunityCorpusHotData; ts: number }>();
const localCorpusHotInflight = new Map<string, Promise<CommunityCorpusHotData>>();
const LOCAL_CORPUS_HOT_FRESH_MS = 60_000;

export async function fetchCommunityCorpusHot(
  tab: CommunityHotTab = "fleet",
  options?: { bypassCache?: boolean; limit?: number },
): Promise<CommunityCorpusHotData> {
  const limit = Math.max(5, Math.min(options?.limit ?? 40, 80));
  const mode: CommunityHotMode =
    tab === "fleet" ? "fleet" : tab === "pool" ? "pool" : "recent";
  const period: CommunityHotPeriod = tab === "pool" || tab === "fleet" ? "day" : tab;
  const cacheKey = `${mode}:${period}:${limit}`;
  const bypass = options?.bypassCache === true;
  const now = Date.now();
  const cached = corpusHotCache.get(cacheKey);
  if (!bypass && cached && now - cached.ts < CORPUS_HOT_FRESH_MS) {
    return cached.data;
  }
  let inflight = corpusHotInflight.get(cacheKey);
  if (!inflight) {
    inflight = (async () => {
      const parsed = (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/community-corpus-hot"]["get"]>(
        "/community-corpus-hot",
        { params: { mode, period, limit } },
      )) as CommunityCorpusHotData;
      corpusHotCache.set(cacheKey, { data: parsed, ts: Date.now() });
      return parsed;
    })().finally(() => {
      corpusHotInflight.delete(cacheKey);
    });
    corpusHotInflight.set(cacheKey, inflight);
  }
  return inflight;
}

export async function fetchLocalCorpusHot(
  options?: { bypassCache?: boolean; limit?: number; scope?: "global" | "group"; groupId?: number },
): Promise<CommunityCorpusHotData> {
  const limit = Math.max(5, Math.min(options?.limit ?? 40, 80));
  const scope = options?.scope === "group" ? "group" : "global";
  const groupId = options?.groupId ?? 0;
  const cacheKey = `${scope}:${groupId}:${limit}`;
  const bypass = options?.bypassCache === true;
  const now = Date.now();
  const cached = localCorpusHotCache.get(cacheKey);
  if (!bypass && cached && now - cached.ts < LOCAL_CORPUS_HOT_FRESH_MS) {
    return cached.data;
  }
  let inflight = localCorpusHotInflight.get(cacheKey);
  if (!inflight) {
    inflight = (async () => {
      const params: Record<string, string | number> = { scope, limit };
      if (scope === "group" && options?.groupId != null) {
        params.group_id = options.groupId;
      }
      const parsed = (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/local-corpus-hot"]["get"]>(
        "/local-corpus-hot",
        { params },
      )) as CommunityCorpusHotData;
      localCorpusHotCache.set(cacheKey, { data: parsed, ts: Date.now() });
      return parsed;
    })().finally(() => {
      localCorpusHotInflight.delete(cacheKey);
    });
    localCorpusHotInflight.set(cacheKey, inflight);
  }
  return inflight;
}

export type CommunityGalleryPost = {
  id: string;
  text: string;
  source: string;
  keywords: string;
  nickname: string;
  avatar_url: string;
  qq?: number | null;
  image_url?: string | null;
  created_at: string;
  created_unix: number;
};

export type CommunityGalleryListData = {
  as_of: string;
  posts: CommunityGalleryPost[];
  next_cursor: string | null;
};

export async function fetchCommunityGallery(options?: {
  mine?: boolean;
  limit?: number;
}): Promise<CommunityGalleryListData> {
  const { data } = await http.get("/community-gallery", {
    params: {
      limit: options?.limit ?? 48,
      mine: options?.mine ? "true" : "false",
    },
  });
  const body = data as { ok?: boolean; data?: CommunityGalleryListData };
  return body.data || { as_of: "", posts: [], next_cursor: null };
}

export async function createCommunityGalleryPost(input: {
  text: string;
  nickname: string;
  avatarUrl?: string;
  botQq?: number | null;
  source?: string;
  keywords?: string;
  image?: File | null;
}): Promise<{ id: string; created_at: string }> {
  const form = new FormData();
  form.append("text", input.text || "");
  form.append("nickname", input.nickname || "");
  form.append("avatar_url", input.avatarUrl || "");
  form.append("source", input.source || "manual");
  form.append("keywords", input.keywords || "");
  if (input.botQq != null) form.append("bot_qq", String(input.botQq));
  if (input.image) form.append("image", input.image);
  const { data } = await http.post("/community-gallery", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60_000,
  });
  const body = data as { ok?: boolean; data?: { id: string; created_at: string } };
  if (!body.data?.id) throw new Error("投稿响应无效");
  return body.data;
}

export async function deleteCommunityGalleryPost(postId: string): Promise<void> {
  await http.delete(`/community-gallery/${encodeURIComponent(postId)}`);
}

let shardObsInflight: Promise<ShardObservabilityData> | null = null;

let ingressDispatchInflight: Promise<IngressDispatchData> | null = null;

export async function fetchIngressDispatch(): Promise<IngressDispatchData> {
  if (!ingressDispatchInflight) {
    ingressDispatchInflight = (async () =>
      (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/ingress-dispatch"]["get"]>(
        "/ingress-dispatch",
      )) as IngressDispatchData)().finally(() => {
      ingressDispatchInflight = null;
    });
  }
  return ingressDispatchInflight;
}

let ingressDispatchHistoryInflight: Promise<IngressDispatchHistoryData> | null = null;

export async function fetchIngressDispatchHistory(windowSec = 7 * 24 * 60 * 60): Promise<IngressDispatchHistoryData> {
  if (!ingressDispatchHistoryInflight) {
    ingressDispatchHistoryInflight = (async () => {
      const { data } = await http.get<{ ok?: boolean; data?: IngressDispatchHistoryData }>("/ingress-dispatch/history", {
        params: { window_sec: windowSec },
      });
      if (!data?.data) throw new Error("入站历史响应无效");
      return data.data;
    })().finally(() => {
      ingressDispatchHistoryInflight = null;
    });
  }
  return ingressDispatchHistoryInflight;
}

export async function fetchShardObservability(): Promise<ShardObservabilityData> {
  if (!shardObsInflight) {
    shardObsInflight = (async () =>
      (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/shard-observability"]["get"]>(
        "/shard-observability",
      )) as ShardObservabilityData)().finally(() => {
      shardObsInflight = null;
    });
  }
  return shardObsInflight;
}

export async function fetchCorpusStatus(): Promise<CorpusStatusData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/corpus-status"]["get"]>(
    "/corpus-status",
  )) as CorpusStatusData;
}

export async function fetchFederationOnboarding(): Promise<FederationOnboardingData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/federation-onboarding"]["get"]>(
    "/federation-onboarding",
  )) as FederationOnboardingData;
}

export async function fetchPluginRunStats(
  selfId?: number,
  logSource?: string,
  options?: { tbLimit?: number; bypassCache?: boolean },
): Promise<PluginRunStatsData> {
  const params: {
    self_id?: number;
    log_source?: string;
    tb_limit?: number;
  } = {};
  if (selfId) params.self_id = selfId;
  if (logSource && logSource !== "all") params.log_source = logSource;
  const tbLimit = options?.tbLimit;
  if (tbLimit !== undefined) params.tb_limit = tbLimit;
  const cacheKey = pluginRunStatsCacheKey({
    selfId,
    logSource,
    tbLimit,
    view: "full",
  });
  return readPluginRunStatsCached(cacheKey, options?.bypassCache === true, async () =>
    (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/plugin-run-stats"]["get"]>(
      "/plugin-run-stats",
      { params },
    )) as PluginRunStatsData,
  );
}

export type LogErrorsData = Pick<
  PluginRunStatsData,
  "log_error_log" | "log_error_sources" | "sharded_log_errors"
>;

/** 日志报错页：专用轻量接口，旧后端回退 plugin-run-stats?view=log_errors */
export async function fetchLogErrors(
  logSource?: string,
  options?: { tbLimit?: number; bypassCache?: boolean },
): Promise<LogErrorsData> {
  const src = logSource && logSource !== "all" ? logSource : "all";
  const tbLimit = options?.tbLimit ?? 0;
  const cacheKey = `log-errors:${src}:${tbLimit}`;
  return readLogErrorsCached(cacheKey, options?.bypassCache === true, async () => {
    try {
      return await fetchLogErrorsFromNetwork(src, tbLimit);
    } catch (err) {
      if (!isLogErrorsDedicatedEndpointMissing(err)) throw err;
      return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/plugin-run-stats"]["get"]>(
        "/plugin-run-stats",
        {
          params: {
            view: "log_errors",
            ...(src !== "all" ? { log_source: src } : {}),
            tb_limit: tbLimit,
          },
        },
      )) as LogErrorsData;
    }
  });
}

const LOG_ERRORS_FRESH_MS = 3_000;
const LOG_ERRORS_STALE_MS = 20_000;
const logErrorsCache = new Map<string, { data: LogErrorsData; ts: number }>();
const logErrorsInflight = new Map<string, Promise<LogErrorsData>>();

async function fetchLogErrorsFromNetwork(source: string, tbLimit: number): Promise<LogErrorsData> {
  const params: { log_source?: string; tb_limit: number; limit: number } = { tb_limit: tbLimit, limit: 120 };
  if (source !== "all") params.log_source = source;
  const { data } = await http.get<{ ok: boolean; data: LogErrorsData }>("/log-errors", { params });
  if (!data?.ok || !data.data) throw new Error("/log-errors: 响应异常");
  return data.data;
}

function isLogErrorsDedicatedEndpointMissing(err: unknown): boolean {
  if (!isAxiosError(err)) return false;
  const status = err.response?.status;
  return status === 404 || status === 405;
}

async function readLogErrorsCached(
  cacheKey: string,
  bypass: boolean,
  loader: () => Promise<LogErrorsData>,
): Promise<LogErrorsData> {
  const now = Date.now();
  const cached = logErrorsCache.get(cacheKey);
  if (!bypass && cached && now - cached.ts < LOG_ERRORS_FRESH_MS) {
    return cached.data;
  }
  if (!bypass && cached && now - cached.ts < LOG_ERRORS_STALE_MS) {
    const snap = cached.data;
    if (!logErrorsInflight.has(cacheKey)) {
      const refresh = loader()
        .then((data) => {
          logErrorsCache.set(cacheKey, { data, ts: Date.now() });
          return data;
        })
        .finally(() => {
          logErrorsInflight.delete(cacheKey);
        });
      logErrorsInflight.set(cacheKey, refresh);
    }
    return snap;
  }
  let inflight = logErrorsInflight.get(cacheKey);
  if (!inflight) {
    inflight = loader()
      .then((data) => {
        logErrorsCache.set(cacheKey, { data, ts: Date.now() });
        return data;
      })
      .finally(() => {
        logErrorsInflight.delete(cacheKey);
      });
    logErrorsInflight.set(cacheKey, inflight);
  }
  return inflight;
}

export function invalidateLogErrorsCache(): void {
  logErrorsCache.clear();
  logErrorsInflight.clear();
  for (const key of [...pluginRunStatsCache.keys()]) {
    if (key.startsWith("log_errors:")) pluginRunStatsCache.delete(key);
  }
}

const PLUGIN_RUN_STATS_FRESH_MS = 2_500;
const PLUGIN_RUN_STATS_STALE_MS = 12_000;

type PluginRunStatsCacheKeyParts = {
  selfId?: number;
  logSource?: string;
  tbLimit?: number;
  view: "full" | "log_errors";
};

function pluginRunStatsCacheKey(parts: PluginRunStatsCacheKeyParts): string {
  const sid = parts.selfId != null ? String(parts.selfId) : "all";
  const src = parts.logSource && parts.logSource !== "all" ? parts.logSource : "all";
  const tbl = parts.tbLimit !== undefined ? String(parts.tbLimit) : "default";
  return `${parts.view}:${sid}:${src}:${tbl}`;
}

const pluginRunStatsCache = new Map<string, { data: PluginRunStatsData | LogErrorsData; ts: number }>();
const pluginRunStatsInflight = new Map<string, Promise<PluginRunStatsData | LogErrorsData>>();

async function readPluginRunStatsCached<T extends PluginRunStatsData | LogErrorsData>(
  cacheKey: string,
  bypass: boolean,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const cached = pluginRunStatsCache.get(cacheKey);
  if (!bypass && cached && now - cached.ts < PLUGIN_RUN_STATS_FRESH_MS) {
    return cached.data as T;
  }
  if (!bypass && cached && now - cached.ts < PLUGIN_RUN_STATS_STALE_MS) {
    const snap = cached.data as T;
    if (!pluginRunStatsInflight.has(cacheKey)) {
      const refresh = loader()
        .then((data) => {
          pluginRunStatsCache.set(cacheKey, { data, ts: Date.now() });
          return data;
        })
        .finally(() => {
          pluginRunStatsInflight.delete(cacheKey);
        });
      pluginRunStatsInflight.set(cacheKey, refresh);
    }
    return snap;
  }
  let inflight = pluginRunStatsInflight.get(cacheKey);
  if (!inflight) {
    inflight = loader()
      .then((data) => {
        pluginRunStatsCache.set(cacheKey, { data, ts: Date.now() });
        return data;
      })
      .finally(() => {
        pluginRunStatsInflight.delete(cacheKey);
      });
    pluginRunStatsInflight.set(cacheKey, inflight);
  }
  return (await inflight) as T;
}

let homeOverviewCache: { data: HomeOverviewData; ts: number } | null = null;
let homeOverviewInflight: Promise<HomeOverviewData> | null = null;
const HOME_OVERVIEW_FRESH_MS = 5_000;
const HOME_OVERVIEW_STALE_MS = 45_000;

function storeHomeOverviewCache(data: HomeOverviewData): void {
  homeOverviewCache = { data, ts: Date.now() };
  seedCachesFromHomeOverview(data);
}

async function fetchHomeOverviewFromNetwork(bypass = false): Promise<HomeOverviewData> {
  const { data } = await http.get<{ ok: boolean; data: HomeOverviewData }>("/home/overview", {
    ...(bypass ? { params: { _ts: Date.now() } } : {}),
  });
  if (!data?.ok || !data.data) throw new Error("/home/overview: 响应异常");
  storeHomeOverviewCache(data.data);
  return data.data;
}

/** 同步读取上次成功的首页聚合快照（供首屏或静默刷新） */
export function peekHomeOverviewCache(): HomeOverviewData | null {
  return homeOverviewCache?.data ?? null;
}

export async function fetchHomeOverview(opts?: { bypassCache?: boolean }): Promise<HomeOverviewData> {
  const bypass = Boolean(opts?.bypassCache);
  const now = Date.now();

  if (!bypass && homeOverviewCache && now - homeOverviewCache.ts < HOME_OVERVIEW_FRESH_MS) {
    return homeOverviewCache.data;
  }

  if (!bypass && homeOverviewCache && now - homeOverviewCache.ts < HOME_OVERVIEW_STALE_MS) {
    const snap = homeOverviewCache.data;
    if (!homeOverviewInflight) {
      homeOverviewInflight = fetchHomeOverviewFromNetwork()
        .finally(() => {
          homeOverviewInflight = null;
        });
    }
    return snap;
  }

  if (bypass) {
    return fetchHomeOverviewFromNetwork(true);
  }

  if (!homeOverviewInflight) {
    homeOverviewInflight = fetchHomeOverviewFromNetwork()
      .finally(() => {
        homeOverviewInflight = null;
      });
  }
  return homeOverviewInflight;
}

function seedCachesFromHomeOverview(data: HomeOverviewData): void {
  if (data.instances) touchInstancesCache(data.instances);
  if (data.bots.length) touchBotsCache(data.bots);
  if (data.plugins.length) touchPluginsCache(data.plugins);
  if (data.message_stats) {
    messageStatsCache.set("all", { data: data.message_stats, ts: Date.now() });
  }
  if (data.plugin_run_stats) {
    const key = pluginRunStatsCacheKey({
      selfId: undefined,
      logSource: "all",
      tbLimit: 0,
      view: "full",
    });
    pluginRunStatsCache.set(key, { data: data.plugin_run_stats, ts: Date.now() });
  }
  if (data.community_stats) {
    communityStatsCache = { data: data.community_stats, ts: Date.now() };
  }
}

const CONSOLE_DAILY_STATS_FRESH_MS = 3_500;
const CONSOLE_DAILY_STATS_STALE_MS = 18_000;

const consoleDailyStatsCache = new Map<string, { data: ConsoleDailyStatsData; ts: number }>();
const consoleDailyStatsInflight = new Map<string, Promise<ConsoleDailyStatsData>>();

function consoleDailyStatsCacheKey(params?: { selfId?: number; start?: string; end?: string }): string {
  const sid = params?.selfId != null ? String(params.selfId) : "all";
  const start = params?.start?.trim() || "";
  const end = params?.end?.trim() || "";
  return `${sid}:${start}:${end}`;
}

export interface LogErrorsCleanupResult {
  cleared: boolean;
  sharded_errors?: boolean;
}

export async function postLogErrorsCleanup(): Promise<LogErrorsCleanupResult> {
  const result = await consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/log-errors/cleanup"]["post"]>(
    "/log-errors/cleanup",
    {},
  );
  invalidateLogErrorsCache();
  return result;
}

export async function fetchConsoleDailyStats(
  params?: {
    selfId?: number;
    start?: string;
    end?: string;
    bypassCache?: boolean;
  },
): Promise<ConsoleDailyStatsData> {
  const cacheKey = consoleDailyStatsCacheKey(params);
  const bypass = params?.bypassCache === true;
  const now = Date.now();
  const cached = consoleDailyStatsCache.get(cacheKey);
  if (!bypass && cached && now - cached.ts < CONSOLE_DAILY_STATS_FRESH_MS) {
    return cached.data;
  }
  if (!bypass && cached && now - cached.ts < CONSOLE_DAILY_STATS_STALE_MS) {
    const snap = cached.data;
    if (!consoleDailyStatsInflight.has(cacheKey)) {
      const refresh = fetchConsoleDailyStatsFromNetwork(params)
        .then((data) => {
          consoleDailyStatsCache.set(cacheKey, { data, ts: Date.now() });
          return data;
        })
        .finally(() => {
          consoleDailyStatsInflight.delete(cacheKey);
        });
      consoleDailyStatsInflight.set(cacheKey, refresh);
    }
    return snap;
  }
  let inflight = consoleDailyStatsInflight.get(cacheKey);
  if (!inflight) {
    inflight = fetchConsoleDailyStatsFromNetwork(params)
      .then((data) => {
        consoleDailyStatsCache.set(cacheKey, { data, ts: Date.now() });
        return data;
      })
      .finally(() => {
        consoleDailyStatsInflight.delete(cacheKey);
      });
    consoleDailyStatsInflight.set(cacheKey, inflight);
  }
  return inflight;
}

async function fetchConsoleDailyStatsFromNetwork(params?: {
  selfId?: number;
  start?: string;
  end?: string;
}): Promise<ConsoleDailyStatsData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/console-daily-stats"]["get"]>(
    "/console-daily-stats",
    {
      params: {
        ...(params?.selfId ? { self_id: params.selfId } : {}),
        ...(params?.start ? { start: params.start } : {}),
        ...(params?.end ? { end: params.end } : {}),
      },
    },
  )) as ConsoleDailyStatsData;
}

export async function fetchPluginConfigHint(): Promise<string> {
  const data = (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/plugin-config-hint"]["get"]>(
    "/plugin-config-hint",
  )) as { message: string };
  return data.message;
}

export async function fetchDbOverview(): Promise<DbOverviewData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/db/overview"]["get"]>(
    "/db/overview",
    { timeout: DB_HEAVY_READ_TIMEOUT_MS },
  )) as DbOverviewData;
}

export async function fetchDbHealth(): Promise<DbHealthData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/db/health"]["get"]>(
    "/db/health",
    { timeout: DB_HEAVY_READ_TIMEOUT_MS },
  )) as DbHealthData;
}

export async function fetchDbTables(): Promise<DbTablesData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/db/tables"]["get"]>(
    "/db/tables",
    { timeout: DB_HEAVY_READ_TIMEOUT_MS },
  )) as DbTablesData;
}

export async function fetchDbTableRows(params: {
  table: string;
  offset?: number;
  limit?: number;
}): Promise<DbTableRowsData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/db/table-rows"]["get"]>(
    "/db/table-rows",
    {
      timeout: DB_HEAVY_READ_TIMEOUT_MS,
      params: {
        table: params.table,
        offset: params.offset ?? 0,
        limit: params.limit ?? 50,
      },
    },
  )) as DbTableRowsData;
}

export async function fetchDbMigrateMongoPgInfo(): Promise<DbMigrateMongoPgInfo> {
  return (await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/db/migrate/mongo-to-pg/info"]["get"]
  >("/db/migrate/mongo-to-pg/info")) as DbMigrateMongoPgInfo;
}

export async function postDbMigrateMongoPg(body: {
  dry_run?: boolean;
  restart_cursor?: boolean;
  switch_backend?: boolean;
  try_hot_rebind?: boolean;
  batch_size?: number;
  tables?: string[];
}): Promise<DbMigrateMongoPgJob> {
  return (await consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/db/migrate/mongo-to-pg"]["post"]>(
    "/db/migrate/mongo-to-pg",
    body,
    { timeout: DB_HEAVY_READ_TIMEOUT_MS },
  )) as DbMigrateMongoPgJob;
}

export async function fetchActiveDbMigrateMongoPgJob(): Promise<DbMigrateMongoPgJob | null> {
  return (await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/db/migrate/mongo-to-pg/jobs/active"]["get"]
  >("/db/migrate/mongo-to-pg/jobs/active")) as DbMigrateMongoPgJob | null;
}

export async function fetchDbMigrateMongoPgJob(jobId: string): Promise<DbMigrateMongoPgJob> {
  return (await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/db/migrate/mongo-to-pg/jobs/{job_id}"]["get"]
  >(`/db/migrate/mongo-to-pg/jobs/${encodeURIComponent(jobId)}`)) as DbMigrateMongoPgJob;
}

export async function fetchDbBackendConfig(): Promise<DbBackendConfigData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/db/backend"]["get"]>(
    "/db/backend",
  )) as DbBackendConfigData;
}

export async function putDbBackendConfig(body: {
  backend: DbBackendKind;
  postgres?: Partial<DbBackendPostgresConfig> | null;
  mongo?: Partial<DbBackendMongoConfig> | null;
  force?: boolean;
}): Promise<DbBackendSaveResult> {
  return (await consoleOpenapiPut<ConsoleOpenapiPaths["/pallas/api/db/backend"]["put"]>(
    "/db/backend",
    body,
  )) as DbBackendSaveResult;
}

export async function postDbBackendProbe(body: {
  backend: DbBackendKind;
  postgres?: Partial<DbBackendPostgresConfig> | null;
  mongo?: Partial<DbBackendMongoConfig> | null;
}): Promise<DbBackendProbeResult> {
  return (await consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/db/backend/probe"]["post"]>(
    "/db/backend/probe",
    body,
  )) as DbBackendProbeResult;
}

export async function fetchDbBackupInfo(): Promise<DbBackupInfo> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/db/backup/info"]["get"]>(
    "/db/backup/info",
  )) as DbBackupInfo;
}

export async function postDbBackup(body: {
  output_parent?: string | null;
  label?: string;
  scope?: "full" | "important";
  pg_format?: "custom" | "plain" | "directory";
  pg_tables?: string[];
  mongo_collections?: string[];
}): Promise<DbBackupJobData> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/db/backup"]["post"]>("/db/backup", body);
}

export async function fetchDbBackupJob(jobId: string): Promise<DbBackupJobData> {
  return (await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/db/backup/jobs/{job_id}"]["get"]
  >(`/db/backup/jobs/${encodeURIComponent(jobId)}`)) as DbBackupJobData;
}

export async function fetchActiveDbBackupJob(): Promise<DbBackupJobData | null> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/db/backup/jobs/active"]["get"]>(
    "/db/backup/jobs/active",
  )) as DbBackupJobData | null;
}

export async function fetchDbBackupRuns(outputParent?: string | null): Promise<DbBackupRunsData> {
  const params = outputParent?.trim() ? { output_parent: outputParent.trim() } : undefined;
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/db/backup/runs"]["get"]>(
    "/db/backup/runs",
    { params },
  )) as DbBackupRunsData;
}

export async function fetchDbBackupBrowse(path?: string | null): Promise<DbBackupBrowseData> {
  const params = path?.trim() ? { path: path.trim() } : undefined;
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/db/backup/browse"]["get"]>(
    "/db/backup/browse",
    { params },
  )) as DbBackupBrowseData;
}

export async function downloadDbBackupRun(params: {
  path: string;
  outputParent?: string | null;
  onProgress?: (percent: number) => void;
}): Promise<Blob> {
  const query: Record<string, string> = { path: params.path };
  if (params.outputParent?.trim()) {
    query.output_parent = params.outputParent.trim();
  }
  const { data } = await http.get<Blob>("/db/backup/runs/download", {
    params: query,
    responseType: "blob",
    timeout: DB_BACKUP_TIMEOUT_MS,
    onDownloadProgress: (ev) => {
      const total = ev.total ?? 0;
      if (!total || !params.onProgress) return;
      params.onProgress(Math.min(100, Math.round((ev.loaded / total) * 100)));
    },
  });
  return data;
}

export async function postDbBackupRunsDelete(body: {
  paths: string[];
  output_parent?: string | null;
}): Promise<DbBackupDeleteResult> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/db/backup/runs/delete"]["post"]>(
    "/db/backup/runs/delete",
    body,
  );
}

export async function postDbBackupRestore(body: {
  path: string;
  output_parent?: string | null;
}): Promise<DbBackupJobData> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/db/backup/runs/restore"]["post"]>(
    "/db/backup/runs/restore",
    body,
  );
}

export async function postMongoAggregate(body: {
  collection: string;
  pipeline: unknown[];
}): Promise<{ rows: Record<string, unknown>[]; truncated_to: number }> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/db/mongodb/aggregate"]["post"]>(
    "/db/mongodb/aggregate",
    body,
  );
}

export async function fetchDbTableRow(params: {
  table: "config" | "bot_config" | "group_config" | "user_config";
  row_id: number;
}): Promise<Record<string, unknown>> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/db/table-row"]["get"]>(
    "/db/table-row",
    { params },
  )) as Record<string, unknown>;
}

export async function putDbTableRow(body: {
  table: "config" | "bot_config" | "group_config" | "user_config";
  row_id: number;
  data: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  return consoleOpenapiPut<ConsoleOpenapiPaths["/pallas/api/db/table-row"]["put"]>("/db/table-row", body);
}

export async function deleteDbTableRow(params: {
  table: "config" | "bot_config" | "group_config" | "user_config";
  row_id: number;
}): Promise<{ deleted: boolean }> {
  return consoleOpenapiDelete<ConsoleOpenapiPaths["/pallas/api/db/table-row"]["delete"]>(
    "/db/table-row",
    { params },
  );
}

export async function fetchInstances(opts?: FetchInstancesOptions): Promise<InstancesData> {
  const bypass = Boolean(opts?.bypassCache);
  const now = Date.now();

  if (bypass) {
    const gen = instancesFetchGen;
    const d = await fetchInstancesFromNetwork();
    if (gen === instancesFetchGen) touchInstancesCache(d);
    return d;
  }

  if (instancesInflight) {
    return instancesInflight;
  }

  if (instancesCache) {
    const age = now - instancesCache.ts;
    if (age < CATALOG_FRESH_MS) {
      return instancesCache.data;
    }
    const snap = instancesCache.data;
    const gen = instancesFetchGen;
    instancesInflight = fetchInstancesFromNetwork()
      .then((d) => {
        if (gen === instancesFetchGen) touchInstancesCache(d);
        return d;
      })
      .finally(() => {
        instancesInflight = null;
      });
    return snap;
  }

  const gen = instancesFetchGen;
  instancesInflight = fetchInstancesFromNetwork()
    .then((d) => {
      if (gen === instancesFetchGen) touchInstancesCache(d);
      return d;
    })
    .finally(() => {
      instancesInflight = null;
    });
  return instancesInflight;
}

/** 获取好友申请列表 */
export async function fetchFriendRequests(params?: {
  self_id?: number;
  doubt?: boolean;
}): Promise<FriendOverviewData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/friend-requests"]["get"]>(
    "/friend-requests",
    { params },
  )) as FriendOverviewData;
}

/** 获取群列表（按账号实时拉取） */
export async function fetchGroupList(selfId: number, limit = 1000): Promise<GroupListData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/group-list"]["get"]>("/group-list", {
    params: { self_id: selfId, limit },
  })) as GroupListData;
}

/** 获取好友列表 */
export async function fetchFriendList(selfId: number, limit = 800): Promise<FriendListData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/friend-list"]["get"]>("/friend-list", {
    params: { self_id: selfId, limit },
  })) as FriendListData;
}

export async function fetchRequestOverview(params?: {
  selfId?: number;
  doubt?: boolean;
}): Promise<RequestOverviewData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/request-overview"]["get"]>(
    "/request-overview",
    {
      params: {
        ...(params?.selfId != null ? { self_id: params.selfId } : {}),
        ...(params?.doubt != null ? { doubt: params.doubt } : {}),
      },
    },
  )) as RequestOverviewData;
}

export async function postRequestAction(body: {
  self_id: number;
  kind: "friend" | "group";
  action?: "approve" | "reject";
  source?: "pending" | "doubt";
  user_id?: number;
  group_id?: number;
}): Promise<{ handled: boolean }> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/request-actions"]["post"]>(
    "/request-actions",
    body,
  );
}

export interface RequestActionsBatchError {
  self_id: number;
  user_id: number;
  source?: string;
  group_id?: number;
  error: string;
}

export interface RequestActionsBatchResult {
  friends_ok: number;
  friends_fail: number;
  friends_errors: RequestActionsBatchError[];
  groups_ok: number;
  groups_fail: number;
  groups_errors: RequestActionsBatchError[];
}

/** 批量好友/入群审批（单次请求、服务端单次写盘） */
export async function postRequestActionsBatch(body: {
  action: "approve" | "reject";
  friends: Array<{ self_id: number; user_id: number; source: "pending" | "doubt" }>;
  groups: Array<{ self_id: number; user_id: number; group_id: number }>;
}): Promise<RequestActionsBatchResult> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/request-actions/batch"]["post"]>(
    "/request-actions/batch",
    body,
  );
}

export async function fetchBotConfigs(): Promise<BotConfigPublic[]> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/bot-configs"]["get"]>(
    "/bot-configs",
  )) as BotConfigPublic[];
}

export async function putBotConfig(
  account: number,
  body: Partial<{
    admins: number[];
    disabled_plugins: string[];
    auto_accept_friend: boolean;
    auto_accept_group: boolean;
    security: boolean;
    community_roster_show_qq: boolean;
    persona: Record<string, unknown> | null;
    group_style_enabled: boolean;
  }>,
): Promise<BotConfigPublic> {
  const out = (await consoleOpenapiPut<
    ConsoleOpenapiPaths["/pallas/api/bot-configs/{account}"]["put"]
  >(`/bot-configs/${account}`, body)) as BotConfigPublic;
  invalidateInstancesCache();
  invalidateBotsCache();
  return out;
}

export async function deleteBotConfig(account: number): Promise<{ deleted: boolean }> {
  const r = await deleteDbTableRow({ table: "bot_config", row_id: account });
  invalidateInstancesCache();
  invalidateBotsCache();
  return r;
}

/** 关闭本进程对该 QQ 的 OneBot WS（不停止外置协议端进程） */
export async function disconnectBotWs(qq: number): Promise<{ qq: number; closed: boolean }> {
  const out = (await consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/bots/{qq}/disconnect-ws"]["post"]
  >(`/bots/${qq}/disconnect-ws`, {})) as { qq: number; closed: boolean };
  invalidateInstancesCache();
  invalidateBotsCache();
  notifyInstancesCatalogUpdated();
  return out;
}

export async function fetchGroupConfigs(limit: number, selfId?: number): Promise<GroupConfigPublic[]> {
  const params: Record<string, unknown> = { limit };
  if (selfId !== undefined) params.self_id = selfId;
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/group-configs"]["get"]>(
    "/group-configs",
    { params, timeout: DB_HEAVY_READ_TIMEOUT_MS },
  )) as GroupConfigPublic[];
}

export async function fetchGroupConfigById(groupId: number): Promise<GroupConfigPublic> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/group-configs/{group_id}"]["get"]>(
    `/group-configs/${groupId}`,
  )) as GroupConfigPublic;
}

export async function fetchBotConfigById(account: number): Promise<BotConfigPublic> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/bot-configs/{account}"]["get"]>(
    `/bot-configs/${account}`,
  )) as BotConfigPublic;
}

export async function putGroupConfig(
  groupId: number,
  body: Partial<{
    disabled_plugins: string[];
    roulette_mode: number;
    banned: boolean;
    blocked_user_ids: number[];
  }>,
): Promise<GroupConfigPublic> {
  return consoleOpenapiPut<ConsoleOpenapiPaths["/pallas/api/group-configs/{group_id}"]["put"]>(
    `/group-configs/${groupId}`,
    body,
  );
}

export async function deleteGroupConfig(groupId: number): Promise<{ deleted: boolean }> {
  return deleteDbTableRow({ table: "group_config", row_id: groupId });
}

export async function fetchUserConfigs(limit: number): Promise<UserConfigPublic[]> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/user-configs"]["get"]>(
    "/user-configs",
    { params: { limit }, timeout: DB_HEAVY_READ_TIMEOUT_MS },
  )) as UserConfigPublic[];
}

export async function fetchUserConfigById(userId: number): Promise<UserConfigPublic> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/user-configs/{user_id}"]["get"]>(
    `/user-configs/${userId}`,
  )) as UserConfigPublic;
}

export async function putUserConfig(
  userId: number,
  body: Partial<{
    banned: boolean;
  }>,
): Promise<UserConfigPublic> {
  return consoleOpenapiPut<ConsoleOpenapiPaths["/pallas/api/user-configs/{user_id}"]["put"]>(
    `/user-configs/${userId}`,
    body,
  );
}

export async function deleteUserConfig(userId: number): Promise<{ deleted: boolean }> {
  return deleteDbTableRow({ table: "user_config", row_id: userId });
}

export async function fetchAiExtensionConfig(): Promise<AiExtensionConfig> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/ai-extension/config"]["get"]>(
    "/ai-extension/config",
  )) as AiExtensionConfig;
}

export async function putAiExtensionConfig(body: AiExtensionConfig): Promise<AiExtensionConfig> {
  return consoleOpenapiPut<ConsoleOpenapiPaths["/pallas/api/ai-extension/config"]["put"]>(
    "/ai-extension/config",
    body,
  );
}

export async function postAiExtensionTest(): Promise<AiExtensionTestData> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/ai-extension/test"]["post"]>("/ai-extension/test");
}

export async function fetchAiExtensionLogs(
  kind: AiExtensionLogKind,
  n = 200,
): Promise<AiExtensionLogsData> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/ai-extension/logs"]["get"]>(
    "/ai-extension/logs",
    { params: { kind, n } },
  )) as AiExtensionLogsData;
}

/** AI 扩展本地日志文件 SSE（Bot 跟读 uvicorn/celery 日志路径） */
export function openAiExtensionLogsEventSource(
  kind: AiExtensionLogKind = "uvicorn",
  lastEventId?: number,
): EventSource {
  const root = ((import.meta.env.BASE_URL as string) || "/pallas/").replace(/\/$/, "");
  const apiBase = `${root}/api`;
  const qs = new URLSearchParams({ kind });
  if (lastEventId != null && lastEventId > 0) qs.set("last_event_id", String(lastEventId));
  return new EventSource(`${apiBase}/ai-extension/logs/stream?${qs.toString()}`, {
    withCredentials: true,
  });
}

export type AiRuntimeServiceStatus = {
  running: boolean;
  pid: number | null;
};

export type AiRuntimeCallbackStatus = {
  can_edit: boolean;
  host: string | null;
  port: number | null;
  expected_host: string | null;
  expected_port: number | null;
  aligned: boolean | null;
  probe: {
    ok: boolean;
    url: string | null;
    status_code: number | null;
    error: string | null;
  } | null;
  error: string | null;
};

export type AiRuntimeStatus = {
  can_manage: boolean;
  ai_root: string | null;
  layout: "managed" | "sibling" | "env" | "missing" | "docker" | "remote" | string;
  running: boolean;
  endpoint?: { host: string; port: number };
  services: Record<string, AiRuntimeServiceStatus>;
  health: {
    ok: boolean;
    url: string | null;
    status_code: number | null;
    body_preview: string | null;
    error: string | null;
  };
  callback?: AiRuntimeCallbackStatus;
};

export type AiInstallStatus = {
  detected: boolean;
  ai_root: string | null;
  clone_target: string;
  managed_root?: string;
  sibling_root?: string;
  layout?: string;
  deployment?: string;
  is_managed?: boolean;
  bootstrap_script: string;
  bootstrap_ready: boolean;
  git_available: boolean;
  can_clone: boolean;
  can_bootstrap: boolean;
  can_update?: boolean;
  /** 托管仓相对远端是否有更新；null 表示探测失败/未查 */
  has_update?: boolean | null;
  installed_ref?: string | null;
  latest_ref?: string | null;
  update_check_error?: string | null;
  in_docker?: boolean;
  endpoint?: { host: string; port: number };
  docker_hint: string;
  git_url: string;
  runtime?: AiRuntimeStatus;
};

export async function fetchAiInstallStatus(): Promise<AiInstallStatus> {
  return (await consoleOpenapiGet("/ai-extension/install/status")) as AiInstallStatus;
}

export async function fetchAiRuntimeStatus(): Promise<AiRuntimeStatus> {
  return (await consoleOpenapiGet("/ai-extension/runtime/status")) as AiRuntimeStatus;
}

export async function postAiRuntimeStart(body?: {
  with_media?: boolean;
}): Promise<Record<string, unknown>> {
  return (await consoleOpenapiPost("/ai-extension/runtime/start", body ?? {})) as Record<string, unknown>;
}

export async function postAiRuntimeStop(): Promise<Record<string, unknown>> {
  return (await consoleOpenapiPost("/ai-extension/runtime/stop", {})) as Record<string, unknown>;
}

export async function putAiRuntimeCallback(body: {
  host?: string | null;
  port?: number | null;
  align?: boolean;
  restart_media?: boolean;
}): Promise<{
  ok: boolean;
  error?: string | null;
  callback?: AiRuntimeCallbackStatus;
  output_tail?: string;
  runtime?: AiRuntimeStatus;
}> {
  return (await consoleOpenapiPut("/ai-extension/runtime/callback", body)) as {
    ok: boolean;
    error?: string | null;
    callback?: AiRuntimeCallbackStatus;
    output_tail?: string;
    runtime?: AiRuntimeStatus;
  };
}

export async function postAiInstall(body: {
  action: "clone" | "bootstrap" | "clone_and_bootstrap" | "update";
  no_start?: boolean;
  remote_only?: boolean;
  with_media?: boolean;
  use_gpu?: boolean;
}): Promise<{ job_id: string; action: string }> {
  return (await consoleOpenapiPost("/ai-extension/install", body)) as {
    job_id: string;
    action: string;
  };
}

export type MediaAssetsStatus = {
  ok?: boolean;
  error?: string;
  deploy_mode: string;
  media_packages_enabled: Record<string, boolean>;
  assets: Record<
    string,
    { ready?: boolean; marker?: string; zip?: string; path?: string; size_bytes?: number }
  >;
  all_media_assets_ready: boolean;
  download_allowed: boolean;
  delete_allowed?: boolean;
  hints: string[];
};

export type MediaAssetsDownloadJob = {
  job_id: string;
  state: string;
  message?: string;
  assets?: string[];
  lines?: string[];
  error?: string;
  progress_percent?: number;
};

export type SingSpeakerRow = {
  id: string;
  path?: string;
  backends?: string[];
  model_files?: string[];
  ready?: boolean;
  preferred_backend?: string;
};

export type SingSpeakersPayload = {
  speakers: SingSpeakerRow[];
  default_speaker: string;
  preferred_backend?: string;
  speaker_backends?: Record<string, string>;
  sing_speakers_map?: Record<string, string>;
  writable?: boolean;
  deploy_mode?: string;
};

export type SvcBackendRow = {
  id: string;
  arg_style?: string;
  model_glob?: string;
  enabled?: boolean;
  output_suffix?: string;
  script_present?: boolean;
  auto_installable?: boolean;
};

export type SingBackendsPayload = {
  backends: SvcBackendRow[];
  fallback_order?: string[];
  preferred_backend?: string;
  writable?: boolean;
  deploy_mode?: string;
};

export type TtsVoiceRow = {
  id: string;
  path: string;
  name?: string;
  size_bytes?: number;
};

export type TtsVoicesPayload = {
  voices: TtsVoiceRow[];
  defaults: {
    ref_audio_path?: string;
    prompt_text?: string;
    prompt_lang?: string;
    text_lang?: string;
  };
  writable?: boolean;
  deploy_mode?: string;
};

export type TtsTranslatorPayload = {
  enable?: boolean;
  provider?: string;
  baidu_app_id?: string;
  baidu_secret_configured?: boolean;
  youdao_app_key?: string;
  youdao_secret_configured?: boolean;
  source?: string;
  writable?: boolean;
};

export async function fetchMediaAssetsStatus(): Promise<MediaAssetsStatus> {
  const res = (await consoleOpenapiGet("/common-config/llm/media-assets/status")) as {
    ok?: boolean;
    data?: MediaAssetsStatus;
  };
  return (res?.data ?? res) as MediaAssetsStatus;
}

export async function postMediaAssetsDownload(assets?: string[]): Promise<MediaAssetsDownloadJob> {
  const body = assets?.length ? { assets } : {};
  const res = (await consoleOpenapiPost("/common-config/llm/media-assets/download", body)) as {
    ok?: boolean;
    data?: MediaAssetsDownloadJob;
  };
  return (res?.data ?? res) as MediaAssetsDownloadJob;
}

export async function postMediaAssetsDelete(assets: string[]): Promise<{
  deleted?: string[];
  status?: MediaAssetsStatus;
}> {
  const res = (await consoleOpenapiPost("/common-config/llm/media-assets/delete", { assets })) as {
    ok?: boolean;
    data?: { deleted?: string[]; status?: MediaAssetsStatus };
  };
  return (res?.data ?? res) as { deleted?: string[]; status?: MediaAssetsStatus };
}

export async function fetchMediaAssetsDownloadJob(jobId: string): Promise<MediaAssetsDownloadJob> {
  const res = (await consoleOpenapiGet(
    `/common-config/llm/media-assets/download/jobs/${encodeURIComponent(jobId)}`,
  )) as { ok?: boolean; data?: MediaAssetsDownloadJob };
  return (res?.data ?? res) as MediaAssetsDownloadJob;
}

export async function fetchMediaAssetsDownloadActive(): Promise<MediaAssetsDownloadJob | null> {
  const res = (await consoleOpenapiGet(
    "/common-config/llm/media-assets/download/jobs/active",
  )) as { ok?: boolean; data?: MediaAssetsDownloadJob | null };
  const data = res?.data ?? null;
  if (!data?.job_id) return null;
  return data;
}

export async function fetchAiInstallJobActive(): Promise<{
  job_id: string;
  action?: string;
  phase?: string;
  message?: string;
  progress_percent?: number;
} | null> {
  const res = (await consoleOpenapiGet("/ai-extension/install/jobs/active")) as {
    ok?: boolean;
    data?: {
      job_id: string;
      action?: string;
      phase?: string;
      message?: string;
      progress_percent?: number;
    } | null;
  };
  return res?.data ?? null;
}

export async function fetchUpdateApplyJobActive(): Promise<{
  job_id: string;
  kind?: string;
  phase?: string;
  message?: string;
  progress_percent?: number;
} | null> {
  const res = (await consoleOpenapiGet("/update/jobs/active")) as {
    ok?: boolean;
    data?: {
      job_id: string;
      kind?: string;
      phase?: string;
      message?: string;
      progress_percent?: number;
    } | null;
  };
  return res?.data ?? null;
}

export async function fetchPluginStoreJobActive(): Promise<{
  job_id: string;
  kind?: string;
  target?: string;
  action?: string;
  phase?: string;
  message?: string;
  progress_percent?: number;
} | null> {
  const res = (await consoleOpenapiGet("/plugins/store-jobs/active")) as {
    ok?: boolean;
    data?: {
      job_id: string;
      kind?: string;
      target?: string;
      action?: string;
      phase?: string;
      message?: string;
      progress_percent?: number;
    } | null;
  };
  return res?.data ?? null;
}

export async function fetchSingSpeakers(): Promise<SingSpeakersPayload> {
  const res = (await consoleOpenapiGet("/common-config/llm/media-models/sing/speakers")) as {
    ok?: boolean;
    data?: SingSpeakersPayload;
  };
  return (res?.data ?? res) as SingSpeakersPayload;
}

export async function fetchSingBackends(): Promise<SingBackendsPayload> {
  const res = (await consoleOpenapiGet("/common-config/llm/media-models/sing/backends")) as {
    ok?: boolean;
    data?: SingBackendsPayload;
  };
  return (res?.data ?? res) as SingBackendsPayload;
}

export async function putSingDefaults(body: {
  default_speaker?: string;
  preferred_backend?: string;
  speaker_backends?: Record<string, string>;
}): Promise<{
  default_speaker?: string;
  preferred_backend?: string;
  speaker_backends?: Record<string, string>;
  writable?: boolean;
}> {
  const res = (await consoleOpenapiPut("/common-config/llm/media-models/sing/defaults", body)) as {
    ok?: boolean;
    data?: {
      default_speaker?: string;
      preferred_backend?: string;
      speaker_backends?: Record<string, string>;
      writable?: boolean;
    };
  };
  return (res?.data ?? res) as {
    default_speaker?: string;
    preferred_backend?: string;
    speaker_backends?: Record<string, string>;
    writable?: boolean;
  };
}

export async function fetchTtsVoices(): Promise<TtsVoicesPayload> {
  const res = (await consoleOpenapiGet("/common-config/llm/media-models/tts/voices")) as {
    ok?: boolean;
    data?: TtsVoicesPayload;
  };
  return (res?.data ?? res) as TtsVoicesPayload;
}

export async function putTtsDefaults(body: {
  ref_audio_path?: string;
  prompt_text?: string;
  prompt_lang?: string;
  text_lang?: string;
}): Promise<Record<string, unknown>> {
  const res = (await consoleOpenapiPut("/common-config/llm/media-models/tts/defaults", body)) as {
    ok?: boolean;
    data?: Record<string, unknown>;
  };
  return (res?.data ?? res) as Record<string, unknown>;
}

export async function fetchTtsTranslator(): Promise<TtsTranslatorPayload> {
  const res = (await consoleOpenapiGet("/common-config/llm/media-models/tts/translator")) as {
    ok?: boolean;
    data?: TtsTranslatorPayload;
  };
  return (res?.data ?? res) as TtsTranslatorPayload;
}

export async function putTtsTranslator(body: {
  enable?: boolean;
  provider?: string;
  baidu_app_id?: string;
  baidu_secret_key?: string;
  youdao_app_key?: string;
  youdao_app_secret?: string;
}): Promise<TtsTranslatorPayload> {
  const res = (await consoleOpenapiPut("/common-config/llm/media-models/tts/translator", body)) as {
    ok?: boolean;
    data?: TtsTranslatorPayload;
  };
  return (res?.data ?? res) as TtsTranslatorPayload;
}

export function openAiInstallJobEventSource(jobId: string): EventSource {
  const root = ((import.meta.env.BASE_URL as string) || "/pallas/").replace(/\/$/, "");
  const apiBase = `${root}/api`;
  return new EventSource(
    `${apiBase}/ai-extension/install/jobs/${encodeURIComponent(jobId)}/stream`,
    { withCredentials: true },
  );
}

export async function fetchAiNcmStatus(): Promise<AiProxyResult> {
  return (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/ai-extension/ncm/status"]["get"]>(
    "/ai-extension/ncm/status",
  )) as AiProxyResult;
}

export async function postAiNcmSendSms(body: { phone: string; ctcode: number }): Promise<AiProxyResult> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/ai-extension/ncm/send-sms"]["post"]>(
    "/ai-extension/ncm/send-sms",
    body,
  );
}

export async function postAiNcmVerifySms(body: {
  phone: string;
  captcha: string;
  ctcode: number;
}): Promise<AiProxyResult> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/ai-extension/ncm/verify-sms"]["post"]>(
    "/ai-extension/ncm/verify-sms",
    body,
  );
}

export async function postAiNcmLogout(): Promise<AiProxyResult> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/ai-extension/ncm/logout"]["post"]>(
    "/ai-extension/ncm/logout",
    {},
  );
}

let updateCheckInflight: Promise<UpdateCheckData> | null = null;

export async function fetchUpdateCheck(): Promise<UpdateCheckData> {
  if (!updateCheckInflight) {
    updateCheckInflight = (async () =>
      (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/update/check"]["get"]>(
        "/update/check",
      )) as UpdateCheckData)().finally(() => {
      updateCheckInflight = null;
    });
  }
  return updateCheckInflight;
}

export async function postUpdateApply(): Promise<UpdateApplyJobStartData> {
  return (await consoleOpenapiPost("/update/apply", {})) as UpdateApplyJobStartData;
}

let botUpdateCheckInflight: Promise<BotUpdateCheckData> | null = null;

let updateCheckAllInflight: Promise<UpdateCheckAllData> | null = null;

export async function fetchUpdateCheckAll(): Promise<UpdateCheckAllData> {
  if (!updateCheckAllInflight) {
    updateCheckAllInflight = (async () =>
      (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/update/check-all"]["get"]>(
        "/update/check-all",
      )) as UpdateCheckAllData)().finally(() => {
      updateCheckAllInflight = null;
    });
  }
  return updateCheckAllInflight;
}

export async function fetchBotUpdateCheck(): Promise<BotUpdateCheckData> {
  if (!botUpdateCheckInflight) {
    botUpdateCheckInflight = (async () =>
      (await consoleOpenapiGet<ConsoleOpenapiPaths["/pallas/api/update/bot/check"]["get"]>(
        "/update/bot/check",
      )) as BotUpdateCheckData)().finally(() => {
      botUpdateCheckInflight = null;
    });
  }
  return botUpdateCheckInflight;
}

export async function postBotUpdateApply(options?: { restart?: boolean }): Promise<UpdateApplyJobStartData> {
  return (await consoleOpenapiPost(
    "/update/bot/apply",
    null,
    { params: { restart: options?.restart ? "true" : "false" } },
  )) as UpdateApplyJobStartData;
}

export async function fetchBotGitStatus(): Promise<import("./pallasTypes").BotGitStatusData> {
  return (await consoleOpenapiGet("/update/git/bot/status")) as import("./pallasTypes").BotGitStatusData;
}

export async function fetchBotGitHistory(options: {
  mode: "release" | "commit" | string;
  branch?: string;
  limit?: number;
}): Promise<import("./pallasTypes").BotGitHistoryData> {
  return (await consoleOpenapiGet("/update/git/bot/history", {
    params: {
      mode: options.mode,
      branch: options.branch || "",
      limit: options.limit ?? 30,
    },
  })) as import("./pallasTypes").BotGitHistoryData;
}

export async function postBotGitApply(
  body: import("./pallasTypes").BotGitApplyBody,
): Promise<UpdateApplyJobStartData> {
  return (await consoleOpenapiPost("/update/git/bot/apply", {
    mode: body.mode,
    branch: body.branch || "",
    ref: body.ref || "",
    strategy: body.strategy || "safe",
    restart: Boolean(body.restart),
  })) as UpdateApplyJobStartData;
}

export type UpdateChangelogTarget = "webui" | "bot";

export type UpdateChangelogData = {
  target: UpdateChangelogTarget;
  repo?: string;
  source?: string;
  changelog_url?: string;
  markdown?: string;
  max_versions?: number;
};

export async function fetchUpdateChangelog(
  target: UpdateChangelogTarget,
  options?: { maxVersions?: number },
): Promise<UpdateChangelogData> {
  return (await consoleOpenapiGet("/update/changelog", {
    params: {
      target,
      max_versions: options?.maxVersions ?? 10,
    },
  })) as UpdateChangelogData;
}

export function openUpdateApplyJobEventSource(jobId: string): EventSource {
  const root = ((import.meta.env.BASE_URL as string) || "/pallas/").replace(/\/$/, "");
  const apiBase = `${root}/api`;
  return new EventSource(`${apiBase}/update/jobs/${encodeURIComponent(jobId)}/stream`, {
    withCredentials: true,
  });
}

export async function fetchUpdateApplyJob(jobId: string): Promise<UpdateApplyJobSnapshot> {
  return (await consoleOpenapiGet(`/update/jobs/${encodeURIComponent(jobId)}`)) as UpdateApplyJobSnapshot;
}

export type WebuiAutoUpdatePendingNotice = {
  kind?: string;
  tag?: string;
  from_tag?: string;
  applied_at?: number;
  updated?: string[];
  failed?: Array<{ id?: string; error?: string }>;
  items?: WebuiAutoUpdatePendingNotice[];
};

export type WebuiAutoUpdateTickResult = {
  result?: string;
  reason?: string;
  tag?: string;
  from_tag?: string;
  error?: string;
  message?: string;
  current_tag?: string;
  latest_tag?: string;
  pending_notice?: WebuiAutoUpdatePendingNotice | null;
  targets?: Record<string, WebuiAutoUpdateTickResult>;
  updated?: string[];
  failed?: Array<{ id?: string; error?: string }>;
};

export type WebuiAutoUpdateTargetStatus = {
  enabled?: boolean;
  last_check_at?: number | null;
  last_check_result?: string | null;
  last_applied_tag?: string | null;
  last_applied_at?: number | null;
  last_error?: string | null;
  skip_reason?: string | null;
  updated?: string[] | null;
  failed?: Array<{ id?: string; error?: string }> | null;
  deployment_mode?: string;
  update_track?: "release" | "branch" | string;
  update_branch?: string;
  auto_apply_eligible?: boolean;
};

export type WebuiAutoUpdateStatusData = {
  enabled?: boolean;
  schedule_mode?: "interval" | "cron" | string;
  interval_hours?: number;
  cron_hour?: number;
  cron_minute?: number;
  last_check_at?: number | null;
  last_check_result?: string | null;
  last_applied_tag?: string | null;
  last_applied_at?: number | null;
  last_error?: string | null;
  pending_notice?: WebuiAutoUpdatePendingNotice | null;
  notify_superusers?: boolean;
  notify_bot_id?: number;
  tick?: WebuiAutoUpdateTickResult;
  webui?: WebuiAutoUpdateTargetStatus;
  bot?: WebuiAutoUpdateTargetStatus;
  plugins?: WebuiAutoUpdateTargetStatus;
  last_run_at?: number | null;
};

export async function fetchWebuiAutoUpdateStatus(): Promise<WebuiAutoUpdateStatusData> {
  return (await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/update/auto/status"]["get"]
  >("/update/auto/status")) as WebuiAutoUpdateStatusData;
}

export async function postWebuiAutoUpdateAck(): Promise<WebuiAutoUpdateStatusData> {
  return (await consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/update/auto/ack"]["post"]
  >("/update/auto/ack", {})) as WebuiAutoUpdateStatusData;
}

export async function postWebuiAutoUpdateRunOnce(): Promise<UpdateApplyJobStartData> {
  return (await consoleOpenapiPost("/update/auto/run-once", {})) as UpdateApplyJobStartData;
}

export async function postSystemRestart(options?: {
  workersOnly?: boolean;
}): Promise<SystemRestartData> {
  return consoleOpenapiPost<ConsoleOpenapiPaths["/pallas/api/system/restart"]["post"]>("/system/restart", {
    workers_only: Boolean(options?.workersOnly),
  });
}

export async function fetchBotConfigMigrationCheck(): Promise<BotConfigMigrationCheckData> {
  return (await consoleOpenapiGet<
    ConsoleOpenapiPaths["/pallas/api/update/bot/config-migration/check"]["get"]
  >("/update/bot/config-migration/check")) as BotConfigMigrationCheckData;
}

export async function postBotConfigMigrationApply(force = false): Promise<BotConfigMigrationApplyData> {
  return consoleOpenapiPost<
    ConsoleOpenapiPaths["/pallas/api/update/bot/config-migration/apply"]["post"]
  >("/update/bot/config-migration/apply", null, {
    params: { force: force ? "true" : "false" },
  });
}

export async function fetchGitMirrorInfo(): Promise<GitMirrorInfo> {
  return (await consoleOpenapiGet("/git-mirror/info")) as GitMirrorInfo;
}

export async function putGitMirrorPreferred(body: {
  preferred_id: string;
  custom_proxy_prefix?: string;
  scopes?: Partial<Record<"bot" | "webui" | "community", string>>;
}): Promise<GitMirrorInfo> {
  return (await consoleOpenapiPut("/git-mirror/preferred", {
    preferred_id: body.preferred_id,
    custom_proxy_prefix: body.custom_proxy_prefix ?? "",
    ...(body.scopes ? { scopes: body.scopes } : {}),
  })) as GitMirrorInfo;
}

export async function postGitMirrorApplyCommunity(
  body?: { preferred_id?: string },
): Promise<GitMirrorApplySummary> {
  return (await consoleOpenapiPost(
    "/git-mirror/apply-community",
    body?.preferred_id ? { preferred_id: body.preferred_id } : {},
  )) as GitMirrorApplySummary;
}

export async function postGitMirrorApplyBot(
  body?: { preferred_id?: string },
): Promise<{ id?: string; success: boolean; message: string; remote_url?: string }> {
  return (await consoleOpenapiPost(
    "/git-mirror/apply-bot",
    body?.preferred_id ? { preferred_id: body.preferred_id } : {},
  )) as { id?: string; success: boolean; message: string; remote_url?: string };
}

export async function postGitMirrorApplyAll(
  body?: { preferred_id?: string },
): Promise<GitMirrorApplySummary> {
  return (await consoleOpenapiPost(
    "/git-mirror/apply-all",
    body?.preferred_id ? { preferred_id: body.preferred_id } : {},
  )) as GitMirrorApplySummary;
}

export async function postGitMirrorApplyOfficial(
  packageName: string,
  body?: { preferred_id?: string },
): Promise<{ id?: string; success: boolean; message: string; remote_url?: string; mirror_id?: string }> {
  return (await consoleOpenapiPost(
    `/git-mirror/apply-official/${encodeURIComponent(packageName)}`,
    body?.preferred_id ? { preferred_id: body.preferred_id } : {},
  )) as { id?: string; success: boolean; message: string; remote_url?: string; mirror_id?: string };
}

export async function postGitMirrorApplyPlugin(
  pluginId: string,
  body?: { preferred_id?: string },
): Promise<{ id?: string; success: boolean; message: string; remote_url?: string }> {
  return (await consoleOpenapiPost(
    `/git-mirror/apply-plugin/${encodeURIComponent(pluginId)}`,
    body?.preferred_id ? { preferred_id: body.preferred_id } : {},
  )) as { id?: string; success: boolean; message: string; remote_url?: string };
}

export async function postGitMirrorProbe(
  body?: { mirror_id?: string },
): Promise<GitMirrorProbeResult> {
  return (await consoleOpenapiPost(
    "/git-mirror/probe",
    body?.mirror_id ? { mirror_id: body.mirror_id } : {},
  )) as GitMirrorProbeResult;
}
