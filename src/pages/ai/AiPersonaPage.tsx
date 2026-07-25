import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchInstances,
  fetchLlmPersonaExport,
  fetchLlmPersonaGroupStyle,
  fetchLlmPersonaObserve,
} from "@/api/fullConsole";
import type {
  GroupStyleProfileSnapshot,
  PersonaAffectRefineSnapshot,
  PersonaAffectTriggerRow,
  PersonaAxisSnapshot,
  PersonaObserveBotRow,
  PersonaObserveData,
} from "@/api/pallasTypes";
import { useRegisterAiObservationChrome } from "@/components/ai/AiObservationChromeContext";
import AiScopeHint from "@/components/ai/AiScopeHint";
import {
  parseScopeBotId,
  parseScopeGroupId,
  useAiObservationScope,
} from "@/components/ai/AiObservationScopeContext";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { personaValueZh, personaValuesZh } from "@/utils/personaLabels";

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

  const tags = [snap.preset_label, snap.archetype, snap.tone]
    .map((t) => personaValueZh(t, ""))
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t, i, arr) => arr.indexOf(t) === i);

  return (
    <div className="space-y-3.5 rounded-lg bg-muted/40 px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {tags.map((t) => (
          <Badge key={t} variant="outline" className="h-5 border-border/60 bg-background/60 px-1.5 text-[11px] font-normal">
            {t}
          </Badge>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <AxisMeter label="温暖" value={num(snap.warmth)} />
        <AxisMeter label="主动" value={num(snap.assertiveness)} />
        <AxisMeter label="直率" value={num(snap.bluntness)} />
      </div>

      <div className="grid gap-x-4 gap-y-1.5 border-t border-border/50 pt-3 sm:grid-cols-2">
        <Kv label="来源">{personaValueZh(snap.source)}</Kv>
        <Kv label="长度">{personaValueZh(snap.length_pref)}</Kv>
        <Kv label="接话">{fmtNum(snap.reply_bias)}</Kv>
        <Kv label="主动偏置">{fmtNum(snap.speak_bias)}</Kv>
        <Kv label="混沌">{fmtNum(snap.chaos_bias)}</Kv>
        <Kv label="活跃">{personaValueZh(snap.activity_level)}</Kv>
      </div>

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

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3.5">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold leading-tight tracking-tight">{title}</div>
          {showAccountUnder ? (
            <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">{row.account}</div>
          ) : null}
          <div className="mt-1.5 text-xs text-muted-foreground">
            {row.seed_prefs?.length
              ? `偏好 ${personaValuesZh(row.seed_prefs)}`
              : "无种子偏好覆盖"}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Badge
            variant={row.group_style_enabled ? "success" : "muted"}
            className="h-5 px-1.5 text-[11px] font-normal"
          >
            {row.group_style_enabled ? "群风格开" : "群风格关"}
          </Badge>
          {row.seed_source ? (
            <Badge variant="outline" className="h-5 px-1.5 text-[11px] font-normal">
              种子 {personaValueZh(row.seed_source)}
            </Badge>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "grid gap-3 p-3 sm:p-3.5",
          row.resolved ? "sm:grid-cols-2" : "grid-cols-1",
        )}
      >
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
        <CardDescription>近期群消息对语气的修正与触发词。</CardDescription>
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

function GroupStyleLiveCard({ data }: { data: Record<string, unknown> }) {
  const sample = asRecord(data.sample);
  const raw = asRecord(data.raw);
  const derived = asRecord(data.derived);
  const affect = asRecord(raw?.affect_tone);
  const contamination = asRecord(sample?.contamination_skipped);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">窗口（小时）</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{num(sample?.window_hours)}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">消息样本</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{num(sample?.message_count)}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">回答样本</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{num(sample?.answer_count)}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">更新时间</div>
          <div className="mt-1 text-sm font-medium tabular-nums">{fmtTime(data.updated_at)}</div>
        </div>
      </div>

      {derived ? (
        <div className="space-y-2 rounded-md border p-3">
          <div className="text-sm font-medium">派生信号</div>
          <div className="grid gap-1 text-sm sm:grid-cols-2">
            <Kv label="长度偏好">{personaValueZh(derived.length_pref)}</Kv>
            <Kv label="接话倍率">{fmtNum(derived.reply_bias_mul, 3)}</Kv>
            <Kv label="主动倍率">{fmtNum(derived.speak_bias_mul, 3)}</Kv>
            <Kv label="混沌">{fmtNum(derived.chaos_bias, 3)}</Kv>
            <Kv label="温暖偏置">{fmtNum(derived.warmth_bias, 3)}</Kv>
            <Kv label="主动偏置">{fmtNum(derived.assertiveness_bias, 3)}</Kv>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">暂无派生信号。</p>
      )}

      {raw ? (
        <div className="space-y-2 rounded-md border p-3">
          <div className="text-sm font-medium">原始统计</div>
          <div className="grid gap-1 text-sm sm:grid-cols-2">
            <Kv label="均长">{fmtNum(raw.avg_plain_len)}</Kv>
            <Kv label="P50 长度">{fmtNum(raw.p50_plain_len)}</Kv>
            <Kv label="活跃条/时">{fmtNum(raw.msgs_per_hour_active)}</Kv>
            <Kv label="本地回答比">{fmtNum(raw.local_answer_ratio)}</Kv>
            <Kv label="复读链率">{fmtNum(raw.repeat_chain_rate)}</Kv>
            {affect ? <Kv label="文明分">{fmtNum(affect.civility_score)}</Kv> : null}
          </div>
          {contamination ? (
            <p className="text-xs text-muted-foreground">
              污染跳过：消息 {num(contamination.message_count)} · 回答 {num(contamination.answer_count)}
            </p>
          ) : null}
        </div>
      ) : null}

      <details className="rounded-md border px-3 py-2 text-sm">
        <summary className="cursor-pointer select-none text-muted-foreground">查看原始 JSON</summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function PromptSection({ title, body }: { title: string; body?: string }) {
  const text = (body || "").trim();
  if (!text) return null;
  return (
    <div className="space-y-1.5 rounded-md border p-3">
      <div className="text-sm font-medium">{title}</div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-muted-foreground">
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
        <CardTitle className="text-base">人设资产导出</CardTitle>
        <CardDescription>编译后发给模型的人设文本；需填写 Bot QQ。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
            <div className="console-panel-grid sm:grid-cols-2">
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
        purpose: "chat",
      }),
  });
  const styleQ = useQuery({
    queryKey: ["llm-persona-group-style", group],
    enabled: groupReady,
    queryFn: () => fetchLlmPersonaGroupStyle({ groupId: group as number }),
  });

  const onRefresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["llm-persona-observe"] });
    void qc.invalidateQueries({ queryKey: ["llm-persona-export"] });
    void qc.invalidateQueries({ queryKey: ["llm-persona-group-style"] });
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

  const styleLive = asRecord(styleQ.data);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">牛格观测</CardTitle>
          <CardDescription>情绪轴、行为提示与群内解析。</CardDescription>
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
          <CardTitle className="text-base">群风格画像</CardTitle>
          <CardDescription>根据近期群消息统计；需填写群号。</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={styleQ.isLoading} error={styleQ.error}>
            {!groupReady ? (
              <AiScopeHint>请在顶栏指定群号。</AiScopeHint>
            ) : styleLive ? (
              <GroupStyleLiveCard data={styleLive} />
            ) : (
              <p className="text-sm text-muted-foreground">暂无画像数据。</p>
            )}
          </StateBlock>
        </CardContent>
      </Card>

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
