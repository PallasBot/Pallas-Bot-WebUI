import { DB_HEAVY_READ_TIMEOUT_MS, http } from "./http";
import { notifyInstancesCatalogUpdated } from "@/utils/catalogSync";
import type {
  UpdateCheckData,
  UpdateApplyData,
  BotUpdateCheckData,
  BotUpdateApplyData,
  ApiOk,
  BotConfigPublic,
  BotRow,
  DbBackupInfo,
  DbBackupJobData,
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
  SystemData,
  UserConfigPublic,
  AiExtensionConfig,
  AiExtensionTestData,
  AiExtensionLogsData,
  AiProxyResult,
  HelpMenuVisibilityData,
  PluginConfigData,
  PluginConfigCheckResult,
  CommonConfigSectionMeta,
  MessageStatsData,
  CommunityStatsData,
  ConsoleDailyStatsData,
  PluginRunStatsData,
  ShardObservabilityData,
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

export async function fetchShardObservability(): Promise<ShardObservabilityData> {
  const { data } = await http.get<ApiOk<ShardObservabilityData>>("/shard-observability");
  return unwrap(data, "/shard-observability");
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

export async function postDbBackupRunsDelete(body: {
  paths: string[];
  output_parent?: string | null;
}): Promise<DbBackupDeleteResult> {
  const { data } = await http.post<ApiOk<DbBackupDeleteResult>>("/db/backup/runs/delete", body);
  return unwrap(data, "/db/backup/runs/delete");
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

export async function fetchUpdateCheck(): Promise<UpdateCheckData> {
  const { data } = await http.get<ApiOk<UpdateCheckData>>("/update/check");
  return unwrap(data, "/update/check");
}

export async function postUpdateApply(): Promise<UpdateApplyData> {
  const { data } = await http.post<ApiOk<UpdateApplyData>>("/update/apply");
  return unwrap(data, "/update/apply");
}

export async function fetchBotUpdateCheck(): Promise<BotUpdateCheckData> {
  const { data } = await http.get<ApiOk<BotUpdateCheckData>>("/update/bot/check");
  return unwrap(data, "/update/bot/check");
}

export async function postBotUpdateApply(): Promise<BotUpdateApplyData> {
  const { data } = await http.post<ApiOk<BotUpdateApplyData>>("/update/bot/apply");
  return unwrap(data, "/update/bot/apply");
}
