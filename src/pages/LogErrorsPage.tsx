import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Radio, Search } from "lucide-react";
import { fetchLogErrors, postLogErrorsCleanup } from "@/api/fullConsole";
import type { MatcherErrorLogEntry } from "@/api/pallasTypes";
import { axiosErrorDetail } from "@/api/http";
import { copyTextToClipboard } from "@/utils/clipboard";
import {
  formatLogErrorExcType,
  formatLogErrorFull,
  formatLogErrorSummary,
  isTracebackTruncated,
  parseLogErrorPlugin,
} from "@/utils/logErrorDisplay";
import { formatLogDisplayTime } from "@/utils/logDisplay";
import { pushConsoleToast } from "@/utils/consoleToast";
import PageMasthead from "@/components/PageMasthead";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import ChromeTools, { CHROME_SEARCH_INPUT, CHROME_SELECT_TRIGGER, CHROME_TOOLS_TRAILING } from "@/components/ChromeTools";
import { ConsoleBlockSkeleton } from "@/components/ConsolePageSkeleton";
import { cn } from "@/lib/utils";
import PageFill from "@/components/layout/PageFill";
import PagePinned from "@/components/layout/PagePinned";
import RefreshIconButton from "@/components/RefreshIconButton";
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
    <PageFill className="log-errors-page">
      {err ? <div className="alert alert--err">{err}</div> : null}

      <PagePinned>
        <PageMasthead
          title="日志报错"
          description="运行期报错；可筛选与清理。"
        />

        <ChromeTools>
          {shardedLogErrors ? (
            <ChromeField label="来源" icon={Radio} className="shrink-0">
              <Select value={logSource} onValueChange={setLogSource}>
                <SelectTrigger
                  className={cn(CHROME_SELECT_TRIGGER, "min-w-[9rem] whitespace-nowrap")}
                  aria-label="报错来源"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start" className="min-w-[10rem]">
                  {sourceOptions.map((s) => (
                    <SelectItem key={`err-src-${s}`} value={s}>
                      <ChromeOptionLabel icon={s === "all" ? Radio : FileText}>
                        {s === "all" ? "全部来源" : s}
                      </ChromeOptionLabel>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ChromeField>
          ) : null}
          <div className="relative min-w-[10rem] flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--text-muted)]"
              strokeWidth={1.75}
              aria-hidden
            />
            <Input
              type="search"
              className={CHROME_SEARCH_INPUT}
              placeholder="搜索报错…"
              aria-label="搜索报错"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className={CHROME_TOOLS_TRAILING}>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="shrink-0"
              disabled={clearing || query.isFetching || !entries.length}
              title={entries.length ? "清空 log_errors 与分片 errors 归档" : "暂无记录可清理"}
              onClick={() => void clearLogErrors()}
            >
              {clearing ? "清理中…" : "清理全部"}
            </Button>
            <RefreshIconButton
              busy={query.isFetching}
              label="刷新"
              showLabel
              onClick={() => void query.refetch()}
            />
          </div>
        </ChromeTools>
      </PagePinned>

      <Card className="log-errors-page__panel flex min-h-0 flex-1 flex-col overflow-hidden shadow-none">
        <CardContent className="log-errors-page__panel-bd flex min-h-0 flex-1 flex-col p-0 px-4 pb-4 pt-2">
          <div className="log-errors-page__scroll">
            {query.isLoading && !entries.length ? (
              <ConsoleBlockSkeleton lines={5} label="报错记录加载中" className="log-errors-page__empty" />
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
                        <Badge
                          variant="destructive"
                          className="log-error-card__type"
                          title={it.exc_type !== it.displayExcType ? it.exc_type : undefined}
                        >
                          {it.displayExcType}
                        </Badge>
                        <span className="log-error-card__source">
                          <span className="log-error-card__source-tag">{it.meta.source}</span>
                          {it.meta.module && it.meta.module !== "log" ? (
                            <span className="log-error-card__module">{it.meta.module}</span>
                          ) : null}
                        </span>
                        {tb && isTracebackTruncated(it.traceback) ? (
                          <Badge variant="muted">落盘时已截断</Badge>
                        ) : null}
                      </header>
                      {tb ? (
                        <pre className="log-error-card__tb log-error-card__tb--full">{it.traceback}</pre>
                      ) : (
                        <p className="log-error-card__summary">{it.message || "（无摘要）"}</p>
                      )}
                      <div className="log-error-card__actions">
                        <Button
                          variant="outline"
                          size="sm"
                          title="复制时间与摘要"
                          onClick={() => void copySummary(it)}
                        >
                          复制摘要
                        </Button>
                        {tb ? (
                          <Button
                            variant="outline"
                            size="sm"
                            title="复制堆栈文本"
                            onClick={() => void copyTraceback(it)}
                          >
                            复制堆栈
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          title="复制时间与完整堆栈"
                          onClick={() => void copyFull(it)}
                        >
                          复制全部
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </PageFill>
  );
}
