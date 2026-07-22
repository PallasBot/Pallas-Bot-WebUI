import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { axiosErrorDetail } from "@/api/http";
import { formatTs } from "@/api/console";
import {
  fetchLlmBehaviorPatterns,
  fetchLlmBehaviorRuns,
  fetchLlmHistorySession,
  fetchLlmHistorySessions,
  postLlmBehaviorPatternUpsert,
  postLlmHistoryBehaviorAnnotate,
} from "@/api/fullConsole";
import type { LlmBehaviorPattern, LlmHistoryBehaviorRun } from "@pallas-vue/api/pallasTypes";
import { BEHAVIOR_OUTCOME_OPTIONS } from "@pallas-vue/utils/aiHistoryLabels";
import PageHeader from "@/components/PageHeader";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const BEHAVIOR_LABEL_OPTIONS = ["像人", "模板感强", "姿态不对", "带偏话题", "作为参考保留"] as const;

const EMPTY_PATTERN: LlmBehaviorPattern = {
  pattern_id: "",
  scene: "smalltalk",
  action: "ack_then_short_reply",
  scope_group_id: null,
  success_score: 0,
  manual_score: 0,
  disabled: false,
  persona_affinity: "",
  trigger_features: [],
  reference_examples: [],
};

function BehaviorAnnotateControls({
  run,
  busy,
  onSave,
}: {
  run: LlmHistoryBehaviorRun;
  busy: boolean;
  onSave: (patch: { labels?: string[]; finalOutcome?: string | null; disabled?: boolean }) => void;
}) {
  const labels = run.manual_labels ?? [];
  const hasLabel = (label: string) => labels.includes(label);

  return (
    <div className="mt-2 space-y-2 border-t pt-2 text-xs">
      <div className="flex flex-wrap gap-1">
        {BEHAVIOR_LABEL_OPTIONS.map((label) => (
          <Button
            key={label}
            size="sm"
            variant={hasLabel(label) ? "default" : "outline"}
            className="h-7 px-2 text-xs"
            disabled={busy}
            onClick={() =>
              onSave({
                labels: hasLabel(label) ? labels.filter((item) => item !== label) : [...labels, label],
              })
            }
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">结果</span>
        <select
          className="h-8 rounded-md border bg-background px-2"
          value={run.final_outcome ?? ""}
          disabled={busy}
          onChange={(e) => onSave({ finalOutcome: e.target.value || null })}
        >
          {BEHAVIOR_OUTCOME_OPTIONS.map((item) => (
            <option key={item.value || "empty"} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={Boolean(run.disabled)}
            disabled={busy}
            onChange={() => onSave({ disabled: !run.disabled })}
          />
          不参与学习
        </label>
      </div>
    </div>
  );
}

export default function AiHistoryPage() {
  const qc = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [behaviorGroup, setBehaviorGroup] = useState("");
  const [patternsGroup, setPatternsGroup] = useState("");
  const [patternEditor, setPatternEditor] = useState<LlmBehaviorPattern>(EMPTY_PATTERN);
  const [patternMsg, setPatternMsg] = useState<string | null>(null);
  const [annotateBusy, setAnnotateBusy] = useState<Record<string, boolean>>({});

  const q = useQuery({
    queryKey: ["llm-history-sessions"],
    queryFn: () => fetchLlmHistorySessions({ limit: 60 }),
  });
  const selected = (q.data?.items || []).find((s) => s.session_key === selectedKey);

  const detailQ = useQuery({
    queryKey: ["llm-history-session", selected?.bot_id, selected?.group_id, selected?.user_id],
    queryFn: () =>
      fetchLlmHistorySession({
        botId: selected!.bot_id!,
        groupId: selected?.group_id ?? null,
        userId: selected!.user_id!,
        limit: 80,
      }),
    enabled: Boolean(selected?.bot_id && selected?.user_id),
  });

  const behaviorGroupId = useMemo(() => {
    const n = Number(behaviorGroup.trim());
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [behaviorGroup]);

  const patternsGroupId = useMemo(() => {
    const n = Number(patternsGroup.trim());
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [patternsGroup]);

  const behaviorRunsQ = useQuery({
    queryKey: ["llm-behavior-runs", behaviorGroupId],
    queryFn: () => fetchLlmBehaviorRuns({ groupId: behaviorGroupId, limit: 20 }),
  });

  const patternsQ = useQuery({
    queryKey: ["llm-behavior-patterns", patternsGroupId],
    queryFn: () => fetchLlmBehaviorPatterns({ groupId: patternsGroupId }),
  });

  const annotateMut = useMutation({
    mutationFn: (args: {
      run: LlmHistoryBehaviorRun;
      patch: { labels?: string[]; finalOutcome?: string | null; disabled?: boolean };
    }) =>
      postLlmHistoryBehaviorAnnotate({
        requestId: args.run.request_id,
        labels: args.patch.labels ?? args.run.manual_labels ?? [],
        finalOutcome: args.patch.finalOutcome ?? args.run.final_outcome ?? "",
        disabled: typeof args.patch.disabled === "boolean" ? args.patch.disabled : Boolean(args.run.disabled),
      }),
    onMutate: ({ run }) => {
      setAnnotateBusy((prev) => ({ ...prev, [run.request_id]: true }));
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["llm-behavior-runs"] }),
        qc.invalidateQueries({ queryKey: ["llm-history-session"] }),
      ]);
    },
    onSettled: (_data, _err, vars) => {
      setAnnotateBusy((prev) => ({ ...prev, [vars.run.request_id]: false }));
    },
  });

  const patternMut = useMutation({
    mutationFn: () =>
      postLlmBehaviorPatternUpsert({
        ...patternEditor,
        pattern_id: patternEditor.pattern_id.trim(),
        scene: patternEditor.scene || "smalltalk",
        action: patternEditor.action || "ack_then_short_reply",
        trigger_features: [...(patternEditor.trigger_features ?? [])],
        reference_examples: [...(patternEditor.reference_examples ?? [])],
      }),
    onSuccess: async () => {
      setPatternMsg("规则已保存");
      setPatternEditor(EMPTY_PATTERN);
      await qc.invalidateQueries({ queryKey: ["llm-behavior-patterns"] });
    },
    onError: (e) => setPatternMsg(axiosErrorDetail(e)),
  });

  const sessionBehaviorRuns = detailQ.data?.behavior_runs ?? [];

  return (
    <div>
      <PageHeader
        title="AI 历史"
        description="最近会话列表；行为标注与规则维护。"
        actions={
          <Button variant="outline" size="sm" disabled={q.isFetching} onClick={() => void q.refetch()}>
            <RefreshCw className={q.isFetching ? "animate-spin" : undefined} />
            刷新
          </Button>
        }
      />

      <StateBlock loading={q.isLoading} error={q.error} empty={!q.data?.items?.length} emptyText="暂无会话">
        <div className="space-y-2">
          {(q.data?.items || []).map((s) => (
            <Card
              key={s.session_key}
              className="cursor-pointer transition-colors hover:border-primary/40"
              onClick={() => setSelectedKey(s.session_key)}
            >
              <CardContent className="space-y-2 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 font-mono text-xs text-muted-foreground">{s.session_key}</div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{s.turn_count ?? 0} 轮</Badge>
                    {s.last_role ? <Badge variant="secondary">{s.last_role}</Badge> : null}
                  </div>
                </div>
                <p className="line-clamp-2">{s.last_content || "（无摘要）"}</p>
                <div className="text-xs text-muted-foreground">
                  bot {s.bot_id ?? "—"} · group {s.group_id ?? "—"} · user {s.user_id ?? "—"} ·{" "}
                  {formatTs(s.last_created_at)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </StateBlock>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>行为运行</CardTitle>
            <CardDescription>标注 manual labels / outcome / disabled</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="群号过滤（可选）" value={behaviorGroup} onChange={(e) => setBehaviorGroup(e.target.value)} />
            <StateBlock loading={behaviorRunsQ.isLoading} error={behaviorRunsQ.error} empty={!behaviorRunsQ.data?.items?.length}>
              <div className="max-h-[24rem] space-y-2 overflow-y-auto">
                {(behaviorRunsQ.data?.items || []).map((run) => (
                  <div key={run.request_id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{run.scene || "—"}</Badge>
                      <span className="font-mono text-xs text-muted-foreground">{run.request_id.slice(0, 12)}…</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{run.user_text || "（无用户句）"}</p>
                    <BehaviorAnnotateControls
                      run={run}
                      busy={Boolean(annotateBusy[run.request_id])}
                      onSave={(patch) => void annotateMut.mutateAsync({ run, patch })}
                    />
                  </div>
                ))}
              </div>
            </StateBlock>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>行为规则</CardTitle>
            <CardDescription>postLlmBehaviorPatternUpsert</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="群号 scope（可选）" value={patternsGroup} onChange={(e) => setPatternsGroup(e.target.value)} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="pattern_id"
                value={patternEditor.pattern_id}
                onChange={(e) => setPatternEditor({ ...patternEditor, pattern_id: e.target.value })}
              />
              <Input
                placeholder="scene"
                value={patternEditor.scene}
                onChange={(e) => setPatternEditor({ ...patternEditor, scene: e.target.value })}
              />
              <Input
                placeholder="action"
                value={patternEditor.action}
                onChange={(e) => setPatternEditor({ ...patternEditor, action: e.target.value })}
              />
              <Input
                placeholder="persona_affinity"
                value={patternEditor.persona_affinity ?? ""}
                onChange={(e) => setPatternEditor({ ...patternEditor, persona_affinity: e.target.value })}
              />
            </div>
            <textarea
              className="min-h-[4rem] w-full rounded-md border bg-background p-2 font-mono text-xs"
              placeholder='trigger_features JSON 数组，如 ["feature"]'
              value={JSON.stringify(patternEditor.trigger_features ?? [])}
              onChange={(e) => {
                try {
                  setPatternEditor({ ...patternEditor, trigger_features: JSON.parse(e.target.value) as string[] });
                } catch {
                  /* keep typing */
                }
              }}
              spellCheck={false}
            />
            {patternMsg ? (
              <p className={cn("text-sm", patternMsg.includes("已保存") ? "text-emerald-400" : "text-destructive")}>
                {patternMsg}
              </p>
            ) : null}
            <Button
              size="sm"
              disabled={patternMut.isPending || !patternEditor.pattern_id.trim()}
              onClick={() => {
                setPatternMsg(null);
                void patternMut.mutateAsync();
              }}
            >
              {patternMut.isPending ? "保存中…" : "保存规则"}
            </Button>
            <StateBlock loading={patternsQ.isLoading} error={patternsQ.error} empty={!patternsQ.data?.items?.length}>
              <div className="max-h-[12rem] space-y-1 overflow-y-auto text-xs">
                {(patternsQ.data?.items || []).map((item) => (
                  <button
                    key={item.pattern_id}
                    type="button"
                    className="flex w-full items-center justify-between rounded border px-2 py-1 text-left hover:bg-muted/40"
                    onClick={() => setPatternEditor({ ...item, trigger_features: [...(item.trigger_features ?? [])], reference_examples: [...(item.reference_examples ?? [])] })}
                  >
                    <span className="font-mono">{item.pattern_id}</span>
                    <Badge variant={item.disabled ? "secondary" : "outline"}>{item.scene}</Badge>
                  </button>
                ))}
              </div>
            </StateBlock>
          </CardContent>
        </Card>
      </div>

      <Sheet open={Boolean(selectedKey)} onOpenChange={(open) => !open && setSelectedKey(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:w-[32rem] sm:max-w-[92vw]">
          <SheetHeader>
            <SheetTitle>会话详情</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <p className="break-all font-mono text-xs text-muted-foreground">{selectedKey}</p>
            <StateBlock loading={detailQ.isLoading} error={detailQ.error} empty={!detailQ.data?.turns?.length}>
              {(detailQ.data?.turns || []).map((t, i) => (
                <div key={i} className="rounded-lg border p-3 text-sm">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant={t.role === "assistant" ? "success" : "outline"}>{t.role || "—"}</Badge>
                    <span className="text-xs text-muted-foreground">{formatTs(t.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words">{t.content || ""}</p>
                </div>
              ))}
            </StateBlock>
            {sessionBehaviorRuns.length ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">会话行为运行</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {sessionBehaviorRuns.map((run) => (
                    <div key={run.request_id} className="rounded-lg border p-3 text-sm">
                      <div className="text-xs text-muted-foreground">{run.scene} · {run.request_id}</div>
                      <p className="mt-1 line-clamp-2">{run.reply_text || run.user_text || "—"}</p>
                      <BehaviorAnnotateControls
                        run={run}
                        busy={Boolean(annotateBusy[run.request_id])}
                        onSave={(patch) => void annotateMut.mutateAsync({ run, patch })}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
