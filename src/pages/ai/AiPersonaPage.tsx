import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Download, RefreshCw } from "lucide-react";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchLlmStickerLabelOverview,
  fetchLlmRepeaterSemanticStyle,
  postLlmStickerLabelManage,
  postLlmRepeaterSemanticStyleManage,
} from "@/api/console";
import {
  fetchInstances,
  fetchLlmPersonaExport,
  fetchLlmPersonaGroupStyle,
  fetchLlmPersonaObserve,
} from "@/api/fullConsole";
import type {
  GroupStyleProfileSnapshot,
  GroupExpressionProfile,
  LlmStickerLabelManageRequest,
  LlmStickerLabelOverviewData,
  PersonaAffectRefineSnapshot,
  PersonaAffectTriggerRow,
  PersonaAxisSnapshot,
  PersonaObserveBotRow,
  PersonaObserveData,
  SemanticStyleQualityData,
  SemanticStyleStatusData,
} from "@/api/pallasTypes";
import { useRegisterAiObservationChrome } from "@/components/ai/AiObservationChromeContext";
import AiScopeHint from "@/components/ai/AiScopeHint";
import {
  parseScopeBotId,
  parseScopeGroupId,
  useAiObservationScope,
} from "@/components/ai/AiObservationScopeContext";
import CopyIconButton from "@/components/CopyIconButton";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
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
import SceneDialogueExamplesCard from "./SceneDialogueExamplesCard";

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmtNum(v: unknown, digits = 2): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function fmtTime(unix: unknown): string {
  const n = Number(unix);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Date(n * 1000).toLocaleString();
}

function fmtDateTime(value: unknown): string {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toLocaleString();
  }
  return fmtTime(value);
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function Kv({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate tabular-nums text-foreground/90">{children}</span>
    </div>
  );
}

