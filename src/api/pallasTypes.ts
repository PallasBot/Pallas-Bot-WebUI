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
  console: { static_root?: string; http_base?: string };
  runtime?: {
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

export interface MessageStatsData {
  total_sent: number;
  total_received: number;
  bots: Array<{
    self_id: string;
    connection_key: string;
    sent: number;
    received: number;
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

export interface PluginConfigData {
  plugin: string;
  module: string;
  fields: PluginConfigField[];
}

export interface BotRow {
  connection_key: string;
  self_id: string;
  adapter: string;
}

export interface LogsData {
  lines: string[];
  max: number;
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
  has_token: boolean;
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
  tag: string;
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
