import { isAxiosError } from "axios";
import type { AiExtensionLogKind } from "@/config/aiConstants";
import type {
  CommunityPluginRow,
  OfficialExtensionRow,
  PluginRow,
  KnowledgeSourceDetail,
  KnowledgeSourceRetrieveData,
  LlmToolIntentPreview,
} from "@/api/pallasTypes";
import { http } from "./http";

export type {
  CommunityPluginRow,
  OfficialExtensionRow,
  PluginRow,
  KnowledgeSourceDetail,
  KnowledgeSourceRetrieveData,
  LlmToolIntentPreview,
};

export type SystemData = {
  plugin_count: number;
  bot_count: number;
  server_time: number;
  runtime?: {
    hostname?: string | null;
    cpu_percent?: number | null;
    memory?: { percent?: number | null; used?: number | null; total?: number | null };
    python?: string;
  };
  console?: { version?: string; frontend?: string; pallas_webui_dev_mode?: boolean; static_root?: string };
};

export type NonebotBotRow = {
  connection_key?: string;
  self_id?: string;
  nickname?: string;
  online?: boolean;
  adapter?: string;
  shard_id?: number;
};

export type ProtocolAccount = {
  id: string;
  display_name?: string;
  protocol_backend?: string;
  enabled?: boolean;
  qq?: string;
  ws_url?: string;
  webui_port?: number;
  working_dir?: string;
};

export type ProtocolSnap = {
  plugin?: string;
  webui_enabled?: boolean;
  webui_path?: string;
  console_auth_configured?: boolean;
  accounts?: ProtocolAccount[];
};

export type InstancesData = {
  nonebot_bots?: NonebotBotRow[];
  db_bot_configs?: unknown[];
  pallas_protocol?: ProtocolSnap;
};

export type MessageStatsData = {
  total_sent: number;
  total_received: number;
  today_sent: number;
  today_received: number;
  bots?: Array<{
    self_id: string;
    sent: number;
    received: number;
    today_sent: number;
    today_received: number;
  }>;
};

export type PluginRunStatsData = {
  total_runs: number;
  total_errors: number;
  total_runs_today: number;
  total_errors_today: number;
  bots?: Array<{
    self_id: string;
    runs: number;
    errors: number;
    runs_today: number;
    errors_today: number;
    plugins?: Array<{ name: string; runs: number; errors: number; avg_duration_ms?: number }>;
  }>;
};

export type LogErrorItem = {
  at?: number;
  plugin?: string;
  exc_type?: string;
  message?: string;
  traceback?: string;
};

export type LogErrorsData = {
  log_error_log?: LogErrorItem[];
  sharded_log_errors?: boolean;
  log_error_sources?: string[];
};

export type FriendRow = { user_id: number; nickname?: string; remark?: string };
export type GroupRow = { group_id: number; group_name?: string; member_count?: number };

export type RequestOverviewBot = {
  self_id: string;
  online?: boolean;
  adapter?: string;
  pending_friend_requests?: Array<{ user_id: number; flag: string; comment?: string }>;
  pending_group_requests?: Array<{
    flag: string;
    sub_type?: string;
    user_id?: number;
    group_id?: number;
    comment?: string;
  }>;
};

export type DbOverviewData = {
  backend: string;
  tables: Array<{ table: string; count: number; count_estimated?: boolean }>;
};

export type DbBackupInfo = {
  backend?: string;
  default_output_parent?: string;
  tool_name?: string;
  tool_available?: boolean;
  restore_tool_available?: boolean;
  tool_install_hint?: string;
};

export type DbBackupRun = {
  id?: string;
  path?: string;
  label?: string;
  created_at?: string | number;
  scope?: string;
  size_bytes?: number;
  status?: string;
};

export type PluginConfigField = {
  name: string;
  kind: string;
  required?: boolean;
  description?: string;
  env_key?: string;
  default?: unknown;
  current?: unknown;
  label?: string;
  /** 兼容旧前端 options；优先用 choices */
  options?: Array<{ value: string; label?: string } | string>;
  choices?: string[];
  choice_labels?: Record<string, string>;
  secret?: boolean;
  multiline?: boolean;
  min_value?: number;
  max_value?: number;
  ui_group?: string;
  ui_order?: number;
  ui_hidden?: boolean;
  ui_widget?: string;
  ui_gateway?: Record<string, unknown>;
};

export type PluginConfigData = {
  plugin: string;
  module?: string;
  fields: PluginConfigField[];
  field_groups?: import("@/api/pallasTypes").PluginConfigFieldGroup[];
  unexpected_keys?: string[];
  hot_reload?: boolean;
};

export type ExtensionInstallJob = { job_id: string; package?: string; plugin_id?: string; target?: string };

export type DbBackupJobData = {
  job_id?: string;
  status?: string;
  phase?: string;
  message?: string;
  error?: string | null;
  progress?: number;
  path?: string;
};

export type CommunityStoreData = {
  source?: string;
  error?: string | null;
  plugins?: CommunityPluginRow[];
  webui_install?: boolean;
};

export type CommunityStatsData = {
  deployments_total?: number;
  deployments_online?: number;
  bots_online_sum?: number;
  stats_url?: string;
  as_of?: string;
  active_recent_24h?: number;
  corpus_enabled?: boolean;
  corpus?: Record<string, number>;
  online_versions?: Array<{ version: string; count: number }>;
};

export type LlmRuntimeOverview = {
  health?: {
    ok?: boolean;
    url?: string;
    llm_runtime_detail?: string;
    llm_health?: {
      health_state?: string;
      provider_status?: Array<{
        id: string;
        kind?: string;
        enabled?: boolean;
        reachable?: boolean;
        health_state?: string;
      }>;
    };
  };
  task_stats?: Record<string, unknown>;
};

export type LlmHistorySession = {
  session_key: string;
  bot_id?: number;
  group_id?: number;
  user_id?: number;
  turn_count?: number;
  last_created_at?: number;
  last_role?: string;
  last_content?: string;
};

export type AiInstallStatus = {
  detected?: boolean;
  ai_root?: string | null;
  layout?: string;
  bootstrap_ready?: boolean;
  deployment?: string;
  can_clone?: boolean;
  can_bootstrap?: boolean;
  can_update?: boolean;
  /** 托管仓相对远端是否有更新；null 表示探测失败/未查 */
  has_update?: boolean | null;
  installed_ref?: string | null;
  latest_ref?: string | null;
  update_check_error?: string | null;
  in_docker?: boolean;
  docker_hint?: string;
  endpoint?: { host?: string; port?: number };
};

export type AiRuntimeCallbackStatus = {
  can_edit?: boolean;
  host?: string | null;
  port?: number | null;
  expected_host?: string | null;
  expected_port?: number | null;
  aligned?: boolean | null;
  probe?: {
    ok?: boolean;
    url?: string | null;
    status_code?: number | null;
    error?: string | null;
  } | null;
  error?: string | null;
};

