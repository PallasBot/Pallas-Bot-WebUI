import type { LogEntry, LogEntryLevel } from "@/api/pallasTypes";

const LOG_LEVELS_STORAGE_KEY = "pallas_logs_enabled_levels_v2";
const LOG_LEVELS_DEFAULT: readonly LogEntryLevel[] = ["info", "success", "warn", "error"];

/** 结构化日志与级别筛选 UI 共用的等级列表（与后端 LEVEL_TO_BUCKET 一致） */
export const LOG_ENTRY_LEVELS: readonly LogEntryLevel[] = [
  "debug",
  "info",
  "success",
  "warn",
  "error",
] as const;

const _embeddedShardPrefixRe = /^\[(?<tag>[^\]]+)\]\s+(?<rest>.+)$/;
const _embeddedScopeTagRe = /^\[(?<tag>[^\]]+)\]\s*(?<mod>.*)$/;
const _nonebotBracketBodyRe =
  /^(?<dt>\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+\[(?<lev>[A-Z]+)\]\s+(?<scope>[^|]+?)\s*\|\s*(?<msg>.*)$/;
const _loguruBodyRe =
  /^(?<dt>\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+\|\s+(?<lev>\S+)\s+\|\s+(?<scope>[^:]+):(?<lineno>\d+)\s+-\s+(?<msg>.*)$/;

/** 分片 scope：``worker-N/module`` 或历史 ``[worker-N] module`` */
export function splitLogScope(scope: string): { source: string; module: string } {
  const raw = String(scope ?? "").trim();
  if (!raw) return { source: "", module: "" };
  const embedded = _embeddedScopeTagRe.exec(raw);
  if (embedded?.groups?.tag) {
    return {
      source: String(embedded.groups.tag).trim(),
      module: String(embedded.groups.mod ?? "").trim(),
    };
  }
  const slash = raw.indexOf("/");
  if (slash > 0) {
    const head = raw.slice(0, slash);
    if (head.startsWith("worker-") || head === "hub" || head === "hub-file") {
      return { source: head === "hub-file" ? "hub" : head, module: raw.slice(slash + 1).trim() };
    }
  }
  return { source: "", module: raw };
}

/** 归一成 ``source/module``（无来源时仅 module） */
export function normalizeLogScope(scope: string): string {
  const { source, module } = splitLogScope(scope);
  if (source && module) return `${source}/${module}`;
  if (source) return source;
  return module;
}
/** 运行日志 feed 行首：仅 `HH:mm:ss`，缩短前置标签 */
export function formatLogDisplayTime(raw: string | number): string {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) return "—";
    const d = new Date(raw * 1000);
    if (Number.isNaN(d.getTime())) return String(raw);
    return formatClock(d);
  }
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return formatClock(d);
  return stripToClock(s);
}

