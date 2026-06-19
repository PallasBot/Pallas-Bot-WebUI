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
  healthPaths: ["/health", "/api/health"] as string[],
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

/** 统计 / 历史页榜单的展示上限。 */
export const AI_STATS_LIMITS = {
  topRows: 8,
  topRoutes: 6,
  historySessions: 20,
  historyTurns: 40,
} as const;

/** 任务统计落盘文件名（仅作为提示展示的兜底值）。 */
export const AI_STATS_STORE_FILE = "llm_daily_stats.json";

/** AI 助手在会话明细中的展示名（牛牛人格的默认昵称）。 */
export const AI_ASSISTANT_NAME = "牛牛";