export type AiRuntimeStatus = {
  can_manage?: boolean;
  running?: boolean;
  ai_root?: string;
  layout?: string;
  endpoint?: { host?: string; port?: number };
  services?: Record<string, { running?: boolean; pid?: number | null }>;
  health?: { ok?: boolean; url?: string; error?: string };
  callback?: AiRuntimeCallbackStatus;
};

export type AiExtensionConfig = {
  base_url?: string;
  api_prefix?: string;
  token?: string;
  timeout_sec?: number;
  health_paths?: string[];
  uvicorn_log_file?: string;
  celery_log_file?: string;
  celery_media_log_file?: string;
};

export type AuthSetupStatus = {
  auth_configured?: boolean;
  setup_completed?: boolean;
  default_password_active?: boolean;
  requires_setup?: boolean;
};

export type UpdateCheckData = {
  current_tag?: string;
  latest_tag?: string;
  has_update?: boolean;
  release_url?: string;
  release_notes?: string;
  error?: string | null;
  checked_at?: number;
};

export type ConsoleDailyStatsData = {
  start?: string;
  end?: string;
  rows?: Array<{
    date: string;
    self_id: string;
    received: number;
    sent: number;
    matcher_runs: number;
    api_calls: number;
  }>;
  live_today?: Record<string, unknown>;
};

/** 控制台 API 统一 { ok, data } 信封 */
function envelopeData<T>(body: unknown): T {
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export async function fetchPlugins(): Promise<PluginRow[]> {
  const { data: body } = await http.get("/plugins");
  const data = envelopeData<PluginRow[] | { plugins?: PluginRow[] }>(body);
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.plugins)) return data.plugins;
  return [];
}

export async function fetchSystem(): Promise<SystemData> {
  const { data: body } = await http.get("/system");
  return envelopeData<SystemData>(body);
}

export async function fetchLogs(n = 200): Promise<string[]> {
  const { data: body } = await http.get("/logs", { params: { n, scope: "all" } });
  const data = envelopeData<{ lines?: string[] }>(body);
  return Array.isArray(data?.lines) ? data.lines : [];
}

export async function fetchInstances(): Promise<InstancesData> {
  const { data: body } = await http.get("/instances");
  return envelopeData<InstancesData>(body) || {};
}

export async function fetchInstancesSummary(): Promise<{ bot_count: number; account_count: number }> {
  try {
    const data = await fetchInstances();
    const bots = data.nonebot_bots || [];
    const accounts = data.pallas_protocol?.accounts || [];
    return { bot_count: bots.length, account_count: accounts.length };
  } catch {
    return { bot_count: 0, account_count: 0 };
  }
}

export async function fetchMessageStats(days = 7): Promise<MessageStatsData> {
  const { data: body } = await http.get("/message-stats", { params: { days } });
  return envelopeData<MessageStatsData>(body);
}

export async function fetchPluginRunStats(days = 7): Promise<PluginRunStatsData> {
  const { data: body } = await http.get("/plugin-run-stats", { params: { days } });
  return envelopeData<PluginRunStatsData>(body);
}

export async function fetchConsoleDailyStats(days = 7): Promise<ConsoleDailyStatsData> {
  const { data: body } = await http.get("/console-daily-stats", { params: { days } });
  return envelopeData<ConsoleDailyStatsData>(body);
}

export async function fetchLogErrors(n = 100): Promise<LogErrorsData> {
  const { data: body } = await http.get("/log-errors", { params: { n } });
  return envelopeData<LogErrorsData>(body) || {};
}

export async function fetchRequestOverview(): Promise<{ bots: RequestOverviewBot[] }> {
  const { data: body } = await http.get("/request-overview");
  return envelopeData<{ bots: RequestOverviewBot[] }>(body) || { bots: [] };
}

export async function fetchFriendList(selfId: string | number, limit = 800): Promise<{ friends: FriendRow[] }> {
  const { data: body } = await http.get("/friend-list", { params: { self_id: selfId, limit } });
  return envelopeData<{ friends: FriendRow[] }>(body) || { friends: [] };
}

export async function fetchGroupList(selfId: string | number, limit = 1000): Promise<{ groups: GroupRow[] }> {
  const { data: body } = await http.get("/group-list", { params: { self_id: selfId, limit } });
  return envelopeData<{ groups: GroupRow[] }>(body) || { groups: [] };
}

export async function fetchDbOverview(): Promise<DbOverviewData> {
  const { data: body } = await http.get("/db/overview");
  return envelopeData<DbOverviewData>(body);
}

export async function fetchDbBackupInfo(): Promise<DbBackupInfo> {
  const { data: body } = await http.get("/db/backup/info");
  return envelopeData<DbBackupInfo>(body) || {};
}

export async function fetchDbBackupRuns(): Promise<{ runs: DbBackupRun[] }> {
  const { data: body } = await http.get("/db/backup/runs");
  const data = envelopeData<{ runs?: DbBackupRun[] }>(body);
  return { runs: Array.isArray(data?.runs) ? data.runs : [] };
}

export async function fetchOfficialExtensions(): Promise<OfficialExtensionRow[]> {
  const { data: body } = await http.get("/plugins/official-extensions");
  const data = envelopeData<OfficialExtensionRow[]>(body);
  return Array.isArray(data) ? data : [];
}

export async function fetchCommunityPluginStore(): Promise<CommunityStoreData> {
  const { data: body } = await http.get("/plugins/community-store");
  return envelopeData<CommunityStoreData>(body) || {};
}

export async function fetchCommunityStats(): Promise<CommunityStatsData> {
  const { data: body } = await http.get("/community-stats");
  return envelopeData<CommunityStatsData>(body) || {};
}

export async function fetchLlmRuntimeOverview(): Promise<LlmRuntimeOverview> {
  const { data: body } = await http.get("/common-config/llm/runtime-overview");
  return envelopeData<LlmRuntimeOverview>(body) || {};
}

export async function fetchLlmHistorySessions(limit = 50): Promise<LlmHistorySession[]> {
  const { data: body } = await http.get("/common-config/llm/history/sessions", { params: { limit } });
  const data = envelopeData<{ items?: LlmHistorySession[] }>(body);
  return Array.isArray(data?.items) ? data.items : [];
}

export type LlmProviderCapability = "text" | "image" | "audio" | "video";

export type LlmProviderModelEffort =
  | ""
  | "enable"
  | "disable"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export type LlmProviderRequestMethod = "chat_completions" | "responses";

export type LlmModelPricingRow = {
  price_in?: number;
  price_out?: number;
  cache_price_in?: number;
  cache_price_out?: number;
};

export type LlmProviderRow = {
  id: string;
  kind: string;
  base_url: string;
  api_key?: string;
  api_keys?: string[];
  api_key_env: string;
  api_key_set?: boolean;
  api_keys_count?: number;
  default_model: string;
  enabled: boolean;
  task_models: Record<string, string>;
  capabilities?: LlmProviderCapability[];
  model_effort?: LlmProviderModelEffort | string;
  request_method?: LlmProviderRequestMethod | string;
  /** 模型单价（每百万 tokens）；币种见 routing.cost_currency */
  model_pricing?: Record<string, LlmModelPricingRow>;
};

