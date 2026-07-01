import type { paths as ConsoleOpenapiPaths } from "./generated/pallasConsoleOpenapi";
import type { HealthResponse } from "./health";

/** 标准响应结构 */

export interface ApiOk<T> {
  ok: boolean;
  data: T;
}

/** 首页聚合只读快照（/home/overview） */
export interface HomeOverviewData {
  health: HealthResponse | null;
  system: SystemData | null;
  bots: BotRow[];
  instances: InstancesData | null;
  plugins: PluginRow[];
  message_stats: MessageStatsData | null;
  plugin_run_stats: PluginRunStatsData | null;
  community_stats: CommunityStatsData | null;
}

type OpenapiJson200<TOperation> =
  TOperation extends { responses: { 200: { content: { "application/json": infer TBody } } } } ? TBody : never;

type OpenapiOkData<TOperation> = OpenapiJson200<TOperation> extends { data: infer TData } ? TData : never;

export interface SystemData {
  nonebot2_driver: { host: string | null; port: number | null };
  superuser_count: number;
  server_time: number;
  plugin_count: number;
  bot_count: number;
  console: { static_root?: string; http_base?: string; version?: string; pallas_webui_dev_mode?: boolean };
  runtime?: {
    hostname?: string | null;
    boot_time?: number | null;
    platform?: string;
    python?: string;
    cpu_percent?: number | null;
    /** 各逻辑核心占用 0–100；与 cpu_percent 同源采样（cpu_percent 为各核算术平均） */
    cpu_per_core?: number[] | null;
    /** Unix 类系统：1 / 5 / 15 分钟平均负载；Windows 通常为 null */
    cpu_load_avg?: [number, number, number] | null;
    memory?: {
      total?: number | null;
      used?: number | null;
      available?: number | null;
      free?: number | null;
      percent?: number | null;
      /** Linux 等；页缓存，可回收 */
      cached?: number | null;
      buffers?: number | null;
      shared?: number | null;
      /** macOS 等 */
      wired?: number | null;
    };
    disk?: { total?: number | null; used?: number | null; free?: number | null; percent?: number | null };
    gpu?: {
      available?: boolean;
      reason?: string;
      devices?: Array<{
        index: number;
        name: string;
        memory_total: number;
        memory_used: number;
        memory_free: number;
        utilization_gpu: number;
        utilization_memory: number;
        temperature: number | null;
      }>;
    };
  };
}

/** GET /community-stats：代理社区统计中心 /v1/monitor/overview（回退 /v1/stats） */
export interface FederationPoolStatsData {
  members_total: number;
  members_online: number;
  members_recent_24h: number;
  coord_active_deployments?: number | null;
  bootstrap_enabled?: boolean;
  federate_id?: string | null;
  coord_redis_configured?: boolean;
}

export interface CommunityCorpusStatsData {
  contexts_total: number;
  answers_total: number;
  enrollments_total: number;
  contribute_enabled_total: number;
  answer_hits_sum?: number;
  enrollments_online?: number;
  enrollments_recent_24h?: number;
  read_enabled_total?: number;
}

export interface CommunityVersionCountData {
  version: string;
  count: number;
}

export interface CommunityStatsData {
  deployments_total: number;
  deployments_online: number;
  bots_online_sum: number;
  online_ttl_sec?: number;
  as_of?: string;
  stats_url?: string;
  deployments_online_sharded?: number;
  shard_workers_online_sum?: number;
  catalog_bots_online_sum?: number;
  active_recent_24h?: number;
  online_versions?: CommunityVersionCountData[];
  corpus_enabled?: boolean;
  corpus?: CommunityCorpusStatsData | null;
  federation?: FederationPoolStatsData | null;
}

export type CommunityHotMode = "pool" | "recent" | "fleet";
export type CommunityHotPeriod = "day" | "week" | "month";
export type CommunityHotTab = "fleet" | "pool" | CommunityHotPeriod;

export interface HotCorpusAnswerData {
  answer_keywords: string;
  message: string;
  count: number;
}

export interface HotCorpusItem {
  keywords: string;
  score: number;
  answers: HotCorpusAnswerData[];
}

export interface CommunityCorpusHotData {
  mode: CommunityHotMode;
  period: CommunityHotPeriod;
  window_sec: number;
  as_of: string;
  items: HotCorpusItem[];
}

/** GET /corpus-status：本部署语料多源状态 */
export interface CorpusCommunityUsageData {
  read_lookups: number;
  read_hits: number;
  contribute_ok: number;
  updated_at?: number | null;
  source?: string;
}

export interface CorpusSourceStatusData {
  enabled: boolean;
  wanted?: boolean;
  configured?: boolean;
  enrolled?: boolean;
  manual?: boolean;
  auto_enroll?: boolean;
  readable?: boolean;
  writable?: boolean;
  api_base?: string;
  contribute?: boolean;
  token_present?: boolean;
  enrolled_at?: number | null;
  expires_at?: number | null;
  usage?: CorpusCommunityUsageData | null;
}

export interface CorpusControlPlaneStatusData {
  enabled?: boolean;
  instance_secret_configured?: boolean;
  federate_id?: string;
  federate_ingress_enabled?: string;
  coord_redis_configured?: boolean;
  bootstrap_refresh_enabled?: boolean;
  bootstrap_valid?: boolean;
  bootstrap_federate_id?: string;
  bootstrap_expires_at?: number | null;
}

export interface CorpusStatusData {
  composite_active: boolean;
  merge_order: string[];
  merge_strategy: string;
  on_remote_failure: string;
  sources: {
    local: CorpusSourceStatusData;
    fed: CorpusSourceStatusData;
    community: CorpusSourceStatusData;
  };
  deployment: {
    deployment_id: string;
    community_stats_enabled: boolean;
    heartbeat_endpoint?: string;
  };
  control_plane?: CorpusControlPlaneStatusData;
  as_of?: number;
}

/** GET /federation-onboarding：中心 Phase 2 入池说明 */
export interface FederationOnboardingStepData {
  order: number;
  title: string;
  detail: string;
}

export interface FederationCoordPublicData {
  redis_url_display?: string;
  host?: string;
  port?: number | null;
  db?: number | null;
}

export interface FederationOnboardingData {
  schema_version?: number;
  phase?: number;
  available?: boolean;
  title?: string;
  summary?: string;
  bootstrap_enabled?: boolean;
  federate_id?: string | null;
  coord?: FederationCoordPublicData | null;
  coord_redis_hint?: string;
  stats_primary_url?: string;
  stats_fallback_url?: string;
  stats_failover_note?: string;
  instance_secret?: string | null;
  instance_secret_label?: string;
  instance_secret_hint?: string;
  steps?: FederationOnboardingStepData[];
  ingress_note?: string;
  config_section_id?: string;
  as_of?: string;
  onboarding_url?: string;
  pool_stats?: FederationPoolStatsData | null;
}

/** 消息收/发按时间桶（与 message_traffic_history_bucket_sec 对齐）；at 为桶起点 Unix 秒，与 Bot 主机本地 wall-clock 对齐 */
export interface MessageTrafficHistoryPoint {
  at: number;
  received: number;
  sent: number;
}

