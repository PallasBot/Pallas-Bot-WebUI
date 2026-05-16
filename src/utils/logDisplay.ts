import type { LogEntryLevel } from "@/api/pallasTypes";

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
