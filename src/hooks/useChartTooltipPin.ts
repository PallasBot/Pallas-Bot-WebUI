import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 图表 tooltip 悬停 + 点击固定：悬停跟随指针；点击固定当前坐标，
 * 固定后再次点击面板内任意位置取消固定（不跳转），点击面板外也会取消。
 * 固定期间指针移动不改变位置。
 */
export function useChartTooltipPin() {
  const [pinned, setPinned] = useState(false);
  const [index, setIndex] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState(0);
  const [tooltipY, setTooltipY] = useState(0);
  const [below, setBelow] = useState(false);
  const pinnedRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = useCallback(
    (
      wrap: HTMLDivElement,
      clientX: number,
      clientY: number,
      forceBelow: boolean | null = null,
    ) => {
      const rect = wrap.getBoundingClientRect();
      const pad = 12;
      const nextX = Math.max(pad, Math.min(rect.width - pad, clientX - rect.left));
      const relativeY = clientY - rect.top;
      const nextBelow =
        forceBelow != null ? forceBelow : relativeY < 72;
      const nextY = nextBelow
        ? Math.min(rect.height - pad, relativeY + 8)
        : Math.max(pad, relativeY - 8);
      setTooltipX((prev) => (Math.abs(prev - nextX) < 0.5 ? prev : nextX));
      setTooltipY((prev) => (Math.abs(prev - nextY) < 0.5 ? prev : nextY));
      setBelow((prev) => (prev === nextBelow ? prev : nextBelow));
    },
    [],
  );

  const attachWrap = useCallback((wrap: HTMLDivElement | null) => {
    wrapRef.current = wrap;
  }, []);

  /** 点击图表面板外取消固定。 */
  useEffect(() => {
    if (!pinned) return;
    function onDocClick(ev: MouseEvent) {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const target = ev.target as Node | null;
      if (target && wrap.contains(target)) return;
      pinnedRef.current = false;
      setPinned(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [pinned]);

  /** 指针移动时更新 index 与位置；固定态只更新坐标不更新 index。 */
  const handlePointerMove = useCallback(
    (
      ev: React.PointerEvent,
      resolveIndex: (clientX: number, clientY: number) => number,
      wrap: HTMLDivElement | null,
    ) => {
      if (!wrap) return;
      if (!pinnedRef.current) {
        const idx = resolveIndex(ev.clientX, ev.clientY);
        setIndex(idx);
      }
      updatePosition(wrap, ev.clientX, ev.clientY);
    },
    [updatePosition],
  );

  /** 点击固定：未固定时固定当前 index；已固定时无论点击何处都取消。 */
  const handleClick = useCallback(
    (
      ev: React.MouseEvent,
      resolveIndex: (clientX: number, clientY: number) => number,
      wrap: HTMLDivElement | null,
    ) => {
      if (!wrap) return;
      if (pinnedRef.current) {
        pinnedRef.current = false;
        setPinned(false);
        return;
      }
      const idx = resolveIndex(ev.clientX, ev.clientY);
      pinnedRef.current = true;
      setPinned(true);
      setIndex(idx);
      updatePosition(wrap, ev.clientX, ev.clientY);
    },
    [updatePosition],
  );

  const handlePointerLeave = useCallback(() => {
    if (pinnedRef.current) return;
    setIndex(null);
  }, []);

  const reset = useCallback(() => {
    pinnedRef.current = false;
    setPinned(false);
    setIndex(null);
  }, []);

  return {
    index,
    pinned,
    tooltipX,
    tooltipY,
    below,
    attachWrap,
    handlePointerMove,
    handleClick,
    handlePointerLeave,
    reset,
  };
}
