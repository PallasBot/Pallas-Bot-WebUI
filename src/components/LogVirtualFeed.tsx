import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { LogEntry } from "@/api/pallasTypes";
import { formatLogDisplayTime, scopeBadgeHue, splitLogScope } from "@/utils/logDisplay";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import "@/styles/log-virtual-feed.css";

export type LogVirtualFeedHandle = {
  scrollToBottom: (force?: boolean) => Promise<void>;
};

type Props = {
  rows: LogEntry[];
  followTail?: boolean;
  overscan?: number;
  onScrollState?: (nearBottom: boolean) => void;
};

function stableRowKey(row: LogEntry, index: number): string {
  const id = row.id;
  if (typeof id === "number" && Number.isFinite(id) && id > 0) return `id:${id}`;
  const msg = String(row.message ?? "");
  return `c:${row.time}|${row.scope}|${row.level}|${index}|${msg.length}:${msg.slice(0, 48)}`;
}

function LogScopeChips({ scope }: { scope: string }) {
  const { source, module } = splitLogScope(scope);
  const text = [source, module].filter(Boolean).join("/") || "";
  const hue = text ? scopeBadgeHue(text) : 0;
  /* 始终占位，避免无 scope 时正文挤进定宽列 */
  return (
    <span className="log-line__scope-group" title={text || scope || undefined}>
      {text ? (
        <Badge
          variant="outline"
          className="log-line__scope-badge"
          style={{ ["--scope-h" as string]: String(hue) }}
        >
          {text}
        </Badge>
      ) : null}
    </span>
  );
}

const ESTIMATE_ROW_PX = 40;
const LINE_PX = 18;
const ROW_PAD_PX = 16;
/** 窄屏 meta / 正文分行，估高需额外占一行 */
const NARROW_META_PX = 22;
const NARROW_LOG_MQ = "(max-width: 560px)";
/** 与 CSS max-height 对齐，避免估高无限膨胀 */
const MSG_MAX_PX = 480;

function narrowLogLayout(): boolean {
  return typeof window !== "undefined" && window.matchMedia(NARROW_LOG_MQ).matches;
}

function estimateRowPx(row: LogEntry | undefined): number {
  const narrow = narrowLogLayout();
  const metaExtra = narrow ? NARROW_META_PX : 0;
  if (!row) return ESTIMATE_ROW_PX + metaExtra;
  const msg = String(row.message ?? "");
  if (!msg) return ESTIMATE_ROW_PX + metaExtra;
  const hardLines = msg.split("\n").length;
  /* 窄屏正文另起一行，按可视宽度估软换行，略偏高避免虚拟行重叠 */
  const cpl = narrow
    ? Math.max(28, Math.floor((Math.min(window.innerWidth, 480) - 24) / 6.5))
    : 100;
  const softLines = Math.ceil(msg.length / cpl);
  const lines = Math.max(1, hardLines, softLines);
  const msgCap = narrow
    ? Math.min(MSG_MAX_PX, Math.round(window.innerHeight * 0.4))
    : MSG_MAX_PX;
  return Math.min(msgCap + ROW_PAD_PX + metaExtra, ROW_PAD_PX + metaExtra + lines * LINE_PX);
}