export type LlmProvidersConfig = {
  providers: LlmProviderRow[];
  routing: {
    chain_fallback: string[];
    tasks: Record<string, string>;
    tier_backups?: { high?: string; low?: string };
    tier_backup_models?: { high?: string; low?: string };
    task_backups?: Record<string, string>;
    task_backup_models?: Record<string, string>;
    /** 最近一次编排写入来源（UI）；运行时主路由读 tasks，备用先 task 再 tier */
    route_source?: "tiers" | "tasks";
    /** 与画画统计共用语义：费用币种（如 CNY） */
    cost_currency?: string;
  };
  providers_file?: string;
  file_exists?: boolean;
};

export type LlmProvidersSaveResult = {
  providers_file?: string;
  provider_status?: Array<{
    id: string;
    kind?: string;
    enabled?: boolean;
    configured?: boolean;
    reachable?: boolean | null;
    default_model?: string;
    base_url?: string;
  }>;
  task_routing?: Record<string, string>;
};

export type LlmProviderTestResult = {
  provider_id?: string;
  reachable?: boolean;
  latency_ms?: number | null;
  error?: string;
  status?: number | null;
  enabled?: boolean | null;
};

export type LlmProviderModelsResult = {
  provider_id?: string;
  ok?: boolean;
  models?: string[];
  source?: string;
  error?: string;
};

export type LlmLocalRoutingConfig = {
  llm_model?: string;
  local_multi_model_enabled?: boolean;
  moe_models?: Record<string, string>;
  task_models?: Record<string, string>;
  env_file?: string;
};

export async function fetchLlmProvidersConfig(): Promise<LlmProvidersConfig> {
  const { data: body } = await http.get("/common-config/llm/providers");
  const data = envelopeData<LlmProvidersConfig>(body);
  const routingIn = data?.routing;
  const routing: LlmProvidersConfig["routing"] = {
    chain_fallback: Array.isArray(routingIn?.chain_fallback) ? routingIn.chain_fallback : [],
    tasks: routingIn?.tasks && typeof routingIn.tasks === "object" ? routingIn.tasks : {},
  };
  if (routingIn && Object.prototype.hasOwnProperty.call(routingIn, "tier_backups")) {
    const raw = routingIn.tier_backups;
    const tier_backups: { high?: string; low?: string } = {};
    if (raw && typeof raw === "object") {
      const high = String((raw as { high?: string }).high || "").trim();
      const low = String((raw as { low?: string }).low || "").trim();
      if (high) tier_backups.high = high;
      if (low) tier_backups.low = low;
    }
    routing.tier_backups = tier_backups;
  }
  if (routingIn && Object.prototype.hasOwnProperty.call(routingIn, "tier_backup_models")) {
    const raw = routingIn.tier_backup_models;
    const tier_backup_models: { high?: string; low?: string } = {};
    if (raw && typeof raw === "object") {
      const high = String((raw as { high?: string }).high || "").trim();
      const low = String((raw as { low?: string }).low || "").trim();
      if (high) tier_backup_models.high = high;
      if (low) tier_backup_models.low = low;
    }
    routing.tier_backup_models = tier_backup_models;
  }
  if (routingIn && Object.prototype.hasOwnProperty.call(routingIn, "task_backups")) {
    const raw = routingIn.task_backups;
    const task_backups: Record<string, string> = {};
    if (raw && typeof raw === "object") {
      for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        const task = String(key || "").trim();
        const providerId = String(value || "").trim();
        if (task && providerId) task_backups[task] = providerId;
      }
    }
    routing.task_backups = task_backups;
  }
  if (routingIn && Object.prototype.hasOwnProperty.call(routingIn, "task_backup_models")) {
    const raw = routingIn.task_backup_models;
    const task_backup_models: Record<string, string> = {};
    if (raw && typeof raw === "object") {
      for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        const task = String(key || "").trim();
        const model = String(value || "").trim();
        if (task && model) task_backup_models[task] = model;
      }
    }
    routing.task_backup_models = task_backup_models;
  }
  if (routingIn && Object.prototype.hasOwnProperty.call(routingIn, "route_source")) {
    const raw = String(routingIn.route_source || "").trim();
    if (raw === "tiers" || raw === "tasks") routing.route_source = raw;
  }
  if (routingIn && Object.prototype.hasOwnProperty.call(routingIn, "cost_currency")) {
    routing.cost_currency = String(routingIn.cost_currency || "").trim().toUpperCase();
  }
  return {
    providers: Array.isArray(data?.providers) ? data.providers : [],
    routing,
    providers_file: data?.providers_file,
    file_exists: data?.file_exists,
  };
}

export async function putLlmProvidersConfig(body: LlmProvidersConfig): Promise<LlmProvidersSaveResult> {
  const payload = {
    providers: body.providers.map((row) => {
      const apiKeys = (Array.isArray(row.api_keys) ? row.api_keys : [])
        .map((k) => String(k || "").trim())
        .filter(Boolean);
      const apiKey = String(row.api_key ?? "").trim() || apiKeys[0] || "";
      const apiKeyEnv = String(row.api_key_env ?? "").trim();
      const item: Record<string, unknown> = {
        id: row.id,
        kind: row.kind,
        base_url: row.base_url,
        api_key_env: apiKeyEnv,
        default_model: row.default_model,
        enabled: row.enabled,
        task_models: row.task_models,
        capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
        model_effort: row.model_effort ?? "",
        request_method: row.request_method || "chat_completions",
        model_pricing: row.model_pricing && typeof row.model_pricing === "object" ? row.model_pricing : {},
      };
      if (apiKeys.length) item.api_keys = apiKeys;
      if (apiKey) item.api_key = apiKey;
      return item;
    }),
    routing: body.routing,
  };
  const { data: res } = await http.put("/common-config/llm/providers", payload, { timeout: 60_000 });
  return envelopeData<LlmProvidersSaveResult>(res) || {};
}

