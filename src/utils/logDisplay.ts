import type { LogEntry, LogEntryLevel } from "@/api/pallasTypes";

/** 结构化日志与级别筛选 UI 共用的等级列表（与后端 LEVEL_TO_BUCKET 一致） */
export const LOG_ENTRY_LEVELS: readonly LogEntryLevel[] = [
  "debug",
  "info",
  "success",
  "warn",
  "error",
] as const;

const LOG_LEVELS_STORAGE_KEY = "pallas_logs_enabled_levels_v1";

const _embeddedShardPrefixRe = /^\[(?<tag>[^\]]+)\]\s+(?<rest>.+)$/;
const _nonebotBracketBodyRe =
  /^(?<dt>\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+\[(?<lev>[A-Z]+)\]\s+(?<scope>[^|]+?)\s*\|\s*(?<msg>.*)$/;
const _loguruBodyRe =
  /^(?<dt>\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+\|\s+(?<lev>\S+)\s+\|\s+(?<scope>[^:]+):(?<lineno>\d+)\s+-\s+(?<msg>.*)$/;

/** 与 NoneBot loguru 行首一致：`MM-DD HH:mm:ss`（不含年份） */
export function formatLogDisplayTime(raw: string | number): string {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) return "—";
    const d = new Date(raw * 1000);
    if (Number.isNaN(d.getTime())) return String(raw);
    return formatDateNoYear(d);
  }
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return formatDateNoYear(d);
  return stripYearFromLogText(s);
}

function formatDateNoYear(d: Date): string {
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `${mo}-${day} ${h}:${mi}:${sec}`;
}

/** 原始日志行 / 已格式化文本：去掉常见四位数年份前缀 */
export function stripYearFromLogText(text: string): string {
  return text
    .replace(/^(\d{4})-(\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})/, "$2")
    .replace(/^(\d{4})\/(\d{2}\/\d{2}[ T]\d{2}:\d{2}:\d{2})/, "$2")
    .replace(/\b(20\d{2})-(\d{2})-(\d{2})([ T]\d{2}:\d{2}:\d{2})/g, "$2-$3$4");
}

export function stripYearFromLogLine(line: string): string {
  const raw = line ?? "";
  if (/^\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(raw)) return raw;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})(\s*\|\s*.*)$/);
  if (m) return stripYearFromLogText(m[1]) + (m[2] ?? "");
  return stripYearFromLogText(raw);
}

export function logEntryLevelClass(lv: LogEntryLevel): string {
  const base = "log-line__lv";
  if (lv === "debug") return `${base} log-line__lv--debug`;
  if (lv === "warn") return `${base} log-line__lv--warn`;
  if (lv === "error") return `${base} log-line__lv--error`;
  if (lv === "success") return `${base} log-line__lv--success`;
  if (lv === "info") return `${base} log-line__lv--info`;
  return base;
}

export function normalizeLogEntryLevel(raw: string): LogEntryLevel {
  const u = raw.trim().toUpperCase();
  if (u === "TRACE" || u === "DEBUG") return "debug";
  if (u === "WARNING" || u === "WARN") return "warn";
  if (u === "ERROR" || u === "CRITICAL") return "error";
  if (u === "SUCCESS") return "success";
  return "info";
}

/** 从原始日志行解析级别（无法识别时视为 info，与后端 parse_nonebot_log_line 默认一致） */
export function parseLogLineLevel(line: string): LogEntryLevel {
  let body = String(line ?? "").trim();
  for (let i = 0; i < 3; i += 1) {
    const m = _embeddedShardPrefixRe.exec(body);
    if (!m?.groups?.rest) break;
    body = String(m.groups.rest).trim();
  }
  const nb = _nonebotBracketBodyRe.exec(body);
  if (nb?.groups?.lev) return normalizeLogEntryLevel(String(nb.groups.lev));
  const lg = _loguruBodyRe.exec(body);
  if (lg?.groups?.lev) return normalizeLogEntryLevel(String(lg.groups.lev));
  if (body.startsWith("Traceback") || body.startsWith("  File ")) return "error";
  return "info";
}

export function loadLogsEnabledLevels(): Set<LogEntryLevel> {
  if (typeof localStorage === "undefined") return new Set(LOG_ENTRY_LEVELS);
  try {
    const raw = localStorage.getItem(LOG_LEVELS_STORAGE_KEY);
    if (!raw) return new Set(LOG_ENTRY_LEVELS);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set(LOG_ENTRY_LEVELS);
    const valid = parsed.filter(
      (x): x is LogEntryLevel =>
        typeof x === "string" && (LOG_ENTRY_LEVELS as readonly string[]).includes(x),
    );
    return valid.length ? new Set(valid) : new Set(LOG_ENTRY_LEVELS);
  } catch {
    return new Set(LOG_ENTRY_LEVELS);
  }
}

