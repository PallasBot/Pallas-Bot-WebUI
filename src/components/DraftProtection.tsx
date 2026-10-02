import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useBlocker, type Location } from "react-router-dom";
import { useConsoleConfirm } from "@/hooks/useConsoleConfirm";

export type DraftNavigation = {
  currentLocation: Location;
  nextLocation: Location;
};

type DraftSource = {
  dirty: boolean;
  shouldBlock: (transition: DraftNavigation) => boolean;
};

type DraftProtectionContextValue = {
  setSource: (id: string, source: DraftSource | null) => void;
};

const DraftProtectionContext = createContext<DraftProtectionContextValue | null>(null);

export function DraftProtectionProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<Map<string, DraftSource>>(() => new Map());
  const setSource = useCallback((id: string, source: DraftSource | null) => {
    setSources((current) => {
      const previous = current.get(id);
      if (!source) {
        if (!previous) return current;
        const next = new Map(current);
        next.delete(id);
        return next;
      }
      if (previous?.dirty === source.dirty && previous.shouldBlock === source.shouldBlock) {
        return current;
      }
      return new Map(current).set(id, source);
    });
  }, []);
  const dirty = [...sources.values()].some((source) => source.dirty);
  const contextValue = useMemo(() => ({ setSource }), [setSource]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    [...sources.values()].some(
      (source) =>
        source.dirty && source.shouldBlock({ currentLocation, nextLocation }),
    ),
  );
  const blockerRef = useRef(blocker);
  blockerRef.current = blocker;
  const pendingLocationKey = useRef("");
  const { confirm, confirmDialog } = useConsoleConfirm();

  useEffect(() => {
    if (!dirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [dirty]);

  useEffect(() => {
    if (blocker.state !== "blocked") {
      pendingLocationKey.current = "";
      return;
    }
    const key = blocker.location.key;
    if (pendingLocationKey.current === key) return;
    pendingLocationKey.current = key;
    let active = true;
    void confirm({
      title: "有未保存的配置草稿",
      subtitle: "离开将丢弃尚未保存的更改。",
      confirmLabel: "离开页面",
      confirmVariant: "default",
    }).then((accepted) => {
      if (!active) return;
      const current = blockerRef.current;
      if (current.state !== "blocked") return;
      if (accepted) current.proceed();
      else current.reset();
    });
    return () => {
      active = false;
    };
  }, [blocker.state, blocker.state === "blocked" ? blocker.location.key : "", confirm]);

  return (
    <DraftProtectionContext.Provider value={contextValue}>
      {children}
      {confirmDialog}
    </DraftProtectionContext.Provider>
  );
}

export function useDraftProtection(
  dirty: boolean,
  shouldBlock?: (transition: DraftNavigation) => boolean,
) {
  const context = useContext(DraftProtectionContext);
  const id = useId();
  const predicateRef = useRef(shouldBlock);
  predicateRef.current = shouldBlock;
  const evaluate = useCallback(
    ({ currentLocation, nextLocation }: DraftNavigation) =>
      predicateRef.current
        ? predicateRef.current({ currentLocation, nextLocation })
        : currentLocation.pathname !== nextLocation.pathname,
    [],
  );

  useLayoutEffect(() => {
    if (!context) return;
    context.setSource(id, { dirty, shouldBlock: evaluate });
  }, [context, dirty, evaluate, id]);

  useLayoutEffect(
    () => () => context?.setSource(id, null),
    [context, id],
  );
}
