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
    memory?: { total?: number | null; used?: number | null; percent?: number | null };
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
}

/** Matcher 按插件名拆分的时间序列（与 matcher_calls_history_bucket_sec 对齐） */
export interface PluginMatcherNamedSeries {
  plugin: string;
  points: ApiCallHistoryPoint[];
}

export interface PluginRunStatsData {
  total_runs: number;
  total_errors: number;
  total_runs_today: number;
  total_errors_today: number;
  matcher_calls_history_bucket_sec?: number;
  matcher_calls_history_max_buckets?: number;
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
  }>;
}

export interface PluginRow {
  name: string;
  module: string;
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
  kind: "bool" | "int" | "float" | "json" | "string";
  required: boolean;
  description: string;
  env_key: string;
  default: unknown;
  current: unknown;
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

export interface PluginConfigData {
  plugin: string;
  module: string;
  fields: PluginConfigField[];
  command_perm_ui?: CommandPermUiData;
}

/** GET /common-config/sections */
export interface CommonConfigSectionMeta {
  id: string;
  title: string;
}

export interface BotRow {
  connection_key: string;
  self_id: string;
  adapter: string;
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
}

/** 数据库概览 */
export type DbOverviewData =
  | {
      backend: "mongodb";
      collections: { name: string; document: string; count: number }[];
    }
  | {
      backend: "postgres";
      tables: { table: string; count: number }[];
    }
  | { backend: string; note?: string };

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
  release_url: string;
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

export interface FriendListData {
  self_id: string;
  connection_key: string;
  adapter: string;
  friends: FriendListRow[];
  truncated: boolean;
  limit: number;
  error: string | null;
}
