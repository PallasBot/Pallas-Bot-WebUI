import { isAxiosError } from "axios";
import { DB_BACKUP_TIMEOUT_MS, DB_HEAVY_READ_TIMEOUT_MS, http } from "./http";
import { notifyInstancesCatalogUpdated } from "@/utils/catalogSync";
import { protocolAccountsSignature } from "@/utils/protocolUi";
import type {
  UpdateCheckData,
  UpdateCheckAllData,
  UpdateApplyData,
  BotUpdateCheckData,
  BotUpdateApplyData,
  SystemRestartData,
  BotConfigMigrationCheckData,
  BotConfigMigrationApplyData,
  ApiOk,
  BotConfigPublic,
  BotRow,
  DbBackupInfo,
  DbBackupJobData,
  DbBackupBrowseData,
  DbBackupDeleteResult,
  DbBackupRunsData,
  DbOverviewData,
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
  PluginCapabilitiesData,
  PluginGovernanceBody,
  PluginGovernanceData,
  PluginConfigCheckResult,
  CommonConfigSectionMeta,
  LlmModelAdminModelResult,
  LlmModelAdminStatus,
  LlmLocalRoutingConfig,
  LlmProvidersConfig,
  LlmProvidersSaveResult,
  LlmProviderModelsResult,
  LlmProviderTestResult,
  LlmHistorySessionDetailData,
  LlmHistoryBehaviorRun,
  LlmBehaviorPattern,
  LlmBehaviorPatternsData,
  LlmBehaviorRunsData,
  LlmHistorySessionsData,
  LlmRepeaterFeedbackData,
  LlmRepeaterFeedbackSummary,
  LlmTaskStatsData,
  PersonaObserveData,
  MessageStatsData,
  CommunityStatsData,
  CommunityCorpusHotData,
  CommunityHotMode,
  CommunityHotPeriod,
  CommunityHotTab,
  CorpusStatusData,
  FederationOnboardingData,
  ConsoleDailyStatsData,
  PluginRunStatsData,
  ShardObservabilityData,
  IngressDispatchData,
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
  const { data } = await http.get<ApiOk<InstancesData>>("/instances");
  return unwrap(data, "/instances");
}

export type FetchInstancesOptions = {
  /** 跳过内存缓存并强制请求（用户刷新、写操作后等） */
  bypassCache?: boolean;
};

function unwrap<T>(body: ApiOk<T> | (ApiOk<T> & Record<string, unknown>), path: string): T {
  if (!body || typeof body !== "object" || !("ok" in body) || !body.ok) {
    throw new Error(`${path}: 响应异常`);
  }
  return body.data;
}

let systemInflight: Promise<SystemData> | null = null;