/** 只保存单个提供方，避免整表 PUT 误擦其他提供方已存密钥。 */
export async function putLlmProvider(row: LlmProviderRow): Promise<LlmProvidersSaveResult> {
  const id = String(row.id || "").trim();
  if (!id) throw new Error("provider id is required");
  const apiKeys = (Array.isArray(row.api_keys) ? row.api_keys : [])
    .map((k) => String(k || "").trim())
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
    model_pricing: row.model_pricing && typeof row.model_pricing === "object" ? row.model_pricing : {},
  };
  if (apiKeys.length) payload.api_keys = apiKeys;
  if (apiKey) payload.api_key = apiKey;
  const { data: res } = await http.put(
    `/common-config/llm/providers/${encodeURIComponent(id)}`,
    payload,
    { timeout: 60_000 },
  );
  return envelopeData<LlmProvidersSaveResult>(res) || {};
}

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
  const { data: body } = await http.post(
    `/common-config/llm/providers/${encodeURIComponent(providerId)}/test`,
    {
      base_url: opts?.base_url ?? "",
      api_key: opts?.api_key ?? "",
      api_key_env: opts?.api_key_env ?? "",
      kind: opts?.kind ?? "",
      request_method: opts?.request_method ?? "",
    },
    { timeout: 60_000 },
  );
  return envelopeData<LlmProviderTestResult>(body) || {};
}

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
  const { data: body } = await http.post(
    `/common-config/llm/providers/${encodeURIComponent(providerId)}/models`,
    {
      base_url: opts?.base_url ?? "",
      api_key: opts?.api_key ?? "",
      api_key_env: opts?.api_key_env ?? "",
      kind: opts?.kind ?? "",
      request_method: opts?.request_method ?? "",
    },
    { timeout: 60_000 },
  );
  return envelopeData<LlmProviderModelsResult>(body) || {};
}

export async function fetchLlmLocalRoutingConfig(): Promise<LlmLocalRoutingConfig> {
  const { data: body } = await http.get("/common-config/llm/local-routing");
  return envelopeData<LlmLocalRoutingConfig>(body) || {};
}

export async function putLlmLocalRoutingConfig(
  body: LlmLocalRoutingConfig,
): Promise<LlmLocalRoutingConfig> {
  const { data: res } = await http.put("/common-config/llm/local-routing", body, { timeout: 60_000 });
  return envelopeData<LlmLocalRoutingConfig>(res) || body;
}

export async function fetchAiExtensionConfig(): Promise<AiExtensionConfig> {
  const { data: body } = await http.get("/ai-extension/config");
  return envelopeData<AiExtensionConfig>(body) || {};
}

export async function fetchAiInstallStatus(): Promise<AiInstallStatus> {
  const { data: body } = await http.get("/ai-extension/install/status");
  return envelopeData<AiInstallStatus>(body) || {};
}

export async function fetchAiRuntimeStatus(): Promise<AiRuntimeStatus> {
  const { data: body } = await http.get("/ai-extension/runtime/status");
  return envelopeData<AiRuntimeStatus>(body) || {};
}

export async function fetchAuthSetupStatus(): Promise<AuthSetupStatus> {
  const { data: body } = await http.get("/auth/setup-status");
  return envelopeData<AuthSetupStatus>(body) || {};
}

export async function changeConsoleLogin(newPassword: string): Promise<{ ok?: boolean; message?: string }> {
  const { data: body } = await http.post("/security/console-login", { new_password: newPassword });
  return envelopeData(body) || body;
}

export async function fetchUpdateCheck(): Promise<UpdateCheckData> {
  const { data: body } = await http.get("/update/check");
  return envelopeData<UpdateCheckData>(body) || {};
}

export async function fetchPluginConfig(pluginName: string): Promise<PluginConfigData> {
  const { data: body } = await http.get(`/plugins/${encodeURIComponent(pluginName)}/config`);
  return envelopeData<PluginConfigData>(body);
}

export async function putPluginConfig(
  pluginName: string,
  values: Record<string, unknown>,
): Promise<PluginConfigData> {
  const { data: body } = await http.put(`/plugins/${encodeURIComponent(pluginName)}/config`, { values });
  return envelopeData<PluginConfigData>(body);
}

export async function fetchPluginConfigRaw(pluginName: string): Promise<string> {
  const { data: body } = await http.get(`/plugins/${encodeURIComponent(pluginName)}/config/raw`);
  const data = envelopeData<{ toml?: string }>(body);
  return typeof data?.toml === "string" ? data.toml : "";
}

export async function putPluginConfigRaw(pluginName: string, toml: string): Promise<PluginConfigData> {
  const { data: body } = await http.put(`/plugins/${encodeURIComponent(pluginName)}/config/raw`, { toml });
  return envelopeData<PluginConfigData>(body);
}

export async function postRequestAction(body: {
  self_id: number;
  kind: "friend" | "group";
  action?: "approve" | "reject";
  source?: "pending" | "doubt";
  user_id?: number;
  group_id?: number;
}): Promise<{ handled?: boolean }> {
  const { data: res } = await http.post("/request-actions", body);
  return envelopeData(res) || res;
}

export async function postRequestActionsBatch(body: {
  action: "approve" | "reject";
  friends: Array<{ self_id: number; user_id: number; source: "pending" | "doubt" }>;
  groups: Array<{ self_id: number; user_id: number; group_id: number }>;
}): Promise<{
  friends_ok: number;
  friends_fail: number;
  groups_ok: number;
  groups_fail: number;
}> {
  const { data: res } = await http.post("/request-actions/batch", body);
  return envelopeData(res) || res;
}

export async function installOfficialExtensionAsync(
  packageName: string,
  options?: { restart?: boolean },
): Promise<ExtensionInstallJob> {
  const { data: body } = await http.post(
    "/plugins/official-extensions/install-async",
    { package: packageName, restart: Boolean(options?.restart) },
    { timeout: 60_000 },
  );
  return envelopeData<ExtensionInstallJob>(body);
}

export async function updateOfficialExtensionAsync(
  packageName: string,
  options?: { restart?: boolean },
): Promise<ExtensionInstallJob> {
  const { data: body } = await http.post(
    "/plugins/official-extensions/update-async",
    { package: packageName, restart: Boolean(options?.restart) },
    { timeout: 60_000 },
  );
  return envelopeData<ExtensionInstallJob>(body);
}

export async function uninstallOfficialExtensionAsync(
  packageName: string,
  options?: { restart?: boolean },
): Promise<ExtensionInstallJob> {
  const { data: body } = await http.post(
    "/plugins/official-extensions/uninstall-async",
    { package: packageName, restart: Boolean(options?.restart) },
    { timeout: 60_000 },
  );
  return envelopeData<ExtensionInstallJob>(body);
}

export async function uninstallOfficialExtension(
  packageName: string,
  options?: { restart?: boolean },
): Promise<{ message?: string; needs_restart?: boolean }> {
  const { data: body } = await http.post(
    "/plugins/official-extensions/uninstall",
    { package: packageName, restart: Boolean(options?.restart) },
    { timeout: 120_000 },
  );
  return envelopeData(body) || body;
}

export async function updateOfficialExtension(
  packageName: string,
  options?: { restart?: boolean },
): Promise<{ message?: string; needs_restart?: boolean }> {
  const { data: body } = await http.post(
    "/plugins/official-extensions/update",
    { package: packageName, restart: Boolean(options?.restart) },
    { timeout: 600_000 },
  );
  return envelopeData(body) || body;
}

export async function installCommunityPluginAsync(
  pluginId: string,
  options?: { restart?: boolean; repositoryUrl?: string; ref?: string },
): Promise<ExtensionInstallJob> {
  const { data: body } = await http.post(
    "/plugins/community-plugins/install-async",
    {
      plugin_id: pluginId,
      repository_url: options?.repositoryUrl,
      ref: options?.ref,
      restart: Boolean(options?.restart),
    },
    { timeout: 60_000 },
  );
  return envelopeData<ExtensionInstallJob>(body);
}