export function persistLogsEnabledLevels(levels: ReadonlySet<LogEntryLevel>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      LOG_LEVELS_STORAGE_KEY,
      JSON.stringify([...levels].filter((x) => LOG_ENTRY_LEVELS.includes(x))),
    );
  } catch {
    /* ignore */
  }
}

/** 结构化视图：从 [raw] 正文里拆出时间/级别/来源，给消息留足横向空间 */
export function normalizeLogEntryDisplay(row: LogEntry): LogEntry {
  const scope = String(row.scope ?? "").trim();
  const message = String(row.message ?? "");
  if (scope !== "raw" && row.time) {
    return row;
  }
  let body = message.trim();
  let sourceTag = "";
  for (let i = 0; i < 3; i += 1) {
    const m = _embeddedShardPrefixRe.exec(body);
    if (!m?.groups?.rest) break;
    sourceTag = sourceTag ? `${sourceTag}/${m.groups.tag}` : String(m.groups.tag);
    body = String(m.groups.rest).trim();
  }
  const nb = _nonebotBracketBodyRe.exec(body);
  if (nb?.groups) {
    const mod = String(nb.groups.scope ?? "").trim();
    return {
      ...row,
      time: row.time || String(nb.groups.dt),
      level: normalizeLogEntryLevel(String(nb.groups.lev)),
      scope: sourceTag ? (mod ? `${sourceTag}/${mod}` : sourceTag) : mod || scope,
      message: String(nb.groups.msg ?? ""),
    };
  }
  const lg = _loguruBodyRe.exec(body);
  if (lg?.groups) {
    const mod = String(lg.groups.scope ?? "").trim();
    return {
      ...row,
      time: row.time || String(lg.groups.dt),
      level: normalizeLogEntryLevel(String(lg.groups.lev)),
      scope: sourceTag ? (mod ? `${sourceTag}/${mod}` : sourceTag) : mod || scope,
      message: String(lg.groups.msg ?? ""),
    };
  }
  if (sourceTag) {
    return { ...row, scope: sourceTag, message: body };
  }
  return row;
}

function logEntryLevelRank(lv: LogEntryLevel): number {
  if (lv === "debug") return 0;
  if (lv === "info") return 1;
  if (lv === "success") return 2;
  if (lv === "warn") return 3;
  if (lv === "error") return 4;
  return 1;
}

function stripShardPrefixBody(message: string): string {
  let body = String(message ?? "").trim();
  for (let i = 0; i < 3; i += 1) {
    const m = _embeddedShardPrefixRe.exec(body);
    if (!m?.groups?.rest) break;
    body = String(m.groups.rest).trim();
  }
  return body;
}

function isLogHeaderBody(body: string): boolean {
  const s = body.trim();
  if (_loguruBodyRe.test(s) || _nonebotBracketBodyRe.test(s)) return true;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) return true;
  return false;
}

/** 是否为多行日志块续行（traceback / pretty-print 树等） */
export function isLogMessageContinuation(message: string): boolean {
  const body = stripShardPrefixBody(message);
  if (!body) return true;
  if (isLogHeaderBody(body)) return false;
  if (body.startsWith("Traceback")) return true;
  if (body.startsWith("  File ") || body.startsWith("    ") || body.startsWith("\t")) return true;
  if (/^[A-Z][a-zA-Z0-9_]*(?:Error|Exception):/.test(body)) return true;
  if (body.startsWith("During handling of the above exception")) return true;
  if (/^[\|└├╭╰─]/.test(body)) return true;
  if (/^\|\s/.test(body) || body.includes(" L ") || body.startsWith("L ")) return true;
  if (body.startsWith("...")) return true;
  if (/^\s+\S/.test(body)) return true;
  return false;
}

/** 合并结构化视图中的续行，与后端 merge_log_line_continuations 对齐 */
export function mergeLogEntryContinuations(rows: LogEntry[]): LogEntry[] {
  const out: LogEntry[] = [];
  for (const row of rows) {
    const cur = { ...row };
    const prev = out[out.length - 1];
    if (prev && isLogMessageContinuation(cur.message)) {
      prev.message = prev.message ? `${prev.message}\n${cur.message}` : cur.message;
      if (logEntryLevelRank(cur.level) > logEntryLevelRank(prev.level)) {
        prev.level = cur.level;
      }
      continue;
    }
    out.push(cur);
  }
  return out;
}