/** GET /message-stats 中各 Bot 的协议 API 调用时间序列（与 today_api_calls 同一排除口径） */
export interface ApiCallHistoryPoint {
  /** 时间桶起点（Unix 秒）；与 Bot 主机本地 wall-clock 对齐，浏览器用本地时区格式化 */
  at: number;
  /** 该桶内成功调用次数 */
  total: number;
}

/** 单条接口的时间序列（与 api_calls_history_bucket_sec 对齐） */
export interface ApiCallNamedSeries {
  api: string;
  points: ApiCallHistoryPoint[];
}

export interface MessageStatsData {
  total_sent: number;
  total_received: number;
  today_sent?: number;
  today_received?: number;
  /** 与 bots[].api_calls_history 对齐的桶宽（秒） */
  api_calls_history_bucket_sec?: number;
  /** 最多保留桶数（≈ 覆盖时长 / bucket_sec） */
  api_calls_history_max_buckets?: number;
  /** 与 bots[].message_traffic_history 对齐的桶宽（秒） */
  message_traffic_history_bucket_sec?: number;
  message_traffic_history_max_buckets?: number;
  bots: Array<{
    self_id: string;
    connection_key: string;
    sent: number;
    received: number;
    today_sent?: number;
    today_received?: number;
    /** 今日协议/API 调用总次数（不含发消息与高频状态类接口） */
    today_api_calls?: number;
    /** 今日调用次数最多的接口名 */
    today_top_api?: string;
    today_top_api_count?: number;
    /** 近期消息收/发序列（进程内，重启清空） */
    message_traffic_history?: MessageTrafficHistoryPoint[];
    /** 近期成功协议 API 调用序列（进程内，重启清空） */
    api_calls_history?: ApiCallHistoryPoint[];
    /** 按接口名拆分的时间序列（条数有上限，优先今日计数高的接口） */
    api_calls_history_by_api?: ApiCallNamedSeries[];
  }>;
}

/** 各插件 Matcher 执行次数（进程内累计，重启清零） */
export interface PluginRunStatsRow {
  name: string;
  runs: number;
  runs_today: number;
  errors: number;
  errors_today: number;
  /** 累计平均 Matcher 墙钟耗时（毫秒）；无样本时为 null */
  avg_duration_ms?: number | null;
  max_duration_ms?: number | null;
  /** 今日平均 / 峰值耗时（毫秒） */
  avg_duration_ms_today?: number | null;
  max_duration_ms_today?: number | null;
}

/** Matcher 按插件名拆分的时间序列（与 matcher_calls_history_bucket_sec 对齐） */
export interface PluginMatcherNamedSeries {
  plugin: string;
  points: ApiCallHistoryPoint[];
}

/** 单次 Matcher 异常快照（进程内环形缓冲；接口返回条数与 traceback 长度有上限） */
export interface MatcherErrorLogEntry {
  at: number;
  plugin: string;
  exc_type: string;
  message: string;
  traceback: string;
}

/** 单次 Matcher 墙钟耗时（jsonl 持久化，每账号默认最多 150 条，重启可恢复） */
export interface MatcherDurationLogEntry {
  at: number;
  plugin: string;
  duration_ms: number;
  had_error: boolean;
}

/** GET /console-daily-stats 单日一行（自然日，无时间桶） */
export interface ConsoleDailyStatRow {
  date: string;
  self_id: string;
  received: number;
  sent: number;
  matcher_runs: number;
  api_calls?: number;
}

export interface ConsoleDailyStatsData {
  start: string;
  end: string;
  query_start: string;
  query_end: string;
  rows: ConsoleDailyStatRow[];
  live_today: Record<string, { received: number; sent: number; matcher_runs: number }>;
  server_date: string;
}

export interface PluginRunStatsData {
  total_runs: number;
  total_errors: number;
  total_runs_today: number;
  total_errors_today: number;
  matcher_calls_history_bucket_sec?: number;
  matcher_calls_history_max_buckets?: number;
  /** 最近若干条 ERROR/CRITICAL 日志（进程内环形缓冲 + jsonl；与 Matcher 异常清理策略一致） */
  log_error_log?: MatcherErrorLogEntry[];
  /** 分片时可选报错来源（hub / worker-N） */
  log_error_sources?: string[];
  sharded_log_errors?: boolean;
  bots: Array<{
    self_id: string;
    connection_key: string;
    runs: number;
    errors: number;
    runs_today: number;
    errors_today: number;
    plugins: PluginRunStatsRow[];
    /** 各插件 Matcher 成功执行次数按桶 */
    matcher_runs_by_plugin?: PluginMatcherNamedSeries[];
    /** 各插件 Matcher 执行异常次数按桶 */
    matcher_errors_by_plugin?: PluginMatcherNamedSeries[];
    /** 各插件 Matcher 耗时（毫秒）按桶累计 */
    matcher_duration_ms_by_plugin?: PluginMatcherNamedSeries[];
    /** 各插件 Matcher 桶内平均耗时（毫秒） */
    matcher_avg_duration_ms_by_plugin?: PluginMatcherNamedSeries[];
    /** 最近若干次 Matcher 异常（含截断后的 traceback） */
    matcher_error_log?: MatcherErrorLogEntry[];
    /** 最近若干次 Matcher 单次耗时（新→旧，条数上限见 matcher_duration_log_cap） */
    matcher_duration_log?: MatcherDurationLogEntry[];
    matcher_duration_log_cap?: number;
    /** 单次耗时环形缓冲内，单插件最多保留条数（避免高频插件占满） */
    matcher_duration_log_per_plugin_cap?: number;
  }>;
}

export type PluginLoadRole = "hub" | "worker" | "both" | "infra" | "internal";

export type PluginCatalogProcessRole = "hub" | "worker" | "unified";

export type PluginSourceKind = "main" | "core" | "extra" | "local" | "pip";

export type OfficialExtensionStatus =
  | "installed"
  | "pip_installed"
  | "bundled"
  | "bundled_active"
  | "external";

export type ExtensionActivationPolicy = "hot-reloadable" | "workers-restart" | "full-restart";

export type ExtensionActivationAction = "none" | "hot-reload" | "workers-restart" | "full-restart";

export interface OfficialExtensionRow {
  package: string;
  plugin_ids: string[];
  display_name?: string;
  uv_extra?: string | null;
  install_cli?: string | null;
  icon?: string | null;
  cover?: string | null;
  avatar?: string | null;
  repository_url?: string | null;
  description?: string;
  bundled_in_repo?: boolean;
  bundled_plugin_ids?: string[];
  bundled_load_enabled?: boolean;
  loaded_plugin_ids?: string[];
  installed?: boolean;
  pip_installed?: boolean;
  install_local_dir?: string;
  webui_install?: boolean;
  restart_available?: boolean;
  activation_policy?: ExtensionActivationPolicy | null;
  can_install?: boolean;
  can_uninstall?: boolean;
  can_update?: boolean;
  /** 版本快照判定：是否有新版本；null/undefined 表示尚未检查 */
  has_update?: boolean | null;
  /** 已安装版本（官方为 PyPI 版本号） */
  installed_ref?: string | null;
  /** 远端最新版本（官方为 PyPI 版本号） */
  latest_ref?: string | null;
  status?: OfficialExtensionStatus;
}

