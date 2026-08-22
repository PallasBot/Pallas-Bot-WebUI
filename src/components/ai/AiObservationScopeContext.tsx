import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";

export type AiObservationScope = {
  botId: string;
  groupId: string;
  setBotId: (value: string) => void;
  setGroupId: (value: string) => void;
};

const AiObservationScopeContext = createContext<AiObservationScope | null>(null);

export function AiObservationScopeProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();
  const [botId, setBotId] = useState(() => searchParams.get("bot") || "");
  const [groupId, setGroupId] = useState(() => searchParams.get("group") || "");
  const value = useMemo(
    () => ({ botId, groupId, setBotId, setGroupId }),
    [botId, groupId],
  );
  return (
    <AiObservationScopeContext.Provider value={value}>{children}</AiObservationScopeContext.Provider>
  );
}

export function useAiObservationScope(): AiObservationScope {
  const ctx = useContext(AiObservationScopeContext);
  if (!ctx) {
    throw new Error("useAiObservationScope must be used within AiObservationScopeProvider");
  }
  return ctx;
}

/** 解析为 API 用数字：空 / 非法 → null；群允许 0（私聊）。 */
export function parseScopeBotId(raw: string): number | null {
  const n = Number(String(raw || "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseScopeGroupId(raw: string): number | null {
  const t = String(raw || "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
