/** 解析 log_error_log 条目的来源与插件名（分片：worker-N/plugin） */
export function parseLogErrorPlugin(plugin: string): { source: string; module: string } {
  const raw = (plugin || "").trim();
  const slash = raw.indexOf("/");
  if (slash > 0 && raw.startsWith("worker-")) {
    return {
      source: raw.slice(0, slash),
      module: raw.slice(slash + 1) || "log",
    };
  }
  if (/^worker-\d+$/.test(raw)) {
    return { source: raw, module: "log" };
  }
  return { source: "hub", module: raw || "log" };
}

export function tracebackLineCount(tb: string): number {
  if (!tb.trim()) return 0;
  return tb.split("\n").filter((ln) => ln.trim()).length;
}

export function isTracebackTruncated(tb: string): boolean {
  return /…\(truncated\)\s*$/.test((tb ?? "").trimEnd());
}

const EXC_TYPE_LINE_RE = /^([A-Z][a-zA-Z0-9_]*(?:Error|Exception))\s*:/;

/** 从堆栈末行解析标准异常名（兼容历史误写入 exc_type 的条目） */
export function excTypeFromTraceback(tb: string): string | null {
  for (const line of (tb ?? "").split("\n").reverse()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Traceback")) continue;
    if (trimmed.includes("└") || trimmed.includes("│")) continue;
    const m = trimmed.match(EXC_TYPE_LINE_RE);
    if (m) return m[1];
  }
  return null;
}

/** 展示用异常类型：仅接受 *Error/*Exception，否则回退 LogError */
export function formatLogErrorExcType(excType: string, traceback?: string): string {
  const fromTb = traceback ? excTypeFromTraceback(traceback) : null;
  if (fromTb) return fromTb;
  const t = (excType || "").trim();
  if (/^[A-Z][a-zA-Z0-9_]*(?:Error|Exception)$/.test(t)) return t;
  return "LogError";
}

export type LogErrorCopyFields = {
  at: number;
  exc_type: string;
  plugin: string;
  message: string;
  traceback?: string;
  meta?: ReturnType<typeof parseLogErrorPlugin>;
};

export function formatLogErrorSummary(it: LogErrorCopyFields, timeLabel: string): string {
  const meta = it.meta ?? parseLogErrorPlugin(it.plugin);
  const excLabel = formatLogErrorExcType(it.exc_type, it.traceback);
  const lines = [
    `[${timeLabel}] ${excLabel} @ ${meta.source}${meta.module && meta.module !== "log" ? `/${meta.module}` : ""}`,
    it.message?.trim() || "（无摘要）",
  ];
  return lines.join("\n");
}

export function formatLogErrorFull(it: LogErrorCopyFields, timeLabel: string): string {
  const meta = it.meta ?? parseLogErrorPlugin(it.plugin);
  const excLabel = formatLogErrorExcType(it.exc_type, it.traceback);
  const head = `[${timeLabel}] ${excLabel} @ ${meta.source}${meta.module && meta.module !== "log" ? `/${meta.module}` : ""}`;
  const tb = (it.traceback ?? "").trim();
  if (tb) return `${head}\n\n${tb}`;
  const msg = it.message?.trim() || "（无摘要）";
  return `${head}\n${msg}`;
}