export interface OfficialExtensionInstallResult {
  package: string;
  uv_extra?: string;
  pip_installed?: boolean;
  needs_restart?: boolean;
  already_installed?: boolean;
  already_removed?: boolean;
  restart_scheduled?: boolean;
  activation_policy?: ExtensionActivationPolicy | null;
  activation_action?: ExtensionActivationAction | null;
  message?: string;
  stdout_tail?: string;
}

export type CommunityPluginStatus = "available" | "installed" | "loaded";

export interface CommunityPluginRow {
  plugin_id: string;
  name: string;
  description?: string;
  icon?: string | null;
  cover?: string | null;
  avatar?: string | null;
  repository_url?: string | null;
  ref?: string;
  author?: string;
  homepage?: string | null;
  tags?: string[];
  min_pallas_version?: string | null;
  local_only?: boolean;
  local_installed?: boolean;
  loaded?: boolean;
  local_path?: string | null;
  install_local_dir?: string;
  extra_plugin_dirs_ready?: boolean;
  webui_install?: boolean;
  restart_available?: boolean;
  activation_policy?: ExtensionActivationPolicy | null;
  can_install?: boolean;
  can_uninstall?: boolean;
  can_update?: boolean;
  /** 版本快照判定：是否有新版本；null/undefined 表示尚未检查 */
  has_update?: boolean | null;
  /** 已安装 commit（短哈希） */
  installed_ref?: string | null;
  /** 远端最新 commit（短哈希） */
  latest_ref?: string | null;
  status?: CommunityPluginStatus;
}

export interface CommunityPluginStoreData {
  source?: string | null;
  meta?: Record<string, unknown>;
  error?: string | null;
  extra_plugin_dirs_ready?: boolean;
  webui_install?: boolean;
  restart_available?: boolean;
  activation_policy?: ExtensionActivationPolicy | null;
  /** 插件更新快照检查时间（秒）；null 表示从未检查 */
  update_checked_at?: number | null;
  plugins: CommunityPluginRow[];
}

export interface CommunityPluginActionResult {
  plugin_id: string;
  local_path?: string;
  installed?: boolean;
  needs_restart?: boolean;
  already_removed?: boolean;
  extra_plugin_dirs_ready?: boolean;
  restart_available?: boolean;
  activation_policy?: ExtensionActivationPolicy | null;
  activation_action?: ExtensionActivationAction | null;
  restart_scheduled?: boolean;
  message?: string;
  stdout_tail?: string;
}

export interface PluginCapabilitiesCommand {
  command_id: string;
  label: string;
  trigger_condition?: string;
  default_level?: string;
  effective_level?: string;
  default_cd_sec?: number;
  effective_cd_sec?: number;
}

export interface PluginCapabilitiesLlmTool {
  name: string;
  command_id: string;
  description: string;
}

export interface PluginCapabilitiesStorageKey {
  key: string;
  scope: string;
  label: string;
  ephemeral: boolean;
}

export interface PluginCapabilitiesRow {
  plugin: string;
  title: string;
  commands: PluginCapabilitiesCommand[];
  llm_tools: PluginCapabilitiesLlmTool[];
  storage_keys: PluginCapabilitiesStorageKey[];
  reload_policy?: string | null;
}

export interface PluginCapabilitiesData {
  plugins: PluginCapabilitiesRow[];
  levels?: { id: string; label: string }[];
}

// ── Plugin Governance API ──────────────────────────────────────────

export interface PluginGovernanceMenuItem {
  func: string;
  trigger_method?: string;
  trigger_scene?: string;
  trigger_condition?: string;
  brief_des?: string;
  detail_des?: string;
  command_permission?: string;
  command_permissions?: string[];
}

export interface PluginGovernanceRuntime {
  global_disable: boolean;
  help_hidden: boolean;
  global_disable_protected?: boolean;
  help_ignored?: boolean;
}

export interface PluginGovernanceData {
  plugin: string;
  title: string;
  commands: PluginCapabilitiesCommand[];
  menu_items: PluginGovernanceMenuItem[];
  runtime: PluginGovernanceRuntime;
  perm_ui_filtered: CommandPermUiData;
  limits_ui_filtered: CommandLimitsUiData;
  reload_policy?: string | null;
  activation_policy?: string | null;
}

export interface PluginGovernanceBody {
  command_permission_overrides: Record<string, string>;
  command_limit_overrides: Record<string, number>;
  global_disable: boolean;
  help_hidden: boolean;
}

export interface PluginRow {
  name: string;
  module: string;
  resolved_plugin_id?: string;
  resolved_module?: string;
  nb_plugin_name?: string;
  load_role?: PluginLoadRole;
  loaded_in_process?: boolean;
  /** 提供插件目录 API 的进程（分片下 WebUI 为 hub） */
  catalog_process_role?: PluginCatalogProcessRole;
  /** 是否应在 catalog_process_role 进程中加载 */
  expected_in_catalog_process?: boolean;
  has_config?: boolean;
  configurable?: boolean;
  help_visible?: boolean;
  help_ignored?: boolean;
  help_hidden?: boolean;
  /** 全实例运行时禁用（所有 bot、所有群） */
  globally_disabled?: boolean;
  /** 基础设施插件，不可全实例禁用 */
  global_disable_protected?: boolean;
  /** 插件代码来源 */
  plugin_source?: PluginSourceKind;
  extra_package?: string | null;
  /** 相对仓库根的目录，如 local/plugins/draw */
  plugin_source_dir?: string | null;
  icon?: string | null;
  cover?: string | null;
  avatar?: string | null;
  metadata: {
    name?: string;
    description?: string;
    usage?: string;
    type?: string;
    extra?: Record<string, unknown>;
  } | null;
}

export interface HelpMenuVisibilityData {
  hidden_plugins: string[];
  ignored_plugins: string[];
}

export interface GlobalPluginDisableData {
  disabled_plugins: string[];
  protected_plugins: string[];
}

export interface GroupFleetWhitelistEntry {
  group_id: number;
  plugins: string[];
}

export interface GroupFleetWhitelistData {
  entries: GroupFleetWhitelistEntry[];
  protected_plugins: string[];
}

export interface PluginConfigField {
  name: string;
  /** 展示用中文名；缺省时用 name */
  label?: string;
  kind: "bool" | "int" | "float" | "json" | "string" | "enum";
  required: boolean;
  description: string;
  env_key: string;
  default: unknown;
  current: unknown;
  /** kind 为 enum 时由后端 Literal 推导 */
  choices?: string[];
  /** 枚举选项展示文案；键为内部值，缺省时前端本地映射 */
  choice_labels?: Record<string, string>;
  /** string 字段密钥语义：前端打码 + 眼睛切换 */
  secret?: boolean;
  /** string 字段多行：前端用 textarea */
  multiline?: boolean;
  /** int/float 字段下界（含），由 Pydantic ge/gt 推导 */
  min_value?: number;
  /** int/float 字段上界（含），由 Pydantic le/lt 推导 */
  max_value?: number;
  /** DynamicConfigPanel 分组标题 */
  ui_group?: string;
  /** 组内排序，越小越靠前 */
  ui_order?: number;
  /** 进阶项，默认折叠 */
  ui_hidden?: boolean;
}

