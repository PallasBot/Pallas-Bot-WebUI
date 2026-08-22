import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { parseGovernanceScope, type GovernanceScope } from "@/pages/ai/governance/governanceScope";

type AiGovernanceScopeValue = {
  botId: string;
  groupId: string;
  scope: GovernanceScope | null;
  setBotId: (value: string) => void;
  setGroupId: (value: string) => void;
};

const AiGovernanceScopeContext = createContext<AiGovernanceScopeValue | null>(null);

export function AiGovernanceScope({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const botId = params.get("bot") || "";
  const groupId = params.get("group") || "";
  const parsed = parseGovernanceScope({ bot: botId, group: groupId, scene: params.get("scene") });

  useEffect(() => {
    if (params.get("scene") === "group_chat") return;
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("scene", "group_chat");
        return next;
      },
      { replace: true },
    );
  }, [params, setParams]);

  const value = useMemo<AiGovernanceScopeValue>(
    () => ({
      botId,
      groupId,
      scope: parsed.scope,
      setBotId: (nextBotId) => {
        setParams(
          (previous) => {
            const next = new URLSearchParams(previous);
            const value = nextBotId.trim();
            if (value) next.set("bot", value);
            else next.delete("bot");
            if (value !== (previous.get("bot") || "")) next.delete("group");
            next.set("scene", "group_chat");
            return next;
          },
          { replace: true },
        );
      },
      setGroupId: (nextGroupId) => {
        setParams(
          (previous) => {
            const next = new URLSearchParams(previous);
            const value = nextGroupId.trim();
            if (value) next.set("group", value);
            else next.delete("group");
            next.set("scene", "group_chat");
            return next;
          },
          { replace: true },
        );
      },
    }),
    [botId, groupId, parsed.scope, setParams],
  );

  return <AiGovernanceScopeContext.Provider value={value}>{children}</AiGovernanceScopeContext.Provider>;
}

export function useAiGovernanceScope(): AiGovernanceScopeValue {
  const context = useContext(AiGovernanceScopeContext);
  if (!context) {
    throw new Error("useAiGovernanceScope must be used within AiGovernanceScope");
  }
  return context;
}
