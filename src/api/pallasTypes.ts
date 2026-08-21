import type { components as ConsoleOpenapiComponents, paths as ConsoleOpenapiPaths } from "./generated/pallasConsoleOpenapi";
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
    cpu_model?: string | null;
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

/** POST /community-stats/connectivity-check：Bot → 社区中心 HTTPS 诊断 */
export type CommunityConnectivityProbeRow = {
  url: string;
  ok: boolean;
  latency_ms?: number | null;
  http_status?: number | null;
  error?: string | null;
};
export type CommunityConnectivityReporting = {
  enabled: boolean;
  endpoint?: string | null;
  active_heartbeat_endpoint?: string | null;
  deployment_id?: string | null;
  last_heartbeat_ok_unix?: number | null;
  last_primary_probe_unix?: number | null;
};
export type CommunityConnectivitySummary = {
  any_ok: boolean;
  hint?: string | null;
};
/** OpenAPI 侧曾退化为 additionalProperties；运行时字段结构固定，此处手写契约。 */
export type CommunityConnectivityCheckData = {
  probes: CommunityConnectivityProbeRow[];
  summary: CommunityConnectivitySummary;
  reporting: CommunityConnectivityReporting;
};

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
  /** off | sync | prefetch */
  remote_find_mode?: string;
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
  /** 当日收到过群消息的去重群数 */
  active_groups?: number;
}

export interface ConsoleGroupMetrics {
  dag: number;
  mag: number;
  dag_mag_ratio: number | null;
  mag_days: number;
}

export interface ConsoleDailyStatsData {
  start: string;
  end: string;
  query_start: string;
  query_end: string;
  rows: ConsoleDailyStatRow[];
  live_today: Record<string, { received: number; sent: number; matcher_runs: number }>;
  server_date: string;
  group_metrics?: ConsoleGroupMetrics;
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

export type PluginSourceKind =
  | "main"
  | "core"
  | "extra"
  | "bundled"
  | "official"
  | "community"
  | "nonebot"
  | "local";

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
  global_disable_revision?: string;
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
  blocked_user_ids?: number[];
  reload_policy?: string | null;
  activation_policy?: string | null;
}

export interface PluginGovernanceBody {
  command_permission_overrides?: Record<string, string>;
  command_limit_overrides?: Record<string, number>;
  global_disable?: boolean;
  global_disable_revision?: string;
  help_hidden?: boolean;
  blocked_user_ids?: number[];
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
  /** 已安装插件版本；无法可靠识别时为空 */
  plugin_version?: string | null;
  extra_package?: string | null;
  /** 相对仓库根的目录，如 local/plugins/draw */
  plugin_source_dir?: string | null;
  /** 是否可在管理页卸载（配置弹窗提供「卸载」入口） */
  uninstallable?: boolean;
  /** 卸载方式：dir 删除源码目录 / pip 卸载 / community 社区插件 / official 官方扩展 */
  uninstall_kind?: "dir" | "pip" | "community" | "official";
  /** 卸载目标：目录相对路径或 pip 包名 */
  uninstall_target?: string | null;
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
  revision: string;
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
  /** 专用控件，如 provider_gateway */
  ui_widget?: string;
  /** provider_gateway 绑定声明 */
  ui_gateway?: Record<string, unknown>;
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
  /** 通用配置跳转用；插件内分组可省略 */
  plugin_config_path?: string;
  /** 进阶分组默认折叠展示 */
  advanced?: boolean;
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
  /** GET：已保存 inline 密钥的不可逆尾号提示。 */
  api_key_hints?: string[];
  api_key_env: string;
  /** GET：是否已配置可用密钥（inline 或环境变量）。 */
  api_key_set?: boolean;
  default_model: string;
  enabled: boolean;
  task_models: Record<string, string>;
  /** chat_completions | responses | anthropic_messages */
  request_method?: string;
  model_pricing?: Record<
    string,
    { price_in?: number; price_out?: number; cache_price_in?: number; cache_price_out?: number }
  >;
}