export interface PluginConfigUnexpectedKey {
  env_key: string;
  value_preview: string;
}

/** GET/PUT 通用配置「命令权限」段时后端可附带，用于矩阵单选 UI */
export interface CommandPermUiLevel {
  id: string;
  label: string;
}

export interface CommandPermUiCommand {
  command_id: string;
  label: string;
  trigger_condition?: string;
  default_level: string;
  effective_level: string;
}

export interface CommandPermUiPlugin {
  plugin: string;
  title: string;
  commands: CommandPermUiCommand[];
}

export interface CommandPermUiData {
  levels: CommandPermUiLevel[];
  plugins: CommandPermUiPlugin[];
}

export interface CommandLimitsUiCommand {
  command_id: string;
  label: string;
  trigger_condition?: string;
  default_cd_sec: number;
  effective_cd_sec: number;
}

export interface CommandLimitsUiPlugin {
  plugin: string;
  title: string;
  commands: CommandLimitsUiCommand[];
}

export interface CommandLimitsUiData {
  plugins: CommandLimitsUiPlugin[];
}

export interface PluginConfigFieldGroup {
  id: string;
  title: string;
  field_names: string[];
  plugin_config_path: string;
}

export interface PluginConfigData {
  plugin: string;
  module: string;
  fields: PluginConfigField[];
  command_perm_ui?: CommandPermUiData;
  command_limits_ui?: CommandLimitsUiData;
  /** 通用配置 service_gateways：分组展示与跳转插件页 */
  field_groups?: PluginConfigFieldGroup[];
  /** 使用 PallasImageGatewaysEditor 编辑画画网关 */
  gateway_editor?: boolean;
  /** 可调用全链路连通检测 API */
  supports_connectivity_check?: boolean;
  /** 智能对话分区：展示模型切换面板 */
  llm_model_admin?: boolean;
  /** 控制台 dev_mode 等可热重载（保存后立即生效） */
  dev_mode_hot_reload?: boolean;
  /** 保存后无需重启即可生效（语料联邦等） */
  hot_reload?: boolean;
  /** webui.json 中存在但 schema 未声明的键 */
  unexpected_keys?: PluginConfigUnexpectedKey[];
}

export interface PluginConfigRawData {
  toml: string;
}

export interface ExtensionInstallJobData {
  job_id: string;
  package: string;
}

/** 通用配置 → 服务网关 / 连通性 */
export const SERVICE_GATEWAYS_SECTION_ID = "service_gateways";
export const CORPUS_FEDERATION_SECTION_ID = "corpus_federation";
export const COMMUNITY_STATS_SECTION_ID = "community_stats";

/** 通用配置 → 控制台 / Pallas WebUI */
export const PALLAS_WEBUI_SECTION_ID = "pallas_webui";

/** GET /common-config/sections */
export interface CommonConfigSectionMeta {
  id: string;
  title: string;
}

export interface LlmProviderStatusRow {
  id: string;
  kind: string;
  enabled: boolean;
  configured: boolean;
  default_model: string;
  base_url: string;
  reachable: boolean | null;
}

type GeneratedLlmProvidersConfig =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/common-config/llm/providers"]["get"]>;

type GeneratedLlmProvidersRouting = NonNullable<GeneratedLlmProvidersConfig["routing"]>;

export interface LlmProviderConfigRow {
  id: string;
  kind: string;
  base_url: string;
  /** 保存时填写；GET 不返回明文，留空表示不修改。 */
  api_key?: string;
  api_key_env: string;
  /** GET：是否已配置可用密钥（inline 或环境变量）。 */
  api_key_set?: boolean;
  default_model: string;
  enabled: boolean;
  task_models: Record<string, string>;
}

export type LlmProvidersConfig = Omit<GeneratedLlmProvidersConfig, "providers" | "routing"> & {
  providers: LlmProviderConfigRow[];
  routing: Omit<GeneratedLlmProvidersRouting, "chain_fallback" | "tasks"> & {
    chain_fallback: NonNullable<GeneratedLlmProvidersRouting["chain_fallback"]>;
    tasks: NonNullable<GeneratedLlmProvidersRouting["tasks"]>;
  };
};

export interface LlmProvidersSaveResult {
  providers_file: string;
  provider_status?: LlmProviderStatusRow[];
  task_routing?: Record<string, string>;
}

/** Provider 在线模型发现结果（经 BFF 代理 AI 仓拉取）。 */
export interface LlmProviderModelsResult {
  provider_id: string;
  ok: boolean;
  models: string[];
  source: string;
  error?: string;
}

/** Provider 实时连通性测试结果（经 BFF 代理 AI 仓 ping）。 */
export type LlmProviderTestResult =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/common-config/llm/providers/{provider_id}/test"]["post"]>;

export interface LlmModelAdminStatus {
  model: string;
  num_gpu?: number | null;
  ai_reachable: boolean;
  llm_chat_enabled: boolean;
  health_url: string;
  error: string;
  provider_mode?: string;
  provider_status?: LlmProviderStatusRow[];
  task_routing?: Record<string, string>;
  categorizer_enabled?: boolean;
  categorizer_model?: string;
  tools_selective?: boolean;
  moe_tier_routing?: boolean;
  local_multi_model_enabled?: boolean;
  local_model_policy?: string;
  local_task_models?: Record<string, string>;
  local_moe_models?: Record<string, string>;
}

export type ConsoleLoginChangeResult =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/security/console-login"]["post"]>;

export type ConsoleSetupStatus =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/auth/setup-status"]["get"]>;

export interface LlmLocalRoutingModels {
  simple: string;
  medium: string;
  complex: string;
  vision: string;
}

export interface LlmLocalRoutingTaskModels {
  llm_chat: string;
  drunk: string;
  repeater_fallback: string;
  repeater_polish: string;
  repeater_polish_lite: string;
  repeater_select: string;
}

export interface LlmLocalRoutingConfig {
  llm_model: string;
  local_multi_model_enabled: boolean;
  moe_models: LlmLocalRoutingModels;
  task_models: LlmLocalRoutingTaskModels;
  env_file: string;
}

export interface LlmModelAdminModelResult {
  model: string;
  num_gpu?: number | null;
}

export interface LlmTaskMetricRow {
  queued?: number;
  running?: number;
  submit_ok?: number;
  submit_skip?: number;
  callback_ok?: number;
  callback_fail?: number;
  task_ok?: number;
  task_fail?: number;
  reply_gate_skip?: number;
  reply_gate_defer?: number;
  route_counts?: Record<string, number>;
}