/** 轴值约 [-1, 1]：轨道从左到右，中线为零。 */
function AxisMeter({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(-1, Math.min(1, value));
  const pct = ((clamped + 1) / 2) * 100;
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium tabular-nums tracking-tight">{value.toFixed(2)}</span>
      </div>
      <div className="relative h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-1/2 z-[1] w-0.5 -translate-x-1/2 bg-foreground/45"
          aria-hidden
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary/25"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
        <div
          className="absolute top-1/2 z-[2] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-background"
          style={{ left: `${pct}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

function HintList({ hints }: { hints: string[] }) {
  if (!hints.length) {
    return <p className="text-sm text-muted-foreground">暂无行为提示</p>;
  }
  return (
    <ul className="space-y-1.5 border-l-2 border-primary/20 pl-3 text-sm leading-relaxed text-muted-foreground">
      {hints.map((h) => (
        <li key={h}>{h}</li>
      ))}
    </ul>
  );
}

function AxisPanel({
  title,
  snap,
  hints,
  empty,
}: {
  title: string;
  snap: PersonaAxisSnapshot | null | undefined;
  hints: string[];
  empty?: string;
}) {
  if (!snap) {
    return (
      <div className="rounded-lg bg-muted/40 px-3.5 py-3">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        <p className="text-sm text-muted-foreground">{empty ?? "未启用或暂无解析结果。"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 rounded-lg bg-muted/40 px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <AxisMeter label="温暖" value={num(snap.warmth)} />
        <AxisMeter label="主动" value={num(snap.assertiveness)} />
        <AxisMeter label="直率" value={num(snap.bluntness)} />
      </div>

      <div className="grid gap-x-4 gap-y-1.5 border-t border-border/50 pt-3 sm:grid-cols-2">
        <Kv label="来源">{personaValueZh(snap.source)}</Kv>
        <Kv label="接话">{fmtNum(snap.reply_bias)}</Kv>
        <Kv label="主动偏置">{fmtNum(snap.speak_bias)}</Kv>
        <Kv label="活跃">{personaValueZh(snap.activity_level)}</Kv>
      </div>

      <details className="border-t border-border/50 pt-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground">高级只读信息</summary>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          <Kv label="原型">{personaValueZh(snap.archetype)}</Kv>
          <Kv label="语气">{personaValueZh(snap.tone)}</Kv>
          <Kv label="旧混沌值">{fmtNum(snap.chaos_bias)}</Kv>
        </div>
      </details>

      <div className="border-t border-border/50 pt-3">
        <HintList hints={hints} />
      </div>
    </div>
  );
}

function BotPersonaCard({
  row,
  nickname,
}: {
  row: PersonaObserveBotRow;
  nickname?: string;
}) {
  const title = nickname?.trim() || `Bot ${row.account}`;
  const showAccountUnder = Boolean(nickname?.trim());
  const accountProfile = row.account_profile;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3.5">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold leading-tight tracking-tight">{title}</div>
          {showAccountUnder ? (
            <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">{row.account}</div>
          ) : null}
          <div className="mt-1.5 text-xs text-muted-foreground">牛牛稳定气质</div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Badge
            variant={row.group_style_enabled ? "success" : "muted"}
            className="h-5 px-1.5 text-[11px] font-normal"
          >
            {row.group_style_enabled ? "群风格开" : "群风格关"}
          </Badge>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-3 p-3 sm:p-3.5",
          row.resolved ? "sm:grid-cols-2" : "grid-cols-1",
        )}
      >
        {accountProfile ? (
          <section className="space-y-3 rounded-lg border border-border/60 px-3.5 py-3 sm:col-span-2" aria-label="牛牛稳定气质四轴">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">牛牛稳定气质</h3>
              <Badge variant="outline">来源 {personaValueZh(accountProfile.source)}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <AxisMeter label="活力" value={num(accountProfile.energy)} />
              <AxisMeter label="亲和" value={num(accountProfile.warmth)} />
              <AxisMeter label="调皮" value={num(accountProfile.mischief)} />
              <AxisMeter label="克制" value={num(accountProfile.restraint)} />
            </div>
          </section>
        ) : null}
        <AxisPanel title="基线" snap={row.base} hints={row.base_hints ?? []} />
        {row.resolved || row.group_style_enabled ? (
          <AxisPanel
            title="群内解析"
            snap={row.resolved}
            hints={row.resolved_hints ?? []}
            empty={
              row.group_style_enabled
                ? "填写群号后可查看群内解析"
                : "群风格已关闭"
            }
          />
        ) : null}
      </div>
    </div>
  );
}

function AffectBlock({
  refine,
  triggers,
}: {
  refine: PersonaAffectRefineSnapshot | null | undefined;
  triggers: PersonaAffectTriggerRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">群情感微调</CardTitle>
        <CardDescription>近期群聊对语气的修正，以及触发词。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {refine ? (
          <div className="space-y-2 rounded-md border p-3 text-sm">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{personaValueZh(refine.source)}</Badge>
              <Badge variant="outline">置信 {fmtNum(refine.confidence)}</Badge>
            </div>
            {refine.summary ? <p className="leading-relaxed text-muted-foreground">{refine.summary}</p> : null}
            <div className="grid gap-1 sm:grid-cols-2">
              <Kv label="温暖 Δ">{fmtNum(refine.warmth_delta)}</Kv>
              <Kv label="主动 Δ">{fmtNum(refine.assertiveness_delta)}</Kv>
              <Kv label="更新">{fmtTime(refine.updated_at)}</Kv>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无情感微调快照。</p>
        )}
        {triggers.length ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">触发词</div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[22rem] text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">短语</th>
                    <th className="px-3 py-2 font-medium">温暖 Δ</th>
                    <th className="px-3 py-2 font-medium">主动 Δ</th>
                    <th className="px-3 py-2 font-medium">权重</th>
                  </tr>
                </thead>
                <tbody>
                  {triggers.map((t) => (
                    <tr key={`${t.phrase}-${t.weight}`} className="border-t">
                      <td className="px-3 py-2">{t.phrase}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtNum(t.warmth_delta)}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtNum(t.assertiveness_delta)}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtNum(t.weight)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无触发词。</p>
        )}
      </CardContent>
    </Card>
  );
}

function SnapshotHints({ snap }: { snap: GroupStyleProfileSnapshot | null | undefined }) {
  if (!snap) return <p className="text-sm text-muted-foreground">暂无已落盘的群风格快照。</p>;
  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap gap-1.5">
        <Badge variant={snap.ready ? "secondary" : "outline"}>{snap.ready ? "已就绪" : "未就绪"}</Badge>
        {snap.updated_at ? <Badge variant="outline">更新 {fmtTime(snap.updated_at)}</Badge> : null}
        {snap.contamination_skipped_count ? (
          <Badge variant="outline">跳过污染 {snap.contamination_skipped_count}</Badge>
        ) : null}
      </div>
      <HintList hints={snap.hints ?? []} />
    </div>
  );
}

function GroupExpressionCard({ data }: { data: GroupExpressionProfile }) {
  const view = groupExpressionView(data);
  return (
    <div className="space-y-3">
      <div className="grid gap-x-5 gap-y-2 rounded-md border p-3 sm:grid-cols-2">
        {view.aggregate.map(([label, value]) => <Kv key={label} label={label}>{value}</Kv>)}
        <Kv label="更新时间">{fmtDateTime(data.updated_at)}</Kv>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="space-y-2 rounded-md border p-3" aria-label="回复形态">
          <h3 className="text-sm font-medium">回复形态</h3>
          <div className="grid gap-1">
            {view.replyShape.map(([label, value]) => <Kv key={label} label={label}>{value}</Kv>)}
            <Kv label="节奏">{view.rhythm}</Kv>
          </div>
        </section>
        <section className="space-y-2 rounded-md border p-3" aria-label="语义样例摘要">
          <h3 className="text-sm font-medium">语义样例摘要</h3>
          <div className="grid gap-1">
            {view.exampleSummary.map(([label, value]) => <Kv key={label} label={label}>{value}</Kv>)}
            <Kv label="强度">{view.intensity}</Kv>
            <Kv label="形式">{view.forms}</Kv>
          </div>
        </section>
      </div>
    </div>
  );
}

function StickerLabelOverview({
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
    <section className="space-y-3 border-t pt-4" aria-label="全局表情标签">
      <div>
        <h3 className="text-sm font-medium">全局表情标签</h3>
        <p className="mt-1 text-sm text-muted-foreground">跨群缓存统计；不随当前 Bot 或群范围变化。</p>
      </div>
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
        <Button
          size="sm"
          variant="outline"
          icon={RefreshCw}
          iconMotion="spin"
          disabled={busy}
          onClick={() => onManage({ action: "requeue" })}
        >
          重排陈旧标签
        </Button>
        <Button
          size="sm"
          variant={data.lazy_labels_paused ? "default" : "outline"}
          icon={Ban}
          disabled={busy}
          onClick={() => onManage({ action: "pause", paused: !data.lazy_labels_paused })}
        >
          {data.lazy_labels_paused ? "恢复懒标注" : "暂停懒标注"}
        </Button>
      </div>
      {jobs.recent_errors?.length ? (
        <p className="text-sm text-destructive">最近失败：{jobs.recent_errors.length} 条</p>
      ) : null}
    </section>
  );
}

type SemanticStyleOverrides = { aggressive: boolean; nonsense: boolean; direct: boolean; image: boolean };
type SemanticStyleAction = "overrides" | "rebuild" | "quality" | "disable";

function isSemanticStyleQuality(
  data: SemanticStyleStatusData | SemanticStyleQualityData,
): data is SemanticStyleQualityData {
  return "status" in data && "label_version" in data;
}
function SemanticStyleControls({
  data,
  qualityData,
  overrides,
  setOverrides,
  busy,
  onAction,
}: {
  data: SemanticStyleStatusData | undefined;
  qualityData: SemanticStyleQualityData | null;
  overrides: SemanticStyleOverrides;
  setOverrides: (value: SemanticStyleOverrides) => void;
  busy: boolean;
  onAction: (action: SemanticStyleAction) => void;
}) {
  const options: Array<[keyof SemanticStyleOverrides, string]> = [
    ["aggressive", "攻击性"], ["nonsense", "无厘头"], ["direct", "直给"], ["image", "图片倾向"],
  ];
  return (
    <section className="space-y-3 border-t pt-4" aria-label="群表达质量与管理">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={data?.enabled === false ? "muted" : "success"}>{data?.enabled === false ? "已停用" : "已启用"}</Badge>
        <Badge variant="outline">样例 {num(data?.example_count)}</Badge>
        <Badge variant="outline">画像 {num(data?.profile_count)}</Badge>
        <span className="text-xs text-muted-foreground">范围：当前 Bot + 当前群；未指定时不开放管理。</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {options.map(([key, label]) => (
          <label key={key} className="flex min-h-10 items-center justify-between gap-2 rounded-md border px-3 text-sm">
            <span>{label}</span>
            <Switch checked={overrides[key]} disabled={busy} onCheckedChange={(checked) => setOverrides({ ...overrides, [key]: checked })} />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => onAction("overrides")}>应用开关</Button>
        <Button size="sm" variant="outline" icon={RefreshCw} iconMotion="spin" disabled={busy} onClick={() => onAction("rebuild")}>重建</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction("quality")}>质量评价</Button>
        <Button size="sm" variant="destructive" icon={Ban} disabled={busy} onClick={() => onAction("disable")}>停用</Button>
      </div>
      {qualityData ? (
        <div className="grid gap-1 rounded-md border p-3 sm:grid-cols-2">
          {semanticStyleQualityView(qualityData).map(([label, value]) => (
            <Kv key={label} label={label}>{value}</Kv>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PromptSection({
  title,
  body,
  className,
}: {
  title: string;
  body?: string;
  className?: string;
}) {
  const text = (body || "").trim();
  if (!text) return null;
  return (
    <div
      className={cn(
        "group flex h-full min-w-0 flex-col gap-2 rounded-md border px-3 py-2.5",
        className,
      )}
    >
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">人设导出</CardTitle>
        <CardDescription>编译后发给模型的人设文本，需填写 Bot QQ。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={plainText}
          onChange={(e) => setPlainText(e.target.value)}
          placeholder="可选：用于编译的原文或触发文本"
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" icon={Download} iconMotion="down" disabled={!botReady || loading} onClick={onReload}>
            重新导出
          </Button>
        </div>
        {!botReady ? (
          <AiScopeHint>请在顶栏指定 Bot QQ。</AiScopeHint>
        ) : !bundle ? (
          <p className="text-sm text-muted-foreground">暂无导出数据。</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">schema v{String(bundle.schema_version ?? "—")}</Badge>
              <Badge variant="outline">用途 {personaValueZh(bundle.purpose || "chat")}</Badge>
              <Badge variant="outline">Bot {String(bundle.bot_id ?? "—")}</Badge>
              {bundle.group_id != null ? (
                <Badge variant="outline">群 {String(bundle.group_id)}</Badge>
              ) : null}
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
      </CardContent>
    </Card>
  );
}

export default function AiPersonaPage() {
  const qc = useQueryClient();
  const { botId, groupId } = useAiObservationScope();
  const [plainText, setPlainText] = useState("");
  const [semanticOverrides, setSemanticOverrides] = useState<SemanticStyleOverrides>({
    aggressive: false,
    nonsense: false,
    direct: false,
    image: false,
  });
  const [semanticQuality, setSemanticQuality] = useState<ScopedSemanticStyleQuality | null>(null);

  const bot = parseScopeBotId(botId) ?? 0;
  const group = parseScopeGroupId(groupId);
  const botReady = bot > 0;
  const groupReady = group != null && group > 0;

  const observeQ = useQuery({
    queryKey: ["llm-persona-observe", group, bot || null],
    queryFn: () =>
      fetchLlmPersonaObserve({
        groupId: group,
        ...(botReady ? { accounts: [bot] } : {}),
      }),
  });
  const instQ = useQuery({ queryKey: ["instances"], queryFn: () => fetchInstances() });
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
  const styleQ = useQuery({
    queryKey: ["llm-persona-group-style", bot || null, group, "group_chat"],
    enabled: groupReady,
    queryFn: () => fetchLlmPersonaGroupStyle({
      botId: botReady ? bot : undefined,
      groupId: group as number,
    }),
  });
  const semanticQ = useQuery({
    queryKey: ["llm-repeater-semantic-style", bot || null, group],
    enabled: botReady && groupReady,
    queryFn: () => fetchLlmRepeaterSemanticStyle({ botId: bot, groupId: group as number }),
  });
  const stickerLabelQ = useQuery({
    queryKey: ["llm-sticker-label-overview"],
    queryFn: () => fetchLlmStickerLabelOverview(),
  });

  useEffect(() => {
    const raw = semanticQ.data?.overrides;
    if (!raw) return;
    setSemanticOverrides({
      aggressive: raw.aggressive === true,
      nonsense: raw.nonsense === true,
      direct: raw.direct === true,
      image: raw.image === true,
    });
  }, [semanticQ.data]);

  const semanticMut = useMutation<
    SemanticStyleStatusData | SemanticStyleQualityData,
    Error,
    SemanticStyleAction
  >({
    mutationFn: (action) => {
      const body = {
        action,
        botId: bot,
        groupId: group as number,
        ...(action === "overrides" ? { overrides: semanticOverrides } : {}),
      };
      if (action === "quality") return postLlmRepeaterSemanticStyleManage({ ...body, action });
      return postLlmRepeaterSemanticStyleManage({ ...body, action });
    },
    onSuccess: async (data, action) => {
      if (action === "quality" && isSemanticStyleQuality(data)) {
        setSemanticQuality({ scopeKey: semanticStyleScopeKey(bot, group), data });
      }
      pushConsoleToast("群表达已更新", "ok");
      await qc.invalidateQueries({ queryKey: ["llm-repeater-semantic-style"] });
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

  const onRefresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["llm-persona-observe"] });
    void qc.invalidateQueries({ queryKey: ["llm-persona-export"] });
    void qc.invalidateQueries({ queryKey: ["llm-persona-group-style"] });
    void qc.invalidateQueries({ queryKey: ["llm-repeater-semantic-style"] });
    void qc.invalidateQueries({ queryKey: ["llm-sticker-label-overview"] });
    void qc.invalidateQueries({ queryKey: ["instances"] });
  }, [qc]);

  useRegisterAiObservationChrome({ onRefresh });

  const observe = observeQ.data as PersonaObserveData | undefined;
  const bots = useMemo(() => {
    const rows = observe?.bots ?? [];
    if (!botReady) return rows;
    return rows.filter((r) => r.account === bot);
  }, [bot, botReady, observe?.bots]);

  const nickByAccount = useMemo(() => {
    const map = new Map<number, string>();
    const profiles = instQ.data?.bot_profiles ?? {};
    for (const [id, profile] of Object.entries(profiles)) {
      const account = Number(id);
      const nick = profile?.nickname?.trim();
      if (Number.isFinite(account) && account > 0 && nick) map.set(account, nick);
    }
    return map;
  }, [instQ.data?.bot_profiles]);

  const styleLive = styleQ.data;

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">牛格观测</CardTitle>
          <CardDescription>情绪轴、行为提示，以及群内解析结果。</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={observeQ.isLoading} error={observeQ.error}>
            <div className="space-y-3">
              {!bots.length ? (
                <p className="text-sm text-muted-foreground">暂无 Bot 人设数据。</p>
              ) : (
                bots.map((row) => (
                  <BotPersonaCard
                    key={row.account}
                    row={row}
                    nickname={nickByAccount.get(row.account)}
                  />
                ))
              )}
              {groupReady ? (
                <AffectBlock refine={observe?.affect_refine} triggers={observe?.affect_triggers ?? []} />
              ) : (
                <AiScopeHint>请在顶栏指定群号以查看群情感微调与触发词。</AiScopeHint>
              )}
              {groupReady ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">已落盘群风格快照</div>
                  <SnapshotHints snap={observe?.group_style_snapshot} />
                </div>
              ) : null}
            </div>
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">群表达</CardTitle>
          <CardDescription>群范围统计与回复形态；语义样例和管理操作使用当前 Bot + 群范围。</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={stickerLabelQ.isLoading} error={stickerLabelQ.error}>
            {stickerLabelQ.data ? (
              <StickerLabelOverview
                data={stickerLabelQ.data}
                busy={stickerLabelMut.isPending}
                onManage={(action) => void stickerLabelMut.mutateAsync(action)}
              />
            ) : null}
          </StateBlock>
          <StateBlock loading={styleQ.isLoading} error={styleQ.error}>
            {!groupReady ? (
              <AiScopeHint>请在顶栏指定群号。</AiScopeHint>
            ) : styleLive ? (
              <div className="space-y-4">
                <GroupExpressionCard data={styleLive} />
                {botReady ? (
                  <StateBlock loading={semanticQ.isLoading} error={semanticQ.error}>
                    <SemanticStyleControls
                      data={semanticQ.data}
                      qualityData={scopedSemanticStyleQuality(semanticQuality, bot, group)}
                      overrides={semanticOverrides}
                      setOverrides={setSemanticOverrides}
                      busy={semanticMut.isPending}
                      onAction={(action) => void semanticMut.mutateAsync(action)}
                    />
                  </StateBlock>
                ) : (
                  <AiScopeHint>填写 Bot QQ 后可查看当前 Bot + 群范围的语义样例质量与管理操作。</AiScopeHint>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无画像数据。</p>
            )}
          </StateBlock>
        </CardContent>
      </Card>

      <SceneDialogueExamplesCard botId={botReady ? bot : null} />

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
    </div>
  );
}
