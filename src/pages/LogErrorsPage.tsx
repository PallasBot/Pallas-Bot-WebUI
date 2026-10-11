import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronRight, ClipboardCopy, Copy, FileText, Files, Radio, Search, Trash2 } from "lucide-react";
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
import { formatLogDisplayDateTime } from "@/utils/logDisplay";
import { pushConsoleToast } from "@/utils/consoleToast";
import PageMasthead from "@/components/PageMasthead";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import ChromeTools, { CHROME_SEARCH_INPUT, CHROME_SELECT_TRIGGER, CHROME_TOOLS_TRAILING } from "@/components/ChromeTools";
import { ConsoleBlockSkeleton } from "@/components/ConsolePageSkeleton";
import { cn } from "@/lib/utils";
import PageFill from "@/components/layout/PageFill";
import PagePinned from "@/components/layout/PagePinned";
import RefreshIconButton from "@/components/RefreshIconButton";
import { Button } from "@/components/ui/button";
import { Chip, Input, ListBox, Select } from "@heroui/react";
import { useConsoleConfirm } from "@/hooks/useConsoleConfirm";

let logErrorsCache: Awaited<ReturnType<typeof fetchLogErrors>> | null = null;

type ErrorRow = MatcherErrorLogEntry & {
  meta: ReturnType<typeof parseLogErrorPlugin>;
  displayExcType: string;
};

function badgeClass(variant: string) {
  const variantClass = {
    destructive: "chip--danger chip--soft",
    muted: "chip--default chip--soft",
  }[variant] ?? "chip--accent chip--soft";
  return `chip chip--md ${variantClass}`;
}

function cardKey(it: MatcherErrorLogEntry, idx: number): string {
  return `logerr-${it.at}-${idx}-${it.plugin}-${it.exc_type}`;
}

export default function LogErrorsPage() {
  const { confirm, confirmDialog } = useConsoleConfirm();
  const [q, setQ] = useState("");
  const [clearing, setClearing] = useState(false);
  const [err, setErr] = useState("");
  const [logSource, setLogSource] = useState("all");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

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
    const timeLabel = formatLogDisplayDateTime(it.at);
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
    const timeLabel = formatLogDisplayDateTime(it.at);
    await runCopy("全部", formatLogErrorFull(it, timeLabel));
  }

  function toggleExpanded(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function clearLogErrors() {
    if (clearing || query.isFetching || !entries.length) return;
    if (!(await confirm({
      title: "清理全部日志报错",
      subtitle: "确定清空全部日志报错记录？",
      warnings: ["将删除 log_errors.jsonl 与分片 errors 归档，不可恢复。"],
      confirmLabel: "清理全部",
    }))) {
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
              <Select value={logSource} onChange={(v) => setLogSource(String(v ?? ""))}>
                <Select.Trigger
                  className={cn(
                    "min-h-[var(--ui-ctrl-height,36px)] w-full min-w-0 overflow-hidden [&>span]:flex [&>span]:h-full [&>span]:min-w-0 [&>span]:flex-1 [&>span]:items-center [&>span]:overflow-x-hidden [&>span]:overflow-y-visible [&>span]:text-left [&>span]:leading-[1.25] [&>span]:whitespace-nowrap [&>span]:text-ellipsis [&>span>*]:min-w-0 [&>span>*]:overflow-x-hidden [&>span>*]:overflow-y-visible [&>span>*]:text-ellipsis [&>span>*]:whitespace-nowrap [&>svg]:shrink-0 [&>svg]:self-center",
                    CHROME_SELECT_TRIGGER,
                    "min-w-[9rem] whitespace-nowrap",
                  )}
                  aria-label="报错来源"
                >
                  <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
                  <Select.Indicator>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Select.Indicator>
                </Select.Trigger>
                <Select.Popover
                  placement="bottom start"
                  className={cn(
                    "relative z-[500] flex min-h-0 min-w-[8rem] flex-col overflow-hidden data-[entering]:animate-in data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[entering]:fade-in-0 data-[exiting]:zoom-out-95 data-[entering]:zoom-in-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2",
                    "min-w-[10rem]",
                  )}
                >
                  <ListBox className="min-h-0 flex-1 overflow-auto p-1">
                  {sourceOptions.map((s) => (
                    <ListBox.Item
                      key={`err-src-${s}`}
                      id={s}
                      textValue={s === "all" ? "全部来源" : s}
                      className="relative flex w-full cursor-default select-none items-center py-1.5 pl-8 pr-2"
                    >
                      <ChromeOptionLabel icon={s === "all" ? Radio : FileText}>
                        {s === "all" ? "全部来源" : s}
                      </ChromeOptionLabel>
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        <ListBox.ItemIndicator>
                          <Check className="h-4 w-4 text-[var(--accent)]" />
                        </ListBox.ItemIndicator>
                      </span>
                    </ListBox.Item>
                  ))}
                  </ListBox>
                </Select.Popover>
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
              className={cn(
                "flex h-9 min-h-[var(--ui-ctrl-height,36px)] w-full",
                CHROME_SEARCH_INPUT,
              )}
              data-heroui-skin="true"
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
              icon={Trash2}
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

      <div className="log-errors-page__list-wrap">
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
              const isOpen = expandedKeys.has(key);
              return (
                <article key={key} className={cn("log-error-card", isOpen && "log-error-card--expanded")}>
                  <button
                    type="button"
                    className="log-error-card__hd"
                    aria-expanded={isOpen}
                    onClick={() => toggleExpanded(key)}
                  >
                    <time className="log-error-card__time">{formatLogDisplayDateTime(it.at)}</time>
                    <Chip
                      className={cn(badgeClass("destructive"), "log-error-card__type")}
                      title={it.exc_type !== it.displayExcType ? it.exc_type : undefined}
                    >
                      <Chip.Label>{it.displayExcType}</Chip.Label>
                    </Chip>
                    <span className="log-error-card__source">
                      <span className="log-error-card__source-tag">{it.meta.source}</span>
                      {it.meta.module && it.meta.module !== "log" ? (
                        <span className="log-error-card__module">{it.meta.module}</span>
                      ) : null}
                    </span>
                    {tb && isTracebackTruncated(it.traceback) ? (
                      <Chip className={badgeClass("muted")}><Chip.Label>落盘时已截断</Chip.Label></Chip>
                    ) : null}
                    <ChevronRight
                      className={cn("log-error-card__chevron", isOpen && "log-error-card__chevron--open")}
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </button>
                  {isOpen ? (
                    <>
                      {tb ? (
                        <pre className="log-error-card__tb">{it.traceback}</pre>
                      ) : (
                        <p className="log-error-card__summary">{it.message || "（无摘要）"}</p>
                      )}
                      <div className="log-error-card__actions">
                        <Button
                          variant="outline"
                          size="sm"
                          icon={ClipboardCopy}
                          title="复制时间与摘要"
                          onClick={() => void copySummary(it)}
                        >
                          复制摘要
                        </Button>
                        {tb ? (
                          <Button
                            variant="outline"
                            size="sm"
                            icon={Copy}
                            title="复制堆栈文本"
                            onClick={() => void copyTraceback(it)}
                          >
                            复制堆栈
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          icon={Files}
                          title="复制时间与完整堆栈"
                          onClick={() => void copyFull(it)}
                        >
                          复制全部
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="log-error-card__summary log-error-card__summary--clamp" title={it.message || undefined}>
                      {it.message || "（无摘要）"}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
      {confirmDialog}
    </PageFill>
  );
}