const LogVirtualFeed = forwardRef<LogVirtualFeedHandle, Props>(function LogVirtualFeed(
  { rows, followTail = true, overscan = 12, onScrollState },
  ref,
) {
  const scrollElRef = useRef<HTMLDivElement | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [pinnedSnapshot, setPinnedSnapshot] = useState<LogEntry | null>(null);
  const suppressScrollStateRef = useRef(0);
  const scrollBottomTokenRef = useRef(0);
  const rowKeys = useMemo(
    () => rows.map((row, index) => stableRowKey(row, index)),
    [rows],
  );

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElRef.current,
    estimateSize: (index) => estimateRowPx(rows[index]),
    overscan,
    getItemKey: (index) => rowKeys[index] ?? index,
  });

  const pinnedRow = useMemo(() => {
    if (!pinnedKey) return null;
    const liveIdx = rowKeys.indexOf(pinnedKey);
    if (liveIdx >= 0) return rows[liveIdx] ?? null;
    return pinnedSnapshot;
  }, [rows, rowKeys, pinnedKey, pinnedSnapshot]);

  const scrollThreshold = useCallback((el: HTMLElement) => {
    const h = el.clientHeight;
    return Math.min(80, Math.max(24, Math.floor(h * 0.08)));
  }, []);

  const isNearBottom = useCallback(
    (el: HTMLElement) => {
      if (el.clientHeight < 8) return false;
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      const slack = Math.max(scrollThreshold(el), ESTIMATE_ROW_PX * 3);
      return gap <= slack;
    },
    [scrollThreshold],
  );

  const scrollToBottom = useCallback(
    async (force = false) => {
      if (!force && !followTail) return;
      await Promise.resolve();
      const el = scrollElRef.current;
      if (!el || rows.length === 0) return;
      const token = ++scrollBottomTokenRef.current;
      suppressScrollStateRef.current += 1;
      const last = rows.length - 1;
      const apply = () => {
        if (token !== scrollBottomTokenRef.current) return;
        rowVirtualizer.scrollToIndex(last, { align: "end" });
      };
      apply();
      let frames = 0;
      const tick = () => {
        if (token !== scrollBottomTokenRef.current) {
          suppressScrollStateRef.current = Math.max(0, suppressScrollStateRef.current - 1);
          return;
        }
        apply();
        frames += 1;
        const laidOut = el.clientHeight >= 8;
        const needRetry = !laidOut || !isNearBottom(el);
        if (frames < (laidOut ? 8 : 16) && needRetry) {
          window.requestAnimationFrame(tick);
          return;
        }
        suppressScrollStateRef.current = Math.max(0, suppressScrollStateRef.current - 1);
        if (laidOut) onScrollState?.(true);
      };
      window.requestAnimationFrame(tick);
    },
    [followTail, isNearBottom, onScrollState, rowVirtualizer, rows.length],
  );

  useImperativeHandle(ref, () => ({ scrollToBottom }), [scrollToBottom]);

  useEffect(() => {
    void scrollToBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enter once
  }, []);

  useEffect(() => {
    if (followTail) void scrollToBottom(true);
  }, [rows.length, followTail, scrollToBottom]);

  useEffect(() => {
    if (followTail) void scrollToBottom(true);
  }, [rows, followTail, scrollToBottom]);

  useEffect(() => {
    rowVirtualizer.measure();
  }, [rows.length, rowVirtualizer]);

  useEffect(() => {
    const el = scrollElRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      rowVirtualizer.measure();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rowVirtualizer]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(NARROW_LOG_MQ);
    const onChange = () => {
      rowVirtualizer.measure();
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [rowVirtualizer]);

  function onScroll() {
    const el = scrollElRef.current;
    if (!el) return;
    if (suppressScrollStateRef.current > 0) return;
    onScrollState?.(isNearBottom(el));
  }

  function pinRow(key: string, row: LogEntry) {
    if (pinnedKey === key) {
      setPinnedKey(null);
      setPinnedSnapshot(null);
      return;
    }
    setPinnedKey(key);
    setPinnedSnapshot({ ...row });
  }

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="log-virtual-feed-wrap">
      <div ref={scrollElRef} className="log-feed log-virtual-feed" onScroll={onScroll}>
        <div
          className="log-virtual-feed__spacer"
          style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}
        >
          {virtualItems.map((vRow) => {
            const row = rows[vRow.index];
            if (!row) return null;
            const stableKey = rowKeys[vRow.index] ?? String(vRow.index);
            const isPinned = pinnedKey === stableKey;
            return (
              <button
                key={stableKey}
                type="button"
                data-index={vRow.index}
                ref={rowVirtualizer.measureElement}
                className={cn(
                  "log-line log-line--virtual",
                  `log-line--virtual-${row.level}`,
                  isPinned && "log-line--virtual-pinned",
                )}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${vRow.start}px)`,
                }}
                title="点击固定到下方查看"
                onClick={() => pinRow(stableKey, row)}
              >
                <span className="log-line__meta-row">
                  <span className="log-line__lead">
                    <span className="log-line__time">{formatLogDisplayTime(row.time)}</span>
                    <span
                      className={cn("log-line__lv-tag", "log-line__lv-tag--dot", `log-line__lv-tag--${row.level}`)}
                      title={row.level}
                      aria-label={row.level}
                    />
                  </span>
                  <LogScopeChips scope={row.scope} />
                </span>
                <span className="log-line__msg log-line__msg--wrap">{row.message}</span>
              </button>
            );
          })}
        </div>
      </div>
      {pinnedRow ? (
        <div className={cn("log-virtual-feed__detail", `log-virtual-feed__detail--${pinnedRow.level}`)}>
          <div className="log-virtual-feed__detail-meta">
            <span className="log-virtual-feed__detail-pin" title="已固定">
              固定
            </span>
            <span className="log-line__time">{formatLogDisplayTime(pinnedRow.time)}</span>
            <span className={cn("log-line__lv-tag", `log-line__lv-tag--${pinnedRow.level}`)}>
              {pinnedRow.level}
            </span>
            <LogScopeChips scope={pinnedRow.scope} />
            <button
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--sm log-virtual-feed__detail-close"
              onClick={() => {
                setPinnedKey(null);
                setPinnedSnapshot(null);
              }}
            >
              取消固定
            </button>
          </div>
          <pre className="log-virtual-feed__detail-body">{pinnedRow.message}</pre>
        </div>
      ) : null}
    </div>
  );
});

export default LogVirtualFeed;
