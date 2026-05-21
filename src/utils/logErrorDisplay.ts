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
  const lines = [
    `[${timeLabel}] ${it.exc_type || "LogError"} @ ${meta.source}${meta.module && meta.module !== "log" ? `/${meta.module}` : ""}`,
    it.message?.trim() || "（无摘要）",
  ];
  return lines.join("\n");
}

export function formatLogErrorFull(it: LogErrorCopyFields, timeLabel: string): string {
  const head = formatLogErrorSummary(it, timeLabel);
  const tb = (it.traceback ?? "").trim();
  if (!tb) return head;
  return `${head}\n\n--- traceback ---\n${tb}`;
}