/** 错误列表等需跨日对照：`MM-DD HH:mm:ss`（不含年份） */
export function formatLogDisplayDateTime(raw: string | number): string {
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

function formatClock(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${mi}:${sec}`;
}

function formatDateNoYear(d: Date): string {
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${mo}-${day} ${formatClock(d)}`;
}

/** 从已格式化文本抽出时分秒；抽不出则退回去年份文本 */
function stripToClock(text: string): string {
  const bare = stripYearFromLogText(text).trim();
  const m = /(?:^|\s)(\d{2}:\d{2}:\d{2})\b/.exec(bare);
  if (m?.[1]) return m[1];
  return bare;
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

function peelShardPrefixes(raw: string): { sourceTag: string; body: string } {
  let body = String(raw ?? "").replace(/\n$/, "");
  const tags: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const firstNl = body.indexOf("\n");
    const first = firstNl >= 0 ? body.slice(0, firstNl) : body;
    const rest = firstNl >= 0 ? body.slice(firstNl + 1) : "";
    const m = _embeddedShardPrefixRe.exec(first);
    if (!m?.groups?.rest) break;
    tags.push(String(m.groups.tag));
    body = rest ? `${m.groups.rest}\n${rest}` : String(m.groups.rest);
  }
  if (tags.length && body.includes("\n")) {
    const tagSet = new Set(tags);
    body = body
      .split("\n")
      .map((ln, idx) => {
        if (idx === 0) return ln;
        const m = _embeddedShardPrefixRe.exec(ln);
        if (m?.groups?.tag && tagSet.has(String(m.groups.tag))) return String(m.groups.rest);
        return ln;
      })
      .join("\n");
  }
  return { sourceTag: tags.join("/"), body };
}

function isTracebackBody(body: string): boolean {
  const s = body.trimStart();
  if (s.startsWith("Traceback")) return true;
  if (body.startsWith("  File ") || s.startsWith('File "')) return true;
  if (s.startsWith("During handling of the above exception")) return true;
  if (/^raise\s+[\w.]*(?:Error|Exception)\b/.test(s)) return true;
  if (/^[\w.]+(?:Error|Exception)(?:\s*:|$)/.test(s)) return true;
  return false;
}

/** 从原始日志行解析级别（无法识别时视为 info，与后端 parse_nonebot_log_line 默认一致） */
export function parseLogLineLevel(line: string): LogEntryLevel {
  const { body } = peelShardPrefixes(String(line ?? ""));
  const head = body.includes("\n") ? body.slice(0, body.indexOf("\n")) : body;
  const nb = _nonebotBracketBodyRe.exec(head);
  if (nb?.groups?.lev) return normalizeLogEntryLevel(String(nb.groups.lev));
  const lg = _loguruBodyRe.exec(head);
  if (lg?.groups?.lev) return normalizeLogEntryLevel(String(lg.groups.lev));
  if (isTracebackBody(head)) return "error";
  return "info";
}

export function loadLogsEnabledLevels(): Set<LogEntryLevel> {
  if (typeof localStorage === "undefined") return new Set(LOG_LEVELS_DEFAULT);
  try {
    const raw = localStorage.getItem(LOG_LEVELS_STORAGE_KEY);
    if (!raw) return new Set(LOG_LEVELS_DEFAULT);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set(LOG_LEVELS_DEFAULT);
    const valid = parsed.filter(
      (x): x is LogEntryLevel =>
        typeof x === "string" && (LOG_ENTRY_LEVELS as readonly string[]).includes(x),
    );
    return valid.length ? new Set(valid) : new Set(LOG_LEVELS_DEFAULT);
  } catch {
    return new Set(LOG_LEVELS_DEFAULT);
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

function joinSourceAndModule(sourceTag: string, mod: string, fallback: string): string {
  const normalizedMod = normalizeLogScope(mod);
  const { source: modSource, module } = splitLogScope(normalizedMod);
  const tag = (sourceTag || modSource || "").trim();
  if (tag && module) return `${tag}/${module}`;
  if (tag) return tag;
  if (module) return module;
  return fallback;
}

/** 结构化视图：从 [raw] 正文里拆出时间/级别/来源，给消息留足横向空间 */
export function normalizeLogEntryDisplay(row: LogEntry): LogEntry {
  const scope = String(row.scope ?? "").trim();
  const message = String(row.message ?? "");
  let normalized: LogEntry = row;
  if (scope === "raw" || !row.time) {
    const peeled = peelShardPrefixes(message);
    const sourceTag = peeled.sourceTag;
    const body = peeled.body;
    const head = body.includes("\n") ? body.slice(0, body.indexOf("\n")) : body;
    const remainder = body.includes("\n") ? body.slice(body.indexOf("\n") + 1) : "";
    const nb = _nonebotBracketBodyRe.exec(head);
    if (nb?.groups) {
      const msg = remainder ? `${nb.groups.msg ?? ""}\n${remainder}` : String(nb.groups.msg ?? "");
      normalized = {
        ...row,
        time: row.time || String(nb.groups.dt),
        level: normalizeLogEntryLevel(String(nb.groups.lev)),
        scope: joinSourceAndModule(sourceTag, String(nb.groups.scope ?? ""), scope),
        message: msg,
      };
    } else {
      const lg = _loguruBodyRe.exec(head);
      if (lg?.groups) {
        const msg = remainder ? `${lg.groups.msg ?? ""}\n${remainder}` : String(lg.groups.msg ?? "");
        normalized = {
          ...row,
          time: row.time || String(lg.groups.dt),
          level: normalizeLogEntryLevel(String(lg.groups.lev)),
          scope: joinSourceAndModule(sourceTag, String(lg.groups.scope ?? ""), scope),
          message: msg,
        };
      } else if (isTracebackBody(head)) {
        normalized = {
          ...row,
          level: "error",
          scope: sourceTag || scope || "raw",
          message: body,
        };
      } else if (sourceTag) {
        normalized = { ...row, scope: sourceTag, message: body };
      }
    }
  }
  const fixedScope = normalizeLogScope(String(normalized.scope ?? "").trim());
  if (fixedScope && fixedScope !== String(normalized.scope ?? "").trim()) {
    normalized = { ...normalized, scope: fixedScope };
  }
  return promoteErrorLevel(normalized);
}

/** 正文已含 traceback / 异常行时抬升为 error（兼容历史错误解析） */
function promoteErrorLevel(row: LogEntry): LogEntry {
  if (row.level === "error") return row;
  const msg = String(row.message ?? "");
  if (
    msg.includes("Traceback (most recent call last):") ||
    /(?:^|\n)\s*[\w.]+(?:Error|Exception):/.test(msg) ||
    /(?:^|\n)\s*raise\s+[\w.]*(?:Error|Exception)\b/.test(msg)
  ) {
    return { ...row, level: "error" };
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
  return peelShardPrefixes(message).body;
}

/** 分片来源键：worker-N / hub；无标签为空串 */
export function logEntrySourceKey(row: Pick<LogEntry, "scope" | "message">): string {
  const { source } = splitLogScope(String(row.scope ?? ""));
  if (source.startsWith("worker-")) return source;
  if (source === "hub") return "hub";
  const primary = String(row.scope ?? "")
    .trim()
    .split("/")[0] ?? "";
  if (primary.startsWith("worker-")) return primary;
  if (primary === "hub" || primary === "hub-file") return "hub";
  const tag = peelShardPrefixes(String(row.message ?? "")).sourceTag.split("/")[0] ?? "";
  if (tag.startsWith("worker-")) return tag;
  if (tag === "hub" || tag === "hub-file") return "hub";
  return "";
}

/** 与后端 ``_entry_matches_log_source`` 对齐：筛选来源时保留对应条目 */
export function logEntryMatchesSource(
  row: Pick<LogEntry, "scope" | "message">,
  source: string | null | undefined,
): boolean {
  const want = (source || "all").trim() || "all";
  if (want === "all") return true;
  const key = logEntrySourceKey(row);
  if (want === "hub" || want === "hub-file") {
    return key === "" || key === "hub";
  }
  return key === want;
}

function entryAcceptsTracebackContinuation(row: LogEntry): boolean {
  if (row.level === "error") return true;
  const msg = String(row.message ?? "");
  return msg.includes("Traceback") || isTracebackBody(stripShardPrefixBody(msg));
}

function absorbContinuation(prev: LogEntry, cur: LogEntry): void {
  prev.message = prev.message ? `${prev.message}\n${cur.message}` : cur.message;
  if (logEntryLevelRank(cur.level) > logEntryLevelRank(prev.level)) {
    prev.level = cur.level;
  }
}

function isLogHeaderBody(body: string): boolean {
  const s = body.includes("\n") ? body.slice(0, body.indexOf("\n")) : body;
  const head = s.trimStart();
  if (_loguruBodyRe.test(head) || _nonebotBracketBodyRe.test(head)) return true;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(head)) return true;
  return false;
}

/** 是否为多行日志块续行（traceback / pretty-print 树等） */
export function isLogMessageContinuation(message: string): boolean {
  const body = stripShardPrefixBody(message);
  if (!body) return true;
  if (isLogHeaderBody(body)) return false;
  if (isTracebackBody(body)) return true;
  if (body.startsWith("  File ") || body.startsWith("    ") || body.startsWith("\t")) return true;
  if (/^[\|└├╭╰─]/.test(body.trimStart())) return true;
  if (/^\|\s/.test(body) || body.includes(" L ") || body.startsWith("L ")) return true;
  if (body.startsWith("...")) return true;
  if (/^\s+\S/.test(body)) return true;
  return false;
}

/** 合并结构化视图中的续行，与后端 merge_log_line_continuations 对齐（按 worker 隔离） */
export function mergeLogEntryContinuations(rows: LogEntry[]): LogEntry[] {
  const out: LogEntry[] = [];
  const lastIdxBySource = new Map<string, number>();
  for (const row of rows) {
    const cur = { ...row };
    const key = logEntrySourceKey(cur);
    if (!isLogMessageContinuation(cur.message)) {
      out.push(cur);
      if (key) lastIdxBySource.set(key, out.length - 1);
      continue;
    }
    let merged = false;
    if (out.length) {
      const prev = out[out.length - 1];
      const prevKey = logEntrySourceKey(prev);
      if (key && prevKey === key) {
        absorbContinuation(prev, cur);
        merged = true;
      } else if (!key && !prevKey) {
        absorbContinuation(prev, cur);
        merged = true;
      } else if (key && isTracebackBody(stripShardPrefixBody(cur.message))) {
        const idx = lastIdxBySource.get(key);
        if (idx != null && entryAcceptsTracebackContinuation(out[idx])) {
          absorbContinuation(out[idx], cur);
          merged = true;
        }
      }
    }
    if (!merged) {
      out.push(cur);
      if (key) lastIdxBySource.set(key, out.length - 1);
    }
  }
  return out;
}
