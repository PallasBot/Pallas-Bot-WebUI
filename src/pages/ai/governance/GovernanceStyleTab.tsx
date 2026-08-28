import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CircleCheck, Ellipsis, Gauge, RefreshCw, Trash2, X } from "lucide-react";
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
  fetchLlmPersonaSemanticStyleExamples,
} from "@/api/fullConsole";
import { axiosErrorDetail } from "@/api/http";
import type {
  GroupStyleGovernanceData,
  LlmStickerLabelManageRequest,
  LlmStickerLabelOverviewData,
  SemanticStyleExamplesData,
  SemanticStyleQualityData,
  SemanticStyleStatusData,
} from "@/api/pallasTypes";
import { useAiGovernanceScope } from "@/components/ai/AiGovernanceScope";
import AiScopeHint from "@/components/ai/AiScopeHint";
import CollapseToggle from "@/components/CollapseToggle";
import CopyIconButton from "@/components/CopyIconButton";
import StateBlock from "@/components/StateBlock";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { copyTextToClipboard } from "@/utils/clipboard";
import { pushConsoleToast } from "@/utils/consoleToast";
import {
  groupExpressionView,
  scopedSemanticStyleQuality,
  semanticStyleQualityView,
  semanticStyleScopeKey,
  type DistSlice,
  type GroupExpressionView,
  type ScopedSemanticStyleQuality,
} from "@/utils/groupExpressionModel";
import { personaValueZh } from "@/utils/personaLabels";
import SceneDialogueExamplesCard, { sceneOptions } from "../SceneDialogueExamplesCard";

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** 千分位整数，用于统计数字。 */
function fmtInt(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : "—";
}

