import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, RefreshCw, Trash2 } from "lucide-react";
import {
  fetchGroupStyleGovernance,
  fetchLlmRepeaterSemanticStyle,
  fetchLlmStickerLabelOverview,
  postGroupStyleGovernanceManage,
  postLlmRepeaterSemanticStyleManage,
  postLlmStickerLabelManage,
} from "@/api/console";
import {
  fetchLlmPersonaExport,
  fetchLlmPersonaGroupStyle,
} from "@/api/fullConsole";
import { axiosErrorDetail } from "@/api/http";
import type {
  GroupStyleGovernanceData,
  LlmStickerLabelManageRequest,
  LlmStickerLabelOverviewData,
  SemanticStyleQualityData,
  SemanticStyleStatusData,
} from "@/api/pallasTypes";
import { useAiGovernanceScope } from "@/components/ai/AiGovernanceScope";
import AiScopeHint from "@/components/ai/AiScopeHint";
import CopyIconButton from "@/components/CopyIconButton";
import StateBlock from "@/components/StateBlock";
import { useConsoleConfirm } from "@/hooks/useConsoleConfirm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { copyTextToClipboard } from "@/utils/clipboard";
import { pushConsoleToast } from "@/utils/consoleToast";
import {
  groupExpressionView,
  scopedSemanticStyleQuality,
  semanticStyleQualityView,
  semanticStyleScopeKey,
  type ScopedSemanticStyleQuality,
} from "@/utils/groupExpressionModel";
import { personaValueZh } from "@/utils/personaLabels";
import SceneDialogueExamplesCard from "../SceneDialogueExamplesCard";

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fmtTime(unix: unknown): string {
  const n = Number(unix);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Date(n * 1000).toLocaleString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function Kv({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate tabular-nums text-foreground/90">{children}</span>
    </div>
  );
}

type SemanticStyleAction = "direct_enabled" | "rebuild" | "quality" | "disable" | "enable" | "set_governance" | "clear";
type GroupStyleAction = "collection" | "injection" | "clear" | "rebuild";

function isSemanticStyleQuality(
  data: SemanticStyleStatusData | SemanticStyleQualityData,
): data is SemanticStyleQualityData {
  return "status" in data && "label_version" in data;
}

/** 行式开关：左+切换右。 */
function ToggleRow({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md border px-3 text-sm">
      <span>{label}</span>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );
}

function GroupStyleControls({
  data,
  busy,
  onAction,
  onClear,
}: {
  data: GroupStyleGovernanceData | undefined;
  busy: boolean;
  onAction: (action: GroupStyleAction, value?: boolean) => void;
  onClear: (continueLearning: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={data?.injection_enabled === false ? "muted" : "success"}>
          {data?.injection_enabled === false ? "未注入" : "正在注入"}
        </Badge>
        <Badge variant="outline">采集 {data?.collection_enabled === false ? "停用" : "启用"}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <ToggleRow
          id="gov-style-tab-collection"
          label="继续采集"
          checked={data?.collection_enabled !== false}
          disabled={busy}
          onChange={(value) => onAction("collection", value)}
        />
        <ToggleRow
          id="gov-style-tab-injection"
          label="参与注入"
          checked={data?.injection_enabled !== false}
          disabled={busy}
          onChange={(value) => onAction("injection", value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" icon={RefreshCw} iconMotion="spin" disabled={busy} onClick={() => onAction("rebuild")}>立即重建</Button>
        <Button size="sm" variant="destructive" icon={Trash2} disabled={busy} onClick={() => onClear(true)}>清空并继续学习</Button>
        <Button size="sm" variant="destructive" icon={Trash2} disabled={busy} onClick={() => onClear(false)}>清空并暂停学习</Button>
      </div>
    </div>
  );
}

function SemanticStyleControls({
  data,
  qualityData,
  busy,
  onAction,
  onClear,
}: {
  data: SemanticStyleStatusData | undefined;
  qualityData: SemanticStyleQualityData | null;
  busy: boolean;
  onAction: (request: { action: SemanticStyleAction; directEnabled?: boolean; collectionEnabled?: boolean; injectionEnabled?: boolean }) => void;
  onClear: (continueLearning: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={data?.injection_enabled === false ? "muted" : "success"}>
          {data?.injection_enabled === false ? "未注入" : "正在注入"}
        </Badge>
        <Badge variant="outline">样例 {num(data?.example_count)}</Badge>
        <Badge variant="outline">画像 {num(data?.profile_count)}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <ToggleRow
          id="gov-sem-tab-collection"
          label="继续学习"
          checked={data?.collection_enabled !== false}
          disabled={busy}
          onChange={(collectionEnabled) => onAction({ action: "set_governance", collectionEnabled })}
        />
        <ToggleRow
          id="gov-sem-tab-injection"
          label="参与注入"
          checked={data?.injection_enabled !== false}
          disabled={busy}
          onChange={(injectionEnabled) => onAction({ action: "set_governance", injectionEnabled })}
        />
        <ToggleRow
          id="gov-sem-tab-direct"
          label="直给倾向"
          checked={data?.direct_enabled !== false}
          disabled={busy}
          onChange={(directEnabled) => onAction({ action: "direct_enabled", directEnabled })}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" icon={RefreshCw} iconMotion="spin" disabled={busy} onClick={() => onAction({ action: "rebuild" })}>重建</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction({ action: "quality" })}>质量评价</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction({ action: "enable" })}>全部启用</Button>
        <Button size="sm" variant="ghost" className="text-destructive" icon={Ban} disabled={busy} onClick={() => onAction({ action: "disable" })}>全部停用</Button>
        <Button size="sm" variant="destructive" icon={Trash2} disabled={busy} onClick={() => onClear(true)}>清空并继续学习</Button>
        <Button size="sm" variant="destructive" icon={Trash2} disabled={busy} onClick={() => onClear(false)}>清空并暂停学习</Button>
      </div>
      {qualityData ? (
        <div className="grid gap-1 rounded-md border p-3 sm:grid-cols-2">
          {semanticStyleQualityView(qualityData).map(([label, value]) => (
            <Kv key={label} label={label}>{value}</Kv>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function GroupExpressionViewCard({ data }: { data: ReturnType<typeof groupExpressionView> }) {
  const replyShape = Object.fromEntries(data.replyShape) as Record<string, string>;
  const exampleSummary = Object.fromEntries(data.exampleSummary) as Record<string, string>;
  const lengthP50 = Number.parseFloat(replyShape["分段字数 P50 / P90"]?.split("/")[0] ?? "");
  const lengthSummary = Number.isFinite(lengthP50)
    ? lengthP50 <= 12 ? "偏短促" : lengthP50 <= 28 ? "适中" : "偏完整"
    : "尚未形成稳定长度偏好";
  const rhythmSummary = data.rhythm === "—" ? "节奏尚未形成稳定偏好" : `节奏偏向${data.rhythm}`;
  const sampleSummary = exampleSummary["语义样本"] && exampleSummary["语义样本"] !== "—"
    ? `已整理 ${exampleSummary["语义样本"]} 组语义样本`
    : "暂未整理出足够的语义样本";

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/20 p-3 text-sm leading-6">
        <p>
          当前群的回复倾向<strong>{lengthSummary}</strong>，{rhythmSummary}；{sampleSummary}。
          这些内容会作为措辞参考，不会覆盖 Bot 人设和本轮回复策略。
        </p>
      </div>
      <details className="rounded-md border px-3 py-2 text-sm">
        <summary className="cursor-pointer select-none font-medium">查看整理依据</summary>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <section className="space-y-2 rounded-md bg-muted/20 p-3" aria-label="回复形态">
            <h4 className="text-sm font-medium">回复形态</h4>
            <div className="grid gap-1">
              {data.replyShape.map(([label, value]) => <Kv key={label} label={label}>{value}</Kv>)}
              <Kv label="节奏">{data.rhythm}</Kv>
            </div>
          </section>
          <section className="space-y-2 rounded-md bg-muted/20 p-3" aria-label="语义样例摘要">
            <h4 className="text-sm font-medium">语义样例摘要</h4>
            <div className="grid gap-1">
              {data.exampleSummary.map(([label, value]) => <Kv key={label} label={label}>{value}</Kv>)}
              <Kv label="强度">{data.intensity}</Kv>
              <Kv label="形式">{data.forms}</Kv>
            </div>
          </section>
        </div>
        <div className="mt-3 grid gap-x-5 gap-y-1 border-t pt-3 sm:grid-cols-2">
          {data.aggregate.map(([label, value]) => <Kv key={label} label={label}>{value}</Kv>)}
        </div>
      </details>
    </div>
  );
}

function StickerLabelCard({
  data,
  busy,
  onManage,
}: {
  data: LlmStickerLabelOverviewData;
  busy: boolean;
  onManage: (action: LlmStickerLabelManageRequest) => void;
}) {
  const labels = data.labels;
  const jobs = data.jobs;
  return (
    <div className="space-y-3">
      <div className="grid gap-x-5 gap-y-2 rounded-md border p-3 sm:grid-cols-2">
        <Kv label="已标注">{labels.total}</Kv>
        <Kv label="表情">{labels.sticker}</Kv>
        <Kv label="非表情">{labels.not_sticker}</Kv>
        <Kv label="低置信">{labels.low_confidence}</Kv>
        <Kv label="待处理">{jobs.pending}</Kv>
        <Kv label="失败">{jobs.failed}</Kv>
        <Kv label="当前版本">{labels.current_version}</Kv>
        <Kv label="VLM 精修避免">{data.vlm_refine_avoided}</Kv>
        <Kv label="VLM 精修实际">{data.vlm_refine_actual}</Kv>
        <Kv label="发送命中">{data.send_hits}</Kv>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" icon={RefreshCw} iconMotion="spin" disabled={busy} onClick={() => onManage({ action: "requeue" })}>
          重排陈旧标签
        </Button>
        <Button size="sm" variant={data.lazy_labels_paused ? "default" : "outline"} icon={Ban} disabled={busy} onClick={() => onManage({ action: "pause", paused: !data.lazy_labels_paused })}>
          {data.lazy_labels_paused ? "恢复懒标注" : "暂停懒标注"}
        </Button>
      </div>
      {jobs.recent_errors?.length ? (
        <p className="text-sm text-destructive">最近失败：{jobs.recent_errors.length} 条</p>
      ) : null}
    </div>
  );
}

function PromptSection({ title, body }: { title: string; body?: string }) {
  const text = (body || "").trim();
  if (!text) return null;
  return (
    <div className="group flex h-full min-w-0 flex-col gap-2 rounded-md border px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-sm font-medium">{title}</div>
        <CopyIconButton
          label={`复制${title}`}
          className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-[560px]:opacity-100"
          onClick={async () => copyTextToClipboard(text)}
        />
      </div>
      <pre className="min-h-0 max-h-52 flex-1 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-muted-foreground">
        {text}
      </pre>
    </div>
  );
}

function ExportCard({
  data,
  botReady,
  plainText,
  setPlainText,
  onReload,
  loading,
}: {
  data: Record<string, unknown> | undefined;
  botReady: boolean;
  plainText: string;
  setPlainText: (v: string) => void;
  onReload: () => void;
  loading: boolean;
}) {
  const bundle = asRecord(data);
  const prompt = asRecord(bundle?.prompt_bundle);
  const sections = asRecord(prompt?.sections);
  const meta = asRecord(prompt?.metadata);
  return (
    <div className="space-y-3">
      <Input
        value={plainText}
        onChange={(e) => setPlainText(e.target.value)}
        placeholder="可选：用于编译的原文或触发文本"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!botReady || loading} onClick={onReload}>
          重新导出
        </Button>
      </div>
      {!botReady ? (
        <AiScopeHint>请先选择 Bot QQ。</AiScopeHint>
      ) : !bundle ? (
        <p className="text-sm text-muted-foreground">暂无导出数据。</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">schema v{String(bundle.schema_version ?? "—")}</Badge>
            <Badge variant="outline">用途 {personaValueZh(bundle.purpose || "chat")}</Badge>
            <Badge variant="outline">Bot {String(bundle.bot_id ?? "—")}</Badge>
            {bundle.group_id != null ? <Badge variant="outline">群 {String(bundle.group_id)}</Badge> : null}
            <Badge variant="outline">导出 {fmtTime(bundle.exported_at)}</Badge>
          </div>
          <PromptSection title="完整 system" body={String(prompt?.system || "")} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-stretch">
            <PromptSection title="基座" body={String(sections?.base || "")} />
            <PromptSection title="自我认同" body={String(sections?.self_identity || "")} />
            <PromptSection title="预设层" body={String(sections?.preset_layers || "")} />
            <PromptSection title="Bot 行为" body={String(sections?.bot_behavior || "")} />
            <PromptSection title="群风格" body={String(sections?.group_style || "")} />
            <PromptSection title="群表达" body={String(sections?.group_expression || "")} />
          </div>
          {meta ? (
            <div className="space-y-1 rounded-md border p-3 text-sm">
              <div className="font-medium">元数据</div>
              <div className="grid gap-1 sm:grid-cols-2">
                <Kv label="版本">{String(meta.version ?? "—")}</Kv>
                <Kv label="Bot">{String(meta.bot_id ?? "—")}</Kv>
                <Kv label="群">{meta.group_id == null ? "—" : String(meta.group_id)}</Kv>
              </div>
            </div>
          ) : null}
          <details className="rounded-md border px-3 py-2 text-sm">
            <summary className="cursor-pointer select-none text-muted-foreground">查看原始 JSON</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
              {JSON.stringify(bundle, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

/** 群风格与语义 tab：群级风格治理 + 全局表情标签 / 场景正反例 / 人设导出。 */
export default function GovernanceStyleTab() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConsoleConfirm();
  const { scope } = useAiGovernanceScope();
  const [plainText, setPlainText] = useState("");
  const [semanticQuality, setSemanticQuality] = useState<ScopedSemanticStyleQuality | null>(null);

  const bot = scope?.botId ?? 0;
  const group = scope?.groupId ?? null;
  const botReady = scope != null;
  const groupReady = scope != null && scope.groupId != null;

  const styleQ = useQuery({
    queryKey: ["llm-persona-group-style", bot, group, "group_chat"],
    enabled: groupReady,
    queryFn: () => fetchLlmPersonaGroupStyle({ botId: bot, groupId: group as number }),
  });
  const semanticQ = useQuery({
    queryKey: ["llm-repeater-semantic-style", bot, group],
    enabled: botReady && groupReady,
    queryFn: () => fetchLlmRepeaterSemanticStyle({ botId: bot, groupId: group as number, scene: "group_chat" }),
  });
  const groupGovernanceQ = useQuery({
    queryKey: ["llm-group-style-governance", bot, group],
    enabled: botReady && groupReady,
    queryFn: () => fetchGroupStyleGovernance({ botId: bot, groupId: group as number }),
  });
  const stickerLabelQ = useQuery({
    queryKey: ["llm-sticker-label-overview"],
    queryFn: () => fetchLlmStickerLabelOverview(),
  });
  const exportQ = useQuery({
    queryKey: ["llm-persona-export", bot, group, plainText],
    enabled: botReady,
    queryFn: () =>
      fetchLlmPersonaExport({
        botId: bot,
        groupId: group,
        plainText: plainText.trim() || undefined,
      }),
  });

  const semanticMut = useMutation<
    SemanticStyleStatusData | SemanticStyleQualityData,
    Error,
    { action: SemanticStyleAction; continueLearning?: boolean; directEnabled?: boolean; collectionEnabled?: boolean; injectionEnabled?: boolean }
  >({
    mutationFn: ({ action, continueLearning, directEnabled, collectionEnabled, injectionEnabled }) => {
      if (!groupReady) throw new Error("需要 Bot 与群号");
      const base = {
        botId: bot,
        groupId: group as number,
        scene: "group_chat",
      };
      if (action === "quality") {
        return postLlmRepeaterSemanticStyleManage({ ...base, action });
      }
      const body = {
        action,
        ...base,
        ...(action === "direct_enabled" ? { directEnabled } : {}),
        ...(action === "set_governance" ? {
          collectionEnabled: collectionEnabled ?? semanticQ.data?.collection_enabled ?? true,
          injectionEnabled: injectionEnabled ?? semanticQ.data?.injection_enabled ?? true,
        } : {}),
        ...(action === "clear" ? { continueLearning } : {}),
      };
      return postLlmRepeaterSemanticStyleManage(body);
    },
    onSuccess: async (data, variables) => {
      if (variables.action === "quality" && isSemanticStyleQuality(data)) {
        setSemanticQuality({ scopeKey: semanticStyleScopeKey(bot, group), data });
      }
      pushConsoleToast("群表达已更新", "ok");
      await qc.invalidateQueries({ queryKey: ["llm-repeater-semantic-style"] });
    },
    onError: (error) => pushConsoleToast(axiosErrorDetail(error), "err"),
  });
  const groupGovernanceMut = useMutation({
    mutationFn: ({ action, value }: { action: GroupStyleAction; value?: boolean }) => {
      if (!groupReady) throw new Error("需要 Bot 与群号");
      return postGroupStyleGovernanceManage({
        action,
        botId: bot,
        groupId: group as number,
        ...(action === "collection" || action === "injection" ? { enabled: value } : {}),
        ...(action === "clear" ? { continueLearning: value } : {}),
      });
    },
    onSuccess: async () => {
      pushConsoleToast("群风格已更新", "ok");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["llm-group-style-governance"] }),
        qc.invalidateQueries({ queryKey: ["llm-persona-group-style"] }),
        qc.invalidateQueries({ queryKey: ["llm-persona-observe"] }),
        qc.invalidateQueries({ queryKey: ["llm-persona-export"] }),
      ]);
    },
    onError: (error) => pushConsoleToast(axiosErrorDetail(error), "err"),
  });
  const stickerLabelMut = useMutation({
    mutationFn: postLlmStickerLabelManage,
    onSuccess: async () => {
      pushConsoleToast("表情标签维护已提交", "ok");
      await qc.invalidateQueries({ queryKey: ["llm-sticker-label-overview"] });
    },
    onError: (error) => pushConsoleToast(axiosErrorDetail(error), "err"),
  });

  const confirmClear = (kind: "群风格" | "语义风格", continueLearning: boolean): Promise<boolean> =>
    confirm({
      title: `清空${kind}`,
      subtitle: `范围为当前 Bot + 当前群。${continueLearning ? "历史记录会被删除，之后继续学习。" : "历史记录会被删除，并暂停后续学习。"}`,
      warnings: ["此操作不能恢复。"],
      confirmLabel: continueLearning ? "清空并继续学习" : "清空并暂停学习",
    });

  const handleGroupClear = (continueLearning: boolean) => {
    void confirmClear("群风格", continueLearning).then((accepted) => {
      if (accepted) groupGovernanceMut.mutate({ action: "clear", value: continueLearning });
    });
  };

  const handleSemanticAction = (request: { action: SemanticStyleAction; continueLearning?: boolean; collectionEnabled?: boolean; injectionEnabled?: boolean }) => {
    if (request.action === "clear") {
      void confirmClear("语义风格", request.continueLearning !== false).then((accepted) => {
        if (accepted) semanticMut.mutate({ action: "clear", continueLearning: request.continueLearning });
      });
      return;
    }
    semanticMut.mutate(request);
  };

  if (!botReady) {
    return <p className="mt-4 text-sm text-muted-foreground">请先选择 Bot QQ。</p>;
  }

  return (
    <div className="space-y-4">
      {groupReady ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">群风格与语义</CardTitle>
              <CardDescription>群范围表达的采集与注入开关，下方为整理出的回复习惯画像。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">群风格画像</h3>
                <StateBlock loading={groupGovernanceQ.isLoading} error={groupGovernanceQ.error}>
                  <GroupStyleControls
                    data={groupGovernanceQ.data}
                    busy={groupGovernanceMut.isPending}
                    onAction={(action, value) => {
                      if (action !== "clear") groupGovernanceMut.mutate({ action, value });
                    }}
                    onClear={handleGroupClear}
                  />
                </StateBlock>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium">语义风格</h3>
                <StateBlock loading={semanticQ.isLoading} error={semanticQ.error}>
                  <SemanticStyleControls
                    data={semanticQ.data}
                    qualityData={scopedSemanticStyleQuality(semanticQuality, bot, group)}
                    busy={semanticMut.isPending}
                    onAction={handleSemanticAction}
                    onClear={(continueLearning) => handleSemanticAction({ action: "clear", continueLearning })}
                  />
                </StateBlock>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium">回复习惯画像</h3>
                <StateBlock loading={styleQ.isLoading} error={styleQ.error} empty={!styleQ.data} emptyText="暂无画像数据。">
                  {styleQ.data ? <GroupExpressionViewCard data={groupExpressionView(styleQ.data)} /> : null}
                </StateBlock>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <AiScopeHint>请在顶部选择群号，以查看群级风格与语义。</AiScopeHint>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">全局表情标签</CardTitle>
          <CardDescription>跨群缓存统计；不随当前 Bot 或群范围变化。</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={stickerLabelQ.isLoading} error={stickerLabelQ.error}>
            {stickerLabelQ.data ? (
              <StickerLabelCard
                data={stickerLabelQ.data}
                busy={stickerLabelMut.isPending}
                onManage={(action) => void stickerLabelMut.mutate(action)}
              />
            ) : null}
          </StateBlock>
        </CardContent>
      </Card>

      <SceneDialogueExamplesCard botId={botReady ? bot : null} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">人设导出</CardTitle>
          <CardDescription>编译后发给模型的人设文本，需填写 Bot QQ。</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={exportQ.isLoading && botReady} error={exportQ.error}>
            <ExportCard
              data={asRecord(exportQ.data) ?? undefined}
              botReady={botReady}
              plainText={plainText}
              setPlainText={setPlainText}
              loading={exportQ.isFetching}
              onReload={() => void exportQ.refetch()}
            />
          </StateBlock>
        </CardContent>
      </Card>
      {confirmDialog}
    </div>
  );
}