export async function fetchSystem(): Promise<SystemData> {
  if (!systemInflight) {
    systemInflight = (async () => {
      const { data } = await http.get<ApiOk<SystemData>>("/system");
      return unwrap(data, "/system");
    })().finally(() => {
      systemInflight = null;
    });
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
  const { data } = await http.get<ApiOk<PluginRow[]>>("/plugins");
  return unwrap(data, "/plugins");
}

export async function fetchPluginCapabilities(): Promise<PluginCapabilitiesData> {
  const { data } = await http.get<ApiOk<PluginCapabilitiesData>>("/plugins/capabilities");
  return unwrap(data, "/plugins/capabilities");
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

export async function fetchOfficialExtensions(): Promise<OfficialExtensionRow[]> {
  const { data } = await http.get<ApiOk<OfficialExtensionRow[]>>("/plugins/official-extensions");
  return unwrap(data, "/plugins/official-extensions");
}

const EXTENSION_INSTALL_TIMEOUT_MS = 620_000;

export async function installOfficialExtension(
  packageName: string,
  options?: { restart?: boolean },
): Promise<OfficialExtensionInstallResult> {
  const { data } = await http.post<ApiOk<OfficialExtensionInstallResult>>(
    "/plugins/official-extensions/install",
    { package: packageName, restart: Boolean(options?.restart) },
    { timeout: EXTENSION_INSTALL_TIMEOUT_MS },
  );
  const out = unwrap(data, "/plugins/official-extensions/install");
  invalidatePluginsCache();
  return out;
}

export async function uninstallOfficialExtension(
  packageName: string,
  options?: { restart?: boolean },
): Promise<OfficialExtensionInstallResult> {
  const { data } = await http.post<ApiOk<OfficialExtensionInstallResult>>(
    "/plugins/official-extensions/uninstall",
    { package: packageName, restart: Boolean(options?.restart) },
    { timeout: 120_000 },
  );
  const out = unwrap(data, "/plugins/official-extensions/uninstall");
  invalidatePluginsCache();
  return out;
}

export async function updateOfficialExtension(
  packageName: string,
  options?: { restart?: boolean },
): Promise<OfficialExtensionInstallResult> {
  const { data } = await http.post<ApiOk<OfficialExtensionInstallResult>>(
    "/plugins/official-extensions/update",
    { package: packageName, restart: Boolean(options?.restart) },
    { timeout: 600_000 },
  );
  const out = unwrap(data, "/plugins/official-extensions/update");
  invalidatePluginsCache();
  return out;
}

export async function fetchCommunityPluginStore(options?: { refresh?: boolean }): Promise<CommunityPluginStoreData> {
  const { data } = await http.get<ApiOk<CommunityPluginStoreData>>("/plugins/community-store", {
    params: options?.refresh ? { refresh: 1 } : undefined,
  });
  return unwrap(data, "/plugins/community-store");
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

export async function fetchPluginBundledReadme(pluginName: string): Promise<PluginBundledReadmeResult> {
  const { data } = await http.get<ApiOk<PluginBundledReadmeResult>>(
    `/plugins/${encodeURIComponent(pluginName)}/readme`,
  );
  return unwrap(data, `/plugins/${pluginName}/readme`);
}

export async function refreshPluginUpdateSnapshot(): Promise<PluginUpdateSnapshotResult> {
  const { data } = await http.post<ApiOk<PluginUpdateSnapshotResult>>(
    "/plugins/update-snapshot/refresh",
    {},
    { timeout: 120_000 },
  );
  return unwrap(data, "/plugins/update-snapshot/refresh");
}

export async function refreshPluginStore(): Promise<PluginStoreRefreshResult> {
  const { data } = await http.post<ApiOk<PluginStoreRefreshResult>>(
    "/plugins/store/refresh",
    {},
    { timeout: 120_000 },
  );
  return unwrap(data, "/plugins/store/refresh");
}

export async function fetchPluginStoreReadme(
  kind: "official" | "community",
  id: string,
): Promise<string> {
  const { data } = await http.get<ApiOk<PluginStoreReadmeResult>>("/plugins/store/readme", {
    params: { kind, id },
  });
  return unwrap(data, "/plugins/store/readme").markdown;
}

const COMMUNITY_INSTALL_TIMEOUT_MS = 320_000;

export async function installCommunityPlugin(
  pluginId: string,
  options?: { restart?: boolean; repositoryUrl?: string; ref?: string },
): Promise<CommunityPluginActionResult> {
  const { data } = await http.post<ApiOk<CommunityPluginActionResult>>(
    "/plugins/community-plugins/install",
    {
      plugin_id: pluginId,
      repository_url: options?.repositoryUrl,
      ref: options?.ref,
      restart: Boolean(options?.restart),
    },
    { timeout: COMMUNITY_INSTALL_TIMEOUT_MS },
  );
  const out = unwrap(data, "/plugins/community-plugins/install");
  invalidatePluginsCache();
  return out;
}

export async function uninstallCommunityPlugin(
  pluginId: string,
  options?: { restart?: boolean },
): Promise<CommunityPluginActionResult> {
  const { data } = await http.post<ApiOk<CommunityPluginActionResult>>(
    "/plugins/community-plugins/uninstall",
    { plugin_id: pluginId, restart: Boolean(options?.restart) },
    { timeout: 120_000 },
  );
  const out = unwrap(data, "/plugins/community-plugins/uninstall");
  invalidatePluginsCache();
  return out;
}

export async function updateCommunityPlugin(
  pluginId: string,
  options?: { restart?: boolean; ref?: string },
): Promise<CommunityPluginActionResult> {
  const { data } = await http.post<ApiOk<CommunityPluginActionResult>>(
    "/plugins/community-plugins/update",
    {
      plugin_id: pluginId,
      ref: options?.ref,
      restart: Boolean(options?.restart),
    },
    { timeout: COMMUNITY_INSTALL_TIMEOUT_MS },
  );
  const out = unwrap(data, "/plugins/community-plugins/update");
  invalidatePluginsCache();
  return out;
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
  const { data } = await http.get<ApiOk<BotRow[]>>("/bots");
  return unwrap(data, "/bots");
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

export async function fetchPluginsHelpMenuVisibility(): Promise<HelpMenuVisibilityData> {
  const { data } = await http.get<ApiOk<HelpMenuVisibilityData>>("/plugins/help-menu-visibility");
  return unwrap(data, "/plugins/help-menu-visibility");
}

export async function putPluginsHelpMenuVisibility(hiddenPlugins: string[]): Promise<{ hidden_plugins: string[] }> {
  const { data } = await http.put<ApiOk<{ hidden_plugins: string[] }>>("/plugins/help-menu-visibility", {
    hidden_plugins: hiddenPlugins,
  });
  const out = unwrap(data, "/plugins/help-menu-visibility");
  invalidatePluginsCache();
  return out;
}

export async function fetchPluginsGlobalDisable(): Promise<GlobalPluginDisableData> {
  const { data } = await http.get<ApiOk<GlobalPluginDisableData>>("/plugins/global-disable");
  return unwrap(data, "/plugins/global-disable");
}

export async function putPluginsGlobalDisable(
  disabledPlugins: string[],
): Promise<GlobalPluginDisableData> {
  const { data } = await http.put<ApiOk<GlobalPluginDisableData>>("/plugins/global-disable", {
    disabled_plugins: disabledPlugins,
  });
  const out = unwrap(data, "/plugins/global-disable");
  invalidatePluginsCache();
  return out;
}

export async function fetchPluginsGroupFleetWhitelist(): Promise<GroupFleetWhitelistData> {
  const { data } = await http.get<ApiOk<GroupFleetWhitelistData>>("/plugins/group-fleet-whitelist");
  return unwrap(data, "/plugins/group-fleet-whitelist");
}

export async function putPluginsGroupFleetWhitelist(
  entries: GroupFleetWhitelistEntry[],
): Promise<GroupFleetWhitelistData> {
  const { data } = await http.put<ApiOk<GroupFleetWhitelistData>>("/plugins/group-fleet-whitelist", {
    entries,
  });
  const out = unwrap(data, "/plugins/group-fleet-whitelist");
  invalidatePluginsCache();
  return out;
}

export async function fetchPluginConfig(pluginName: string): Promise<PluginConfigData> {
  const { data } = await http.get<ApiOk<PluginConfigData>>(`/plugins/${encodeURIComponent(pluginName)}/config`);
  return unwrap(data, `/plugins/${pluginName}/config`);
}

export async function putPluginConfig(
  pluginName: string,
  values: Record<string, unknown>,
): Promise<PluginConfigData> {
  const { data } = await http.put<ApiOk<PluginConfigData>>(`/plugins/${encodeURIComponent(pluginName)}/config`, {
    values,
  });
  const out = unwrap(data, `/plugins/${pluginName}/config`);
  invalidatePluginsCache();
  return out;
}

export async function postPluginConfigCheck(
  pluginName: string,
  values?: Record<string, unknown>,
): Promise<PluginConfigCheckResult> {
  const { data } = await http.post<ApiOk<PluginConfigCheckResult>>(
    `/plugins/${encodeURIComponent(pluginName)}/config-check`,
    values ? { values } : {},
  );
  return unwrap(data, `/plugins/${pluginName}/config-check`);
}

export async function fetchPluginGovernance(pluginName: string): Promise<PluginGovernanceData> {
  const { data } = await http.get<ApiOk<PluginGovernanceData>>(
    `/plugins/${encodeURIComponent(pluginName)}/governance`,
  );
  return unwrap(data, `/plugins/${pluginName}/governance`);
}

export async function putPluginGovernance(
  pluginName: string,
  body: PluginGovernanceBody,
): Promise<PluginGovernanceData> {
  const { data } = await http.put<ApiOk<PluginGovernanceData>>(
    `/plugins/${encodeURIComponent(pluginName)}/governance`,
    body,
  );
  const out = unwrap(data, `/plugins/${pluginName}/governance`);
  invalidatePluginsCache();
  return out;
}

export async function fetchCommonConfigSections(): Promise<CommonConfigSectionMeta[]> {
  const { data } = await http.get<ApiOk<CommonConfigSectionMeta[]>>("/common-config/sections");
  return unwrap(data, "/common-config/sections");
}

export async function fetchCommonConfig(sectionId: string): Promise<PluginConfigData> {
  const { data } = await http.get<ApiOk<PluginConfigData>>(
    `/common-config/${encodeURIComponent(sectionId)}`,
  );
  return unwrap(data, `/common-config/${sectionId}`);
}

export async function putCommonConfig(
  sectionId: string,
  values: Record<string, unknown>,
): Promise<PluginConfigData> {
  const { data } = await http.put<ApiOk<PluginConfigData>>(`/common-config/${encodeURIComponent(sectionId)}`, {
    values,
  });
  return unwrap(data, `/common-config/${sectionId}`);
}

export async function postServiceGatewaysConnectivityCheck(
  values?: Record<string, unknown>,
): Promise<PluginConfigCheckResult> {
  const { data } = await http.post<ApiOk<PluginConfigCheckResult>>(
    "/common-config/service_gateways/connectivity-check",
    values ? { values } : {},
  );
  return unwrap(data, "/common-config/service_gateways/connectivity-check");
}

export async function fetchLlmProvidersConfig(): Promise<LlmProvidersConfig> {
  const { data } = await http.get<ApiOk<LlmProvidersConfig>>("/common-config/llm/providers");
  return unwrap(data, "/common-config/llm/providers");
}

export async function fetchLlmLocalRoutingConfig(): Promise<LlmLocalRoutingConfig> {
  const { data } = await http.get<ApiOk<LlmLocalRoutingConfig>>("/common-config/llm/local-routing");
  return unwrap(data, "/common-config/llm/local-routing");
}

export async function putLlmLocalRoutingConfig(
  body: LlmLocalRoutingConfig,
): Promise<LlmLocalRoutingConfig> {
  const { data } = await http.put<ApiOk<LlmLocalRoutingConfig>>(
    "/common-config/llm/local-routing",
    body,
  );
  return unwrap(data, "/common-config/llm/local-routing");
}

export async function putLlmProvidersConfig(
  body: LlmProvidersConfig,
): Promise<LlmProvidersSaveResult> {
  const { data } = await http.put<ApiOk<LlmProvidersSaveResult>>(
    "/common-config/llm/providers",
    body,
  );
  return unwrap(data, "/common-config/llm/providers");
}

/** 在线发现指定 Provider 的可用模型（经 BFF 代理 AI 仓）。 */
export async function fetchLlmProviderModels(
  providerId: string,
): Promise<LlmProviderModelsResult> {
  const path = `/common-config/llm/providers/${encodeURIComponent(providerId)}/models`;
  const { data } = await http.get<ApiOk<LlmProviderModelsResult>>(path);
  return unwrap(data, path);
}

/** 实时测试指定 Provider 的连通性（经 BFF 代理 AI 仓 ping）。 */
export async function postLlmProviderTest(
  providerId: string,
): Promise<LlmProviderTestResult> {
  const path = `/common-config/llm/providers/${encodeURIComponent(providerId)}/test`;
  const { data } = await http.post<ApiOk<LlmProviderTestResult>>(path, {});
  return unwrap(data, path);
}

export async function fetchLlmTaskStats(params?: {
  start?: string;
  end?: string;
}): Promise<LlmTaskStatsData> {
  const { data } = await http.get<ApiOk<LlmTaskStatsData>>("/common-config/llm/task-stats", {
    params: {
      ...(params?.start ? { start: params.start } : {}),
      ...(params?.end ? { end: params.end } : {}),
    },
  });
  return unwrap(data, "/common-config/llm/task-stats");
}

export async function fetchLlmHistorySessions(params?: {
  botId?: number | null;
  groupId?: number | null;
  userId?: number | null;
  limit?: number;
}): Promise<LlmHistorySessionsData> {
  const { data } = await http.get<ApiOk<LlmHistorySessionsData>>("/common-config/llm/history/sessions", {
    params: {
      ...(params?.botId != null && params.botId > 0 ? { bot_id: params.botId } : {}),
      ...(params?.groupId != null && params.groupId >= 0 ? { group_id: params.groupId } : {}),
      ...(params?.userId != null && params.userId > 0 ? { user_id: params.userId } : {}),
      ...(params?.limit ? { limit: params.limit } : {}),
    },
  });
  return unwrap(data, "/common-config/llm/history/sessions");
}

export async function fetchLlmHistorySession(params: {
  botId: number;
  groupId?: number | null;
  userId: number;
  limit?: number;
}): Promise<LlmHistorySessionDetailData> {
  const { data } = await http.get<ApiOk<LlmHistorySessionDetailData>>("/common-config/llm/history/session", {
    params: {
      bot_id: params.botId,
      ...(params.groupId != null && params.groupId >= 0 ? { group_id: params.groupId } : {}),
      user_id: params.userId,
      ...(params.limit ? { limit: params.limit } : {}),
    },
  });
  return unwrap(data, "/common-config/llm/history/session");
}

export async function postLlmHistoryBehaviorAnnotate(body: {
  requestId: string;
  labels: string[];
  finalOutcome?: string | null;
  disabled?: boolean;
}): Promise<LlmHistoryBehaviorRun> {
  const path = "/common-config/llm/history/behavior/annotate";
  const { data } = await http.post<ApiOk<LlmHistoryBehaviorRun>>(path, {
    request_id: body.requestId,
    labels: body.labels,
    ...(body.finalOutcome ? { final_outcome: body.finalOutcome } : {}),
    ...(typeof body.disabled === "boolean" ? { disabled: body.disabled } : {}),
  });
  return unwrap(data, path);
}

export async function fetchLlmBehaviorRuns(params?: {
  groupId?: number | null;
  scene?: string | null;
  finalOutcome?: string | null;
  includeDisabled?: boolean;
  limit?: number;
}): Promise<LlmBehaviorRunsData> {
  const { data } = await http.get<ApiOk<LlmBehaviorRunsData>>("/common-config/llm/behavior/runs", {
    params: {
      ...(params?.groupId != null && params.groupId > 0 ? { group_id: params.groupId } : {}),
      ...(params?.scene ? { scene: params.scene } : {}),
      ...(params?.finalOutcome ? { final_outcome: params.finalOutcome } : {}),
      ...(typeof params?.includeDisabled === "boolean" ? { include_disabled: params.includeDisabled } : {}),
      ...(params?.limit ? { limit: params.limit } : {}),
    },
  });
  return unwrap(data, "/common-config/llm/behavior/runs");
}

export async function fetchLlmBehaviorPatterns(params?: {
  groupId?: number | null;
  scene?: string | null;
  includeDisabled?: boolean;
}): Promise<LlmBehaviorPatternsData> {
  const { data } = await http.get<ApiOk<LlmBehaviorPatternsData>>("/common-config/llm/behavior/patterns", {
    params: {
      ...(params?.groupId != null && params.groupId > 0 ? { group_id: params.groupId } : {}),
      ...(params?.scene ? { scene: params.scene } : {}),
      ...(typeof params?.includeDisabled === "boolean" ? { include_disabled: params.includeDisabled } : {}),
    },
  });
  return unwrap(data, "/common-config/llm/behavior/patterns");
}

export async function postLlmBehaviorPatternUpsert(
  body: LlmBehaviorPattern,
): Promise<LlmBehaviorPattern> {
  const path = "/common-config/llm/behavior/patterns/upsert";
  const { data } = await http.post<ApiOk<LlmBehaviorPattern>>(path, body);
  return unwrap(data, path);
}

export async function postLlmBehaviorPatternDelete(patternId: string): Promise<{ pattern_id: string }> {
  const path = "/common-config/llm/behavior/patterns/delete";
  const { data } = await http.post<ApiOk<{ pattern_id: string }>>(path, { pattern_id: patternId });
  return unwrap(data, path);
}

export async function fetchLlmRepeaterFeedback(params: {
  groupId: number;
  limit?: number;
}): Promise<LlmRepeaterFeedbackData> {
  const { data } = await http.get<ApiOk<LlmRepeaterFeedbackData>>("/llm/repeater-feedback", {
    params: {
      group_id: params.groupId,
      ...(params.limit ? { limit: params.limit } : {}),
    },
  });
  return unwrap(data, "/llm/repeater-feedback");
}

export async function fetchLlmRepeaterFeedbackSummary(params: {
  groupId: number;
  limit?: number;
}): Promise<LlmRepeaterFeedbackSummary> {
  const { data } = await http.get<ApiOk<LlmRepeaterFeedbackSummary>>("/llm/repeater-feedback/summary", {
    params: {
      group_id: params.groupId,
      ...(params.limit ? { limit: params.limit } : {}),
    },
  });
  return unwrap(data, "/llm/repeater-feedback/summary");
}

export async function fetchLlmPersonaObserve(params?: {
  groupId?: number | null;
  accounts?: number[];
}): Promise<PersonaObserveData> {
  const { data } = await http.get<ApiOk<PersonaObserveData>>("/common-config/llm/persona-observe", {
    params: {
      ...(params?.groupId != null && params.groupId > 0 ? { group_id: params.groupId } : {}),
      ...(params?.accounts?.length ? { accounts: params.accounts.join(",") } : {}),
    },
  });
  return unwrap(data, "/common-config/llm/persona-observe");
}

export async function fetchLlmModelAdminStatus(): Promise<LlmModelAdminStatus> {
  const { data } = await http.get<ApiOk<LlmModelAdminStatus>>("/common-config/llm/model-admin");
  return unwrap(data, "/common-config/llm/model-admin");
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
      const { data } = await http.post<ApiOk<LlmModelAdminModelResult>>(path, body);
      return unwrap(data, path);
    } catch (e) {
      lastErr = e;
      if (!isAxiosError(e) || (e.response?.status !== 404 && e.response?.status !== 405)) {
        throw e;
      }
    }
  }
  try {
    const { data } = await http.put<ApiOk<LlmModelAdminModelResult>>(
      "/common-config/llm/model-admin",
      body,
    );
    return unwrap(data, "/common-config/llm/model-admin");
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
  const { data } = await http.post<ApiOk<LlmModelAdminModelResult>>(
    "/common-config/llm/model-admin/reload",
    {},
  );
  return unwrap(data, "/common-config/llm/model-admin/reload");
}

export async function postLlmModelAdminUnload(): Promise<{ status: string }> {
  const { data } = await http.post<ApiOk<{ status: string }>>(
    "/common-config/llm/model-admin/unload",
    {},
  );
  return unwrap(data, "/common-config/llm/model-admin/unload");
}

export async function postLlmModelAdminNumGpu(
  numGpu: number,
): Promise<LlmModelAdminModelResult> {
  const { data } = await http.post<ApiOk<LlmModelAdminModelResult>>(
    "/common-config/llm/model-admin/num-gpu",
    { num_gpu: numGpu },
  );
  return unwrap(data, "/common-config/llm/model-admin/num-gpu");
}

export async function changeConsoleLogin(newPassword: string): Promise<{ message: string }> {
  const { data } = await http.post<ApiOk<{ message: string }>>("/security/console-login", {
    new_password: newPassword,
  });
  return unwrap(data, "/security/console-login");
}

export async function fetchLogs(
  n: number,
  scope: LogScope = "all",
  source?: string,
): Promise<LogsData> {
  const params: { n: number; scope: LogScope; source?: string } = { n, scope };
  if (source && source !== "all") params.source = source;
  const { data } = await http.get<ApiOk<LogsData>>("/logs", { params });
  return unwrap(data, "/logs");
}

/** 分片 hub 实时日志 SSE（合并 hub 环与各 worker 落盘增量） */
export function openLogsEventSource(
  scope: LogScope = "all",
  source?: string,
): EventSource {
  const root = ((import.meta.env.BASE_URL as string) || "/pallas/").replace(/\/$/, "");
  const apiBase = `${root}/api`;
  const qs = new URLSearchParams({ scope });
  if (source && source !== "all") qs.set("source", source);
  return new EventSource(`${apiBase}/logs/stream?${qs.toString()}`, { withCredentials: true });
}

export async function fetchMessageStats(selfId?: number): Promise<MessageStatsData> {
  const { data } = await http.get<ApiOk<MessageStatsData>>("/message-stats", {
    params: selfId ? { self_id: selfId } : {},
  });
  return unwrap(data, "/message-stats");
}

const COMMUNITY_STATS_FRESH_MS = 60_000;

let communityStatsCache: { data: CommunityStatsData; ts: number } | null = null;
let communityStatsInflight: Promise<CommunityStatsData> | null = null;

export async function fetchCommunityStats(options?: { bypassCache?: boolean }): Promise<CommunityStatsData> {
  const bypass = options?.bypassCache === true;
  const now = Date.now();
  if (!bypass && communityStatsCache && now - communityStatsCache.ts < COMMUNITY_STATS_FRESH_MS) {
    return communityStatsCache.data;
  }
  if (!communityStatsInflight) {
    communityStatsInflight = (async () => {
      const { data } = await http.get<ApiOk<CommunityStatsData>>("/community-stats");
      const parsed = unwrap(data, "/community-stats");
      communityStatsCache = { data: parsed, ts: Date.now() };
      return parsed;
    })().finally(() => {
      communityStatsInflight = null;
    });
  }
  return communityStatsInflight;
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
      const { data } = await http.get<ApiOk<CommunityCorpusHotData>>("/community-corpus-hot", {
        params: { mode, period, limit },
      });
      const parsed = unwrap(data, "/community-corpus-hot");
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
      const { data } = await http.get<ApiOk<CommunityCorpusHotData>>("/local-corpus-hot", { params });
      const parsed = unwrap(data, "/local-corpus-hot");
      localCorpusHotCache.set(cacheKey, { data: parsed, ts: Date.now() });
      return parsed;
    })().finally(() => {
      localCorpusHotInflight.delete(cacheKey);
    });
    localCorpusHotInflight.set(cacheKey, inflight);
  }
  return inflight;
}

