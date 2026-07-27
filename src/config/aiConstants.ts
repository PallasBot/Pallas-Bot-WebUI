/**
 * AI 相关页面的集中默认值与常量。
 *
 * 此前这些值散落在各 section / composable 内（连接默认地址出现 3 次、
 * 国家码 86 出现 3 次、日志行数 200、各种 slice 上限等）。集中到这里，
 * 保证前后端默认一致、改一处即可。
 */

/** 扩展连接（ai_extension.json）默认值，与 BFF `_normalize_ai_extension_config` 对齐。 */
export const AI_EXTENSION_DEFAULTS = {
  baseUrl: "http://127.0.0.1:9099",
  hostPort: "127.0.0.1:9099",
  apiPrefix: "/api",
  /** AI 规范探活路径为 /health；旧配置可能仍含 /api/health（AI 侧已做别名兼容）。 */
  healthPaths: ["/health"] as string[],
  timeoutSec: 8,
  timeoutMin: 2,
  timeoutMax: 30,
} as const;

/** 网易云登录默认值。 */
export const AI_NCM_DEFAULTS = {
  countryCode: 86,
  phoneMinLength: 5,
  captchaMinLength: 2,
} as const;

/** 扩展日志默认拉取行数与可选档位。 */
export const AI_LOG_DEFAULTS = {
  lines: 200,
  lineOptions: [100, 200, 500, 1000] as number[],
} as const;

/** AI 扩展日志 SSE kind（与 BFF `/ai-extension/logs` 对齐；LLM default 队列已下线）。 */
export type AiExtensionLogKind = "uvicorn" | "celery-media";

export const AI_EXTENSION_LOG_KINDS: {
  id: AiExtensionLogKind;
  label: string;
  shortLabel: string;
}[] = [
  { id: "uvicorn", label: "Web 服务（uvicorn / api）运行日志", shortLabel: "Web 服务" },
  { id: "celery-media", label: "媒体任务队列（Celery · media）运行日志", shortLabel: "媒体队列" },
];

/** Docker 全栈 compose 下 Bot 容器内 AI 日志挂载点（只读）。 */
export const AI_EXTENSION_DOCKER_LOG_MOUNT = "/ai-logs";

/** Runtime layout 徽章文案（后端返回英文键）。 */
export const AI_RUNTIME_LAYOUT_LABELS: Record<string, string> = {
  sibling: "同级源码",
  managed: "托管安装",
  env: "环境变量路径",
  docker: "Docker",
  remote: "远端服务",
  missing: "未检测到",
};

export function aiRuntimeLayoutLabel(layout: string | null | undefined): string {
  const key = (layout || "").trim();
  if (!key) return "—";
  return AI_RUNTIME_LAYOUT_LABELS[key] || key;
}

/** 统计 / 历史页榜单的展示上限。 */
export const AI_STATS_LIMITS = {
  topRows: 8,
  topRoutes: 6,
  historySessions: 20,
  historyTurns: 40,
} as const;

/**
 * Token 用量文案（观测统计 / 趋势图例 / Provider 单价字段对齐）。
 */
export const AI_TOKEN_METRIC_LABELS = {
  prompt: "输入",
  completion: "输出",
  cacheRead: "缓存读",
  cacheWrite: "缓存写",
  /** 输入中未命中前缀缓存的部分（与缓存读对照） */
  uncachedPrompt: "非缓存输入",
  total: "Token 总量",
  cacheHitRate: "缓存命中率",
  cacheHitShare: "缓存读占比",
  /** 趋势图标题里的输入 / 输出并称 */
  ioPair: "输入 / 输出",
} as const;

/** 任务统计落盘文件名（仅作为提示展示的兜底值）。 */
export const AI_STATS_STORE_FILE = "llm_daily_stats.json";

/** AI 助手在会话明细中的展示名（牛牛人格的默认昵称）。 */
export const AI_ASSISTANT_NAME = "牛牛";
