import { useCallback, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  aiObservationMeta,
  aiObservationSectionFromPath,
  aiObservationSectionPath,
  type AiObservationSectionId,
} from "@/config/aiObservationSections";
import { AiObservationChromeProvider } from "@/components/ai/AiObservationChromeContext";
import { AiObservationScopeProvider } from "@/components/ai/AiObservationScopeContext";
import AiObservationChromeTools from "@/components/ai/AiObservationChromeTools";
import PageMasthead from "@/components/PageMasthead";

const SECTION_REFRESH_KEYS: Record<AiObservationSectionId, string[][]> = {
  statistics: [["llm-runtime-overview"], ["llm-task-stats"], ["llm-history-stats"]],
  session: [
    ["llm-history-sessions"],
    ["llm-history-session"],
    ["llm-history-stats"],
    ["llm-behavior-patterns"],
  ],
  tasks: [["agent-tasks"], ["agent-platform-overview"]],
  logs: [["ai-extension-logs"]],
};

/**
 * AI 观测壳：PageMasthead + ChromeTools 分段（统计/会话/任务/日志）。
 * 有分区/筛选 → 刷新在工具条右钉。
 */
export default function AiObservationLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const section = aiObservationSectionFromPath(location.pathname) ?? "statistics";
  const meta = aiObservationMeta(section);

  const onSectionChange = useCallback(
    (id: AiObservationSectionId) => {
      navigate({ pathname: aiObservationSectionPath(id), search: location.search });
    },
    [location.search, navigate],
  );

  const onRefresh = useCallback(async () => {
    const keys = SECTION_REFRESH_KEYS[section] || [];
    setRefreshing(true);
    try {
      await Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
    } finally {
      setRefreshing(false);
    }
  }, [qc, section]);

  return (
    <AiObservationScopeProvider>
      <AiObservationChromeProvider>
        <div data-ui-zone="ai-observe" className="console-hub-page w-full">
          <PageMasthead title="AI 观测" description={meta.lead} />
          <AiObservationChromeTools
            section={section}
            onSectionChange={onSectionChange}
            onRefresh={() => void onRefresh()}
            refreshing={refreshing}
          />
          <Outlet />
        </div>
      </AiObservationChromeProvider>
    </AiObservationScopeProvider>
  );
}
