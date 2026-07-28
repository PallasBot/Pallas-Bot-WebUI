import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Search, Eye, LayoutList, FileText, FolderOpen, Globe, Monitor, Radio, Hash, Download } from "lucide-react";
import { fetchLogs, openLogsEventSource } from "@/api/fullConsole";
import type { LogEntry, LogEntryLevel, LogScope, LogsData } from "@/api/pallasTypes";
import PageMasthead from "@/components/PageMasthead";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import ChromeTools, {
  CHROME_SEARCH_INPUT,
  CHROME_SELECT_TRIGGER,
} from "@/components/ChromeTools";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton";
import { cn } from "@/lib/utils";
import LogVirtualFeed, { type LogVirtualFeedHandle } from "@/components/LogVirtualFeed";
import PageFill from "@/components/layout/PageFill";
import PagePinned from "@/components/layout/PagePinned";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LOG_ENTRY_LEVELS,
  loadLogsEnabledLevels,
  mergeLogEntryContinuations,
  normalizeLogEntryDisplay,
  parseLogLineLevel,
  persistLogsEnabledLevels,
  stripYearFromLogLine,
} from "@/utils/logDisplay";
import {
  loadLogsLastEventId,
  persistLogsLastEventId,
} from "@/utils/logStreamResume";
import { pushConsoleToast } from "@/utils/consoleToast";

type LogsSnapshot = {
  scope: LogScope;
  logSource: string;
  n: number;
  payload: LogsData;
};

let logsSnapshotCache: LogsSnapshot | null = null;
const LOG_POLL_MS = 8000;

function onNInput(raw: string, setN: (n: number) => void) {
  const next = Number(raw);
  if (!Number.isFinite(next)) {
    setN(20);
    return;
  }
  setN(Math.min(2000, Math.max(20, Math.trunc(next))));
}

function formatLogEntryLine(e: LogEntry): string {
  return `[${e.time || ""}] [${e.level || "info"}] [${e.scope || ""}] ${e.message || ""}`;
}

