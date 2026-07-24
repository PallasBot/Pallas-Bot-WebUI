import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LogEntry } from "@/api/pallasTypes";
import { formatLogDisplayTime } from "@/utils/logDisplay";
import { cn } from "@/lib/utils";

export type LogVirtualFeedHandle = {
  scrollToBottom: (force?: boolean) => Promise<void>;
};

type Props = {
  rows: LogEntry[];
  followTail?: boolean;
  rowHeight?: number;
  overscan?: number;
  onScrollState?: (nearBottom: boolean) => void;
};

function stableRowKey(row: LogEntry): string {
  const id = row.id;
  if (typeof id === "number" && Number.isFinite(id) && id > 0) return `id:${id}`;
  const msg = String(row.message ?? "");
  return `c:${row.time}|${row.scope}|${row.level}|${msg.length}:${msg.slice(0, 64)}:${msg.slice(-32)}`;
}

function previewMessage(message: string): string {
  return message.replace(/\s+/g, " ").trim();
}

const LogVirtualFeed = forwardRef<LogVirtualFeedHandle, Props>(function LogVirtualFeed(
  { rows, followTail = true, rowHeight = 34, overscan = 10, onScrollState },
  ref,
) {
  const scrollElRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(480);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandedSnapshot, setExpandedSnapshot] = useState<LogEntry | null>(null);
  const suppressScrollStateRef = useRef(0);
  const scrollBottomTokenRef = useRef(0);
  const roRef = useRef<ResizeObserver | null>(null);

  const totalHeight = Math.max(0, rows.length * rowHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(
    rows.length,
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan,
  );
  const visibleRows = useMemo(
    () =>
      rows.slice(startIndex, endIndex).map((row, i) => {
        const index = startIndex + i;
        const stableKey = stableRowKey(row);
        return { row, index, stableKey, domKey: `${stableKey}#${index}` };
      }),
    [rows, startIndex, endIndex],
  );
  const offsetY = startIndex * rowHeight;

  const expandedRow = useMemo(() => {
    if (!expandedKey) return null;
    const live = rows.find((row) => stableRowKey(row) === expandedKey);
    return live ?? expandedSnapshot;
  }, [rows, expandedKey, expandedSnapshot]);

  const scrollThreshold = useCallback((el: HTMLElement) => {
    const h = el.clientHeight;
    return Math.min(80, Math.max(24, Math.floor(h * 0.08)));
  }, []);

  const isNearBottom = useCallback(
    (el: HTMLElement) => {
      if (el.clientHeight < 8) return false;
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      const slack = Math.max(scrollThreshold(el), rowHeight * 3);
      return gap <= slack;
    },
    [rowHeight, scrollThreshold],
  );

  const scrollToBottom = useCallback(
    async (force = false) => {
      if (!force && !followTail) return;
      await Promise.resolve();
      const el = scrollElRef.current;
      if (!el) return;
      const token = ++scrollBottomTokenRef.current;
      suppressScrollStateRef.current += 1;
      const apply = () => {
        if (token !== scrollBottomTokenRef.current) return;
        const estimated = Math.max(el.scrollHeight, rows.length * rowHeight);
        el.scrollTop = Math.max(0, estimated - el.clientHeight);
        setScrollTop(el.scrollTop);
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
    [followTail, isNearBottom, onScrollState, rowHeight, rows.length],
  );

  useImperativeHandle(ref, () => ({ scrollToBottom }), [scrollToBottom]);

  // 挂载时强制贴底一次（；后续跟尾由 followTail 相关 effect 负责
  useEffect(() => {
    void scrollToBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enter once
  }, []);

  useEffect(() => {
    const el = scrollElRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    roRef.current?.disconnect();
    roRef.current = new ResizeObserver(() => {
      setViewportHeight(el.clientHeight || 480);
      if (followTail) void scrollToBottom(true);
    });
    roRef.current.observe(el);
    setViewportHeight(el.clientHeight || 480);
    return () => roRef.current?.disconnect();
  }, [followTail, scrollToBottom]);

  useEffect(() => {
    if (followTail) void scrollToBottom(true);
  }, [rows.length, followTail, scrollToBottom]);

  useEffect(() => {
    const last = rows[rows.length - 1];
    const token = last ? `${stableRowKey(last)}|${last.message.length}` : "";
    void token;
    if (followTail) void scrollToBottom(true);
  }, [rows, followTail, scrollToBottom]);

  useEffect(() => {
    if (followTail) void scrollToBottom(true);
  }, [followTail, scrollToBottom]);

  function onScroll() {
    const el = scrollElRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
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

  return (
    <div className="log-virtual-feed-wrap">
      <div ref={scrollElRef} className="log-feed log-virtual-feed" onScroll={onScroll}>
        <div className="log-virtual-feed__spacer" style={{ height: `${totalHeight}px` }}>
          <div className="log-virtual-feed__window" style={{ transform: `translateY(${offsetY}px)` }}>
            {visibleRows.map(({ row, stableKey, domKey }) => (
              <button
                key={domKey}
                type="button"
                className={cn(
                  "log-line log-line--virtual",
                  expandedKey === stableKey && "log-line--virtual-active",
                )}
                style={{ minHeight: `${rowHeight}px`, height: `${rowHeight}px` }}
                title={previewMessage(row.message)}
                onClick={() => toggleRow(stableKey, row)}
              >
                <span className="log-line__time">{formatLogDisplayTime(row.time)}</span>
                <span className={cn("log-line__lv-tag", `log-line__lv-tag--${row.level}`)}>{row.level}</span>
                {row.scope ? <span className="log-line__scope">[{row.scope}]</span> : null}
                <span className="log-line__msg log-line__msg--clip">{previewMessage(row.message)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {expandedRow ? (
        <div className="log-virtual-feed__detail">
          <div className="log-virtual-feed__detail-meta">
            <span className="log-line__time">{formatLogDisplayTime(expandedRow.time)}</span>
            <span className={cn("log-line__lv-tag", `log-line__lv-tag--${expandedRow.level}`)}>
              {expandedRow.level}
            </span>
            {expandedRow.scope ? <span className="log-line__scope">[{expandedRow.scope}]</span> : null}
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
