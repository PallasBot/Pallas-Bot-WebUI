/** 与 Pallas 扩展 API 的 { ok, data } 约定一致 */

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
  };
}

export interface PluginRow {
  name: string;
  module: string;
  metadata: {
    name?: string;
    description?: string;
    usage?: string;
    type?: string;
    extra?: Record<string, unknown>;
  } | null;
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

/** GET /db/overview */
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

/** 与 Pallas 当前 DB 中 Bot 配置一致 */
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

/** 与 pallas_protocol 账号列表 _compose_account_state 一致（字段可能随版本增加） */
export interface NapcatAccountRow {
  id?: string;
  qq?: string;
  display_name?: string;
  webui_port?: number | string;
  webui_token?: string;
  /** NapCat 进程内嵌 Web（主仓字段名） */
  native_webui_url?: string;
  /** 旧 napcat_manager 字段名，兼容 */
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

/** GET /instances */
export interface InstancesData {
  nonebot_bots: BotRow[];
  db_bot_configs: BotConfigPublic[];
  pallas_protocol: NapcatManagerSnapshot | null;
  /** 与 pallas_protocol 相同，兼容旧字段名 */
  napcat?: NapcatManagerSnapshot | null;
}

/** GET /friend-requests */
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

/** GET /friend-list */
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