let shardObsInflight: Promise<ShardObservabilityData> | null = null;

export async function fetchShardObservability(): Promise<ShardObservabilityData> {
  if (!shardObsInflight) {
    shardObsInflight = (async () => {
      const { data } = await http.get<ApiOk<ShardObservabilityData>>("/shard-observability");
      return unwrap(data, "/shard-observability");
    })().finally(() => {
      shardObsInflight = null;
    });
  }
  return shardObsInflight;
}

let ingressDispatchInflight: Promise<IngressDispatchData> | null = null;

export async function fetchIngressDispatch(): Promise<IngressDispatchData> {
  if (!ingressDispatchInflight) {
    ingressDispatchInflight = (async () => {
      const { data } = await http.get<ApiOk<IngressDispatchData>>("/ingress-dispatch");
      return unwrap(data, "/ingress-dispatch");
    })().finally(() => {
      ingressDispatchInflight = null;
    });
  }
  return ingressDispatchInflight;
}

export async function fetchCorpusStatus(): Promise<CorpusStatusData> {
  const { data } = await http.get<ApiOk<CorpusStatusData>>("/corpus-status");
  return unwrap(data, "/corpus-status");
}

export async function fetchFederationOnboarding(): Promise<FederationOnboardingData> {
  const { data } = await http.get<ApiOk<FederationOnboardingData>>("/federation-onboarding");
  return unwrap(data, "/federation-onboarding");
}

