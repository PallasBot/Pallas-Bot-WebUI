import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchLogErrors, postLogErrorsCleanup } from "@/api/fullConsole";
import type { MatcherErrorLogEntry } from "@pallas-vue/api/pallasTypes";
import { copyTextToClipboard } from "@pallas-vue/utils/clipboard";
import {
  formatLogErrorExcType,
  formatLogErrorFull,
  formatLogErrorSummary,
  isTracebackTruncated,
  parseLogErrorPlugin,
} from "@pallas-vue/utils/logErrorDisplay";
import { formatLogDisplayTime } from "@pallas-vue/utils/logDisplay";
import PageHeader from "@/components/PageHeader";
import RefreshIconButton from "@/components/RefreshIconButton";
import { Input } from "@/components/ui/input";
import { axiosErrorDetail } from "@/api/http";
import { cn } from "@/lib/utils";

let logErrorsCache: Awaited<ReturnType<typeof fetchLogErrors>> | null = null;

type ErrorRow = MatcherErrorLogEntry & {
  meta: ReturnType<typeof parseLogErrorPlugin>;
  displayExcType: string;
};

function cardKey(it: MatcherErrorLogEntry, idx: number): string {
  return `logerr-${it.at}-${idx}-${it.plugin}-${it.exc_type}`;
}

