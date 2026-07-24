import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type AiObservationChromeSlots = {
  middle?: ReactNode;
  trailing?: ReactNode;
  onRefresh?: () => void;
};

type AiObservationChromeCtx = {
  slots: AiObservationChromeSlots;
  setSlots: (slots: AiObservationChromeSlots) => void;
};

const AiObservationChromeContext = createContext<AiObservationChromeCtx | null>(null);

export function AiObservationChromeProvider({ children }: { children: ReactNode }) {
  const [slots, setSlotsState] = useState<AiObservationChromeSlots>({});
  const setSlots = useCallback((next: AiObservationChromeSlots) => {
    setSlotsState((prev) => {
      if (
        prev.middle === next.middle &&
        prev.trailing === next.trailing &&
        prev.onRefresh === next.onRefresh
      ) {
        return prev;
      }
      return next;
    });
  }, []);
  const value = useMemo(() => ({ slots, setSlots }), [slots, setSlots]);
  return (
    <AiObservationChromeContext.Provider value={value}>{children}</AiObservationChromeContext.Provider>
  );
}

export function useAiObservationChromeSlots(): AiObservationChromeSlots {
  return useContext(AiObservationChromeContext)?.slots ?? {};
}

/**
 * 段内注册工具条 middle / trailing / onRefresh。
 * onRefresh 经 ref 稳定，避免 useQuery 结果对象变更导致 setSlots 死循环（白屏）。
 */
export function useRegisterAiObservationChrome(slots: AiObservationChromeSlots) {
  const setSlots = useContext(AiObservationChromeContext)?.setSlots;
  const { middle, trailing, onRefresh } = slots;
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const stableRefresh = useCallback(() => {
    onRefreshRef.current?.();
  }, []);

  const hasRefresh = Boolean(onRefresh);

  useLayoutEffect(() => {
    if (!setSlots) return;
    setSlots({
      middle,
      trailing,
      onRefresh: hasRefresh ? stableRefresh : undefined,
    });
    return () => setSlots({});
  }, [setSlots, middle, trailing, hasRefresh, stableRefresh]);
}