export async function fetchPluginRunStats(
  selfId?: number,
  logSource?: string,
  options?: { tbLimit?: number },
): Promise<PluginRunStatsData> {
  const params: { self_id?: number; log_source?: string; tb_limit?: number } = {};
  if (selfId) params.self_id = selfId;
  if (logSource && logSource !== "all") params.log_source = logSource;
  const tbLimit = options?.tbLimit;
  if (tbLimit !== undefined) params.tb_limit = tbLimit;
  const { data } = await http.get<ApiOk<PluginRunStatsData>>("/plugin-run-stats", { params });
  return unwrap(data, "/plugin-run-stats");
}

export interface LogErrorsCleanupResult {
  cleared: boolean;
  sharded_errors?: boolean;
}

export async function postLogErrorsCleanup(): Promise<LogErrorsCleanupResult> {
  const { data } = await http.post<ApiOk<LogErrorsCleanupResult>>("/log-errors/cleanup");
  return unwrap(data, "/log-errors/cleanup");
}

export async function fetchConsoleDailyStats(params?: {
  selfId?: number;
  start?: string;
  end?: string;
}): Promise<ConsoleDailyStatsData> {
  const { data } = await http.get<ApiOk<ConsoleDailyStatsData>>("/console-daily-stats", {
    params: {
      ...(params?.selfId ? { self_id: params.selfId } : {}),
      ...(params?.start ? { start: params.start } : {}),
      ...(params?.end ? { end: params.end } : {}),
    },
  });
  return unwrap(data, "/console-daily-stats");
}