export default function LogErrorsPage() {
  const [q, setQ] = useState("");
  const [clearing, setClearing] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const [logSource, setLogSource] = useState("all");
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const query = useQuery({
    queryKey: ["log-errors", logSource],
    queryFn: async () => {
      const stats = await fetchLogErrors(logSource, { tbLimit: 0 });
      logErrorsCache = stats;
      return stats;
    },
    initialData: logErrorsCache ?? undefined,
  });

  const entries = query.data?.log_error_log ?? [];
  const shardedLogErrors = Boolean(query.data?.sharded_log_errors);
  const logSources = query.data?.log_error_sources ?? [];

  const sourceOptions = useMemo(() => {
    const opts = logSources.length ? logSources : ["hub"];
    return ["all", ...opts.filter((s) => s !== "all")];
  }, [logSources]);

  const displayEntries = useMemo((): ErrorRow[] => {
    const needle = q.trim().toLowerCase();
    const rows: ErrorRow[] = [...entries].reverse().map((it) => ({
      ...it,
      meta: parseLogErrorPlugin(it.plugin),
      displayExcType: formatLogErrorExcType(it.exc_type, it.traceback),
    }));
    if (!needle) return rows;
    return rows.filter((it) => {
      const hay = [it.message, it.exc_type, it.plugin, it.meta.source, it.meta.module, it.traceback]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [entries, q]);

  const allExpanded = displayEntries.length > 0 && displayEntries.every((it, idx) => expandedKeys[cardKey(it, idx)]);

  async function runCopy(label: string, text: string) {
    if (!(await copyTextToClipboard(text))) {
      setToast("复制失败");
      return;
    }
    setToast(`已复制${label}`);
    window.setTimeout(() => setToast(""), 2500);
  }

  async function copySummary(it: ErrorRow) {
    const timeLabel = formatLogDisplayTime(it.at);
    await runCopy("摘要", formatLogErrorSummary(it, timeLabel));
  }

  async function copyTraceback(it: ErrorRow) {
    const tb = (it.traceback ?? "").trim();
    if (!tb) {
      setToast("无堆栈内容");
      return;
    }
    await runCopy("堆栈", tb);
  }

  async function copyFull(it: ErrorRow) {
    const timeLabel = formatLogDisplayTime(it.at);
    await runCopy("全部", formatLogErrorFull(it, timeLabel));
  }

  async function clearLogErrors() {
    if (clearing || query.isFetching || !entries.length) return;
    if (
      !window.confirm(
        "确定清空全部日志报错记录？将删除 log_errors.jsonl 与分片 errors 归档，不可恢复。",
      )
    ) {
      return;
    }
    setClearing(true);
    setErr("");
    try {
      await postLogErrorsCleanup();
      setToast("已清理日志报错记录");
      await query.refetch();
    } catch (e) {
      setErr(axiosErrorDetail(e));
      setToast("清理失败");
    } finally {
      setClearing(false);
    }
  }

  function toggleExpanded(key: string) {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleExpandAll() {
    if (allExpanded) {
      setExpandedKeys({});
      return;
    }
    const next: Record<string, boolean> = {};
    displayEntries.forEach((it, idx) => {
      if (it.traceback?.trim()) next[cardKey(it, idx)] = true;
    });
    setExpandedKeys(next);
  }

  return (
    <div className="page-fill log-errors-page console-hub-page">
      {err ? <div className="alert alert--err">{err}</div> : null}
      {toast ? <p className="muted log-errors-page__hint">{toast}</p> : null}

      <div className="page-pinned">
        <PageHeader
          title="日志报错"
          description="每条报错独立成卡；分片时可按来源筛选。「清理全部」与每日 4:00 自动清理中的日志报错部分一致。"
          actions={
            <div className="console-hub-toolbar-strip__masthead-actions row-actions">
              {shardedLogErrors ? (
                <select
                  className="sel ui-select log-errors-page__source-sel"
                  aria-label="报错来源"
                  value={logSource}
                  onChange={(e) => setLogSource(e.target.value)}
                >
                  {sourceOptions.map((s) => (
                    <option key={`err-src-${s}`} value={s}>
                      {s === "all" ? "全部来源" : s}
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                type="button"
                className="btn btn--danger log-errors-page__clear-btn"
                disabled={clearing || query.isFetching || !entries.length}
                title={entries.length ? "清空 log_errors 与分片 errors 归档" : "暂无记录可清理"}
                onClick={() => void clearLogErrors()}
              >
                {clearing ? "清理中…" : "清理全部"}
              </button>
              <RefreshIconButton
                embedded
                busy={query.isFetching}
                label="刷新"
                onClick={() => void query.refetch()}
              />
            </div>
          }
        />

        <div className="console-hub-page__search-wrap hub-search-wide-only">
          <Input
            className="console-hub-page__search-input"
            placeholder="搜索消息、类型、来源…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="console-hub-toolbar-strip">
          <div className="console-hub-page__search-wrap">
            <Input
              className="console-hub-page__search-input"
              placeholder="搜索消息、类型、来源…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="console-hub-toolbar-strip__middle row-actions">
            {shardedLogErrors ? (
              <select
                className="sel ui-select log-errors-page__source-sel log-errors-page__source-sel--strip"
                aria-label="报错来源"
                value={logSource}
                onChange={(e) => setLogSource(e.target.value)}
              >
                {sourceOptions.map((s) => (
                  <option key={`err-src-strip-${s}`} value={s}>
                    {s === "all" ? "全部来源" : s}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              className="btn btn--danger log-errors-page__clear-btn log-errors-page__clear-btn--strip"
              disabled={clearing || query.isFetching || !entries.length}
              title={entries.length ? "清空 log_errors 与分片 errors 归档" : "暂无记录可清理"}
              onClick={() => void clearLogErrors()}
            >
              {clearing ? "清理中…" : "清理"}
            </button>
          </div>
          <div className="console-hub-toolbar-strip__actions">
            <RefreshIconButton
              embedded
              busy={query.isFetching}
              label="刷新"
              onClick={() => void query.refetch()}
            />
          </div>
        </div>
      </div>

      <section className="panel ui-card ui-card--glass log-errors-page__panel">
        <div className="panel__bd">
          {displayEntries.some((it) => it.traceback?.trim()) ? (
            <button type="button" className="log-errors-page__expand-all btn btn--ghost" onClick={toggleExpandAll}>
              {allExpanded ? "全部收起堆栈" : "全部展开堆栈"}
            </button>
          ) : null}
          <div className="log-errors-page__scroll">
            {query.isLoading && !entries.length ? (
              <p className="muted log-errors-page__empty">加载中…</p>
            ) : !displayEntries.length ? (
              <p className="muted log-errors-page__empty">
                {entries.length && q ? "无匹配结果。" : "暂无报错记录。"}
              </p>
            ) : (
              <div className="log-errors-page__list">
                {displayEntries.map((it, idx) => {
                  const key = cardKey(it, idx);
                  const tb = (it.traceback ?? "").trim();
                  const expanded = Boolean(expandedKeys[key]);
                  return (
                    <article key={key} className="log-error-card">
                      <header className="log-error-card__hd">
                        <time className="log-error-card__time">{formatLogDisplayTime(it.at)}</time>
                        <span
                          className="log-error-card__type"
                          title={it.exc_type !== it.displayExcType ? it.exc_type : undefined}
                        >
                          {it.displayExcType}
                        </span>
                        <span className="log-error-card__source">
                          <span className="log-error-card__source-tag">{it.meta.source}</span>
                          {it.meta.module && it.meta.module !== "log" ? (
                            <span className="log-error-card__module">{it.meta.module}</span>
                          ) : null}
                        </span>
                        {tb && isTracebackTruncated(it.traceback) ? (
                          <span className="log-error-card__trunc-badge muted">落盘时已截断</span>
                        ) : null}
                      </header>
                      {tb ? (
                        expanded ? (
                          <pre className="log-error-card__tb log-error-card__tb--full">{it.traceback}</pre>
                        ) : (
                          <div className="log-error-card__summary-row">
                            <p className="log-error-card__summary">{it.message || "（点击查看堆栈）"}</p>
                            <button type="button" className="btn btn--ghost" onClick={() => toggleExpanded(key)}>
                              展开堆栈
                            </button>
                          </div>
                        )
                      ) : (
                        <p className="log-error-card__summary">{it.message || "（无摘要）"}</p>
                      )}
                      <div className="log-error-card__actions">
                        <button
                          type="button"
                          className="btn log-error-card__copy-btn"
                          title="复制时间与摘要"
                          onClick={() => void copySummary(it)}
                        >
                          复制摘要
                        </button>
                        {tb ? (
                          <button
                            type="button"
                            className="btn log-error-card__copy-btn"
                            title="复制堆栈文本"
                            onClick={() => void copyTraceback(it)}
                          >
                            复制堆栈
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn log-error-card__copy-btn"
                          title="复制时间与完整堆栈"
                          onClick={() => void copyFull(it)}
                        >
                          复制全部
                        </button>
                        {tb ? (
                          <button
                            type="button"
                            className={cn("btn log-error-card__copy-btn", expanded && "btn--primary")}
                            onClick={() => toggleExpanded(key)}
                          >
                            {expanded ? "收起堆栈" : "展开堆栈"}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