function fmtTime(unix: unknown): string {
  const n = Number(unix);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Date(n * 1000).toLocaleString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function Kv({ label, title, children }: { label: string; title?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className="min-w-0 truncate tabular-nums text-foreground/90"
        title={title ?? (typeof children === "string" ? children : undefined)}
      >
        {children}
      </span>
    </div>
  );
}

/** 迷你分布条：标签 + 占比条 + 数值。 */
function DistList({ slices }: { slices: DistSlice[] }) {
  return (
    <div className="space-y-1.5">
      {slices.map((slice) => (
        <div key={slice.label} className="flex items-center gap-2 text-sm">
          <span className="w-14 shrink-0 truncate text-muted-foreground" title={slice.label}>
            {slice.label}
          </span>
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.round(slice.ratio * 100)}%` }} />
          </div>
          <span className="shrink-0 tabular-nums">{slice.value}</span>
        </div>
      ))}
    </div>
  );
}

/** 防抖值：延迟同步，用于输入触发的查询。 */
function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

type SemanticStyleAction = "direct_enabled" | "rebuild" | "quality" | "disable" | "enable" | "set_governance" | "clear";
type GroupStyleAction = "collection" | "injection" | "clear" | "rebuild";
type ClearKind = "群风格" | "语义风格";

const SEMANTIC_ACTION_TOASTS: Record<SemanticStyleAction, string> = {
  direct_enabled: "直给倾向已更新",
  rebuild: "语义风格已重建",
  quality: "质量评价已完成",
  disable: "语义风格已全部停用",
  enable: "语义风格已全部启用",
  set_governance: "学习开关已更新",
  clear: "语义风格已清空",
};

const GROUP_ACTION_TOASTS: Record<GroupStyleAction, string> = {
  collection: "采集开关已更新",
  injection: "注入开关已更新",
  rebuild: "群风格已重建",
  clear: "群风格已清空",
};

function isSemanticStyleQuality(
  data: SemanticStyleStatusData | SemanticStyleQualityData,
): data is SemanticStyleQualityData {
  return "status" in data && "label_version" in data;
}

/** 行式开关：左标签+说明，右切换。 */
function ToggleRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 py-0.5 text-sm">
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer select-none font-medium">
          {label}
        </label>
        {hint ? <p className="text-xs leading-4 text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
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
  onClear: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
        <ToggleRow
          id="gov-style-tab-collection"
          label="继续采集"
          hint="关闭后不再从本群收集新的对话样本"
          checked={data?.collection_enabled !== false}
          disabled={busy}
          onChange={(value) => onAction("collection", value)}
        />
        <ToggleRow
          id="gov-style-tab-injection"
          label="参与注入"
          hint="关闭后群风格画像不进入回复提示词"
          checked={data?.injection_enabled !== false}
          disabled={busy}
          onChange={(value) => onAction("injection", value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" icon={RefreshCw} iconMotion="spin" disabled={busy} onClick={() => onAction("rebuild")}>重建</Button>
        <Button size="sm" variant="destructive" icon={Trash2} disabled={busy} onClick={onClear}>清空数据…</Button>
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
  onCloseQuality,
}: {
  data: SemanticStyleStatusData | undefined;
  qualityData: SemanticStyleQualityData | null;
  busy: boolean;
  onAction: (request: { action: SemanticStyleAction; directEnabled?: boolean; collectionEnabled?: boolean; injectionEnabled?: boolean }) => void;
  onClear: () => void;
  onCloseQuality: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">样例 {num(data?.example_count)}</Badge>
        <Badge variant="outline">画像 {num(data?.profile_count)}</Badge>
      </div>
      <div className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
        <ToggleRow
          id="gov-sem-tab-collection"
          label="继续学习"
          hint="关闭后不再收集新的语义样例"
          checked={data?.collection_enabled !== false}
          disabled={busy}
          onChange={(collectionEnabled) => onAction({ action: "set_governance", collectionEnabled })}
        />
        <ToggleRow
          id="gov-sem-tab-injection"
          label="参与注入"
          hint="关闭后语义参考不进入回复提示词"
          checked={data?.injection_enabled !== false}
          disabled={busy}
          onChange={(injectionEnabled) => onAction({ action: "set_governance", injectionEnabled })}
        />
        <ToggleRow
          id="gov-sem-tab-direct"
          label="直给倾向"
          hint="开启后回复更倾向直接给出结论"
          checked={data?.direct_enabled !== false}
          disabled={busy}
          onChange={(directEnabled) => onAction({ action: "direct_enabled", directEnabled })}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" icon={RefreshCw} iconMotion="spin" disabled={busy} onClick={() => onAction({ action: "rebuild" })}>重建</Button>
        <Button size="sm" variant="destructive" icon={Trash2} disabled={busy} onClick={onClear}>清空数据…</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" icon={Ellipsis} disabled={busy}>更多操作</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem disabled={busy} onClick={() => onAction({ action: "quality" })}>
              <Gauge className="size-4" /> 质量评价
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onClick={() => onAction({ action: "enable" })}>
              <CircleCheck className="size-4" /> 全部启用
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy} className="text-destructive focus:text-destructive" onClick={() => onAction({ action: "disable" })}>
              <Ban className="size-4" /> 全部停用
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {qualityData ? (
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium">质量评价结果</h4>
            <Button size="icon" variant="ghost" aria-label="关闭质量评价结果" onClick={onCloseQuality}>
              <X className="size-4" />
            </Button>
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            {semanticStyleQualityView(qualityData).map(([label, value]) => (
              <Kv key={label} label={label}>{value}</Kv>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SemanticStyleExamplesView({
  data,
  loading,
  error,
}: {
  data: SemanticStyleExamplesData | undefined;
  loading: boolean;
  error: unknown;
}) {
  const items = data?.items ?? [];
  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-medium">实际语义样本</h4>
        <Badge variant="outline">{data ? `${num(data.total)} 组` : "生产样本"}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">仅展示已通过语义标注的群聊接话样本。</p>
      <StateBlock loading={loading} error={error} empty={!items.length} emptyText="暂无已整理的实际语义样本。">
        <div className="space-y-2">
          {items.map((item) => {
            const strategy = item.behavior_strategy;
            const actions = item.label.interaction_actions ?? [];
            const relations = item.label.semantic_relations ?? [];
            const forms = item.label.forms ?? [];
            return (
              <article key={item.example_id} className="min-w-0 rounded-md border bg-muted/10 p-3">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="secondary">{item.pair_relation === "quoted" ? "引用接话" : "相邻接话"}</Badge>
                  {item.learning_type === "self_reflection" ? (
                    <Badge variant="outline">接话复盘</Badge>
                  ) : (
                    <Badge variant="outline">真人接话</Badge>
                  )}
                  <span className="ml-auto tabular-nums">{fmtTime(item.created_at)}</span>
                </div>
                <div className="mt-2 grid gap-2 text-sm">
                  <div className="min-w-0">
                    <span className="mr-2 text-xs text-muted-foreground">前句</span>
                    <span className="break-words">{item.trigger_text}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="mr-2 text-xs text-muted-foreground">接话</span>
                    <span className="break-words font-medium text-foreground">{item.reply_text}</span>
                  </div>
                </div>
                {(actions.length || relations.length || forms.length) ? (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                    {actions.map((value) => <Badge key={`action-${value}`} variant="outline">动作：{value}</Badge>)}
                    {relations.map((value) => <Badge key={`relation-${value}`} variant="outline">关系：{value}</Badge>)}
                    {forms.map((value) => <Badge key={`form-${value}`} variant="outline">形式：{value}</Badge>)}
                    <Badge variant="outline">强度：{item.label.intensity}</Badge>
                  </div>
                ) : null}
                {strategy ? (
                  <div className="mt-2 break-words border-t pt-2 text-xs leading-5 text-muted-foreground">
                    <span className="mr-2 font-medium text-foreground/80">策略</span>
                    {strategy.scene ? <span>{strategy.scene}</span> : null}
                    {strategy.action ? <span>：{strategy.action}</span> : null}
                    {strategy.outcome ? <span>，结果：{strategy.outcome}</span> : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </StateBlock>
    </div>
  );
}

function GroupExpressionViewCard({
  data,
}: {
  data: GroupExpressionView;
}) {
  const sceneLabel = data.exampleScene
    ? sceneOptions.find((option) => option.value === data.exampleScene)?.label ?? data.exampleScene
    : "";
  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/20 p-3 text-sm leading-6">
        <p>
          当前群的回复倾向<strong>{data.summary.length}</strong>，{data.summary.rhythm}；{data.summary.sample}。
          这些内容会作为措辞参考，不会覆盖 Bot 人设和本轮回复策略。
        </p>
        {data.lowSample ? <p className="mt-1 text-xs text-muted-foreground">样本较少，画像仅供参考。</p> : null}
      </div>
      <details className="rounded-md border px-3 py-2 text-sm">
        <summary className="cursor-pointer select-none font-medium">查看整理依据</summary>
        <p className="mt-2 text-xs text-muted-foreground">
          统计窗口：近 {data.meta.windowHours} · 更新于 {data.meta.updatedAt}
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <section className="space-y-2 rounded-md bg-muted/20 p-3" aria-label="样本与活跃">
            <h4 className="text-sm font-medium">样本与活跃</h4>
            <div className="grid gap-1">
              {data.sampleGroup.map(([label, value]) => <Kv key={label} label={label}>{value}</Kv>)}
            </div>
          </section>
          <section className="space-y-2 rounded-md bg-muted/20 p-3" aria-label="回复形态">
            <h4 className="text-sm font-medium">回复形态</h4>
            <div className="grid gap-1">
              {data.replyShape.map(([label, value]) => <Kv key={label} label={label}>{value}</Kv>)}
            </div>
            {data.rhythm.length ? (
              <div className="space-y-1.5 border-t pt-2" aria-label="节奏分布">
                <div className="text-xs text-muted-foreground">节奏</div>
                <DistList slices={data.rhythm} />
              </div>
            ) : null}
          </section>
          <section className="space-y-2 rounded-md bg-muted/20 p-3" aria-label="质量与过滤">
            <h4 className="text-sm font-medium">质量与过滤</h4>
            <div className="grid gap-1">
              {data.qualityGroup.map(([label, value]) => <Kv key={label} label={label}>{value}</Kv>)}
            </div>
          </section>
          <section className="space-y-2 rounded-md bg-muted/20 p-3" aria-label="语义样例摘要">
            <h4 className="text-sm font-medium">语义样例摘要</h4>
            {sceneLabel ? <Kv label="场景">{sceneLabel}</Kv> : null}
            <div className="grid gap-1">
              {data.exampleGroup.map(([label, value]) => <Kv key={label} label={label}>{value}</Kv>)}
            </div>
            {data.intensity.length ? (
              <div className="space-y-1.5 border-t pt-2" aria-label="语气强度分布">
                <div className="text-xs text-muted-foreground">语气强度</div>
                <DistList slices={data.intensity} />
              </div>
            ) : null}
            {data.forms.length ? (
              <div className="space-y-1.5 border-t pt-2" aria-label="形式分布">
                <div className="text-xs text-muted-foreground">形式</div>
                <DistList slices={data.forms} />
              </div>
            ) : null}
          </section>
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
  const total = num(labels.total);
  const sticker = num(labels.sticker);
  const notSticker = num(labels.not_sticker);
  const denom = sticker + notSticker;
  const stickerPct = denom > 0 ? Math.round((sticker / denom) * 100) : 0;
  const vlmAvoid = num(data.vlm_refine_avoided);
  const vlmActual = num(data.vlm_refine_actual);
  const vlmDenom = vlmAvoid + vlmActual;
  const vlmAvoidPct = vlmDenom > 0 ? Math.round((vlmAvoid / vlmDenom) * 100) : 0;
  const hasIssue =
    num(labels.low_confidence) > 0 || num(jobs.pending) > 0 || num(jobs.failed) > 0 || data.label_circuit_open;

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-md border p-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-xl font-semibold leading-none tabular-nums">{fmtInt(total)}</span>
          <span className="text-sm text-muted-foreground">已标注</span>
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">表情占 {stickerPct}%</span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="bg-primary" style={{ width: `${stickerPct}%` }} />
          <div className="bg-muted-foreground/40" style={{ width: `${Math.max(100 - stickerPct, 0)}%` }} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">表情 {fmtInt(sticker)}</Badge>
          <Badge variant="outline">非表情 {fmtInt(notSticker)}</Badge>
          {num(labels.low_confidence) > 0 ? <Badge variant="warn">低置信 {fmtInt(labels.low_confidence)}</Badge> : null}
          {num(jobs.pending) > 0 ? <Badge variant="pending">待处理 {fmtInt(jobs.pending)}</Badge> : null}
          {num(jobs.failed) > 0 ? <Badge variant="destructive">失败 {fmtInt(jobs.failed)}</Badge> : null}
          {data.label_circuit_open ? <Badge variant="warn">标签熔断中</Badge> : null}
          {data.lazy_labels_paused ? <Badge variant="muted">懒标注已暂停</Badge> : null}
          {!hasIssue ? <span className="text-xs text-muted-foreground">无低置信、待处理与失败任务</span> : null}
        </div>
      </div>
      <details className="rounded-md border px-3 py-2 text-sm">
        <summary className="cursor-pointer select-none text-muted-foreground">详细统计</summary>
        <div className="mt-2 grid gap-x-5 gap-y-3 sm:grid-cols-3">
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">标注质量</div>
            <Kv label="低置信" title="置信度较低、可能需要复核的标签">{fmtInt(labels.low_confidence)}</Kv>
            <Kv label="标签版本" title="每次全量重排后递增">v{fmtInt(labels.current_version)}</Kv>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">任务</div>
            <Kv label="待处理">{fmtInt(jobs.pending)}</Kv>
            <Kv label="失败">{fmtInt(jobs.failed)}</Kv>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">视觉精修</div>
            <Kv label="避免 / 实际" title="避免 = 本地直接判定，未调用视觉模型；实际 = 真实调用次数">
              {`${fmtInt(vlmAvoid)} / ${fmtInt(vlmActual)}`}
            </Kv>
            {vlmDenom > 0 ? (
              <>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="bg-primary" style={{ width: `${vlmAvoidPct}%` }} />
                  <div className="bg-muted-foreground/40" style={{ width: `${100 - vlmAvoidPct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">避免率 {vlmAvoidPct}%</p>
              </>
            ) : null}
            <Kv label="发送命中" title="带表情标签发送的命中次数">{fmtInt(data.send_hits)}</Kv>
          </div>
        </div>
      </details>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" icon={RefreshCw} iconMotion="spin" disabled={busy} onClick={() => onManage({ action: "requeue" })}>
          重排陈旧标签
        </Button>
        <Button size="sm" variant={data.lazy_labels_paused ? "default" : "outline"} icon={Ban} disabled={busy} onClick={() => onManage({ action: "pause", paused: !data.lazy_labels_paused })}>
          {data.lazy_labels_paused ? "恢复懒标注" : "暂停懒标注"}
        </Button>
      </div>
      {jobs.recent_errors?.length ? (
        <details className="rounded-md border border-destructive/30 px-3 py-2 text-sm">
          <summary className="cursor-pointer select-none text-destructive">最近失败：{jobs.recent_errors.length} 条</summary>
          <div className="mt-2 space-y-1.5">
            {jobs.recent_errors.slice(0, 3).map((error) => (
              <div key={error.job_id} className="rounded-md bg-muted/30 px-2.5 py-1.5">
                <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                  <span className="min-w-0 truncate">{error.job_id}</span>
                  <span className="shrink-0 tabular-nums">{fmtTime(error.created_at)}</span>
                </div>
                <p className="mt-0.5 break-words text-destructive">{error.error}</p>
                <p className="text-xs text-muted-foreground">状态：{error.state}</p>
              </div>
            ))}
          </div>
        </details>
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
  const { scope } = useAiGovernanceScope();
  const [plainText, setPlainText] = useState("");
  const [semanticQuality, setSemanticQuality] = useState<ScopedSemanticStyleQuality | null>(null);
  const [clearTarget, setClearTarget] = useState<ClearKind | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const debouncedPlainText = useDebouncedValue(plainText);

  const bot = scope?.botId ?? 0;
  const group = scope?.groupId ?? null;
  const botReady = scope != null;
  const groupReady = scope != null && scope.groupId != null;
  const scopeLabel = groupReady ? `Bot ${bot} · 群 ${group}` : `Bot ${bot}`;

  const styleQ = useQuery({
    queryKey: ["llm-persona-group-style", bot, group, "group_chat"],
    enabled: groupReady,
    queryFn: () => fetchLlmPersonaGroupStyle({ botId: bot, groupId: group as number }),
  });
  const semanticExamplesQ = useQuery({
    queryKey: ["llm-persona-semantic-style-examples", bot, group, "group_chat"],
    enabled: groupReady,
    queryFn: () => fetchLlmPersonaSemanticStyleExamples({ botId: bot, groupId: group as number, scene: "group_chat", limit: 20 }),
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
    queryKey: ["llm-persona-export", bot, group, debouncedPlainText],
    enabled: botReady && exportOpen,
    queryFn: () =>
      fetchLlmPersonaExport({
        botId: bot,
        groupId: group,
        plainText: debouncedPlainText.trim() || undefined,
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
      pushConsoleToast(SEMANTIC_ACTION_TOASTS[variables.action] ?? "群表达已更新", "ok");
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
    onSuccess: async (_data, variables) => {
      pushConsoleToast(GROUP_ACTION_TOASTS[variables.action] ?? "群风格已更新", "ok");
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

  /** 确认框内二选一：清空后继续学习，或清空并暂停学习。 */
  const runClear = (continueLearning: boolean) => {
    if (clearTarget == null) return;
    if (clearTarget === "群风格") groupGovernanceMut.mutate({ action: "clear", value: continueLearning });
    else semanticMut.mutate({ action: "clear", continueLearning });
    setClearTarget(null);
  };

  if (!botReady) {
    return <p className="mt-4 text-sm text-muted-foreground">请先选择 Bot QQ。</p>;
  }

  return (
    <div className="space-y-4">
      {groupReady ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">群风格与语义</CardTitle>
              <Badge variant="outline">{scopeLabel}</Badge>
            </div>
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
                  onClear={() => setClearTarget("群风格")}
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
                  onAction={semanticMut.mutate}
                  onClear={() => setClearTarget("语义风格")}
                  onCloseQuality={() => setSemanticQuality(null)}
                />
              </StateBlock>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium">回复习惯画像</h3>
              <StateBlock loading={styleQ.isLoading} error={styleQ.error} empty={!styleQ.data} emptyText="暂无画像数据。">
                {styleQ.data ? <GroupExpressionViewCard data={groupExpressionView(styleQ.data)} /> : null}
              </StateBlock>
              <SemanticStyleExamplesView
                data={semanticExamplesQ.data}
                loading={semanticExamplesQ.isLoading}
                error={semanticExamplesQ.error}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <AiScopeHint>请在顶部选择群号，以查看群级风格与语义。</AiScopeHint>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">全局表情标签</CardTitle>
            <Badge variant="outline">全局</Badge>
          </div>
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

      <SceneDialogueExamplesCard botId={botReady ? bot : null} defaultOpen={false} />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-base">人设导出</CardTitle>
              <CardDescription>编译后发给模型的人设文本，需填写 Bot QQ。</CardDescription>
            </div>
            <CollapseToggle open={exportOpen} onToggle={() => setExportOpen((v) => !v)} label="人设导出" />
          </div>
        </CardHeader>
        {exportOpen ? (
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
        ) : null}
      </Card>

      <AlertDialog
        open={clearTarget != null}
        onOpenChange={(next) => {
          if (!next) setClearTarget(null);
        }}
      >
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>清空{clearTarget ?? ""}</AlertDialogTitle>
            <AlertDialogDescription>
              将删除 {scopeLabel} 范围内已整理的数据，此操作不能恢复。请选择清空后的学习模式。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <Button type="button" variant="outline" className="text-destructive" icon={Trash2} iconMotion="scale" onClick={() => runClear(true)}>
              清空并继续学习
            </Button>
            <Button type="button" variant="destructive" icon={Trash2} iconMotion="scale" onClick={() => runClear(false)}>
              清空并暂停学习
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