export async function fetchPluginConfigHint(): Promise<string> {
  const { data } = await http.get<ApiOk<{ message: string }>>("/plugin-config-hint");
  return unwrap(data, "/plugin-config-hint").message;
}

export async function fetchDbOverview(): Promise<DbOverviewData> {
  const { data } = await http.get<ApiOk<DbOverviewData>>("/db/overview", {
    timeout: DB_HEAVY_READ_TIMEOUT_MS,
  });
  return unwrap(data, "/db/overview");
}

export async function fetchDbBackupInfo(): Promise<DbBackupInfo> {
  const { data } = await http.get<ApiOk<DbBackupInfo>>("/db/backup/info");
  return unwrap(data, "/db/backup/info");
}

export async function postDbBackup(body: {
  output_parent?: string | null;
  label?: string;
  scope?: "full" | "important";
  pg_format?: "custom" | "plain" | "directory";
  pg_tables?: string[];
  mongo_collections?: string[];
}): Promise<DbBackupJobData> {
  const { data } = await http.post<ApiOk<DbBackupJobData>>("/db/backup", body);
  return unwrap(data, "/db/backup");
}

export async function fetchDbBackupJob(jobId: string): Promise<DbBackupJobData> {
  const { data } = await http.get<ApiOk<DbBackupJobData>>(`/db/backup/jobs/${encodeURIComponent(jobId)}`);
  return unwrap(data, `/db/backup/jobs/${jobId}`);
}