export interface LlmTokenMetricBreakdownRow {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface LlmTokenMetricsSlice {
  source: string;
  day_key: string;
  updated_at?: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  by_task: Record<string, LlmTokenMetricBreakdownRow>;
  by_provider?: Record<string, LlmTokenMetricBreakdownRow>;
  by_model?: Record<string, LlmTokenMetricBreakdownRow>;
}

export interface LlmClassificationTotals {
  tier_simple?: number;
  tier_medium?: number;
  tier_complex?: number;
  tools_on?: number;
  tools_off?: number;
  vision_on?: number;
  vision_off?: number;
}

export interface LlmTaskMetricsSlice {
  source: string;
  day_key: string;
  updated_at?: number;
  by_task: Record<string, LlmTaskMetricRow>;
  totals: Record<string, number>;
  state_counts?: Record<string, number>;
  failure_counts?: Record<string, number>;
  provider_stats?: Record<string, LlmRuntimeDimensionStatsRow>;
  model_stats?: Record<string, LlmRuntimeDimensionStatsRow>;
  tokens?: LlmTokenMetricsSlice;
  classification?: {
    totals: LlmClassificationTotals;
  };
}

export interface LlmRuntimeDimensionStatsRow {
  requests?: number;
  succeeded?: number;
  failed?: number;
  total_latency_ms?: number;
  avg_latency_ms?: number | null;
  recent_failure_class?: string | null;
}

export interface LlmTaskStatsHistoryRow {
  date: string;
  bot?: LlmTaskMetricsSlice | null;
  ai?: LlmTaskMetricsSlice | null;
}

export interface LlmTaskStatsPersistence {
  store_file?: string;
  bot_collecting?: boolean;
  bot_day_key?: string;
  ai_collecting?: boolean;
  ai_reachable?: boolean;
}

export interface LlmTaskStatsData {
  bot: LlmTaskMetricsSlice;
  ai: LlmTaskMetricsSlice;
  ai_reachable: boolean;
  error?: string;
  persistence?: LlmTaskStatsPersistence;
  history?: {
    start: string;
    end: string;
    query_start: string;
    query_end: string;
    rows: LlmTaskStatsHistoryRow[];
    server_date: string;
  };
}

type GeneratedLlmWizardStatusData =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/common-config/llm/wizard/status"]["get"]>;

export type LlmWizardCheckRow = NonNullable<GeneratedLlmWizardStatusData["checks"]>[number];

export type LlmWizardStatusData = Omit<GeneratedLlmWizardStatusData, "checks"> & {
  checks: LlmWizardCheckRow[];
};

type GeneratedLlmRuntimeOverviewData =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/common-config/llm/runtime-overview"]["get"]>;

export type LlmRuntimeOverviewHealthData = GeneratedLlmRuntimeOverviewData["health"] & {
  llm_health?: AiExtensionTestData["llm_health"];
  image_health?: AiExtensionTestData["image_circuit"];
  tts_health?: AiExtensionTestData["tts_health"];
  media_tasks?: AiExtensionTestData["media_tasks"];
};

export type LlmRuntimeOverviewData = Omit<
  GeneratedLlmRuntimeOverviewData,
  "health" | "model_admin" | "task_stats" | "conversation_kernel"
> & {
  health: LlmRuntimeOverviewHealthData;
  model_admin?: Partial<LlmModelAdminStatus>;
  task_stats?: Partial<LlmTaskStatsData>;
  conversation_kernel?: Partial<ConversationKernelStatus>;
};

export interface LlmHistoryTurn {
  role: "user" | "assistant";
  content: string;
  user_id: number;
  created_at: number;
}

export interface LlmHistorySessionSummary {
  session_key: string;
  bot_id: number;
  group_id: number;
  user_id: number;
  turn_count: number;
  first_created_at: number;
  last_created_at: number;
  last_role: "user" | "assistant";
  last_content: string;
}

export interface LlmHistorySessionsData {
  items: LlmHistorySessionSummary[];
  limit: number;
}

export interface LlmHistorySessionDetailData {
  session: LlmHistorySessionSummary;
  turns: LlmHistoryTurn[];
  behavior_runs: LlmHistoryBehaviorRun[];
  feedback_entries?: LlmRepeaterFeedbackEntry[];
}

export interface LlmHistoryBehaviorAutoFeedbackPayload {
  source?: "session" | "ambient" | "mixed" | "timeout" | string;
  matched_signal?: string;
  matched_tokens?: string[];
  observed_turn_count?: number;
  agent_trace?: LlmHistoryBehaviorAgentTrace;
}

export interface LlmHistoryBehaviorAgentTraceRound {
  round?: number;
  tool_calls?: string[];
  used_prefetch?: boolean;
}

export interface LlmHistoryBehaviorAgentTraceToolCall {
  tool?: string;
  args_keys?: string[];
  ok?: boolean;
  error?: string | null;
  result_preview?: string | null;
}

export interface LlmHistoryBehaviorAgentTraceStage {
  stage?: string;
  status?: string;
  provider?: string;
  model?: string;
  latency_ms?: number;
  tool_calls?: LlmHistoryBehaviorAgentTraceToolCall[];
}

export interface LlmHistoryBehaviorAgentTrace {
  version?: string;
  agent_stage_plan?: string[];
  planner_enabled?: boolean;
  retrieve_enabled?: boolean;
  tool_loop_enabled?: boolean;
  tool_schema_count?: number;
  tool_call_count?: number;
  request_snapshot_id?: string | null;
  tool_catalog_version?: string | null;
  rounds?: LlmHistoryBehaviorAgentTraceRound[];
  stages?: LlmHistoryBehaviorAgentTraceStage[];
  prefetched_tool?: string | null;
  final_stage?: string | null;
  status?: string | null;
}

export interface LlmRuntimeReplayResult {
  request_id?: string;
  request_snapshot_id?: string | null;
  mode?: string;
  task?: string;
  reply?: string;
  trace?: LlmHistoryBehaviorAgentTrace | null;
  assistant_message?: Record<string, unknown>;
  persona_shaping?: LlmPersonaShapingSummary | null;
}

export interface LlmPersonaShapingSummary {
  source_task?: string;
  persona_shaping_active?: boolean;
  affect_block?: string;
  dynamic_expression?: string;
  variation_hint?: string;
  lines?: string[];
  compare_note?: string;
  corpus_ending?: string;
}

export interface LlmRuntimeDebugData {
  request_id?: string;
  snapshot?: Record<string, unknown> | null;
  trace?: LlmHistoryBehaviorAgentTrace | null;
  persona_shaping?: LlmPersonaShapingSummary | null;
}

export interface LlmBehaviorPattern {
  pattern_id: string;
  scene: string;
  action: string;
  scope_group_id?: number | null;
  success_score?: number;
  manual_score?: number;
  disabled?: boolean;
  persona_affinity?: string;
  trigger_features?: string[];
  reference_examples?: string[];
}

export interface LlmBehaviorRunsData {
  items: LlmHistoryBehaviorRun[];
  count: number;
  limit: number;
}

export interface LlmBehaviorPatternsData {
  items: LlmBehaviorPattern[];
  count: number;
}

export interface LlmHistoryBehaviorRun {
  request_id: string;
  group_id?: number | null;
  user_id?: number | null;
  bot_id?: number | null;
  created_at?: number;
  scene: string;
  user_text?: string;
  reply_text?: string;
  selected_pattern_ids: string[];
  selected_actions: string[];
  behavior_hint_text: string;
  final_outcome?: string | null;
  score_delta?: number;
  auto_feedback_payload?: LlmHistoryBehaviorAutoFeedbackPayload;
  manual_labels: string[];
  disabled?: boolean;
}

export interface LlmRepeaterFeedbackEntry {
  entry_id: string;
  created_at: number;
  bot_id: number;
  group_id: number;
  user_id: number;
  request_id: string;
  user_text: string;
  reply_text: string;
  behavior_scene?: string;
  behavior_actions?: string[];
  llm_route?: string;
  source_tags?: string[];
  eligible_for_bias?: boolean;
  eligible_for_writeback?: boolean;
  corrected_reply_text?: string;
  corrected_at?: number;
}

export interface LlmRepeaterFeedbackData {
  items: LlmRepeaterFeedbackEntry[];
  limit: number;
}

export interface LlmRepeaterFeedbackSummary {
  count: number;
  top_replies: string[];
  matched_replies?: string[];
  semantic_matched_replies?: string[];
  penalized_replies?: string[];
  scenes: string[];
  promotion_candidate_count?: number;
  learning_stats?: {
    window_sec?: number;
    repeater_reply_count?: number;
    feedback_bias_hit_count?: number;
    feedback_bias_hit_rate?: number;
    auto_promote_count?: number;
  };
}

export interface LlmPromotionCandidate {
  candidate_id: string;
  group_id: number;
  trigger_text: string;
  reply_text: string;
  support_count: number;
  last_seen_at: number;
  promoted: boolean;
  rejected_reason: string;
  behavior_scene: string;
  source_request_id: string;
}

export interface LlmPromotionCandidatesData {
  items: LlmPromotionCandidate[];
  limit: number;
}

export interface ConversationKernelMemoryPolicy {
  allow_runtime_state?: boolean;
  allow_persistent_memory?: boolean;
  allow_corpus_foundation?: boolean;
  allow_behavioral_learning?: boolean;
  allow_writeback?: boolean;
  runtime_state_summary_enabled?: boolean;
  read_persistent_memory?: boolean;
  read_session?: boolean;
  read_group_style?: boolean;
  read_affect?: boolean;
  write_session?: boolean;
}

export interface ConversationKernelStatus {
  feature_level: string;
  llm_chat_enabled: boolean;
  conversation_feature_level_raw?: string;
  llm_repeater_mode?: string;
  llm_repeater_feedback_enabled?: boolean;
  llm_repeater_bias_enabled?: boolean;
  llm_repeater_writeback_enabled?: boolean;
  feedback_collect_active: boolean;
  feedback_bias_active: boolean;
  writeback_active: boolean;
  runtime_state_summary_active?: boolean;
  memory_policy: ConversationKernelMemoryPolicy;
}

export interface ConversationKernelTraceRow {
  kind?: string;
  group_id?: number;
  bot_id?: number;
  action?: string;
  opportunity_accepted?: boolean;
  created_at?: number;
  [key: string]: unknown;
}

export interface ConversationKernelTracesData {
  items: ConversationKernelTraceRow[];
  limit: number;
}

export interface ConversationKernelMemoryEntry {
  id: number;
  bot_id: number;
  group_id: number;
  keywords?: string;
  content: string;
  source?: string;
  created_at?: number;
  updated_at?: number;
}

export interface ConversationKernelRelationshipNote {
  id: number;
  bot_id: number;
  group_id: number;
  user_id: number;
  content: string;
  source?: string;
  weight?: number;
  created_at?: number;
  updated_at?: number;
}

export interface ConversationKernelKnowledgeSource {
  source_id: string;
  title: string;
  description?: string;
  scope?: string;
  retrieval_mode?: string;
  origin?: string;
  plugin_name?: string;
  plugin_title?: string;
  default?: boolean;
  chunk_count?: number;
}

export interface ConversationKernelMemoryData {
  items: ConversationKernelMemoryEntry[];
  count: number;
  limit: number;
}

export interface ConversationKernelRelationshipNotesData {
  items: ConversationKernelRelationshipNote[];
  count: number;
  limit: number;
}

export interface ConversationKernelKnowledgeSourcesData {
  items: ConversationKernelKnowledgeSource[];
  count: number;
}

export interface PersonaAxisSnapshot {
  source?: string;
  preset_label?: string;
  archetype?: string;
  tone?: string;
  reply_bias?: number;
  speak_bias?: number;
  length_pref?: string;
  chaos_bias?: number;
  warmth: number;
  assertiveness: number;
  bluntness: number;
  harsh_msg_ratio?: number;
  polite_msg_ratio?: number;
  msgs_per_hour_active?: number;
  activity_level?: string;
}

export interface PersonaObserveBotRow {
  account: number;
  group_style_enabled: boolean;
  base: PersonaAxisSnapshot;
  base_hints: string[];
  resolved: PersonaAxisSnapshot | null;
  resolved_hints: string[];
}

export interface PersonaAffectRefineSnapshot {
  source: string;
  warmth_delta: number;
  assertiveness_delta: number;
  confidence: number;
  summary: string;
  updated_at?: number | null;
}

export interface PersonaAffectTriggerRow {
  phrase: string;
  warmth_delta: number;
  assertiveness_delta: number;
  weight: number;
  expires_at?: number | null;
}

export interface PersonaObserveData {
  group_id: number | null;
  group_style_snapshot: GroupStyleProfileSnapshot | null;
  affect_refine: PersonaAffectRefineSnapshot | null;
  affect_triggers: PersonaAffectTriggerRow[];
  bots: PersonaObserveBotRow[];
}

export interface BotRow {
  connection_key: string;
  self_id: string;
  adapter: string;
  /** 当前进程内最近一次接入 Unix 秒（仅在线 Bot；来自控制台扩展 API） */
  connected_at_unix?: number | null;
}

/** GET /logs?scope= 与后端一致 */
export type LogScope = "all" | "webui" | "protocol";

export type LogEntryLevel = "debug" | "info" | "success" | "warn" | "error";

export interface LogEntry {
  id: number;
  time: string;
  level: LogEntryLevel;
  scope: string;
  message: string;
}

export interface LogsData {
  lines: string[];
  entries: LogEntry[];
  max: number;
  scope?: LogScope;
  /** 当前筛选来源：all | hub | worker-N */
  source?: string;
  /** 分片部署：已合并主节点与各节点日志落盘尾行 */
  sharded_logs?: boolean;
  /** 分片时可选的日志来源列表 */
  log_sources?: string[];
}

/** 数据库概览 */
export type DbOverviewData =
  | {
      backend: "mongodb";
      collections: {
        name: string;
        document: string;
        count: number;
        count_estimated?: boolean;
      }[];
    }
  | {
      backend: "postgres";
      tables: { table: string; count: number }[];
    }
  | { backend: string; note?: string };

export interface DbBackupConnectionInfo {
  host: string;
  port: number;
  database: string;
  user?: string | null;
}

export interface DbBackupInfo {
  backend: "mongodb" | "postgres";
  default_output_parent: string;
  tool_name: string;
  tool_available: boolean;
  /** 未检测到 CLI 时供前端展示的安装包名称 */
  tool_download_label?: string;
  /** 官方下载页 */
  tool_download_url?: string;
  tool_install_hint?: string;
  restore_tool_name?: string;
  restore_tool_available?: boolean;
  connection: DbBackupConnectionInfo;
  mongo_scopes: string[];
  postgres_formats: string[];
}

export interface DbBackupResult {
  ok: boolean;
  backend: string;
  scope: string;
  output_dir: string;
  artifacts: string[];
  size_bytes: number;
  message: string;
}

export type DbBackupJobStatus = "queued" | "running" | "completed" | "failed";

export type DbBackupJobKind = "backup" | "restore";

export interface DbBackupJobData {
  job_id: string;
  job_kind?: DbBackupJobKind;
  status: DbBackupJobStatus;
  output_dir: string;
  restore_path?: string;
  size_bytes: number;
  elapsed_sec?: number | null;
  created_at?: number;
  started_at?: number | null;
  finished_at?: number | null;
  result?: DbBackupResult;
  error?: string;
}

export interface DbBackupRunRow {
  name: string;
  path: string;
  backend: "mongodb" | "postgres" | string;
  size_bytes: number;
  modified_at: string;
}

export interface DbBackupBrowseEntry {
  name: string;
  path: string;
  kind: "dir";
}

export interface DbBackupBrowseData {
  current: string;
  parent: string | null;
  entries: DbBackupBrowseEntry[];
  default_path: string;
  project_root: string;
}

export interface DbBackupRunsData {
  runs: DbBackupRunRow[];
}

export interface DbBackupDeleteResult {
  deleted: string[];
  count: number;
}

/** Bot 配置 */
export interface BotConfigPublic {
  account: number;
  admins: number[];
  auto_accept_friend: boolean;
  auto_accept_group: boolean;
  security: boolean;
  taken_name: Record<string, number>;
  drunk: Record<string, number>;
  disabled_plugins: string[];
  /** 是否在社区主站名册展示本牛 QQ（默认开；需通用配置开启「公开牛牛 QQ」） */
  community_roster_show_qq: boolean;
}

export interface GroupStyleProfileSnapshot {
  version?: number;
  ready: boolean;
  updated_at?: number | null;
  sample?: Record<string, unknown> | null;
  signals?: Record<string, unknown> | null;
  hints?: string[];
  /** 画像计算时跳过的污染 message/answer 样本总数 */
  contamination_skipped_count?: number | null;
}

export interface GroupConfigPublic {
  group_id: number;
  roulette_mode: number;
  banned: boolean;
  sing_progress: unknown;
  disabled_plugins: string[];
  /** 本群拉黑 QQ（牛牛黑名单·群聊维度） */
  blocked_user_ids: number[];
  /** 群风格画像快照（只读，供 LLM / repeater 驱动） */
  style_profile_snapshot?: GroupStyleProfileSnapshot | null;
}

export interface UserConfigPublic {
  user_id: number;
  banned: boolean;
}

/** 协议账号信息 */
export interface NapcatAccountRow {
  id?: string;
  qq?: string;
  display_name?: string;
  webui_port?: number | string;
  webui_token?: string;
  /** OneBot 正向 WS 地址（协议端写入） */
  ws_url?: string;
  snowluma_docker_host_onebot_ws?: number | string;
  /** 内嵌 Web 地址 */
  native_webui_url?: string;
  /** 兼容字段 */
  napcat_native_webui_url?: string;
  running?: boolean;
  connected?: boolean;
  process_running?: boolean;
  /** plugin=插件托管 external=自建协议端经消息框架接入 */
  account_source?: "plugin" | "external";
  external_adapter?: string;
  connection_key?: string;
  [key: string]: unknown;
}

export interface NapcatManagerSnapshot {
  plugin: string;
  webui_enabled: boolean;
  webui_path: string;
  console_auth_configured: boolean;
  accounts: NapcatAccountRow[];
}

export interface ProtocolExtensionStatus {
  installed: boolean;
  package: string;
  uv_extra?: string | null;
  install_cli?: string | null;
  repository_url?: string | null;
}

/** 实例数据 */
export interface InstancesData {
  nonebot_bots: BotRow[];
  db_bot_configs: BotConfigPublic[];
  pallas_protocol: NapcatManagerSnapshot | null;
  protocol_extension?: ProtocolExtensionStatus | null;
  bot_profiles?: Record<
    string,
    {
      nickname?: string;
      user_id?: number | null;
      connection_key?: string;
      adapter?: string;
    }
  >;
  /** 兼容字段 */
  napcat?: NapcatManagerSnapshot | null;
}

/** 好友申请 */
export interface FriendPendingEntry {
  user_id: number;
  flag: string;
  /** 控制台拉取：协议可疑列表透传或 get_stranger_info 补全 */
  nickname?: string | null;
}

export interface FriendOverviewBotRow {
  self_id: string;
  connection_key: string | null;
  adapter: string;
  online: boolean;
  pending_friend_requests: FriendPendingEntry[];
  doubt_friend_requests: FriendPendingEntry[];
}

export interface FriendOverviewData {
  bots: FriendOverviewBotRow[];
}

export interface GroupPendingEntry {
  flag: string;
  sub_type: string;
  user_id: number;
  group_id: number;
  comment: string;
}

export interface RequestOverviewBotRow extends FriendOverviewBotRow {
  pending_group_requests: GroupPendingEntry[];
}

export interface RequestOverviewData {
  bots: RequestOverviewBotRow[];
}

export interface AiExtensionConfig {
  base_url: string;
  api_prefix: string;
  token: string;
  health_paths: string[];
  uvicorn_log_file: string;
  celery_log_file: string;
  timeout_sec: number;
}

export type AiExtensionTestData =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/ai-extension/test"]["post"]>;

type GeneratedPluginConfigCheckResult =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/common-config/service_gateways/connectivity-check"]["post"]>;

export type PluginConfigCheckResult = Omit<GeneratedPluginConfigCheckResult, "lines" | "results"> & {
  lines: NonNullable<GeneratedPluginConfigCheckResult["lines"]>;
  results: NonNullable<GeneratedPluginConfigCheckResult["results"]>;
};

export interface AiExtensionLogsData {
  kind: "uvicorn" | "celery";
  path: string;
  lines: string[];
  error: string | null;
}

export interface AiProxyResult {
  ok: boolean;
  status_code: number | null;
  url: string;
  data: Record<string, unknown>;
  error: string | null;
}

/** WebUI 更新检查 */
export interface UpdateCheckData {
  current_tag: string;
  latest_tag: string | null;
  has_update: boolean;
  release_url: string;
  asset_url: string;
  /** GitHub Release 正文（Markdown），网页兜底拉 tag 时可能为空 */
  release_notes?: string | null;
  error: string | null;
  checked_at: number;
}

export interface UpdateApplyData {
  /** GitHub 发布 tag（与检查接口一致） */
  tag: string;
  /** dist 内 console-version.json 的展示版本，可能与 tag 不同 */
  version?: string;
  message: string;
}

export interface UpdateCheckAllData {
  webui: UpdateCheckData;
  bot: BotUpdateCheckData;
  checked_at: number;
}

/** Bot 本体更新检查 */
export type BotDeploymentMode = "docker" | "release_tag" | "release_tag_dirty" | "dev_clone";

export interface BotUpdateCheckData {
  current_tag: string;
  current_commit: string;
  latest_tag: string | null;
  has_update: boolean;
  /** 相对最新 release 超前或未打发行 tag，且无需更新 */
  development_build?: boolean;
  release_url: string;
  /** GitHub Release 正文（Markdown），网页兜底拉 tag 时可能为空 */
  release_notes?: string | null;
  error: string | null;
  checked_at: number;
  /** 运行目录部署形态（控制台 git 更新策略） */
  deployment_mode?: BotDeploymentMode;
  git_available?: boolean;
  dirty?: boolean;
  dirty_file_count?: number;
  current_branch?: string;
  restart_available?: boolean;
  activation_policy?: ExtensionActivationPolicy | null;
}

export interface BotUpdateApplyData {
  tag: string;
  message: string;
  restart_scheduled?: boolean;
}

export interface SystemRestartData {
  scheduled: boolean;
  mode: "full-restart" | "workers-restart";
  workers_only: boolean;
  bot_runtime_mode: string;
  message: string;
}

/** Bot .env → pallas.toml / webui.json 迁移检查 */
export interface BotConfigMigrationCheckData {
  show: boolean;
  legacy_env_files: string[];
  legacy_env_key_count: number;
  pallas_toml_exists: boolean;
  webui_json_exists: boolean;
  can_migrate: boolean;
  needs_force: boolean;
  suggest_cleanup_legacy_env: boolean;
}

export interface BotConfigMigrationApplyData {
  config_path: string;
  webui_path: string;
  bootstrap_field_groups: number;
  webui_env_key_count: number;
  legacy_env_key_count: number;
  legacy_env_files: string[];
  overwritten: boolean;
  message: string;
  migration?: BotConfigMigrationCheckData;
}

/** 群列表（按账号实时拉取） */
export interface GroupListRow {
  group_id: number;
  group_name: string;
  member_count: number;
  max_member_count: number;
}

export interface GroupListData {
  self_id: string;
  connection_key: string;
  adapter: string;
  groups: GroupListRow[];
  truncated: boolean;
  limit: number;
  error: string | null;
}

/** 好友列表 */
export interface FriendListRow {
  user_id: number;
  nickname: string;
  remark: string;
  sex?: unknown;
}

export interface ShardIngressMetrics {
  day_key?: string;
  events?: number;
  early_fleet?: number;
  early_not_at_target?: number;
  fanout_bypass?: number;
  claim_won?: number;
  claim_lost?: number;
  claim_attempts?: number;
  claim_hit_rate?: number | null;
}

export interface ShardCoordPendingSnapshot {
  total_json?: number;
  actionable_total?: number;
  historical_retained?: number;
  by_dir?: Record<string, number>;
  bot_action_open?: number;
  bot_action_stale_open?: number;
}

export interface ShardPgPoolEstimate {
  pg_pool_size?: number;
  pg_max_overflow?: number;
  per_process_max?: number;
  recommended_per_process_max?: number;
  worker_shards?: number;
  estimated_processes?: number;
  estimated_pg_connections_peak?: number;
  warning?: string | null;
}

export interface ShardObservabilityWorker {
  shard_id: number;
  updated_at?: number;
  ingress?: ShardIngressMetrics;
  coord_pending?: ShardCoordPendingSnapshot;
}

export interface IngressDispatchSendQueueStatus {
  enabled?: boolean;
  installed?: boolean;
  depth?: number;
  depth_live?: number;
  max_depth?: number;
  workers?: number;
  sent?: number;
  dropped?: number;
  min_interval_ms?: number;
}

export interface IngressDispatchPoolBudget {
  capacity?: number;
  utilization?: number;
  checked_out?: number;
  cluster_pg?: Record<string, unknown>;
}

export interface IngressDispatchWorker {
  shard_id: number;
  updated_at?: number;
  ingress_dispatch?: IngressDispatchData;
}

/** GET /ingress-dispatch */
export interface IngressDispatchData {
  sharded?: boolean;
  workers?: IngressDispatchWorker[];
  day_key?: string;
  group_messages?: number;
  command_traffic?: number;
  chatter_traffic?: number;
  matchers_considered?: number;
  matchers_selected?: number;
  matchers_run?: number;
  matchers_selected_ratio?: number | null;
  avg_matchers_per_message?: number | null;
  lane_wait_ms_avg?: number | null;
  lane_busy?: number;
  overload_signals?: number;
  prefetch_paused?: number;
  preprocessor_dropped?: number;
  ingress_duration_ms_p95?: number | null;
  send_queue?: IngressDispatchSendQueueStatus;
  pool_budget?: IngressDispatchPoolBudget;
  alerts?: string[];
}

/** GET /shard-observability */
export interface ShardObservabilityData {
  sharded?: boolean;
  ingress_cluster?: ShardIngressMetrics;
  coord_pending_live?: ShardCoordPendingSnapshot;
  workers?: ShardObservabilityWorker[];
  pg_pool?: ShardPgPoolEstimate;
}

/** 生成 OpenAPI 类型与手写类型的对齐入口 */
export type OpenapiSystemData = OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/system"]["get"]>;
export type OpenapiPluginsData = OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/plugins"]["get"]>;
export type OpenapiCommonConfigSectionsData =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/common-config/sections"]["get"]>;
export type OpenapiCommonConfigSectionData =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/common-config/{section_id}"]["get"]>;
export type OpenapiCommonConfigSectionRawData =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/common-config/{section_id}/raw"]["get"]>;
export type OpenapiPluginConfigRawData =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/plugins/{plugin_name}/config/raw"]["get"]>;
export type OpenapiPluginConfigCheckResult =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/plugins/{plugin_name}/config-check"]["post"]>;
export type OpenapiShardObservabilityData =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/shard-observability"]["get"]>;
export type OpenapiIngressDispatchData =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/ingress-dispatch"]["get"]>;
export type OpenapiLogsData = OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/logs"]["get"]>;
export type OpenapiPluginGovernanceData =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/plugins/{plugin_name}/governance"]["get"]>;
export type OpenapiPluginConfigData =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/plugins/{plugin_name}/config"]["get"]>;

export interface FriendListData {
  self_id: string;
  connection_key: string;
  adapter: string;
  friends: FriendListRow[];
  truncated: boolean;
  limit: number;
  error: string | null;
}
