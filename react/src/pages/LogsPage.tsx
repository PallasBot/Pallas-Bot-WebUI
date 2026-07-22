import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchLogs, openLogsEventSource } from "@/api/fullConsole";
import type { LogEntry, LogEntryLevel, LogScope, LogsData } from "@pallas-vue/api/pallasTypes";
import ConsoleHubSearch from "@/components/ConsoleHubSearch";
import LogVirtualFeed, { type LogVirtualFeedHandle } from "@/components/LogVirtualFeed";
import PageHeader from "@/components/PageHeader";
import UiInput from "@/components/ui/UiInput";
import UiSelect from "@/components/ui/UiSelect";
import {
  LOG_ENTRY_LEVELS,
  loadLogsEnabledLevels,
  mergeLogEntryContinuations,
  normalizeLogEntryDisplay,
  parseLogLineLevel,
  persistLogsEnabledLevels,
  stripYearFromLogLine,
} from "@pallas-vue/utils/logDisplay";
import {
  loadLogsLastEventId,
  persistLogsLastEventId,
} from "@pallas-vue/utils/logStreamResume";
import { cn } from "@/lib/utils";

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

  const bumpLiveTick = useCallback(() => setLiveTick((v) => v + 1), []);

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
          void logFeedRef.current?.scrollToBottom(true);
        }
      }
    },
    [logSource, n, scope],
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
    setFollowLogTail(true);
    void logFeedRef.current?.scrollToBottom(true);
    startLogPolling();
    startLogStream();
  }, [load, pageReady, startLogPolling, startLogStream]);

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
    void bootLogsPage();
    return () => {
      stopLogPolling();
      closeLogStream();
    };
  }, [bootLogsPage, closeLogStream, stopLogPolling]);

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
    const rows = displayLines;
    if (enabledLevels.size >= LOG_ENTRY_LEVELS.length) return rows;
    return rows.filter((line) => enabledLevels.has(parseLogLineLevel(line)));
  }, [displayLines, enabledLevels]);

  const historyEntryCount = baseEntries.length;
  const liveExtraCount = useMemo(() => {
    void liveTick;
    if (!liveEntries.length) return 0;
    const seen = new Set(baseEntries.map((e) => `${e.time}|${e.scope}|${e.message}`));
    return liveEntries.filter((e) => !seen.has(`${e.time}|${e.scope}|${e.message}`)).length;
  }, [baseEntries, liveEntries, liveTick]);

  const visibleCount = view === "feed" ? filtered.length : filteredRawLines.length;

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
  const streamBadgeClass = streamLive
    ? "logs-page__badge--live"
    : streamReconnecting
      ? "logs-page__badge--reconnect"
      : "logs-page__badge--pending";

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
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    setFollowLogTail(gap <= 80);
  }

  if (!pageReady) {
    return (
      <div className="page-fill logs-page console-hub-page">
        <p className="muted">加载日志…</p>
      </div>
    );
  }

  return (
    <div className="page-fill logs-page console-hub-page">
      {err ? <div className="alert alert--err">{err}</div> : null}

      <div className="page-pinned">
        <PageHeader
          title="运行日志"
          description="支持结构化与原始行视图；可按范围、来源与条数筛选，并实时跟随推送。"
        />

        <div className="logs-page__chrome-tools">
          <div className="logs-page__search-row">
            <ConsoleHubSearch
              className="logs-page__search"
              placeholder="搜索消息、scope、级别…"
              ariaLabel="按消息、scope、级别等过滤"
              value={q}
              onValueChange={setQ}
            />
            <button
              type="button"
              className={cn(
                "btn logs-page__filter-toggle",
                (advancedOpen || activeFilterCount > 0) && "btn--primary",
              )}
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              筛选{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </button>
          </div>
          <div className="logs-page__toolbar-row">
            <div className="logs-page__view-btns console-view-toggle" role="group" aria-label="日志视图">
              <button
                type="button"
                className={cn(view === "feed" && "is-on")}
                onClick={() => setView("feed")}
              >
                结构化
              </button>
              <button
                type="button"
                className={cn(view === "raw" && "is-on")}
                onClick={() => setView("raw")}
              >
                原始行
              </button>
            </div>
          </div>
          {advancedOpen ? (
            <div className="logs-page__hd-advanced">
              <div className="logs-page__filter-row form-toolbar">
                <label className="logs-page__field">
                  <span className="logs-page__field-label">范围</span>
                  <UiSelect
                    aria-label="日志范围"
                    value={scope}
                    onValueChange={(v) => setScope(v as LogScope)}
                  >
                    <option value="all">全部</option>
                    <option value="webui">WebUI</option>
                    <option value="protocol">协议</option>
                  </UiSelect>
                </label>
                {payload?.sharded_logs ? (
                  <label className="logs-page__field">
                    <span className="logs-page__field-label">来源</span>
                    <UiSelect
                      aria-label="日志来源"
                      value={logSource}
                      onValueChange={setLogSource}
                    >
                      {sourceOptions.map((s) => (
                        <option key={`src-${s}`} value={s}>
                          {s === "all" ? "全部来源" : s}
                        </option>
                      ))}
                    </UiSelect>
                  </label>
                ) : null}
                <label className="logs-page__field">
                  <span className="logs-page__field-label">条数</span>
                  <UiInput
                    className="logs-page__n-inp"
                    type="number"
                    min={20}
                    max={2000}
                    aria-label="拉取条数"
                    value={String(n)}
                    onValueChange={(v) => onNInput(v, setN)}
                  />
                </label>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <section className="panel ui-card ui-card--glass logs-page__panel">
        <div className="panel__bd">
          {payload?.max != null ? (
            <div className="logs-page__status">
              <span className={cn("logs-page__badge", streamBadgeClass)}>{streamBadgeLabel}</span>
              <span className="logs-page__badge">历史 {historyEntryCount}</span>
              {liveExtraCount ? (
                <span className="logs-page__badge logs-page__badge--accent">+{liveExtraCount} 实时</span>
              ) : null}
              <span className="logs-page__badge">显示 {visibleCount}</span>
              {activeFilterCount ? (
                <span className="logs-page__badge logs-page__badge--muted">筛选中</span>
              ) : null}
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
        </div>
      </section>
    </div>
  );
}
