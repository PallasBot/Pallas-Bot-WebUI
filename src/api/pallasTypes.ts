/** 标准响应结构 */

export interface ApiOk<T> {
  ok: boolean;
  data: T;
}

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

/** GET /community-stats：代理社区统计中心 /v1/stats */
export interface CommunityStatsData {
  deployments_total: number;
  deployments_online: number;
  bots_online_sum: number;
  online_ttl_sec?: number;
  as_of?: string;
  stats_url?: string;
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

/** 单次 Matcher 墙钟耗时（jsonl 持久化，每账号默认最多 80 条，重启可恢复） */
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
  }>;
}

export type PluginLoadRole = "hub" | "worker" | "both" | "infra" | "internal";

export interface PluginRow {
  name: string;
  module: string;
  nb_plugin_name?: string;
  load_role?: PluginLoadRole;
  loaded_in_process?: boolean;
  has_config?: boolean;
  help_visible?: boolean;
  help_ignored?: boolean;
  help_hidden?: boolean;
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

export interface PluginConfigField {
  name: string;
  kind: "bool" | "int" | "float" | "json" | "string" | "enum";
  required: boolean;
  description: string;
  env_key: string;
  default: unknown;
  current: unknown;
  /** kind 为 enum 时由后端 Literal 推导 */
  choices?: string[];
}

/** GET/PUT 通用配置「命令权限」段时后端可附带，用于矩阵单选 UI */
export interface CommandPermUiLevel {
  id: string;
  label: string;
}

export interface CommandPermUiCommand {
  command_id: string;
  label: string;
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
  /** 通用配置 service_gateways：分组展示与跳转插件页 */
  field_groups?: PluginConfigFieldGroup[];
  /** 使用 PallasImageGatewaysEditor 编辑画画网关 */
  gateway_editor?: boolean;
  /** 可调用全链路连通检测 API */
  supports_connectivity_check?: boolean;
}

/** 通用配置 → 服务网关 / 连通性 */
export const SERVICE_GATEWAYS_SECTION_ID = "service_gateways";

/** GET /common-config/sections */
export interface CommonConfigSectionMeta {
  id: string;
  title: string;
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
  /** 分片 hub：已合并 data/pallas_shard/logs 下 hub/worker 落盘尾行 */
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
}

export interface GroupConfigPublic {
  group_id: number;
  roulette_mode: number;
  banned: boolean;
  sing_progress: unknown;
  disabled_plugins: string[];
  /** 本群拉黑 QQ（牛牛黑名单·群聊维度） */
  blocked_user_ids: number[];
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
  /** 内嵌 Web 地址 */
  native_webui_url?: string;
  /** 兼容字段 */
  napcat_native_webui_url?: string;
  running?: boolean;
  connected?: boolean;
  process_running?: boolean;
  [key: string]: unknown;
}

export interface NapcatManagerSnapshot {
  plugin: string;
  webui_enabled: boolean;
  webui_path: string;
  console_auth_configured: boolean;
  accounts: NapcatAccountRow[];
}

/** 实例数据 */
export interface InstancesData {
  nonebot_bots: BotRow[];
  db_bot_configs: BotConfigPublic[];
  pallas_protocol: NapcatManagerSnapshot | null;
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

export interface AiExtensionTestData {
  ok: boolean;
  status_code: number | null;
  health_url: string;
  tried_urls?: string[];
  error: string | null;
}

export interface PluginConfigCheckResult {
  lines: string[];
  results: Array<{
    category?: string;
    site: string;
    ok: boolean;
    latency_ms: number | null;
    status_code: number | null;
    error: string | null;
    label?: string;
  }>;
}

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

/** Bot 本体更新检查 */
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
}

export interface BotUpdateApplyData {
  tag: string;
  message: string;
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

/** GET /shard-observability */
export interface ShardObservabilityData {
  sharded?: boolean;
  ingress_cluster?: ShardIngressMetrics;
  coord_pending_live?: ShardCoordPendingSnapshot;
  workers?: ShardObservabilityWorker[];
  pg_pool?: ShardPgPoolEstimate;
}

export interface FriendListData {
  self_id: string;
  connection_key: string;
  adapter: string;
  friends: FriendListRow[];
  truncated: boolean;
  limit: number;
  error: string | null;
}