export type LlmProvidersConfig = Omit<GeneratedLlmProvidersConfig, "providers" | "routing"> & {
  providers: LlmProviderConfigRow[];
  routing: Omit<GeneratedLlmProvidersRouting, "chain_fallback" | "tasks"> & {
    chain_fallback: NonNullable<GeneratedLlmProvidersRouting["chain_fallback"]>;
    tasks: NonNullable<GeneratedLlmProvidersRouting["tasks"]>;
    cost_currency?: string;
  };
};

export interface LlmProvidersSaveResult {
  providers_file: string;
  provider_status?: LlmProviderStatusRow[];
  task_routing?: Record<string, string>;
}

/** Provider 在线模型发现结果（Bot 直连上游 /v1/models）。 */
export interface LlmProviderModelsResult {
  provider_id: string;
  ok: boolean;
  models: string[];
  source: string;
  error?: string;
}

/** Provider 实时连通性测试结果（Bot 直连上游）。 */
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

/** Embedding 提供方诊断（common-config/llm/embedding-status）。 */
export interface LlmEmbeddingStatus {
  embedding_provider: string;
  embedding_kind?: string;
  embedding_model: string;
  resolved_model?: string;
  embedding_provider_id?: string | null;
  endpoint_provider_id?: string | null;
  semantic_available: boolean;
  embedding_fallback: boolean;
  embedding_error?: string | null;
  available_providers?: string[];
  local_dependency_ready?: boolean;
  local_default_model?: string | null;
  remote_default_model?: string | null;
  endpoint_configured?: boolean;
  trigger_cache_count?: number;
  trigger_cache_model?: string | null;
  probe_ok?: boolean | null;
  probe_dims?: number | null;
  probe_ms?: number | null;
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
  affect_refine: string;
  turn_decision: string;
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
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  total_tokens?: number;
  cost_total?: number;
}

export interface LlmTokenMetricsSlice {
  source: string;
  day_key: string;
  updated_at?: number;
  prompt_tokens: number;
  completion_tokens: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  total_tokens: number;
  cost_total?: number;
  cost_currency?: string;
  by_task: Record<string, LlmTokenMetricBreakdownRow>;
  by_provider?: Record<string, LlmTokenMetricBreakdownRow>;
  by_model?: Record<string, LlmTokenMetricBreakdownRow>;
  by_hour?: Record<string, LlmTokenMetricBreakdownRow>;
}

export interface LlmImageMetricBreakdownRow {
  ok_count?: number;
  fail_count?: number;
  image_count?: number;
  cost_total?: number;
}

