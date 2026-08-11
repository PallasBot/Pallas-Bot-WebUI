import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LogEntry, LogEntryLevel } from "@/api/pallasTypes";
import {
  formatLogDisplayTime,
  formatLogScopeBadge,
  logScopeBadgeColorKey,
  scopeBadgeHue,
} from "@/utils/logDisplay";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import "@/styles/log-virtual-feed.css";

export type LogVirtualFeedHandle = {
  scrollToBottom: (force?: boolean) => Promise<void>;
};

type Props = {
  rows: LogEntry[];
  followTail?: boolean;
  /** @deprecated 文档流列表不再虚拟化，保留以兼容调用方 */
  overscan?: number;
  onScrollState?: (nearBottom: boolean) => void;
};

function logLevelBadgeVariant(level: LogEntryLevel): NonNullable<BadgeProps["variant"]> {
  if (level === "success") return "success";
  if (level === "warn") return "warn";
  if (level === "error") return "danger";
  if (level === "info") return "info";
  return "neutral";
}

function stableRowKey(row: LogEntry, index: number): string {
  const id = row.id;
  if (typeof id === "number" && Number.isFinite(id) && id > 0) return `id:${id}`;
  const msg = String(row.message ?? "");
  return `c:${row.time}|${row.scope}|${row.level}|${index}|${msg.length}:${msg.slice(0, 48)}`;
}

function LogScopeChips({ scope }: { scope: string }) {
  const { label, title } = formatLogScopeBadge(scope);
  const colorKey = logScopeBadgeColorKey(scope);
  const hue = colorKey ? scopeBadgeHue(colorKey) : 0;
  return (
    <span className="log-line__scope-group" title={title || undefined}>
      {label ? (
        <Badge
          variant="outline"
          className="log-line__scope-badge"
          style={{ ["--scope-h" as string]: String(hue) }}
        >
          {label}
        </Badge>
      ) : null}
    </span>
  );
}

/** 裁掉首尾噪声换行，与 gsuid normalizeLogContent 同口径 */
function normalizeLogMessage(content: unknown): string {
  const text = typeof content === "string" ? content : String(content ?? "");
  return text.replace(/^[\r\n]+|[\r\n]+$/g, "");
}

const LogRow = memo(function LogRow({
  row,
  rowKey,
  pinned,
  onPin,
}: {
  row: LogEntry;
  rowKey: string;
  pinned: boolean;
  onPin: (key: string, row: LogEntry) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "log-line log-line--virtual",
        `log-line--virtual-${row.level}`,
        pinned && "log-line--virtual-pinned",
      )}
      title="点击固定到下方查看"
      onClick={() => onPin(rowKey, row)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPin(rowKey, row);
        }
      }}
    >
      <span className="log-line__time">{formatLogDisplayTime(row.time)}</span>
      <Badge
        variant={logLevelBadgeVariant(row.level)}
        size="compact"
        className="log-line__level-badge"
        title={row.level}
        aria-label={row.level}
      >
        {row.level}
      </Badge>
      <LogScopeChips scope={row.scope} />
      <span className="log-line__msg log-line__msg--wrap">{normalizeLogMessage(row.message)}</span>
    </div>
  );
});

const LogVirtualFeed = forwardRef<LogVirtualFeedHandle, Props>(function LogVirtualFeed(
  { rows, followTail = true, onScrollState },
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

  const pinnedRow = useMemo(() => {
    if (!pinnedKey) return null;
    const liveIdx = rowKeys.indexOf(pinnedKey);
    if (liveIdx >= 0) return rows[liveIdx] ?? null;
    return pinnedSnapshot;
  }, [rows, rowKeys, pinnedKey, pinnedSnapshot]);

  const isNearBottom = useCallback((el: HTMLElement) => {
    if (el.clientHeight < 8) return false;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    return gap <= Math.min(80, Math.max(24, Math.floor(el.clientHeight * 0.08)));
  }, []);

  const scrollToBottom = useCallback(
    async (force = false) => {
      if (!force && !followTail) return;
      await Promise.resolve();
      const el = scrollElRef.current;
      if (!el || rows.length === 0) return;
      const token = ++scrollBottomTokenRef.current;
      suppressScrollStateRef.current += 1;
      const apply = () => {
        if (token !== scrollBottomTokenRef.current) return;
        el.scrollTop = el.scrollHeight;
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
        if (frames < (laidOut ? 6 : 12) && needRetry) {
          window.requestAnimationFrame(tick);
          return;
        }
        suppressScrollStateRef.current = Math.max(0, suppressScrollStateRef.current - 1);
        if (laidOut) onScrollState?.(true);
      };
      window.requestAnimationFrame(tick);
    },
    [followTail, isNearBottom, onScrollState, rows.length],
  );

  useImperativeHandle(ref, () => ({ scrollToBottom }), [scrollToBottom]);

  useEffect(() => {
    void scrollToBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enter once
  }, []);

  useEffect(() => {
    if (followTail) void scrollToBottom(true);
  }, [rows.length, followTail, scrollToBottom]);

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

  return (
    <div className="log-virtual-feed-wrap">
      <div ref={scrollElRef} className="log-feed log-virtual-feed" onScroll={onScroll}>
        <div className="log-virtual-feed__list">
          {rows.map((row, index) => {
            const stableKey = rowKeys[index] ?? String(index);
            return (
              <LogRow
                key={stableKey}
                row={row}
                rowKey={stableKey}
                pinned={pinnedKey === stableKey}
                onPin={pinRow}
              />
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
            <Badge
              variant={logLevelBadgeVariant(pinnedRow.level)}
              size="compact"
              className="log-virtual-feed__detail-level"
            >
              {pinnedRow.level}
            </Badge>
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
          <pre className="log-virtual-feed__detail-body">{normalizeLogMessage(pinnedRow.message)}</pre>
        </div>
      ) : null}
    </div>
  );
});

export default LogVirtualFeed;
