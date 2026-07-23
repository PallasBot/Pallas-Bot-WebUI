import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchLlmBehaviorPatterns,
  fetchLlmBehaviorRuns,
  fetchLlmPersonaObserve,
  fetchLlmPromotionCandidates,
  fetchLlmRepeaterFeedback,
  fetchLlmRepeaterFeedbackSummary,
  fetchLlmRuntimeDebug,
  fetchLlmRuntimeReplay,
  postLlmBehaviorPatternDelete,
  postLlmPromotionCandidateResolve,
  postLlmRepeaterFeedbackManage,
  postLlmRuntimeReplayRun,
} from "@/api/console";
import StateBlock from "@/components/StateBlock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function AiConfigBehaviorSection() {
  const qc = useQueryClient();
  const [groupId, setGroupId] = useState("0");
  const [requestId, setRequestId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
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
  const feedbackQ = useQuery({
    queryKey: ["llm-repeater-feedback", group],
    queryFn: () => fetchLlmRepeaterFeedback({ groupId: group, limit: 30 }),
    enabled: group > 0,
  });
  const summaryQ = useQuery({
    queryKey: ["llm-repeater-summary", group],
    queryFn: () => fetchLlmRepeaterFeedbackSummary({ groupId: group, limit: 30 }),
    enabled: group > 0,
  });
  const promoQ = useQuery({
    queryKey: ["llm-promotion-candidates", group],
    queryFn: () => fetchLlmPromotionCandidates({ groupId: group, includeResolved: true }),
    enabled: group > 0,
  });
  const personaQ = useQuery({
    queryKey: ["llm-persona-observe", group],
    queryFn: () => fetchLlmPersonaObserve({ groupId: group || null }),
  });

  const delPatternMut = useMutation({
    mutationFn: (patternId: string) => postLlmBehaviorPatternDelete(patternId),
    onSuccess: async () => {
      setMsg("模式已删除");
      await qc.invalidateQueries({ queryKey: ["llm-behavior-patterns"] });
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const feedbackMut = useMutation({
    mutationFn: (body: { entryId: string; action: "invalidate" | "restore" | "delete" }) =>
      postLlmRepeaterFeedbackManage(body),
    onSuccess: async () => {
      setMsg("复读反馈已更新");
      await qc.invalidateQueries({ queryKey: ["llm-repeater-feedback"] });
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const promoMut = useMutation({
    mutationFn: (body: { candidateId: string; action: "promote" | "reject" }) =>
      postLlmPromotionCandidateResolve(body),
    onSuccess: async () => {
      setMsg("候选已处理");
      await qc.invalidateQueries({ queryKey: ["llm-promotion-candidates"] });
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const debugMut = useMutation({
    mutationFn: async (mode: "fetch" | "replay" | "run") => {
      const id = requestId.trim();
      if (!id) throw new Error("请填写 request_id");
      if (mode === "fetch") return fetchLlmRuntimeDebug(id);
      if (mode === "replay") return fetchLlmRuntimeReplay(id);
      return postLlmRuntimeReplayRun(id);
    },
    onSuccess: (data) => {
      setDebugOut(data);
      setMsg("调试请求完成");
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  return (
    <div className="space-y-4">
      {msg ? (
        <p className={cn("text-sm", /完成|已/.test(msg) ? "text-emerald-400" : "text-destructive")}>{msg}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>行为与调试</CardTitle>
          <CardDescription>patterns / runs / repeater / persona / runtime-debug；用顶部工具条刷新。</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="block max-w-xs space-y-1 text-sm">
            <span className="text-muted-foreground">group_id</span>
            <Input value={groupId} onChange={(e) => setGroupId(e.target.value)} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>行为样本 runs</CardTitle>
        </CardHeader>
        <CardContent>
          <StateBlock loading={runsQ.isLoading} error={runsQ.error} empty={!runsQ.data?.items?.length}>
            <pre className="max-h-48 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
              {JSON.stringify(runsQ.data?.items || [], null, 2)}
            </pre>
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>行为模式 patterns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <StateBlock loading={patternsQ.isLoading} error={patternsQ.error} empty={!patternsQ.data?.items?.length}>
            {(patternsQ.data?.items || []).map((row, i) => {
              const pid = String(row.pattern_id || row.id || "");
              return (
                <div key={i} className="flex items-start justify-between gap-2 rounded-md border p-2 text-xs">
                  <pre className="min-w-0 flex-1">{JSON.stringify(row, null, 2)}</pre>
                  {pid ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setMsg(null);
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>复读反馈</CardTitle>
          <CardDescription>summary + manage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <StateBlock loading={summaryQ.isLoading} error={summaryQ.error} empty={group <= 0} emptyText="请填写 group_id">
            <pre className="max-h-24 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
              {JSON.stringify(summaryQ.data, null, 2)}
            </pre>
          </StateBlock>
          <StateBlock loading={feedbackQ.isLoading} error={feedbackQ.error} empty={!feedbackQ.data?.items?.length}>
            {(feedbackQ.data?.items || []).slice(0, 10).map((row, i) => {
              const entryId = String(row.entry_id || row.id || "");
              return (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs">
                  <span className="font-mono">{entryId || `#${i}`}</span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => entryId && void feedbackMut.mutateAsync({ entryId, action: "invalidate" })}
                    >
                      作废
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => entryId && void feedbackMut.mutateAsync({ entryId, action: "delete" })}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              );
            })}
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>升格候选</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <StateBlock loading={promoQ.isLoading} error={promoQ.error} empty={!promoQ.data?.items?.length}>
            {(promoQ.data?.items || []).map((row, i) => {
              const cid = String(row.candidate_id || row.id || "");
              return (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs">
                  <pre className="min-w-0 flex-1">{JSON.stringify(row, null, 2)}</pre>
                  {cid ? (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => void promoMut.mutateAsync({ candidateId: cid, action: "promote" })}>
                        升格
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void promoMut.mutateAsync({ candidateId: cid, action: "reject" })}
                      >
                        拒绝
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>牛格观测 persona-observe</CardTitle>
        </CardHeader>
        <CardContent>
          <StateBlock loading={personaQ.isLoading} error={personaQ.error}>
            <pre className="max-h-48 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
              {JSON.stringify(personaQ.data, null, 2)}
            </pre>
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>运行时调试 replay</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-md"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              placeholder="request_id"
            />
            <Button size="sm" variant="outline" disabled={debugMut.isPending} onClick={() => void debugMut.mutateAsync("fetch")}>
              拉取
            </Button>
            <Button size="sm" variant="outline" disabled={debugMut.isPending} onClick={() => void debugMut.mutateAsync("replay")}>
              预览 replay
            </Button>
            <Button size="sm" disabled={debugMut.isPending} onClick={() => void debugMut.mutateAsync("run")}>
              执行 replay
            </Button>
          </div>
          {debugOut ? (
            <pre className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
              {JSON.stringify(debugOut, null, 2)}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