export async function fetchActiveDbBackupJob(): Promise<DbBackupJobData | null> {
  const { data } = await http.get<ApiOk<DbBackupJobData | null>>("/db/backup/jobs/active");
  return unwrap(data, "/db/backup/jobs/active");
}

export async function fetchDbBackupRuns(outputParent?: string | null): Promise<DbBackupRunsData> {
  const params = outputParent?.trim() ? { output_parent: outputParent.trim() } : undefined;
  const { data } = await http.get<ApiOk<DbBackupRunsData>>("/db/backup/runs", { params });
  return unwrap(data, "/db/backup/runs");
}

export async function fetchDbBackupBrowse(path?: string | null): Promise<DbBackupBrowseData> {
  const params = path?.trim() ? { path: path.trim() } : undefined;
  const { data } = await http.get<ApiOk<DbBackupBrowseData>>("/db/backup/browse", { params });
  return unwrap(data, "/db/backup/browse");
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
  const { data } = await http.post<ApiOk<DbBackupDeleteResult>>("/db/backup/runs/delete", body);
  return unwrap(data, "/db/backup/runs/delete");
}

export async function postDbBackupRestore(body: {
  path: string;
  output_parent?: string | null;
}): Promise<DbBackupJobData> {
  const { data } = await http.post<ApiOk<DbBackupJobData>>("/db/backup/runs/restore", body);
  return unwrap(data, "/db/backup/runs/restore");
}

