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
import ConsoleHubSearch from "@/components/ConsoleHubSearch";
import ConsoleHubToolbarStrip from "@/components/ConsoleHubToolbarStrip";
import PageHeader from "@/components/PageHeader";
import RefreshIconButton from "@/components/RefreshIconButton";
import UiButton from "@/components/ui/UiButton";
import UiSelect from "@/components/ui/UiSelect";
import { axiosErrorDetail } from "@/api/http";
import { pushConsoleToast } from "@/utils/consoleToast";

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
  const [logSource, setLogSource] = useState("all");

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

  async function runCopy(label: string, text: string) {
    if (!(await copyTextToClipboard(text))) {
      pushConsoleToast("复制失败", "err");
      return;
    }
    pushConsoleToast(`已复制${label}`, "ok");
  }

  async function copySummary(it: ErrorRow) {
    const timeLabel = formatLogDisplayTime(it.at);
    await runCopy("摘要", formatLogErrorSummary(it, timeLabel));
  }

  async function copyTraceback(it: ErrorRow) {
    const tb = (it.traceback ?? "").trim();
    if (!tb) {
      pushConsoleToast("无堆栈内容", "warn");
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
      pushConsoleToast("已清理日志报错记录", "ok");
      await query.refetch();
    } catch (e) {
      setErr(axiosErrorDetail(e));
      pushConsoleToast("清理失败", "err");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="page-fill log-errors-page console-hub-page">
      {err ? <div className="alert alert--err">{err}</div> : null}

      <div className="page-pinned">
        <PageHeader
          title="日志报错"
          description="每条报错独立成卡；分片时可按来源筛选。「清理全部」与每日 4:00 自动清理中的日志报错部分一致。"
          actions={
            <div className="console-hub-toolbar-strip__masthead-actions row-actions">
              {shardedLogErrors ? (
                <UiSelect
                  className="log-errors-page__source-sel"
                  aria-label="报错来源"
                  value={logSource}
                  onValueChange={setLogSource}
                >
                  {sourceOptions.map((s) => (
                    <option key={`err-src-${s}`} value={s}>
                      {s === "all" ? "全部来源" : s}
                    </option>
                  ))}
                </UiSelect>
              ) : null}
              <UiButton
                variant="destructive"
                className="log-errors-page__clear-btn"
                disabled={clearing || query.isFetching || !entries.length}
                title={entries.length ? "清空 log_errors 与分片 errors 归档" : "暂无记录可清理"}
                onClick={() => void clearLogErrors()}
              >
                {clearing ? "清理中…" : "清理全部"}
              </UiButton>
              <RefreshIconButton
                embedded
                busy={query.isFetching}
                label="刷新"
                onClick={() => void query.refetch()}
              />
            </div>
          }
        />

        <ConsoleHubSearch
          className="hub-search-wide-only"
          placeholder="搜索消息、类型、来源…"
          value={q}
          onValueChange={setQ}
        />

        <ConsoleHubToolbarStrip
          search={
            <ConsoleHubSearch
              placeholder="搜索消息、类型、来源…"
              value={q}
              onValueChange={setQ}
            />
          }
          middle={
            <div className="row-actions">
              {shardedLogErrors ? (
                <UiSelect
                  className="log-errors-page__source-sel log-errors-page__source-sel--strip"
                  aria-label="报错来源"
                  value={logSource}
                  onValueChange={setLogSource}
                >
                  {sourceOptions.map((s) => (
                    <option key={`err-src-strip-${s}`} value={s}>
                      {s === "all" ? "全部来源" : s}
                    </option>
                  ))}
                </UiSelect>
              ) : null}
              <UiButton
                variant="destructive"
                className="log-errors-page__clear-btn log-errors-page__clear-btn--strip"
                disabled={clearing || query.isFetching || !entries.length}
                title={entries.length ? "清空 log_errors 与分片 errors 归档" : "暂无记录可清理"}
                onClick={() => void clearLogErrors()}
              >
                {clearing ? "清理中…" : "清理"}
              </UiButton>
            </div>
          }
          actions={
            <RefreshIconButton
              embedded
              busy={query.isFetching}
              label="刷新"
              onClick={() => void query.refetch()}
            />
          }
        />
      </div>

      <section className="panel ui-card ui-card--glass log-errors-page__panel">
        <div className="panel__bd">
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
                        <pre className="log-error-card__tb log-error-card__tb--full">{it.traceback}</pre>
                      ) : (
                        <p className="log-error-card__summary">{it.message || "（无摘要）"}</p>
                      )}
                      <div className="log-error-card__actions">
                        <UiButton
                          variant="outline"
                          size="sm"
                          className="log-error-card__copy-btn"
                          title="复制时间与摘要"
                          onClick={() => void copySummary(it)}
                        >
                          复制摘要
                        </UiButton>
                        {tb ? (
                          <UiButton
                            variant="outline"
                            size="sm"
                            className="log-error-card__copy-btn"
                            title="复制堆栈文本"
                            onClick={() => void copyTraceback(it)}
                          >
                            复制堆栈
                          </UiButton>
                        ) : null}
                        <UiButton
                          variant="outline"
                          size="sm"
                          className="log-error-card__copy-btn"
                          title="复制时间与完整堆栈"
                          onClick={() => void copyFull(it)}
                        >
                          复制全部
                        </UiButton>
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
