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
import { formatLogDisplayTime, splitLogScope } from "@/utils/logDisplay";
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
  if (!source && !module) return null;
  return (
    <span className="log-line__scope-group">
      {source ? <span className="log-line__source">{source}</span> : null}
      {module ? <span className="log-line__scope">[{module}]</span> : null}
    </span>
  );
}

const ESTIMATE_ROW_PX = 36;

const LogVirtualFeed = forwardRef<LogVirtualFeedHandle, Props>(function LogVirtualFeed(
  { rows, followTail = true, overscan = 12, onScrollState },
  ref,
) {
  const scrollElRef = useRef<HTMLDivElement | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandedSnapshot, setExpandedSnapshot] = useState<LogEntry | null>(null);
  const suppressScrollStateRef = useRef(0);
  const scrollBottomTokenRef = useRef(0);
  const rowKeys = useMemo(
    () => rows.map((row, index) => stableRowKey(row, index)),
    [rows],
  );

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElRef.current,
    estimateSize: () => ESTIMATE_ROW_PX,
    overscan,
    getItemKey: (index) => rowKeys[index] ?? index,
  });

  const expandedRow = useMemo(() => {
    if (!expandedKey) return null;
    const liveIdx = rowKeys.indexOf(expandedKey);
    if (liveIdx >= 0) return rows[liveIdx] ?? null;
    return expandedSnapshot;
  }, [rows, rowKeys, expandedKey, expandedSnapshot]);

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

  function onScroll() {
    const el = scrollElRef.current;
    if (!el) return;
    if (suppressScrollStateRef.current > 0) return;
    onScrollState?.(isNearBottom(el));
  }

  function toggleRow(key: string, row: LogEntry) {
    if (expandedKey === key) {
      setExpandedKey(null);
      setExpandedSnapshot(null);
      return;
    }
    setExpandedKey(key);
    setExpandedSnapshot({ ...row });
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
            const isError = row.level === "error";
            return (
              <button
                key={stableKey}
                type="button"
                data-index={vRow.index}
                ref={rowVirtualizer.measureElement}
                className={cn(
                  "log-line log-line--virtual",
                  isError && "log-line--virtual-error",
                  expandedKey === stableKey && "log-line--virtual-active",
                )}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${vRow.start}px)`,
                }}
                title={row.message}
                onClick={() => toggleRow(stableKey, row)}
              >
                <span className="log-line__time">{formatLogDisplayTime(row.time)}</span>
                <span
                  className={cn("log-line__lv-tag", "log-line__lv-tag--dot", `log-line__lv-tag--${row.level}`)}
                  title={row.level}
                  aria-label={row.level}
                />
                <LogScopeChips scope={row.scope} />
                <span className="log-line__msg log-line__msg--wrap">{row.message}</span>
              </button>
            );
          })}
        </div>
      </div>
      {expandedRow ? (
        <div className="log-virtual-feed__detail">
          <div className="log-virtual-feed__detail-meta">
            <span className="log-line__time">{formatLogDisplayTime(expandedRow.time)}</span>
            <span className={cn("log-line__lv-tag", `log-line__lv-tag--${expandedRow.level}`)}>
              {expandedRow.level}
            </span>
            <LogScopeChips scope={expandedRow.scope} />
            <button
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--sm log-virtual-feed__detail-close"
              onClick={() => {
                setExpandedKey(null);
                setExpandedSnapshot(null);
              }}
            >
              收起
            </button>
          </div>
          <pre className="log-virtual-feed__detail-body">{expandedRow.message}</pre>
        </div>
      ) : null}
    </div>
  );
});

export default LogVirtualFeed;
