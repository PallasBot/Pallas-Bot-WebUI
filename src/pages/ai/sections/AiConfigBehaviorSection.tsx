import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchLlmBehaviorPatterns,
  fetchLlmBehaviorRuns,
  fetchLlmPersonaObserve,
  fetchLlmRuntimeDebug,
  fetchLlmRuntimeReplay,
  postLlmBehaviorPatternDelete,
  postLlmRuntimeReplayRun,
} from "@/api/console";
import { Download, Eye, Play, Trash2 } from "lucide-react";
import { useRegisterAiConfigChrome } from "@/components/ai/AiConfigChromeContext";
import AiConfigSectionCard from "@/components/ai/AiConfigSectionCard";
import SegTabs from "@/components/SegTabs";
import StateBlock from "@/components/StateBlock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { preserveShellMainScroll } from "@/utils/preserveShellScroll";
import { pushConsoleToast } from "@/utils/consoleToast";

function notifyOk(message: string) {
  pushConsoleToast(message, "ok");
}

function notifyErr(message: string) {
  pushConsoleToast(message || "操作失败", "err");
}

type Panel = "samples" | "patterns" | "repeater" | "persona" | "debug";

const PANEL_OPTIONS = [
  { value: "samples", label: "样本" },
  { value: "patterns", label: "模式" },
  { value: "repeater", label: "复读" },
  { value: "persona", label: "牛格" },
  { value: "debug", label: "调试" },
];

export default function AiConfigBehaviorSection() {
  const qc = useQueryClient();
  const [panel, setPanel] = useState<Panel>("samples");
  const [groupId, setGroupId] = useState("0");
  const [requestId, setRequestId] = useState("");
  const [debugOut, setDebugOut] = useState<Record<string, unknown> | null>(null);

  const group = Number(groupId) || 0;

  const runsQ = useQuery({
    queryKey: ["llm-behavior-runs", group],
    queryFn: () => fetchLlmBehaviorRuns({ groupId: group || null, limit: 30 }),
  });
  const patternsQ = useQuery({
    queryKey: ["llm-behavior-patterns", group],
    queryFn: () => fetchLlmBehaviorPatterns({ groupId: group || null }),
  });
  const personaQ = useQuery({
    queryKey: ["llm-persona-observe", group],
    queryFn: () => fetchLlmPersonaObserve({ groupId: group || null }),
  });

  const delPatternMut = useMutation({
    mutationFn: (patternId: string) => postLlmBehaviorPatternDelete(patternId),
    onSuccess: async () => {
      notifyOk("行为模式已删除");
      await qc.invalidateQueries({ queryKey: ["llm-behavior-patterns"] });
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  const debugMut = useMutation({
    mutationFn: async (mode: "fetch" | "replay" | "run") => {
      const id = requestId.trim();
      if (!id) throw new Error("请填写请求 ID。");
      if (mode === "fetch") return fetchLlmRuntimeDebug(id);
      if (mode === "replay") return fetchLlmRuntimeReplay(id);
      return postLlmRuntimeReplayRun(id);
    },
    onSuccess: (data) => {
      setDebugOut(data);
      notifyOk("调试请求已完成");
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  const chromeMiddle = useMemo(
    () => (
      <SegTabs
        size="toolbar"
        ariaLabel="行为与调试分区"
        value={panel}
        onValueChange={(v) => {
          preserveShellMainScroll(() => setPanel(v as Panel));
        }}
        options={PANEL_OPTIONS}
      />
    ),
    [panel],
  );

  useRegisterAiConfigChrome({ middle: chromeMiddle });

  const panelMeta = PANEL_OPTIONS.find((p) => p.value === panel) || PANEL_OPTIONS[0];

  return (
    <AiConfigSectionCard title={panelMeta.label} contentClassName="space-y-3">
        <div className="grid max-w-xl gap-3 sm:grid-cols-1">
          <label className="block min-w-0 space-y-1 text-sm">
            <span className="text-muted-foreground">群号</span>
            <Input value={groupId} onChange={(e) => setGroupId(e.target.value)} inputMode="numeric" />
          </label>
        </div>

        {panel === "samples" ? (
          <StateBlock loading={runsQ.isLoading} error={runsQ.error} empty={!runsQ.data?.items?.length}>
            <pre className="max-h-48 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
              {JSON.stringify(runsQ.data?.items || [], null, 2)}
            </pre>
          </StateBlock>
        ) : null}

        {panel === "patterns" ? (
          <StateBlock loading={patternsQ.isLoading} error={patternsQ.error} empty={!patternsQ.data?.items?.length}>
            {(patternsQ.data?.items || []).map((row) => {
              const pid = String(row.pattern_id || row.id || "");
              return (
                <div key={pid} className="flex items-start justify-between gap-2 rounded-md border p-2 text-xs">
                  <pre className="min-w-0 flex-1">{JSON.stringify(row, null, 2)}</pre>
                  {pid ? (
                    <Button
                      size="sm"
                      variant="outline"
                      icon={Trash2}
                      onClick={() => {
                        void delPatternMut.mutateAsync(pid);
                      }}
                    >
                      删除
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </StateBlock>
        ) : null}

        {panel === "repeater" ? (
          <section aria-label="语义风格" className="space-y-2 rounded-md border p-3">
            <h3 className="text-sm font-medium">群表达已迁移</h3>
            <p className="text-sm text-muted-foreground">
              群画像、语义样例、质量评价和重建操作统一在 AI 治理中维护。
            </p>
            <Button asChild size="sm" variant="outline">
              <Link to="/ai/governance">前往 AI 治理</Link>
            </Button>
          </section>
        ) : null}

        {panel === "persona" ? (
          <StateBlock loading={personaQ.isLoading} error={personaQ.error}>
            <pre className="max-h-48 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
              {JSON.stringify(personaQ.data, null, 2)}
            </pre>
          </StateBlock>
        ) : null}

        {panel === "debug" ? (
          <>
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-md"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              placeholder="输入请求 ID"
            />
            <Button
              size="sm"
              variant="outline"
              icon={Download}
              iconMotion="down"
              disabled={debugMut.isPending}
              onClick={() => void debugMut.mutateAsync("fetch")}
            >
              拉取
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={Eye}
              disabled={debugMut.isPending}
              onClick={() => void debugMut.mutateAsync("replay")}
            >
              预览 replay
            </Button>
            <Button
              size="sm"
              icon={Play}
              disabled={debugMut.isPending}
              onClick={() => void debugMut.mutateAsync("run")}
            >
              执行 replay
            </Button>
          </div>
          {debugOut ? (
            <pre className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
              {JSON.stringify(debugOut, null, 2)}
            </pre>
          ) : null}
          </>
        ) : null}
    </AiConfigSectionCard>
  );
}