export interface LlmImageMetricsSlice {
  source?: string;
  day_key?: string;
  updated_at?: number;
  ok_count?: number;
  fail_count?: number;
  image_count?: number;
  cost_total?: number;
  cost_currency?: string;
  by_gateway?: Record<string, LlmImageMetricBreakdownRow>;
  by_provider?: Record<string, LlmImageMetricBreakdownRow>;
  by_model?: Record<string, LlmImageMetricBreakdownRow>;
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

export interface LlmRagMetricsSlice {
  source?: string;
  day_key?: string;
  updated_at?: number;
  hit_count?: number;
  miss_count?: number;
  skip_count?: number;
  hit_rate?: number;
  by_document?: Record<string, number>;
  by_source?: Record<string, number>;
}

export interface LlmGatesSlice {
  skip?: number;
  defer?: number;
  proceed?: number;
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
  images?: LlmImageMetricsSlice;
  rag?: LlmRagMetricsSlice;
  memory_rag?: LlmRagMetricsSlice;
  gates?: LlmGatesSlice;
  classification?: {
    totals: LlmClassificationTotals;
  };
  sticker_vision?: LlmStickerVisionStats;
  sticker_label?: LlmStickerLabelStats;
}

export interface LlmStickerVisionRecentRow {
  job_id: string;
  created_at: number;
  state: string;
  candidate_count: number;
  provider: string;
  model: string;
  duration_ms?: number | null;
  delivery_state: string;
  error?: string | null;
}

export interface LlmStickerVisionStats {
  requests: number;
  selected: number;
  failed: number;
  skipped?: number;
  no_match?: number;
  sent?: number;
  delivery_failed?: number;
  candidate_total?: number;
  avg_duration_ms?: number | null;
  recent_error?: string | null;
  recent: LlmStickerVisionRecentRow[];
}

export interface LlmStickerLabelStats {
  submitted?: number;
  labeled?: number;
  pending?: number;
  failed?: number;
  timeout?: number;
  parse_error?: number;
  no_vision?: number;
  circuit_open?: number;
  cache_changed?: number;
  recent_errors?: LlmStickerLabelRecentError[];
}

export interface LlmStickerLabelRecentError {
  job_id: string;
  created_at: number;
  state: string;
  error: string;
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

type GeneratedLlmRuntimeOverviewData =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/common-config/llm/runtime-overview"]["get"]>;

export type LlmRuntimeOverviewHealthData = GeneratedLlmRuntimeOverviewData["health"] & {
  llm_health?: AiExtensionTestData["llm_health"];
  image_health?: AiExtensionTestData["image_circuit"];
  /** plugin_runtime | ai_service_runtime；未装画画插件时为 null */
  draw_runtime_mode?: string | null;
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
  calls?: LlmHistoryBehaviorAgentTraceToolCall[];
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
  tool_names?: string[];
  request_snapshot_id?: string | null;
  tool_catalog_version?: string | null;
  rounds?: LlmHistoryBehaviorAgentTraceRound[];
  stages?: LlmHistoryBehaviorAgentTraceStage[];
  prefetched_tool?: string | null;
  final_stage?: string | null;
  status?: string | null;
}

export interface LlmToolTraceUi {
  tools_enabled?: boolean;
  tool_schema_count?: number;
  tool_names?: string[];
  selection?: Record<string, unknown>;
  tool_call_count?: number;
  status?: string | null;
  agent_trace?: LlmHistoryBehaviorAgentTrace | null;
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
  variation_hint?: string;
  lines?: string[];
}

export interface LlmRuntimeDebugView {
  retired_persona_cleanup?: {
    system_prompt_sections?: string[];
    persona_summary_fields?: string[];
  };
}

export interface LlmRuntimeDebugData {
  request_id?: string;
  snapshot?: Record<string, unknown> | null;
  trace?: LlmHistoryBehaviorAgentTrace | null;
  persona_shaping?: LlmPersonaShapingSummary | null;
  tool_trace?: LlmToolTraceUi | null;
  debug_view?: LlmRuntimeDebugView | null;
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
  writeback_status?: string;
  writeback_message?: string;
  writeback_at?: number;
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
  affinity?: number;
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

export interface KnowledgeSourceChunkPreview {
  index?: number;
  title?: string;
  keywords?: string;
  content_preview?: string;
  content_len?: number;
}

export interface KnowledgeSourceDetail {
  source_id: string;
  title?: string;
  description?: string;
  scope?: string;
  retrieval_mode?: string;
  origin?: string;
  plugin_name?: string;
  plugin_title?: string;
  default?: boolean;
  top_k?: number;
  max_chunk_len?: number;
  chunk_count?: number;
  chunks_preview?: KnowledgeSourceChunkPreview[];
  chunks_preview_truncated?: boolean;
  preview_content_len?: number;
}

export interface KnowledgeSourceRetrieveHit {
  source_id?: string;
  title?: string;
  content?: string;
  score?: number;
  retrieval_mode?: string;
}

export interface KnowledgeSourceRetrieveData {
  query?: string;
  source_id?: string | null;
  min_score?: number;
  items?: KnowledgeSourceRetrieveHit[];
  count?: number;
  enabled?: boolean;
}

export interface LlmMcpRegistrationStatus {
  servers?: Array<{
    id?: string;
    transport?: string;
    command?: string[];
    url?: string;
    enabled_tools?: string[];
  }>;
  registered_tool_names?: string[];
  registered_count?: number;
  errors?: Array<{ server_id?: string; error?: string }>;
  sessions?: Array<{
    id?: string;
    transport?: string;
    alive?: boolean;
    calls?: number;
  }>;
}

export interface LlmToolCatalogPolicy {
  tools_enabled?: boolean;
  selective_enabled?: boolean;
  max_rounds?: number;
  blacklist?: string[];
  arknights_kb_enabled?: boolean;
  desc_max_len?: number;
  mcp?: LlmMcpRegistrationStatus;
}

export interface LlmToolCatalogItem {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  source?: string;
  domains?: string[];
  capabilities?: string[];
  command_id?: string | null;
  plugin_name?: string | null;
  provider_name?: string | null;
  mcp_server_id?: string | null;
  eligible?: boolean;
  disabled_reason?: string | null;
  hints?: string[];
  effective_hints?: string[];
  visibility?: string;
  declared_visibility?: string;
  override?: {
    description?: string | null;
    hints?: string[] | null;
    visibility?: string | null;
    disabled?: boolean | null;
  } | null;
}

export interface LlmToolOverridePatch {
  description?: string | null;
  hints?: string[] | null;
  visibility?: "visible" | "deferred" | "" | null;
  disabled?: boolean | null;
}

export interface LlmToolIntentPreview {
  text?: string;
  domains?: string[];
  structure_domains?: string[];
  hint_domains?: string[];
  top_scores?: Array<{
    name?: string;
    score?: number;
    domains?: string[];
    visibility?: string;
  }>;
  schema_tools?: string[];
  schema_count?: number;
  selective_empty?: boolean;
}

export interface LlmToolCatalogData {
  items: LlmToolCatalogItem[];
  count: number;
  policy?: LlmToolCatalogPolicy;
  overrides?: Record<string, LlmToolOverridePatch>;
  patched?: { name?: string; override?: LlmToolOverridePatch };
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
  account_profile: AccountPersonaProfile;
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

export interface SceneDialogueExample {
  schema_version: number;
  example_id: string;
  bot_id: number;
  scene: string;
  user_cue: string;
  positive: string;
  negative: string;
  enabled: boolean;
  order: number;
  created_at: number;
  updated_at: number;
}

export interface SceneDialogueExamplesData {
  items: SceneDialogueExample[];
  count: number;
}

export interface BotRow {
  connection_key: string;
  self_id: string;
  adapter: string;
  /** 当前进程内最近一次接入 Unix 秒（仅在线 Bot；来自控制台扩展 API） */
  connected_at_unix?: number | null;
  /** 本连接所在 Bot 进程 OneBot 反向 WS 监听端口（分片时可区分 worker） */
  ws_port?: number | null;
  /** 分片 worker 编号；非分片或 hub 本地列表可能缺省 */
  shard_id?: number | null;
  nickname?: string | null;
  online?: boolean;
}

/** GET /logs?scope= 与后端一致 */
export type LogScope = "all" | "message" | "console" | "other";

export type LogEntryLevel = "debug" | "info" | "success" | "warn" | "error";

export type LogFacet = "message" | "console" | "other";

export interface LogEntry {
  id: number;
  time: string;
  level: LogEntryLevel;
  scope: string;
  message: string;
  /** sink 写入的切面；缺失时后端按 other 过滤 */
  facet?: LogFacet | null;
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
  /** 可选的日志来源列表（分片 worker 与已启用的辅进程） */
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

export type DbHealthStatus = "healthy" | "degraded" | "unhealthy";

export interface DbHealthData {
  status: DbHealthStatus;
  reason: string;
  backend?: string;
  updated_at?: number;
  updated_at_unix?: number;
  last_probe_ok?: boolean | null;
  pool?: {
    capacity?: number;
    utilization?: number | null;
    under_pressure?: boolean;
    live?: Record<string, number> | null;
    idle_in_tx?: number | null;
  } | null;
  schema?: {
    ok?: number;
    failed?: number;
    last_error?: string;
    steps?: { name: string; ok: boolean; error?: string }[];
  };
  low_priority_writers?: {
    name: string;
    queued: number;
    dropped: number;
    flushed: number;
    max_retain: number;
  }[];
}

export interface DbTablesData {
  backend?: string;
  tables: {
    name: string;
    count?: number;
    count_estimated?: boolean;
    browseable?: boolean;
    overview_only?: boolean;
  }[];
}

export interface DbTableRowsData {
  table: string;
  offset: number;
  limit: number;
  total: number;
  rows: Record<string, unknown>[];
}

export type DbLifecycleCatalogData = OpenapiOkData<
  ConsoleOpenapiPaths["/pallas/api/db/lifecycle/catalog"]["get"]
>;
export type DbLifecyclePoliciesData = OpenapiOkData<
  ConsoleOpenapiPaths["/pallas/api/db/lifecycle/policies"]["get"]
>;
export type DbLifecyclePolicy = DbLifecyclePoliciesData["policies"][string];
export type DbLifecyclePreviewData = OpenapiOkData<
  ConsoleOpenapiPaths["/pallas/api/db/lifecycle/preview"]["post"]
>;
export type DbLifecycleJobData = OpenapiOkData<
  ConsoleOpenapiPaths["/pallas/api/db/lifecycle/jobs"]["post"]
>;
export type FilesListData = OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/files/list"]["get"]>;
export type FilesEntry = FilesListData["entries"][number];
export type FilesReadData = OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/files/read"]["get"]>;
export type FilesOkData = OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/files/write"]["post"]>;

export type DbBackendKind = "postgresql" | "mongodb";

export interface DbBackendPostgresConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  password_set?: boolean;
  db: string;
  auto_create_db: boolean;
}

export interface DbBackendMongoConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  password_set?: boolean;
  db: string;
  auth_source: string;
}

export interface DbBackendConfigData {
  active_backend: DbBackendKind | string;
  backend: DbBackendKind | string;
  postgres: DbBackendPostgresConfig;
  mongo: DbBackendMongoConfig;
  restart_required_hint?: string;
}

export interface DbBackendSaveResult {
  restart_required: boolean;
  backend: string;
  message: string;
  force?: boolean;
}

export interface DbMigrateMongoPgInfo {
  active_backend?: string;
  tables: string[];
  schema_ensure_steps?: { id: string; kind: string }[];
  notes?: string[];
}

export interface DbMigrateMongoPgJob {
  job_id: string;
  status: "queued" | "running" | "completed" | "failed" | string;
  phase?: string;
  dry_run?: boolean;
  tables?: string[];
  logs?: string[];
  result?: Record<string, unknown>;
  error?: string;
  created_at?: number;
  started_at?: number | null;
  finished_at?: number | null;
  elapsed_sec?: number | null;
}

export interface DbBackendProbeResult {
  ok: boolean;
  latency_ms: number;
  detail: string;
}

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
  /** 账号 persona JSON；编辑面仅写 account_profile，其他字段为运行时兼容数据。 */
  persona?: Record<string, unknown> | null;
  /** 当前生效的账号稳定气质（含自动派生），供弹窗展示。 */
  account_profile_effective?: AccountPersonaProfile | null;
  group_style_enabled?: boolean;
}

export type AccountPersonaAxis = "energy" | "warmth" | "mischief" | "restraint";

/** Bot openspec 新结构；WebUI generated 基线同步后可改回 generated alias。 */
export type AccountPersonaProfile = ConsoleOpenapiComponents["schemas"]["AccountPersonaProfile"];

export interface MessageLengthDistribution {
  average: number;
  p50: number;
  p90: number;
}

export interface GroupExpressionAggregate {
  sample_count: number;
  window_hours: number;
  message_count: number;
  answer_count: number;
  distinct_answer_keywords: number;
  active_hour_count: number;
  messages_per_active_hour: number;
  message_length?: MessageLengthDistribution;
  answer_ratio: number;
  repetition_rate: number;
  forced_teach_weight: number;
  contamination_skipped_messages: number;
  contamination_skipped_answers: number;
}

export interface SemanticExamplesSummary {
  profile_ref: string;
  scene: string;
  sample_count: number;
  direct_example_count: number;
  direct_pair_count: number;
  rewrite_seed_count: number;
  intensity_counts?: Record<string, number>;
  form_counts?: Record<string, number>;
  updated_at?: string | null;
}

export type SemanticStyleOverridesData = ConsoleOpenapiComponents["schemas"]["_SemanticStyleOverridesData"];
export type SemanticStyleStatusData = ConsoleOpenapiComponents["schemas"]["_SemanticStyleStatusData"];
export type SemanticStyleQualityData = ConsoleOpenapiComponents["schemas"]["_SemanticStyleQualityData"];
export type GroupStyleGovernanceData = ConsoleOpenapiComponents["schemas"]["_GroupStyleGovernanceData"];
export type BasePromptPreviewData = ConsoleOpenapiComponents["schemas"]["_BasePromptPreviewData"];
export type BasePromptOverrideData = Omit<BasePromptPreviewData, "mode" | "versions"> & {
  mode: "append" | "replace";
  text: string;
  versions: Array<{ id: string; mode: "append" | "replace"; text: string; builtin_sha256: string; updated_at: string }>;
};
export type LlmStickerLabelOverviewData = ConsoleOpenapiComponents["schemas"]["_StickerLabelOverviewData"];
export type LlmStickerLabelMaintenanceResult = OpenapiOkData<
  ConsoleOpenapiPaths["/pallas/api/common-config/llm/persona/sticker-labels/manage"]["post"]
>;

export type LlmStickerLabelManageRequest =
  | { action: "requeue" }
  | { action: "pause"; paused: boolean }
  | { action: "clear"; contentHash: string };

export interface GroupReplyShapeHint {
  length_pref: "short" | "medium" | "long" | "any";
  bubble_count_p50: number;
  bubble_count_p90: number;
  segment_char_length_p50: number;
  segment_char_length_p90: number;
  rhythm_distribution?: Record<string, number>;
}

export interface GroupExpressionProfile {
  aggregate: GroupExpressionAggregate;
  examples_summary: SemanticExamplesSummary;
  reply_shape: GroupReplyShapeHint;
  updated_at?: string;
}

export interface LegacyGroupStyleProfile {
  updated_at?: string | number;
  sample?: {
    window_hours?: number;
    message_count?: number;
    answer_count?: number;
  };
  raw?: {
    avg_plain_len?: number;
    p50_plain_len?: number;
    msgs_per_hour_active?: number;
    local_answer_ratio?: number;
    repeat_chain_rate?: number;
  };
}

export function readManualAccountPersonaProfile(
  persona: Record<string, unknown> | null | undefined,
): AccountPersonaProfile | null {
  const raw = persona?.account_profile;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const profile = raw as Record<string, unknown>;
  if (profile.source !== "manual") return null;
  const value = (axis: AccountPersonaAxis) => {
    const parsed = Number(profile[axis]);
    return Number.isFinite(parsed) ? Math.max(-1, Math.min(1, parsed)) : 0;
  };
  return {
    energy: value("energy"),
    warmth: value("warmth"),
    mischief: value("mischief"),
    restraint: value("restraint"),
    source: "manual",
  };
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
  /** 原生 WebUI 鉴权/密钥提示（列表或详情旁注） */
  native_webui_auth_note?: string;
  /** SnowLuma Docker noVNC 元数据（协议插件 compose） */
  snowluma_docker_novnc?: {
    url?: string;
    bind_host?: string;
    host_port?: number;
    uses_default_vnc_password?: boolean;
  };
  /** Bot 自动改密后写入 accounts.json 的 SnowLuma WebUI 管理密钥 */
  snowluma_managed_webui_password?: string;
  /** 日志解析的一次性初始密钥（改密前） */
  snowluma_runtime_webui_password?: string;
  snowluma_webui_default_user?: string;
  snowluma_linux_docker?: boolean;
  /** SnowLuma 多 QQ 共享进程/容器 id */
  snowluma_runtime_id?: string;
  snowluma_runtime_legacy_container_account_id?: string;
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
  celery_media_log_file: string;
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
  kind: "uvicorn" | "celery" | "celery-media";
  path: string;
  lines: string[];
  error: string | null;
  source?: "local" | "remote" | "none";
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

export interface UpdateApplyJobStartData {
  job_id: string;
  kind: "webui" | "bot" | "auto";
  restart?: boolean;
}

export interface UpdateApplyJobSnapshot {
  job_id: string;
  kind: "webui" | "bot" | "auto";
  phase: "queued" | "running" | "done" | "failed";
  message: string;
  progress_percent: number;
  result?: {
    tag?: string;
    version?: string;
    message?: string;
    restart_scheduled?: boolean;
    tick?: {
      result?: string;
      reason?: string;
      error?: string;
      targets?: Record<
        string,
        {
          result?: string;
          error?: string;
          reason?: string;
        }
      >;
    };
    last_error?: string | null;
  } | null;
  error?: string;
  restart?: boolean;
}

/** @deprecated POST /update/apply 现返回 job_id；保留兼容字段 */
export interface UpdateApplyData extends Partial<UpdateApplyJobStartData> {
  /** GitHub 发布 tag（与检查接口一致） */
  tag?: string;
  /** dist 内 console-version.json 的展示版本，可能与 tag 不同 */
  version?: string;
  message?: string;
}

export interface UpdateCheckAllData {
  webui: UpdateCheckData;
  bot: BotUpdateCheckData;
  checked_at: number;
}

/** Bot 本体更新检查 */
export type BotDeploymentMode = "docker" | "release_tag" | "release_tag_dirty" | "dev_clone";

export type BotUpdateTrack = "release" | "branch";

export interface BotUpdateCheckData {
  current_tag: string;
  current_commit: string;
  latest_tag: string | null;
  has_update: boolean;
  /** 相对最新 release 超前或未打发行 tag，且无需更新 */
  development_build?: boolean;
  /** release=正式版 tag；branch=git pull 跟踪分支 tip */
  update_track?: BotUpdateTrack;
  /** 分支轨道配置的分支名；空表示自动解析 */
  update_branch?: string;
  upstream_ref?: string;
  latest_commit?: string;
  commits_behind?: number;
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
  image_version?: string;
  runtime_version?: string;
  container_overlay_update?: boolean;
  activation_policy?: ExtensionActivationPolicy | null;
}

/** Bot git 管理台：更新方式（UI：Release / Commit；配置 track 仍为 release / branch） */
export type BotGitUiMode = "release" | "commit";

export type BotGitHeadInfo = {
  sha: string;
  short_sha: string;
  tag?: string;
  date?: string;
  message?: string;
};

export type BotGitStatusData = {
  update_track?: BotUpdateTrack | string;
  update_branch?: string;
  branches?: string[];
  head?: BotGitHeadInfo | null;
  upstream_ref?: string;
  latest_commit?: string;
  commits_behind?: number;
  git_available?: boolean;
  dirty?: boolean;
  dirty_file_count?: number;
  current_branch?: string;
  deployment_mode?: BotDeploymentMode | string;
  restart_available?: boolean;
  image_version?: string;
  runtime_version?: string;
  container_overlay_update?: boolean;
};

export type BotGitHistoryItem = {
  kind: "commit" | "release" | string;
  ref: string;
  short_ref: string;
  date: string;
  message: string;
  is_head?: boolean;
  is_latest?: boolean;
};

export type BotGitHistoryData = {
  mode: BotGitUiMode | string;
  branch?: string;
  head?: BotGitHeadInfo | null;
  items: BotGitHistoryItem[];
};

export type BotGitApplyBody = {
  mode: BotGitUiMode | string;
  branch?: string;
  ref?: string;
  strategy?: "safe" | "force" | string;
  restart?: boolean;
};

export interface BotUpdateApplyData extends Partial<UpdateApplyJobStartData> {
  tag?: string;
  message?: string;
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

/** GET /git-mirror/info */
export type GitMirrorOption = {
  id: string;
  label: string;
  type: "default" | "proxy" | "custom";
};

export type GitMirrorScopes = {
  bot: string;
  webui: string;
  community: string;
};

export type GitMirrorTargetRow = {
  id: string;
  kind: "bot" | "webui" | "official" | "plugin";
  label?: string;
  path: string;
  remote_url: string;
  is_git_repo: boolean;
  mirror: string;
  can_apply_remote?: boolean;
  scope_id?: string;
  note?: string;
};

export type GitMirrorPluginRow = GitMirrorTargetRow;

export type GitMirrorInfo = {
  preferred_id: string;
  custom_proxy_prefix: string;
  scopes: GitMirrorScopes;
  available_mirrors: GitMirrorOption[];
  targets: GitMirrorTargetRow[];
  plugins: GitMirrorPluginRow[];
};

export type GitMirrorApplySummary = {
  results: { id?: string; name?: string; success: boolean; message: string }[];
  summary: { total: number; success_count: number; fail_count: number };
};

export type GitMirrorProbeResult = { ok: boolean; mirror_id?: string; error?: string };

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

export interface IngressDispatchHotpath {
  learn_enqueued?: number;
  learn_buffered?: number;
  learn_persisted?: number;
  learn_skipped_full?: number;
  learn_dropped_shutdown?: number;
  llm_retained_under_shed?: number;
  llm_budget_skipped_explicit?: number;
  llm_budget_skipped_ambient?: number;
  llm_budget_skipped_repeater_strong?: number;
  llm_budget_skipped_repeater_weak?: number;
  llm_budget_skipped_proactive?: number;
}

export interface IngressDispatchWorkAux {
  available?: boolean;
  heartbeat_age_sec?: number;
  consumers?: number;
  pending?: number;
  leased?: number;
  oldest_pending_age_sec?: number | null;
  max_attempts?: number;
  completed_since_start?: number;
  failed_since_start?: number;
  retried_since_start?: number;
  dead_lettered_since_start?: number;
}

export interface IngressDispatchConversationScheduler {
  enabled?: boolean;
  pending?: number;
  pending_peak?: number;
  active?: number;
  active_peak?: number;
  ready_peak?: number;
  wait_ms_p95?: number | null;
  run_ms_p95?: number | null;
  backpressure_waits?: number;
}

export interface IngressDispatchWorker {
  shard_id: number;
  updated_at?: number;
  ingress_dispatch?: IngressDispatchData;
}

export interface IngressDispatchHistoryPoint {
  at: number;
  ingress_p95_ms: number;
  ingress_full_p95_ms: number;
  scheduler_wait_p95_ms: number;
  scheduler_pending: number;
  scheduler_active: number;
  scheduler_capacity: number;
  work_pending: number;
  work_leased: number;
  group_messages: number;
  learn_enqueued: number;
  learn_persisted: number;
  work_completed: number;
}

export interface IngressDispatchHistoryData {
  retention_sec: number;
  bucket_sec: number;
  points: IngressDispatchHistoryPoint[];
}

export interface IngressDispatchLane {
  limit?: number;
  in_use?: number;
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
  ingress_full_ms_p95?: number | null;
  send_queue?: IngressDispatchSendQueueStatus;
  pool_budget?: IngressDispatchPoolBudget;
  hotpath?: IngressDispatchHotpath;
  work_aux?: IngressDispatchWorkAux;
  conversation_scheduler?: IngressDispatchConversationScheduler;
  lanes?: Record<string, IngressDispatchLane>;
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

/** GET /system/restart-availability */
export interface SystemRestartAvailabilityData {
  restart_available?: boolean;
  deployment_mode?: string;
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
export type OpenapiSystemRestartAvailabilityData =
  OpenapiOkData<ConsoleOpenapiPaths["/pallas/api/system/restart-availability"]["get"]>;
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
