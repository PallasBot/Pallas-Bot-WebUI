import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AiConfigChromeSlots = {
  middle?: ReactNode;
  trailing?: ReactNode;
  /** 覆盖壳默认刷新（如接入段改为重新加载 providers） */
  onRefresh?: () => void;
};

type AiConfigChromeCtx = {
  search: string;
  setSearch: (value: string) => void;
  slots: AiConfigChromeSlots;
  setSlots: (slots: AiConfigChromeSlots) => void;
};

const AiConfigChromeContext = createContext<AiConfigChromeCtx | null>(null);

export function AiConfigChromeProvider({
  search,
  setSearch,
  children,
}: {
  search: string;
  setSearch: (value: string) => void;
  children: ReactNode;
}) {
  const [slots, setSlotsState] = useState<AiConfigChromeSlots>({});
  const setSlots = useCallback((next: AiConfigChromeSlots) => {
    setSlotsState(next);
  }, []);

  const value = useMemo(
    () => ({ search, setSearch, slots, setSlots }),
    [search, setSearch, slots, setSlots],
  );

  return <AiConfigChromeContext.Provider value={value}>{children}</AiConfigChromeContext.Provider>;
}

/** 配置壳工具条搜索；壳外使用时返回空串。 */
export function useAiConfigChromeSearch(): Pick<AiConfigChromeCtx, "search" | "setSearch"> {
  const ctx = useContext(AiConfigChromeContext);
  return ctx ?? { search: "", setSearch: () => undefined };
}

export function useAiConfigChromeSlots(): AiConfigChromeSlots {
  return useContext(AiConfigChromeContext)?.slots ?? {};
}

/**
 * 段内注册工具条 middle / trailing / onRefresh。
 * 调用方须对 middle / trailing / onRefresh 做 useMemo / useCallback，避免每渲循环。
 */
export function useRegisterAiConfigChrome(slots: AiConfigChromeSlots) {
  const setSlots = useContext(AiConfigChromeContext)?.setSlots;
  const { middle, trailing, onRefresh } = slots;
  useLayoutEffect(() => {
    if (!setSlots) return;
    setSlots({ middle, trailing, onRefresh });
    return () => setSlots({});
  }, [setSlots, middle, trailing, onRefresh]);
}