export async function updateCommunityPluginAsync(
  pluginId: string,
  options?: { restart?: boolean; ref?: string },
): Promise<ExtensionInstallJob> {
  const { data: body } = await http.post(
    "/plugins/community-plugins/update-async",
    {
      plugin_id: pluginId,
      ref: options?.ref,
      restart: Boolean(options?.restart),
    },
    { timeout: 60_000 },
  );
  return envelopeData<ExtensionInstallJob>(body);
}

export async function uninstallCommunityPluginAsync(
  pluginId: string,
  options?: { restart?: boolean },
): Promise<ExtensionInstallJob> {
  const { data: body } = await http.post(
    "/plugins/community-plugins/uninstall-async",
    { plugin_id: pluginId, restart: Boolean(options?.restart) },
    { timeout: 60_000 },
  );
  return envelopeData<ExtensionInstallJob>(body);
}

export async function uninstallCommunityPlugin(
  pluginId: string,
  options?: { restart?: boolean },
): Promise<{ message?: string; needs_restart?: boolean }> {
  const { data: body } = await http.post(
    "/plugins/community-plugins/uninstall",
    { plugin_id: pluginId, restart: Boolean(options?.restart) },
    { timeout: 120_000 },
  );
  return envelopeData(body) || body;
}

export async function updateCommunityPlugin(
  pluginId: string,
  options?: { restart?: boolean; ref?: string },
): Promise<{ message?: string; needs_restart?: boolean }> {
  const { data: body } = await http.post(
    "/plugins/community-plugins/update",
    { plugin_id: pluginId, restart: Boolean(options?.restart), ref: options?.ref },
    { timeout: 320_000 },
  );
  return envelopeData(body) || body;
}

export function openPluginInstallJobEventSource(jobId: string): EventSource {
  const root = ((import.meta.env.BASE_URL as string) || "/pallas/").replace(/\/$/, "");
  return new EventSource(`${root}/api/plugins/store-jobs/${encodeURIComponent(jobId)}/stream`, {
    withCredentials: true,
  });
}

/** @deprecated 使用 openPluginInstallJobEventSource（已指向 store-jobs） */
export function openPluginStoreJobEventSource(jobId: string): EventSource {
  return openPluginInstallJobEventSource(jobId);
}

export async function postDbBackup(body: {
  label?: string;
  scope?: "full" | "important";
  output_parent?: string | null;
}): Promise<DbBackupJobData> {
  const { data: res } = await http.post("/db/backup", body, { timeout: 60_000 });
  return envelopeData<DbBackupJobData>(res);
}

export async function fetchDbBackupJob(jobId: string): Promise<DbBackupJobData> {
  const { data: body } = await http.get(`/db/backup/jobs/${encodeURIComponent(jobId)}`);
  return envelopeData<DbBackupJobData>(body) || {};
}

export async function fetchActiveDbBackupJob(): Promise<DbBackupJobData | null> {
  const { data: body } = await http.get("/db/backup/jobs/active");
  return envelopeData<DbBackupJobData | null>(body);
}

export async function postDbBackupRunsDelete(paths: string[]): Promise<{ deleted?: number }> {
  const { data: body } = await http.post("/db/backup/runs/delete", { paths });
  return envelopeData(body) || body;
}

export async function fetchLlmHistorySession(params: {
  botId: number;
  groupId?: number | null;
  userId: number;
  limit?: number;
}): Promise<{
  session?: LlmHistorySession;
  turns?: Array<{ role?: string; content?: string; created_at?: number; user_id?: number }>;
}> {
  const { data: body } = await http.get("/common-config/llm/history/session", {
    params: {
      bot_id: params.botId,
      ...(params.groupId != null && params.groupId >= 0 ? { group_id: params.groupId } : {}),
      user_id: params.userId,
      ...(params.limit ? { limit: params.limit } : {}),
    },
  });
  return envelopeData(body) || {};
}

export async function putAiExtensionConfig(values: AiExtensionConfig): Promise<AiExtensionConfig> {
  const { data: body } = await http.put("/ai-extension/config", values);
  return envelopeData<AiExtensionConfig>(body) || values;
}

function unwrapNestedEnvelope<T>(body: unknown): T {
  const first = envelopeData<unknown>(body);
  if (first && typeof first === "object" && "data" in first && (first as { data?: unknown }).data != null) {
    return (first as { data: T }).data;
  }
  return first as T;
}

export type AiExtensionTestData = {
  ok?: boolean;
  status_code?: number | null;
  health_url?: string;
  tried_urls?: string[];
  error?: string | null;
};

export type AiExtensionLogsData = {
  lines?: string[];
  path?: string;
  source?: string;
  kind?: string;
  error?: string | null;
};

export type AiProxyResult = {
  ok?: boolean;
  status_code?: number;
  error?: string;
  data?: Record<string, unknown>;
};

export type LlmModelAdminStatus = {
  ai_reachable?: boolean;
  model?: string;
  num_gpu?: number | null;
  provider_mode?: string;
  ollama_host?: string;
};

export type LlmModelAdminModelResult = {
  model?: string;
  num_gpu?: number;
  status?: string;
  message?: string;
};

export type MediaAssetsStatus = {
  ok?: boolean;
  error?: string;
  deploy_mode?: string;
  media_packages_enabled?: Record<string, boolean>;
  assets?: Record<string, { ready?: boolean; path?: string; size_bytes?: number }>;
  all_media_assets_ready?: boolean;
  download_allowed?: boolean;
  delete_allowed?: boolean;
  hints?: string[];
};

export type MediaAssetsDownloadJob = {
  job_id?: string;
  state?: string;
  message?: string;
  assets?: string[];
  lines?: string[];
  error?: string;
  progress_percent?: number;
};

