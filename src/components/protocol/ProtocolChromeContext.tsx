import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ProtocolChromeSlots = {
  middle?: ReactNode;
  trailing?: ReactNode;
  onRefresh?: () => void;
};

type ProtocolChromeCtx = {
  slots: ProtocolChromeSlots;
  setSlots: (slots: ProtocolChromeSlots) => void;
};

const ProtocolChromeContext = createContext<ProtocolChromeCtx | null>(null);

export function ProtocolChromeProvider({ children }: { children: ReactNode }) {
  const [slots, setSlotsState] = useState<ProtocolChromeSlots>({});
  const setSlots = useCallback((next: ProtocolChromeSlots) => {
    setSlotsState(next);
  }, []);
  const value = useMemo(() => ({ slots, setSlots }), [slots, setSlots]);
  return (
    <ProtocolChromeContext.Provider value={value}>{children}</ProtocolChromeContext.Provider>
  );
}

export function useProtocolChromeSlots(): ProtocolChromeSlots {
  return useContext(ProtocolChromeContext)?.slots ?? {};
}

/**
 * 段内注册工具条 middle / trailing / onRefresh。
 * 调用方须对 middle / trailing / onRefresh 做 useMemo / useCallback。
 * 仅卸载时清空，避免依赖更新时先清后写触发多余渲染。
 */
export function useRegisterProtocolChrome(slots: ProtocolChromeSlots) {
  const setSlots = useContext(ProtocolChromeContext)?.setSlots;
  const { middle, trailing, onRefresh } = slots;
  useLayoutEffect(() => {
    if (!setSlots) return;
    setSlots({ middle, trailing, onRefresh });
  }, [setSlots, middle, trailing, onRefresh]);

  useLayoutEffect(() => {
    return () => setSlots?.({});
  }, [setSlots]);
}