export async function postMongoAggregate(body: {
  collection: string;
  pipeline: unknown[];
}): Promise<{ rows: Record<string, unknown>[]; truncated_to: number }> {
  const { data } = await http.post<ApiOk<{ rows: Record<string, unknown>[]; truncated_to: number }>>(
    "/db/mongodb/aggregate",
    body,
  );
  return unwrap(data, "/db/mongodb/aggregate");
}

export async function fetchDbTableRow(params: {
  table: "config" | "bot_config" | "group_config" | "user_config";
  row_id: number;
}): Promise<Record<string, unknown>> {
  const { data } = await http.get<ApiOk<Record<string, unknown>>>("/db/table-row", { params });
  return unwrap(data, "/db/table-row");
}

export async function putDbTableRow(body: {
  table: "config" | "bot_config" | "group_config" | "user_config";
  row_id: number;
  data: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const { data } = await http.put<ApiOk<Record<string, unknown>>>("/db/table-row", body);
  return unwrap(data, "/db/table-row");
}

export async function deleteDbTableRow(params: {
  table: "config" | "bot_config" | "group_config" | "user_config";
  row_id: number;
}): Promise<{ deleted: boolean }> {
  const { data } = await http.delete<ApiOk<{ deleted: boolean }>>("/db/table-row", { params });
  return unwrap(data, "/db/table-row");
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
  const { data } = await http.get<ApiOk<FriendOverviewData>>("/friend-requests", { params });
  return unwrap(data, "/friend-requests");
}

/** 获取群列表（按账号实时拉取） */
export async function fetchGroupList(selfId: number, limit = 1000): Promise<GroupListData> {
  const { data } = await http.get<ApiOk<GroupListData>>("/group-list", {
    params: { self_id: selfId, limit },
  });
  return unwrap(data, "/group-list");
}

/** 获取好友列表 */
export async function fetchFriendList(selfId: number, limit = 800): Promise<FriendListData> {
  const { data } = await http.get<ApiOk<FriendListData>>("/friend-list", {
    params: { self_id: selfId, limit },
  });
  return unwrap(data, "/friend-list");
}

export async function fetchRequestOverview(params?: {
  selfId?: number;
  doubt?: boolean;
}): Promise<RequestOverviewData> {
  const { data } = await http.get<ApiOk<RequestOverviewData>>("/request-overview", {
    params: {
      ...(params?.selfId != null ? { self_id: params.selfId } : {}),
      ...(params?.doubt != null ? { doubt: params.doubt } : {}),
    },
  });
  return unwrap(data, "/request-overview");
}

export async function postRequestAction(body: {
  self_id: number;
  kind: "friend" | "group";
  action?: "approve" | "reject";
  source?: "pending" | "doubt";
  user_id?: number;
  group_id?: number;
}): Promise<{ handled: boolean }> {
  const { data } = await http.post<ApiOk<{ handled: boolean }>>("/request-actions", body);
  return unwrap(data, "/request-actions");
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
  const { data } = await http.post<ApiOk<RequestActionsBatchResult>>("/request-actions/batch", body);
  return unwrap(data, "/request-actions/batch");
}

export async function fetchBotConfigs(): Promise<BotConfigPublic[]> {
  const { data } = await http.get<ApiOk<BotConfigPublic[]>>("/bot-configs");
  return unwrap(data, "/bot-configs");
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
  }>,
): Promise<BotConfigPublic> {
  const { data } = await http.put<ApiOk<BotConfigPublic>>(`/bot-configs/${account}`, body);
  const out = unwrap(data, `/bot-configs/${account}`);
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

export async function fetchGroupConfigs(limit: number, selfId?: number): Promise<GroupConfigPublic[]> {
  const params: Record<string, unknown> = { limit };
  if (selfId !== undefined) params.self_id = selfId;
  const { data } = await http.get<ApiOk<GroupConfigPublic[]>>("/group-configs", {
    params,
    timeout: DB_HEAVY_READ_TIMEOUT_MS,
  });
  return unwrap(data, "/group-configs");
}

export async function fetchGroupConfigById(groupId: number): Promise<GroupConfigPublic> {
  const { data } = await http.get<ApiOk<GroupConfigPublic>>(`/group-configs/${groupId}`);
  return unwrap(data, `/group-configs/${groupId}`);
}

export async function fetchBotConfigById(account: number): Promise<BotConfigPublic> {
  const { data } = await http.get<ApiOk<BotConfigPublic>>(`/bot-configs/${account}`);
  return unwrap(data, `/bot-configs/${account}`);
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
  const { data } = await http.put<ApiOk<GroupConfigPublic>>(`/group-configs/${groupId}`, body);
  return unwrap(data, `/group-configs/${groupId}`);
}

export async function fetchUserConfigs(limit: number): Promise<UserConfigPublic[]> {
  const { data } = await http.get<ApiOk<UserConfigPublic[]>>("/user-configs", {
    params: { limit },
    timeout: DB_HEAVY_READ_TIMEOUT_MS,
  });
  return unwrap(data, "/user-configs");
}

export async function fetchUserConfigById(userId: number): Promise<UserConfigPublic> {
  const { data } = await http.get<ApiOk<UserConfigPublic>>(`/user-configs/${userId}`);
  return unwrap(data, `/user-configs/${userId}`);
}

export async function putUserConfig(
  userId: number,
  body: Partial<{
    banned: boolean;
  }>,
): Promise<UserConfigPublic> {
  const { data } = await http.put<ApiOk<UserConfigPublic>>(`/user-configs/${userId}`, body);
  return unwrap(data, `/user-configs/${userId}`);
}

export async function fetchAiExtensionConfig(): Promise<AiExtensionConfig> {
  const { data } = await http.get<ApiOk<AiExtensionConfig>>("/ai-extension/config");
  return unwrap(data, "/ai-extension/config");
}

export async function putAiExtensionConfig(body: AiExtensionConfig): Promise<AiExtensionConfig> {
  const { data } = await http.put<ApiOk<AiExtensionConfig>>("/ai-extension/config", body);
  return unwrap(data, "/ai-extension/config");
}

export async function postAiExtensionTest(): Promise<AiExtensionTestData> {
  const { data } = await http.post<ApiOk<AiExtensionTestData>>("/ai-extension/test");
  return unwrap(data, "/ai-extension/test");
}

export async function fetchAiExtensionLogs(
  kind: "uvicorn" | "celery",
  n = 200,
): Promise<AiExtensionLogsData> {
  const { data } = await http.get<ApiOk<AiExtensionLogsData>>("/ai-extension/logs", {
    params: { kind, n },
  });
  return unwrap(data, "/ai-extension/logs");
}

export async function fetchAiNcmStatus(): Promise<AiProxyResult> {
  const { data } = await http.get<ApiOk<AiProxyResult>>("/ai-extension/ncm/status");
  return unwrap(data, "/ai-extension/ncm/status");
}

export async function postAiNcmSendSms(body: { phone: string; ctcode: number }): Promise<AiProxyResult> {
  const { data } = await http.post<ApiOk<AiProxyResult>>("/ai-extension/ncm/send-sms", body);
  return unwrap(data, "/ai-extension/ncm/send-sms");
}

export async function postAiNcmVerifySms(body: {
  phone: string;
  captcha: string;
  ctcode: number;
}): Promise<AiProxyResult> {
  const { data } = await http.post<ApiOk<AiProxyResult>>("/ai-extension/ncm/verify-sms", body);
  return unwrap(data, "/ai-extension/ncm/verify-sms");
}

export async function postAiNcmLogout(): Promise<AiProxyResult> {
  const { data } = await http.post<ApiOk<AiProxyResult>>("/ai-extension/ncm/logout");
  return unwrap(data, "/ai-extension/ncm/logout");
}

let updateCheckInflight: Promise<UpdateCheckData> | null = null;

export async function fetchUpdateCheck(): Promise<UpdateCheckData> {
  if (!updateCheckInflight) {
    updateCheckInflight = (async () => {
      const { data } = await http.get<ApiOk<UpdateCheckData>>("/update/check");
      return unwrap(data, "/update/check");
    })().finally(() => {
      updateCheckInflight = null;
    });
  }
  return updateCheckInflight;
}

export async function postUpdateApply(): Promise<UpdateApplyData> {
  const { data } = await http.post<ApiOk<UpdateApplyData>>("/update/apply");
  return unwrap(data, "/update/apply");
}

let botUpdateCheckInflight: Promise<BotUpdateCheckData> | null = null;

let updateCheckAllInflight: Promise<UpdateCheckAllData> | null = null;

export async function fetchUpdateCheckAll(): Promise<UpdateCheckAllData> {
  if (!updateCheckAllInflight) {
    updateCheckAllInflight = (async () => {
      const { data } = await http.get<ApiOk<UpdateCheckAllData>>("/update/check-all");
      return unwrap(data, "/update/check-all");
    })().finally(() => {
      updateCheckAllInflight = null;
    });
  }
  return updateCheckAllInflight;
}

export async function fetchBotUpdateCheck(): Promise<BotUpdateCheckData> {
  if (!botUpdateCheckInflight) {
    botUpdateCheckInflight = (async () => {
      const { data } = await http.get<ApiOk<BotUpdateCheckData>>("/update/bot/check");
      return unwrap(data, "/update/bot/check");
    })().finally(() => {
      botUpdateCheckInflight = null;
    });
  }
  return botUpdateCheckInflight;
}

export async function postBotUpdateApply(options?: { restart?: boolean }): Promise<BotUpdateApplyData> {
  const { data } = await http.post<ApiOk<BotUpdateApplyData>>(
    "/update/bot/apply",
    null,
    { params: { restart: options?.restart ? "true" : "false" } },
  );
  return unwrap(data, "/update/bot/apply");
}

export async function postSystemRestart(options?: {
  workersOnly?: boolean;
}): Promise<SystemRestartData> {
  const { data } = await http.post<ApiOk<SystemRestartData>>("/system/restart", {
    workers_only: Boolean(options?.workersOnly),
  });
  return unwrap(data, "/system/restart");
}

export async function fetchBotConfigMigrationCheck(): Promise<BotConfigMigrationCheckData> {
  const { data } = await http.get<ApiOk<BotConfigMigrationCheckData>>("/update/bot/config-migration/check");
  return unwrap(data, "/update/bot/config-migration/check");
}

export async function postBotConfigMigrationApply(force = false): Promise<BotConfigMigrationApplyData> {
  const { data } = await http.post<ApiOk<BotConfigMigrationApplyData>>(
    "/update/bot/config-migration/apply",
    null,
    { params: { force: force ? "true" : "false" } },
  );
  return unwrap(data, "/update/bot/config-migration/apply");
}
