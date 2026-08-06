import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchLlmBehaviorPatterns,
  fetchLlmBehaviorRuns,
  fetchLlmPersonaObserve,
  fetchLlmPromotionCandidates,
  fetchLlmRepeaterSemanticStyle,
  fetchLlmRuntimeDebug,
  fetchLlmRuntimeReplay,
  postLlmBehaviorPatternDelete,
  postLlmPromotionCandidateResolve,
  postLlmRepeaterSemanticStyleManage,
  postLlmRuntimeReplayRun,
} from "@/api/console";
import { Archive, Ban, Download, Eye, Play, RefreshCw, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { useRegisterAiConfigChrome } from "@/components/ai/AiConfigChromeContext";
import AiConfigSectionCard from "@/components/ai/AiConfigSectionCard";
import SegTabs from "@/components/SegTabs";
import StateBlock from "@/components/StateBlock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { preserveShellMainScroll } from "@/utils/preserveShellScroll";
import { pushConsoleToast } from "@/utils/consoleToast";

function notifyOk(message: string) {
  pushConsoleToast(message, "ok");
}

function notifyErr(message: string) {
  pushConsoleToast(message || "操作失败", "err");
}

type Panel = "samples" | "patterns" | "repeater" | "promotion" | "persona" | "debug";

type SemanticStyleOverrides = {
  aggressive: boolean;
  nonsense: boolean;
  direct: boolean;
  image: boolean;
};

const SEMANTIC_STYLE_OPTIONS: Array<{ key: keyof SemanticStyleOverrides; label: string }> = [
  { key: "aggressive", label: "攻击性" },
  { key: "nonsense", label: "无厘头" },
  { key: "direct", label: "直给" },
  { key: "image", label: "图片倾向" },
];

const PANEL_OPTIONS = [
  { value: "samples", label: "样本" },
  { value: "patterns", label: "模式" },
  { value: "repeater", label: "复读" },
  { value: "promotion", label: "入库" },
  { value: "persona", label: "牛格" },
  { value: "debug", label: "调试" },
];

export default function AiConfigBehaviorSection() {
  const qc = useQueryClient();
  const [panel, setPanel] = useState<Panel>("samples");
  const [groupId, setGroupId] = useState("0");
  const [botId, setBotId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [debugOut, setDebugOut] = useState<Record<string, unknown> | null>(null);
  const [semanticActionOut, setSemanticActionOut] = useState<Record<string, unknown> | null>(null);
  const [semanticOverrides, setSemanticOverrides] = useState<SemanticStyleOverrides>({
    aggressive: false,
    nonsense: false,
    direct: false,
    image: false,
  });

  const group = Number(groupId) || 0;
  const bot = Number(botId) || 0;
  const hasBotInput = botId.trim().length > 0;
  const hasGroupInput = groupId.trim() !== "" && groupId.trim() !== "0";
  const semanticScopeInvalid = (hasBotInput || hasGroupInput) && !(bot > 0 && group > 0);
  const semanticScope = bot > 0 && group > 0 ? { botId: bot, groupId: group } : undefined;

  const runsQ = useQuery({
    queryKey: ["llm-behavior-runs", group],
    queryFn: () => fetchLlmBehaviorRuns({ groupId: group || null, limit: 30 }),
  });
  const patternsQ = useQuery({
    queryKey: ["llm-behavior-patterns", group],
    queryFn: () => fetchLlmBehaviorPatterns({ groupId: group || null }),
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
  const semanticStyleQ = useQuery({
    queryKey: ["llm-repeater-semantic-style", semanticScope?.botId ?? null, semanticScope?.groupId ?? null],
    queryFn: () => fetchLlmRepeaterSemanticStyle(semanticScope),
    enabled: panel === "repeater" && !semanticScopeInvalid,
  });

  useEffect(() => {
    const rawOverrides = semanticStyleQ.data?.overrides;
    if (!rawOverrides || typeof rawOverrides !== "object") return;
    const overrides = rawOverrides as Partial<SemanticStyleOverrides>;
    setSemanticOverrides((current) => ({
      aggressive: typeof overrides.aggressive === "boolean" ? overrides.aggressive : current.aggressive,
      nonsense: typeof overrides.nonsense === "boolean" ? overrides.nonsense : current.nonsense,
      direct: typeof overrides.direct === "boolean" ? overrides.direct : current.direct,
      image: typeof overrides.image === "boolean" ? overrides.image : current.image,
    }));
  }, [semanticStyleQ.data]);

  const delPatternMut = useMutation({
    mutationFn: (patternId: string) => postLlmBehaviorPatternDelete(patternId),
    onSuccess: async () => {
      notifyOk("行为模式已删除");
      await qc.invalidateQueries({ queryKey: ["llm-behavior-patterns"] });
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  const semanticStyleMut = useMutation({
    mutationFn: (body: {
      action: "status" | "overrides" | "clear" | "rebuild" | "quality" | "recover" | "disable";
      overrides?: SemanticStyleOverrides;
    }) => postLlmRepeaterSemanticStyleManage({ ...body, ...semanticScope }),
    onSuccess: async (data) => {
      setSemanticActionOut(data);
      notifyOk("语义风格已更新");
      await qc.invalidateQueries({ queryKey: ["llm-repeater-semantic-style"] });
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  const promoMut = useMutation({
    mutationFn: (body: { candidateId: string; action: "promote" | "reject" }) =>
      postLlmPromotionCandidateResolve(body),
    onSuccess: async () => {
      notifyOk("候选已处理");
      await qc.invalidateQueries({ queryKey: ["llm-promotion-candidates"] });
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
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <label className="block min-w-0 space-y-1 text-sm">
            <span className="text-muted-foreground">机器人 QQ</span>
            <Input value={botId} onChange={(e) => setBotId(e.target.value)} inputMode="numeric" />
          </label>
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
            {(patternsQ.data?.items || []).map((row, i) => {
              const pid = String(row.pattern_id || row.id || "");
              return (
                <div key={i} className="flex items-start justify-between gap-2 rounded-md border p-2 text-xs">
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
          <>
          <StateBlock loading={semanticStyleQ.isLoading} error={semanticStyleQ.error}>
            <section aria-label="语义风格" className="space-y-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium">语义风格</h3>
                  <p className="text-xs text-muted-foreground">
                    {semanticScope
                      ? `机器人 ${semanticScope.botId} · 群 ${semanticScope.groupId}`
                      : "全局运行状态、开关与质量评价。"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  icon={RefreshCw}
                  iconMotion="spin"
                  iconBusy={semanticStyleQ.isFetching}
                  disabled={semanticStyleQ.isFetching || semanticStyleMut.isPending || semanticScopeInvalid}
                  onClick={() => void semanticStyleQ.refetch()}
                >
                  刷新
                </Button>
              </div>
              {semanticScopeInvalid ? (
                <p className="text-xs text-destructive">机器人 QQ 与群号需同时填写正整数，才能操作局部画像。</p>
              ) : null}
              <pre className="max-h-48 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
                {JSON.stringify(semanticStyleQ.data || {}, null, 2)}
              </pre>
              {semanticActionOut ? (
                <pre className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
                  {JSON.stringify(semanticActionOut, null, 2)}
                </pre>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {SEMANTIC_STYLE_OPTIONS.map(({ key, label }) => (
                  <label key={key} className="flex min-h-9 items-center justify-between gap-2 rounded-md border px-2 text-sm">
                    <span>{label}</span>
                    <Switch
                      checked={semanticOverrides[key]}
                      disabled={semanticStyleMut.isPending || semanticScopeInvalid}
                      onCheckedChange={(checked) =>
                        setSemanticOverrides((current) => ({ ...current, [key]: checked }))
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  icon={Sparkles}
                  disabled={semanticStyleMut.isPending || semanticScopeInvalid}
                  onClick={() => void semanticStyleMut.mutateAsync({ action: "overrides", overrides: semanticOverrides })}
                >
                  应用开关
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={RefreshCw}
                  iconMotion="spin"
                  disabled={semanticStyleMut.isPending || semanticScopeInvalid}
                  onClick={() => void semanticStyleMut.mutateAsync({ action: "rebuild" })}
                >
                  重建
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={RotateCcw}
                  iconMotion="undo"
                  disabled={semanticStyleMut.isPending || semanticScopeInvalid}
                  onClick={() => void semanticStyleMut.mutateAsync({ action: "recover" })}
                >
                  恢复
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={semanticStyleMut.isPending || semanticScopeInvalid}
                  onClick={() => void semanticStyleMut.mutateAsync({ action: "quality" })}
                >
                  质量评价
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={Trash2}
                  disabled={semanticStyleMut.isPending || semanticScopeInvalid}
                  onClick={() => void semanticStyleMut.mutateAsync({ action: "clear" })}
                >
                  清空
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  icon={Ban}
                  disabled={semanticStyleMut.isPending || semanticScopeInvalid}
                  onClick={() => void semanticStyleMut.mutateAsync({ action: "disable" })}
                >
                  停用
                </Button>
              </div>
            </section>
          </StateBlock>
          </>
        ) : null}

        {panel === "promotion" ? (
          <StateBlock loading={promoQ.isLoading} error={promoQ.error} empty={!promoQ.data?.items?.length}>
            {(promoQ.data?.items || []).map((row, i) => {
              const cid = String(row.candidate_id || row.id || "");
              return (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs">
                  <pre className="min-w-0 flex-1">{JSON.stringify(row, null, 2)}</pre>
                  {cid ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        icon={Archive}
                        onClick={() => void promoMut.mutateAsync({ candidateId: cid, action: "promote" })}
                      >
                        入库
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        icon={X}
                        iconMotion="close"
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