export type SingSpeakerRow = { id: string; path?: string; ready?: boolean; backends?: string[] };
export type SingSpeakersPayload = {
  speakers?: SingSpeakerRow[];
  default_speaker?: string;
  preferred_backend?: string;
  writable?: boolean;
};
export type SingBackendsPayload = {
  backends?: Array<{ id: string; enabled?: boolean }>;
  preferred_backend?: string;
  writable?: boolean;
};
export type TtsVoiceRow = { id: string; path: string; name?: string; size_bytes?: number };
export type TtsVoicesPayload = {
  voices?: TtsVoiceRow[];
  defaults?: { ref_audio_path?: string; prompt_text?: string; prompt_lang?: string; text_lang?: string };
  writable?: boolean;
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

export async function postAiExtensionTest(): Promise<AiExtensionTestData> {
  const { data: body } = await http.post("/ai-extension/test", {}, { timeout: 60_000 });
  return envelopeData<AiExtensionTestData>(body) || {};
}

export async function fetchAiExtensionLogs(
  kind: AiExtensionLogKind,
  n = 200,
): Promise<AiExtensionLogsData> {
  const { data: body } = await http.get("/ai-extension/logs", { params: { kind, n } });
  return envelopeData<AiExtensionLogsData>(body) || {};
}

export function openAiExtensionLogsEventSource(
  kind: AiExtensionLogKind = "uvicorn",
  lastEventId?: number,
): EventSource {
  const root = ((import.meta.env.BASE_URL as string) || "/pallas/").replace(/\/$/, "");
  const qs = new URLSearchParams({ kind });
  if (lastEventId != null && lastEventId > 0) qs.set("last_event_id", String(lastEventId));
  return new EventSource(`${root}/api/ai-extension/logs/stream?${qs.toString()}`, { withCredentials: true });
}

export async function postAiRuntimeStart(body?: { with_media?: boolean }): Promise<Record<string, unknown>> {
  const { data: res } = await http.post("/ai-extension/runtime/start", body ?? {}, { timeout: 120_000 });
  return envelopeData(res) || res;
}

export async function postAiRuntimeStop(): Promise<Record<string, unknown>> {
  const { data: res } = await http.post("/ai-extension/runtime/stop", {}, { timeout: 120_000 });
  return envelopeData(res) || res;
}

export async function putAiRuntimeCallback(body: {
  host?: string | null;
  port?: number | null;
  align?: boolean;
  restart_media?: boolean;
}): Promise<{
  ok?: boolean;
  error?: string | null;
  callback?: AiRuntimeCallbackStatus;
  output_tail?: string;
  runtime?: AiRuntimeStatus;
}> {
  const { data: res } = await http.put("/ai-extension/runtime/callback", body, { timeout: 180_000 });
  return envelopeData(res) || res;
}

export async function postAiInstall(body: {
  action: "clone" | "bootstrap" | "clone_and_bootstrap" | "update";
  no_start?: boolean;
  remote_only?: boolean;
  with_media?: boolean;
  use_gpu?: boolean;
}): Promise<{ job_id: string; action?: string }> {
  const { data: res } = await http.post("/ai-extension/install", body, { timeout: 60_000 });
  return envelopeData(res) || res;
}

export function openAiInstallJobEventSource(jobId: string): EventSource {
  const root = ((import.meta.env.BASE_URL as string) || "/pallas/").replace(/\/$/, "");
  return new EventSource(`${root}/api/ai-extension/install/jobs/${encodeURIComponent(jobId)}/stream`, {
    withCredentials: true,
  });
}

export async function fetchLlmModelAdminStatus(): Promise<LlmModelAdminStatus> {
  const { data: body } = await http.get("/common-config/llm/model-admin");
  return envelopeData<LlmModelAdminStatus>(body) || {};
}

export async function postLlmModelAdminSwitch(model: string, pull = true): Promise<LlmModelAdminModelResult> {
  const payload = { model, pull };
  const paths = ["/common-config/llm/model-admin/switch", "/common-config/llm/model-admin"];
  for (const path of paths) {
    try {
      const { data: body } = await http.post(path, payload, { timeout: 300_000 });
      return envelopeData<LlmModelAdminModelResult>(body) || {};
    } catch (e) {
      if (!isAxiosError(e) || (e.response?.status !== 404 && e.response?.status !== 405)) throw e;
    }
  }
  const { data: body } = await http.put("/common-config/llm/model-admin", payload, { timeout: 300_000 });
  return envelopeData<LlmModelAdminModelResult>(body) || {};
}

/** @deprecated 使用 postLlmModelAdminSwitch */
export async function putLlmModelAdminModel(model: string, pull = true): Promise<LlmModelAdminModelResult> {
  return postLlmModelAdminSwitch(model, pull);
}

export async function postLlmModelAdminReload(): Promise<LlmModelAdminModelResult> {
  const { data: body } = await http.post("/common-config/llm/model-admin/reload", {}, { timeout: 120_000 });
  return envelopeData<LlmModelAdminModelResult>(body) || {};
}

export async function postLlmModelAdminUnload(): Promise<{ status?: string }> {
  const { data: body } = await http.post("/common-config/llm/model-admin/unload", {}, { timeout: 120_000 });
  return envelopeData(body) || body;
}

export async function postLlmModelAdminNumGpu(numGpu: number): Promise<LlmModelAdminModelResult> {
  const { data: body } = await http.post("/common-config/llm/model-admin/num-gpu", { num_gpu: numGpu }, { timeout: 120_000 });
  return envelopeData<LlmModelAdminModelResult>(body) || {};
}

export async function fetchAiNcmStatus(): Promise<AiProxyResult> {
  const { data: body } = await http.get("/ai-extension/ncm/status");
  return envelopeData<AiProxyResult>(body) || {};
}

export async function postAiNcmSendSms(body: { phone: string; ctcode: number }): Promise<AiProxyResult> {
  const { data: res } = await http.post("/ai-extension/ncm/send-sms", body);
  return envelopeData<AiProxyResult>(res) || res;
}

export async function postAiNcmVerifySms(body: {
  phone: string;
  captcha: string;
  ctcode: number;
}): Promise<AiProxyResult> {
  const { data: res } = await http.post("/ai-extension/ncm/verify-sms", body);
  return envelopeData<AiProxyResult>(res) || res;
}

export async function postAiNcmLogout(): Promise<AiProxyResult> {
  const { data: res } = await http.post("/ai-extension/ncm/logout", {});
  return envelopeData<AiProxyResult>(res) || res;
}

export async function fetchMediaAssetsStatus(): Promise<MediaAssetsStatus> {
  const { data: body } = await http.get("/common-config/llm/media-assets/status");
  return unwrapNestedEnvelope<MediaAssetsStatus>(body);
}

export async function postMediaAssetsDownload(assets?: string[]): Promise<MediaAssetsDownloadJob> {
  const { data: body } = await http.post(
    "/common-config/llm/media-assets/download",
    assets?.length ? { assets } : {},
    { timeout: 60_000 },
  );
  return unwrapNestedEnvelope<MediaAssetsDownloadJob>(body);
}

export async function postMediaAssetsDelete(assets: string[]): Promise<{ deleted?: string[]; status?: MediaAssetsStatus }> {
  const { data: body } = await http.post("/common-config/llm/media-assets/delete", { assets });
  return unwrapNestedEnvelope(body);
}

export async function fetchMediaAssetsDownloadJob(jobId: string): Promise<MediaAssetsDownloadJob> {
  const { data: body } = await http.get(
    `/common-config/llm/media-assets/download/jobs/${encodeURIComponent(jobId)}`,
  );
  return unwrapNestedEnvelope<MediaAssetsDownloadJob>(body);
}

export async function fetchSingSpeakers(): Promise<SingSpeakersPayload> {
  const { data: body } = await http.get("/common-config/llm/media-models/sing/speakers");
  return unwrapNestedEnvelope<SingSpeakersPayload>(body);
}

export async function fetchSingBackends(): Promise<SingBackendsPayload> {
  const { data: body } = await http.get("/common-config/llm/media-models/sing/backends");
  return unwrapNestedEnvelope<SingBackendsPayload>(body);
}

export async function putSingDefaults(body: {
  default_speaker?: string;
  preferred_backend?: string;
}): Promise<{ default_speaker?: string; preferred_backend?: string }> {
  const { data: res } = await http.put("/common-config/llm/media-models/sing/defaults", body);
  return unwrapNestedEnvelope(res);
}

export async function fetchTtsVoices(): Promise<TtsVoicesPayload> {
  const { data: body } = await http.get("/common-config/llm/media-models/tts/voices");
  return unwrapNestedEnvelope<TtsVoicesPayload>(body);
}

export async function putTtsDefaults(body: {
  ref_audio_path?: string;
  prompt_text?: string;
  prompt_lang?: string;
  text_lang?: string;
}): Promise<Record<string, unknown>> {
  const { data: res } = await http.put("/common-config/llm/media-models/tts/defaults", body);
  return unwrapNestedEnvelope(res);
}

export async function fetchTtsTranslator(): Promise<TtsTranslatorPayload> {
  const { data: body } = await http.get("/common-config/llm/media-models/tts/translator");
  return unwrapNestedEnvelope<TtsTranslatorPayload>(body);
}

export async function putTtsTranslator(body: {
  enable?: boolean;
  provider?: string;
  baidu_app_id?: string;
  baidu_secret_key?: string;
  youdao_app_key?: string;
  youdao_app_secret?: string;
}): Promise<TtsTranslatorPayload> {
  const { data: res } = await http.put("/common-config/llm/media-models/tts/translator", body);
  return unwrapNestedEnvelope<TtsTranslatorPayload>(res);
}

export async function fetchCommonConfig(sectionId: string): Promise<PluginConfigData> {
  const { data: body } = await http.get(`/common-config/${encodeURIComponent(sectionId)}`);
  return envelopeData<PluginConfigData>(body);
}

export async function putCommonConfig(
  sectionId: string,
  values: Record<string, unknown>,
): Promise<PluginConfigData> {
  const { data: body } = await http.put(`/common-config/${encodeURIComponent(sectionId)}`, { values });
  return envelopeData<PluginConfigData>(body);
}

export async function fetchCommonConfigRaw(sectionId: string): Promise<string> {
  const { data: body } = await http.get(`/common-config/${encodeURIComponent(sectionId)}/raw`);
  const data = envelopeData<{ toml?: string }>(body);
  return typeof data?.toml === "string" ? data.toml : "";
}

export async function putCommonConfigRaw(sectionId: string, toml: string): Promise<PluginConfigData> {
  const { data: body } = await http.put(`/common-config/${encodeURIComponent(sectionId)}/raw`, { toml });
  return envelopeData<PluginConfigData>(body);
}

export type ConversationKernelStatus = Record<string, unknown>;
export type ConversationKernelTracesData = { items?: Array<Record<string, unknown>> };
export type ConversationKernelMemoryData = { items?: Array<Record<string, unknown>> };
export type ConversationKernelRelationshipNotesData = { items?: Array<Record<string, unknown>> };
export type ConversationKernelKnowledgeSourcesData = {
  items?: Array<Record<string, unknown>>;
  count?: number;
};

export type LlmToolCatalogData = {
  items?: Array<Record<string, unknown>>;
  count?: number;
  policy?: {
    tools_enabled?: boolean;
    selective_enabled?: boolean;
    max_rounds?: number;
    blacklist?: string[];
    arknights_kb_enabled?: boolean;
    desc_max_len?: number;
  };
};

export async function fetchConversationKernelStatus(): Promise<ConversationKernelStatus> {
  const { data: body } = await http.get("/llm/conversation-kernel/status");
  return envelopeData<ConversationKernelStatus>(body) || {};
}

export async function fetchConversationKernelTraces(params?: {
  groupId?: number | null;
  botId?: number | null;
  kind?: string;
  limit?: number;
}): Promise<ConversationKernelTracesData> {
  const { data: body } = await http.get("/llm/conversation-kernel/traces", {
    params: {
      kind: params?.kind || "decision",
      limit: params?.limit ?? 30,
      ...(params?.groupId != null && params.groupId > 0 ? { group_id: params.groupId } : {}),
      ...(params?.botId != null && params.botId > 0 ? { bot_id: params.botId } : {}),
    },
  });
  return envelopeData<ConversationKernelTracesData>(body) || {};
}

export async function fetchConversationKernelMemory(params: {
  botId: number;
  groupId?: number | null;
  query?: string;
  limit?: number;
}): Promise<ConversationKernelMemoryData> {
  const { data: body } = await http.get("/llm/conversation-kernel/memory", {
    params: {
      bot_id: params.botId,
      ...(params.groupId != null && params.groupId > 0 ? { group_id: params.groupId } : {}),
      ...(params.query?.trim() ? { query: params.query.trim() } : {}),
      limit: params.limit ?? 50,
    },
  });
  return envelopeData<ConversationKernelMemoryData>(body) || {};
}

export async function postConversationKernelMemoryDelete(body: {
  id: number;
  botId: number;
}): Promise<{ id?: number }> {
  const { data: res } = await http.post("/llm/conversation-kernel/memory/delete", {
    id: body.id,
    bot_id: body.botId,
  });
  return envelopeData(res) || res;
}

export async function fetchConversationKernelRelationshipNotes(params: {
  botId: number;
  groupId?: number | null;
  query?: string;
  limit?: number;
}): Promise<ConversationKernelRelationshipNotesData> {
  const { data: body } = await http.get("/llm/conversation-kernel/relationship-notes", {
    params: {
      bot_id: params.botId,
      ...(params.groupId != null && params.groupId > 0 ? { group_id: params.groupId } : {}),
      ...(params.query?.trim() ? { query: params.query.trim() } : {}),
      limit: params.limit ?? 50,
    },
  });
  return envelopeData<ConversationKernelRelationshipNotesData>(body) || {};
}

export async function postConversationKernelRelationshipNoteDelete(body: {
  id: number;
  botId: number;
}): Promise<{ id?: number }> {
  const { data: res } = await http.post("/llm/conversation-kernel/relationship-notes/delete", {
    id: body.id,
    bot_id: body.botId,
  });
  return envelopeData(res) || res;
}

export async function fetchConversationKernelKnowledgeSources(): Promise<ConversationKernelKnowledgeSourcesData> {
  const { data: body } = await http.get("/llm/conversation-kernel/knowledge-sources");
  return envelopeData<ConversationKernelKnowledgeSourcesData>(body) || {};
}

export async function fetchConversationKernelKnowledgeSourceDetail(
  sourceId: string,
  params?: { previewLimit?: number; previewContentLen?: number },
): Promise<KnowledgeSourceDetail> {
  const { data: body } = await http.get(
    `/llm/conversation-kernel/knowledge-sources/${encodeURIComponent(sourceId)}`,
    {
      params: {
        ...(params?.previewLimit ? { preview_limit: params.previewLimit } : {}),
        ...(params?.previewContentLen ? { preview_content_len: params.previewContentLen } : {}),
      },
    },
  );
  return envelopeData<KnowledgeSourceDetail>(body) || { source_id: sourceId };
}

export async function postConversationKernelKnowledgeSourceRetrieve(body: {
  query: string;
  sourceId?: string | null;
  topK?: number | null;
}): Promise<KnowledgeSourceRetrieveData> {
  const { data: res } = await http.post("/llm/conversation-kernel/knowledge-sources/retrieve", {
    query: body.query,
    ...(body.sourceId ? { source_id: body.sourceId } : {}),
    ...(body.topK != null && body.topK > 0 ? { top_k: body.topK } : {}),
  });
  return envelopeData<KnowledgeSourceRetrieveData>(res) || res || {};
}

export async function fetchLlmToolsCatalog(): Promise<LlmToolCatalogData> {
  const { data: body } = await http.get("/llm/tools");
  return envelopeData<LlmToolCatalogData>(body) || {};
}

export async function previewLlmToolIntent(text: string): Promise<LlmToolIntentPreview> {
  const { data: body } = await http.post("/llm/tools/preview", { text });
  return envelopeData<LlmToolIntentPreview>(body) || { text, domains: [], schema_tools: [] };
}

export async function patchLlmToolOverride(
  toolName: string,
  patch: import("./pallasTypes").LlmToolOverridePatch,
): Promise<LlmToolCatalogData> {
  const { data: body } = await http.patch(`/llm/tools/overrides/${encodeURIComponent(toolName)}`, patch);
  return envelopeData<LlmToolCatalogData>(body) || {};
}

export async function fetchLlmBehaviorRuns(params?: {
  groupId?: number | null;
  scene?: string | null;
  limit?: number;
}): Promise<{ items?: Array<Record<string, unknown>> }> {
  const { data: body } = await http.get("/common-config/llm/behavior/runs", {
    params: {
      ...(params?.groupId != null && params.groupId > 0 ? { group_id: params.groupId } : {}),
      ...(params?.scene ? { scene: params.scene } : {}),
      ...(params?.limit ? { limit: params.limit } : {}),
    },
  });
  return envelopeData(body) || {};
}

export async function fetchLlmBehaviorPatterns(params?: {
  groupId?: number | null;
  scene?: string | null;
}): Promise<{ items?: Array<Record<string, unknown>> }> {
  const { data: body } = await http.get("/common-config/llm/behavior/patterns", {
    params: {
      ...(params?.groupId != null && params.groupId > 0 ? { group_id: params.groupId } : {}),
      ...(params?.scene ? { scene: params.scene } : {}),
    },
  });
  return envelopeData(body) || {};
}

export async function postLlmBehaviorPatternDelete(patternId: string): Promise<{ pattern_id?: string }> {
  const { data: res } = await http.post("/common-config/llm/behavior/patterns/delete", { pattern_id: patternId });
  return envelopeData(res) || res;
}

export async function fetchLlmRepeaterFeedback(params: {
  groupId: number;
  limit?: number;
}): Promise<{ items?: Array<Record<string, unknown>> }> {
  const { data: body } = await http.get("/llm/repeater-feedback", {
    params: { group_id: params.groupId, ...(params.limit ? { limit: params.limit } : {}) },
  });
  return envelopeData(body) || {};
}

export async function fetchLlmRepeaterFeedbackSummary(params: {
  groupId: number;
  limit?: number;
}): Promise<Record<string, unknown>> {
  const { data: body } = await http.get("/llm/repeater-feedback/summary", {
    params: { group_id: params.groupId, ...(params.limit ? { limit: params.limit } : {}) },
  });
  return envelopeData(body) || {};
}

export async function postLlmRepeaterFeedbackManage(body: {
  entryId?: string;
  action: "invalidate" | "restore" | "delete" | "correct" | "clear_correction";
  correctedReplyText?: string;
}): Promise<Record<string, unknown>> {
  const { data: res } = await http.post("/llm/repeater-feedback/manage", {
    entry_id: body.entryId ?? "",
    action: body.action,
    corrected_reply_text: body.correctedReplyText ?? "",
  });
  return envelopeData(res) || res;
}

export async function fetchLlmPromotionCandidates(params: {
  groupId: number;
  limit?: number;
  includeResolved?: boolean;
}): Promise<{ items?: Array<Record<string, unknown>> }> {
  const { data: body } = await http.get("/llm/repeater-feedback/promotion-candidates", {
    params: {
      group_id: params.groupId,
      limit: params.limit ?? 20,
      include_resolved: Boolean(params.includeResolved),
    },
  });
  return envelopeData(body) || {};
}

export async function postLlmPromotionCandidateResolve(body: {
  candidateId: string;
  action: "promote" | "reject";
  reason?: string;
}): Promise<Record<string, unknown>> {
  const { data: res } = await http.post("/llm/repeater-feedback/promotion-candidates/resolve", {
    candidate_id: body.candidateId,
    action: body.action,
    reason: body.reason ?? "",
  });
  return envelopeData(res) || res;
}

export async function fetchLlmPersonaObserve(params?: {
  groupId?: number | null;
  accounts?: number[];
}): Promise<Record<string, unknown>> {
  const { data: body } = await http.get("/common-config/llm/persona-observe", {
    params: {
      ...(params?.groupId != null && params.groupId > 0 ? { group_id: params.groupId } : {}),
      ...(params?.accounts?.length ? { accounts: params.accounts.join(",") } : {}),
    },
  });
  return envelopeData(body) || {};
}

export async function fetchLlmRuntimeDebug(requestId: string): Promise<Record<string, unknown>> {
  const { data: body } = await http.get(
    `/common-config/llm/runtime-debug/${encodeURIComponent(requestId)}`,
  );
  return envelopeData(body) || {};
}

export async function fetchLlmRuntimeReplay(
  requestId: string,
  mode = "mock_tools",
): Promise<Record<string, unknown>> {
  const { data: body } = await http.get(
    `/common-config/llm/runtime-debug/${encodeURIComponent(requestId)}/replay`,
    { params: { mode } },
  );
  return envelopeData(body) || {};
}

export async function postLlmRuntimeReplayRun(
  requestId: string,
  mode = "mock_tools",
): Promise<Record<string, unknown>> {
  const { data: body } = await http.post(
    `/common-config/llm/runtime-debug/${encodeURIComponent(requestId)}/replay/run`,
    { mode },
    { timeout: 120_000 },
  );
  return envelopeData(body) || {};
}

export function pluginLabel(p: PluginRow): string {
  return p.metadata?.name || p.name;
}

export function pluginDescription(p: PluginRow): string {
  return p.metadata?.description || "";
}

export function formatTs(ts?: number | null): string {
  if (ts == null || !Number.isFinite(ts)) return "—";
  const ms = ts > 1e12 ? ts : ts * 1000;
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ts);
  }
}

export function formatCount(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("zh-CN").format(n);
}