function logsExportFilename(scope: string, source: string): string {
  const now = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    + `-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `pallas-logs_${scope || "all"}_${source || "all"}_${stamp}.txt`;
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LogsPage() {
  const [err, setErr] = useState("");
  const [pageReady, setPageReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<LogScope>("all");
  const [logSource, setLogSource] = useState("all");
  const [logSources, setLogSources] = useState<string[]>([]);
  const [n, setN] = useState(200);
  const [payload, setPayload] = useState<LogsData | null>(null);
  const [view, setView] = useState<"feed" | "raw">("feed");
  const [q, setQ] = useState("");
  const [enabledLevels, setEnabledLevels] = useState<Set<LogEntryLevel>>(() => loadLogsEnabledLevels());
  const [liveEntries, setLiveEntries] = useState<LogEntry[]>([]);
  const [streamReconnectCount, setStreamReconnectCount] = useState(0);
  const [streamReconnecting, setStreamReconnecting] = useState(false);
  const [lastStreamEventId, setLastStreamEventId] = useState(0);
  const [followLogTail, setFollowLogTail] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [streamLive, setStreamLive] = useState(false);
  const [liveTick, setLiveTick] = useState(0);

  const logPollTimerRef = useRef<number | null>(null);
  const logEsRef = useRef<EventSource | null>(null);
  const streamReconnectTimerRef = useRef<number | null>(null);
  const rawScrollElRef = useRef<HTMLPreElement | null>(null);
  const logFeedRef = useRef<LogVirtualFeedHandle | null>(null);
  const suppressRawFollowUpdateRef = useRef(0);
  const logScrollBottomRafRef = useRef(0);
  const logScrollBottomForceRef = useRef(false);
  const logScrollBottomRetryTimersRef = useRef<number[]>([]);
  const viewRef = useRef(view);
  const followLogTailRef = useRef(followLogTail);
  viewRef.current = view;
  followLogTailRef.current = followLogTail;

  const bumpLiveTick = useCallback(() => setLiveTick((v) => v + 1), []);

  const isRawNearBottom = useCallback((el: HTMLElement) => {
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    return gap <= 80;
  }, []);

  const cancelScrollActiveLogRetries = useCallback(() => {
    for (const id of logScrollBottomRetryTimersRef.current) window.clearTimeout(id);
    logScrollBottomRetryTimersRef.current = [];
  }, []);

  const scrollActiveLogToBottom = useCallback(
    async (force = false) => {
      await Promise.resolve();
      if (viewRef.current === "feed") {
        if (force || followLogTailRef.current) {
          // 强制进页滚底时先锁跟尾，避免 scrollTop=0 的残留 scroll 事件把 follow 打回 false
          if (force) setFollowLogTail(true);
          await logFeedRef.current?.scrollToBottom(true);
        }
        return;
      }
      const el = rawScrollElRef.current;
      if (!el || (!force && !followLogTailRef.current)) return;
      if (force) setFollowLogTail(true);
      suppressRawFollowUpdateRef.current += 1;
      const apply = () => {
        el.scrollTop = el.scrollHeight;
      };
      apply();
      window.requestAnimationFrame(() => {
        apply();
        window.requestAnimationFrame(() => {
          apply();
          suppressRawFollowUpdateRef.current = Math.max(0, suppressRawFollowUpdateRef.current - 1);
          setFollowLogTail(isRawNearBottom(el));
        });
      });
    },
    [isRawNearBottom],
  );

  const scheduleScrollActiveLogToBottom = useCallback(
    (force = false) => {
      if (force) logScrollBottomForceRef.current = true;
      if (logScrollBottomRafRef.current) window.cancelAnimationFrame(logScrollBottomRafRef.current);
      logScrollBottomRafRef.current = window.requestAnimationFrame(() => {
        logScrollBottomRafRef.current = 0;
        const useForce = logScrollBottomForceRef.current;
        logScrollBottomForceRef.current = false;
        void scrollActiveLogToBottom(useForce);
      });
    },
    [scrollActiveLogToBottom],
  );

  /** 进页/激活：布局未完成时多拍几次强制滚底 */
  const scheduleEnterLogScroll = useCallback(() => {
    setFollowLogTail(true);
    scheduleScrollActiveLogToBottom(true);
    cancelScrollActiveLogRetries();
    for (const ms of [50, 120, 320]) {
      logScrollBottomRetryTimersRef.current.push(
        window.setTimeout(() => {
          setFollowLogTail(true);
          scheduleScrollActiveLogToBottom(true);
        }, ms),
      );
    }
  }, [cancelScrollActiveLogRetries, scheduleScrollActiveLogToBottom]);

  const pushLiveEntry = useCallback(
    (raw: LogEntry) => {
      const row = normalizeLogEntryDisplay({
        ...raw,
        id: raw.id ?? Date.now() + Math.floor(Math.random() * 1000),
      });
      setLiveEntries((buf) => {
        const next = [...buf];
        const key = `${row.scope}|${row.time}`;
        if (row.message.includes("\n") || row.message.startsWith("  File ")) {
          const prev = next[next.length - 1];
          if (prev && `${prev.scope}|${prev.time}` === key) {
            prev.message = prev.message ? `${prev.message}\n${row.message}` : row.message;
            return next.length > 1200 ? next.slice(-1200) : next;
          }
        }
        next.push(row);
        return next.length > 1200 ? next.slice(-1200) : next;
      });
      bumpLiveTick();
    },
    [bumpLiveTick],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean; bypassCache?: boolean }) => {
      const silent = Boolean(opts?.silent);
      if (!silent) setLoading(true);
      setErr("");
      try {
        const src = logSource === "all" ? undefined : logSource;
        const data = await fetchLogs(n, scope, src, { bypassCache: opts?.bypassCache === true });
        setPayload(data);
        if (data.log_sources?.length) setLogSources(data.log_sources);
        logsSnapshotCache = { scope, logSource, n, payload: data };
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!silent) setLoading(false);
        setPageReady(true);
        if (!silent) {
          setFollowLogTail(true);
          scheduleEnterLogScroll();
        }
      }
    },
    [logSource, n, scheduleEnterLogScroll, scope],
  );

  const stopLogPolling = useCallback(() => {
    if (logPollTimerRef.current == null) return;
    window.clearInterval(logPollTimerRef.current);
    logPollTimerRef.current = null;
  }, []);

  const startLogPolling = useCallback(() => {
    if (logPollTimerRef.current != null) return;
    logPollTimerRef.current = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void load({ silent: true });
    }, LOG_POLL_MS);
  }, [load]);

  const stopLogStreamConnection = useCallback(() => {
    logEsRef.current?.close();
    logEsRef.current = null;
    if (streamReconnectTimerRef.current != null) {
      window.clearTimeout(streamReconnectTimerRef.current);
      streamReconnectTimerRef.current = null;
    }
  }, []);

  const closeLogStream = useCallback(() => {
    stopLogStreamConnection();
    setStreamLive(false);
    setLiveEntries([]);
    bumpLiveTick();
  }, [bumpLiveTick, stopLogStreamConnection]);

  const startLogStream = useCallback(() => {
    stopLogStreamConnection();
    setStreamLive(false);
    setStreamReconnecting(false);
    try {
      const resumeId = lastStreamEventId > 0 ? lastStreamEventId : undefined;
      const es = openLogsEventSource(scope, logSource, resumeId);
      logEsRef.current = es;
      es.onopen = () => {
        setStreamLive(true);
        setStreamReconnecting(false);
      };
      es.onmessage = (ev) => {
        if (!ev.data) return;
        try {
          const row = JSON.parse(ev.data) as LogEntry & { type?: string };
          if (row?.type === "ready") return;
          if (row.message != null) {
            if (typeof row.id === "number" && row.id > 0) {
              setLastStreamEventId(row.id);
              persistLogsLastEventId(scope, logSource, row.id);
            } else if (ev.lastEventId) {
              const parsed = Number(ev.lastEventId);
              if (Number.isFinite(parsed) && parsed > 0) {
                setLastStreamEventId(parsed);
                persistLogsLastEventId(scope, logSource, parsed);
              }
            }
            pushLiveEntry(row);
          }
        } catch {
          /* ignore malformed */
        }
      };
      es.onerror = () => {
        setStreamLive(false);
        stopLogStreamConnection();
        if (streamReconnectTimerRef.current != null) return;
        setStreamReconnecting(true);
        streamReconnectTimerRef.current = window.setTimeout(() => {
          streamReconnectTimerRef.current = null;
          setStreamReconnectCount((v) => v + 1);
        }, 3000);
      };
    } catch {
      stopLogStreamConnection();
    }
  }, [lastStreamEventId, logSource, pushLiveEntry, scope, stopLogStreamConnection]);

  const bootLogsPage = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    await load({ silent: pageReady });
    // silent 刷新不会在 load.finally 里滚底；数据落地后再强制一次
    scheduleEnterLogScroll();
    startLogPolling();
    startLogStream();
  }, [load, pageReady, scheduleEnterLogScroll, startLogPolling, startLogStream]);

  useEffect(() => {
    if (logsSnapshotCache) {
      setScope(logsSnapshotCache.scope);
      setLogSource(logsSnapshotCache.logSource);
      setN(logsSnapshotCache.n);
      setPayload(logsSnapshotCache.payload);
      if (logsSnapshotCache.payload.log_sources?.length) {
        setLogSources(logsSnapshotCache.payload.log_sources);
      }
      setPageReady(true);
    }
    // 进页：先锁跟尾并滚底，再拉历史
    scheduleEnterLogScroll();
    void bootLogsPage();
    return () => {
      cancelScrollActiveLogRetries();
      if (logScrollBottomRafRef.current) {
        window.cancelAnimationFrame(logScrollBottomRafRef.current);
        logScrollBottomRafRef.current = 0;
      }
      logScrollBottomForceRef.current = false;
      stopLogPolling();
      closeLogStream();
    };
  }, [bootLogsPage, cancelScrollActiveLogRetries, closeLogStream, scheduleEnterLogScroll, stopLogPolling]);

  useEffect(() => {
    void load();
  }, [scope, n, logSource, load]);

  useEffect(() => {
    setLastStreamEventId(loadLogsLastEventId(scope, logSource));
  }, [scope, logSource]);

  useEffect(() => {
    startLogStream();
  }, [scope, logSource, streamReconnectCount, startLogStream]);

  const baseEntries = payload?.entries ?? [];
  const entries = useMemo(() => {
    void liveTick;
    if (!liveEntries.length) return baseEntries;
    const seen = new Set(baseEntries.map((e) => `${e.time}|${e.scope}|${e.message}`));
    const extra = liveEntries.filter((e) => !seen.has(`${e.time}|${e.scope}|${e.message}`));
    return [...baseEntries, ...extra];
  }, [baseEntries, liveEntries, liveTick]);

  const lines = payload?.lines ?? [];
  const displayLines = useMemo(() => lines.map(stripYearFromLogLine), [lines]);

  const sourceOptions = useMemo(() => {
    const opts = logSources.length ? logSources : ["hub"];
    if (!opts.includes("all")) return ["all", ...opts];
    return ["all", ...opts.filter((s) => s !== "all")];
  }, [logSources]);

  const displayEntries = useMemo(
    () => mergeLogEntryContinuations(entries.map((e) => normalizeLogEntryDisplay(e))),
    [entries],
  );

  const levelFilteredEntries = useMemo(
    () => displayEntries.filter((e) => enabledLevels.has(e.level)),
    [displayEntries, enabledLevels],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = levelFilteredEntries;
    if (!needle) return base;
    return base.filter(
      (e) =>
        e.message.toLowerCase().includes(needle)
        || e.scope.toLowerCase().includes(needle)
        || e.level.toLowerCase().includes(needle)
        || e.time.toLowerCase().includes(needle),
    );
  }, [levelFilteredEntries, q]);

  const filteredRawLines = useMemo(() => {
    let rows = displayLines;
    if (enabledLevels.size < LOG_ENTRY_LEVELS.length) {
      rows = rows.filter((line) => enabledLevels.has(parseLogLineLevel(line)));
    }
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((line) => line.toLowerCase().includes(needle));
  }, [displayLines, enabledLevels, q]);

  const historyEntryCount = baseEntries.length;
  const liveExtraCount = useMemo(() => {
    void liveTick;
    if (!liveEntries.length) return 0;
    const seen = new Set(baseEntries.map((e) => `${e.time}|${e.scope}|${e.message}`));
    return liveEntries.filter((e) => !seen.has(`${e.time}|${e.scope}|${e.message}`)).length;
  }, [baseEntries, liveEntries, liveTick]);

  const visibleCount = view === "feed" ? filtered.length : filteredRawLines.length;

  function exportCurrentView() {
    const text =
      view === "feed"
        ? filtered.map(formatLogEntryLine).join("\n")
        : filteredRawLines.join("\n");
    if (!text.trim()) {
      pushConsoleToast("当前视图无可导出日志", "warn");
      return;
    }
    const filename = logsExportFilename(scope, logSource);
    downloadTextFile(filename, `${text}\n`);
    pushConsoleToast(`已导出 ${view === "feed" ? filtered.length : filteredRawLines.length} 行`, "ok");
  }

  useEffect(() => {
    scheduleScrollActiveLogToBottom();
  }, [view, filtered.length, filteredRawLines.length, payload?.entries?.length, scheduleScrollActiveLogToBottom]);

  useEffect(() => {
    scheduleScrollActiveLogToBottom(followLogTail);
  }, [liveTick, followLogTail, scheduleScrollActiveLogToBottom]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (q.trim()) count += 1;
    if (scope !== "all") count += 1;
    if (logSource !== "all") count += 1;
    if (n !== 200) count += 1;
    if (enabledLevels.size < LOG_ENTRY_LEVELS.length) count += 1;
    return count;
  }, [enabledLevels.size, logSource, n, q, scope]);

  const streamBadgeLabel = streamLive ? "实时" : streamReconnecting ? "重连中" : "连接中";
  const streamBadgeVariant = streamLive
    ? "success"
    : streamReconnecting
      ? "warn"
      : "secondary";

  const levelCounts = useMemo(() => {
    void liveTick;
    const counts: Record<LogEntryLevel, number> = {
      debug: 0,
      info: 0,
      success: 0,
      warn: 0,
      error: 0,
    };
    for (const entry of displayEntries) counts[entry.level] += 1;
    return counts;
  }, [displayEntries, liveTick]);

  function toggleLogLevel(lv: LogEntryLevel) {
    setEnabledLevels((prev) => {
      const next = new Set(prev);
      if (next.has(lv)) next.delete(lv);
      else next.add(lv);
      persistLogsEnabledLevels(next);
      return next;
    });
  }

  function onRawScroll(ev: React.UIEvent<HTMLPreElement>) {
    if (suppressRawFollowUpdateRef.current > 0) return;
    const el = ev.currentTarget;
    setFollowLogTail(isRawNearBottom(el));
  }

  if (!pageReady) {
    return (
      <PageFill className="logs-page">
        <ConsolePageSkeleton panels={2} />
      </PageFill>
    );
  }

  return (
    <PageFill className="logs-page">
      {err ? <div className="alert alert--err">{err}</div> : null}

      <PagePinned>
        <PageMasthead
          title="运行日志"
          description="结构化 / 原始日志；可筛选与跟随。"
        />

        <ChromeTools
          advanced={
            advancedOpen ? (
              <>
                <ChromeField label="范围" icon={FolderOpen}>
                  <Select value={scope} onValueChange={(v) => setScope(v as LogScope)}>
                    <SelectTrigger className={CHROME_SELECT_TRIGGER} aria-label="日志范围">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <ChromeOptionLabel icon={Globe}>全部</ChromeOptionLabel>
                      </SelectItem>
                      <SelectItem value="webui">
                        <ChromeOptionLabel icon={Monitor}>WebUI</ChromeOptionLabel>
                      </SelectItem>
                      <SelectItem value="protocol">
                        <ChromeOptionLabel icon={Radio}>协议</ChromeOptionLabel>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </ChromeField>
                {payload?.sharded_logs ? (
                  <ChromeField label="来源" icon={Radio}>
                    <Select value={logSource} onValueChange={setLogSource}>
                      <SelectTrigger className={CHROME_SELECT_TRIGGER} aria-label="日志来源">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceOptions.map((s) => (
                          <SelectItem key={`src-${s}`} value={s}>
                            <ChromeOptionLabel icon={s === "all" ? Radio : FileText}>
                              {s === "all" ? "全部来源" : s}
                            </ChromeOptionLabel>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </ChromeField>
                ) : null}
                <ChromeField label="条数" icon={Hash}>
                  <Input
                    className="h-9 min-h-9 w-[4.5rem]"
                    type="number"
                    min={20}
                    max={2000}
                    aria-label="拉取条数"
                    value={String(n)}
                    onChange={(e) => onNInput(e.target.value, setN)}
                  />
                </ChromeField>
              </>
            ) : undefined
          }
        >
          <div className="relative min-w-[8rem] flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--text-muted)]"
              strokeWidth={1.75}
              aria-hidden
            />
            <Input
              type="search"
              className={CHROME_SEARCH_INPUT}
              placeholder="搜索日志…"
              aria-label="搜索日志"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <ChromeField label="视图" icon={Eye}>
            <Select value={view} onValueChange={(v) => setView(v === "raw" ? "raw" : "feed")}>
              <SelectTrigger
                className={cn(CHROME_SELECT_TRIGGER, "min-w-[6.5rem] max-w-[9rem]")}
                aria-label="日志视图"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="min-w-[10rem]">
                <SelectItem value="feed">
                  <ChromeOptionLabel icon={LayoutList}>结构化</ChromeOptionLabel>
                </SelectItem>
                <SelectItem value="raw">
                  <ChromeOptionLabel icon={FileText}>原始行</ChromeOptionLabel>
                </SelectItem>
              </SelectContent>
            </Select>
          </ChromeField>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={exportCurrentView}
          >
            <Download className="size-3.5" strokeWidth={1.75} aria-hidden />
            导出
          </Button>
          <Button
            type="button"
            variant={advancedOpen || activeFilterCount > 0 ? "default" : "secondary"}
            size="sm"
            className="shrink-0"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            筛选{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Button>
        </ChromeTools>
      </PagePinned>

      <Card className="logs-page__panel flex min-h-0 flex-1 flex-col overflow-hidden shadow-none">
        <CardContent className="logs-page__panel-bd flex min-h-0 flex-1 flex-col gap-1.5 px-4 pb-4 pt-2">
          {payload?.max != null ? (
            <div className="logs-page__status flex flex-wrap items-center gap-1.5">
              <Badge variant={streamBadgeVariant}>{streamBadgeLabel}</Badge>
              <Badge variant="outline">历史 {historyEntryCount}</Badge>
              {liveExtraCount ? <Badge variant="default">+{liveExtraCount} 实时</Badge> : null}
              <Badge variant="outline">显示 {visibleCount}</Badge>
              {activeFilterCount ? <Badge variant="muted">筛选中</Badge> : null}
            </div>
          ) : null}

          {view === "feed" ? (
            <div className="logs-page__level-bar">
              <span className="logs-page__level-bar__label">日志级别:</span>
              <div className="logs-page__level-stats" role="group" aria-label="日志级别筛选">
                {LOG_ENTRY_LEVELS.map((lv) => (
                  <button
                    key={`stat-${lv}`}
                    type="button"
                    className={cn(
                      "logs-page__level-stat",
                      `logs-page__level-stat--${lv}`,
                      enabledLevels.has(lv) ? "logs-page__level-stat--on" : "logs-page__level-stat--off",
                    )}
                    aria-pressed={enabledLevels.has(lv)}
                    onClick={() => toggleLogLevel(lv)}
                  >
                    <span className="logs-page__level-stat__badge">
                      {levelCounts[lv] > 0 ? levelCounts[lv] : "–"}
                    </span>
                    <span className="logs-page__level-stat__label">{lv}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="logs-page__scroll">
            {view === "feed" ? (
              !filtered.length && !loading ? (
                <div className="muted">暂无条目（或筛选无结果）。</div>
              ) : (
                <LogVirtualFeed
                  ref={logFeedRef}
                  rows={filtered}
                  followTail={followLogTail}
                  onScrollState={setFollowLogTail}
                />
              )
            ) : !lines.length && !loading ? (
              <div className="muted">无原始行数据（后端可能仅返回结构化 entries）。</div>
            ) : !filteredRawLines.length && !loading ? (
              <div className="muted">暂无行（或级别/关键词筛选无结果）。</div>
            ) : (
              <pre
                ref={rawScrollElRef}
                className="pre-block pre-block--logs-tall"
                onScroll={onRawScroll}
              >
                {filteredRawLines.join("\n")}
              </pre>
            )}
          </div>
        </CardContent>
      </Card>
    </PageFill>
  );
}
