import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clipboard, Eye, EyeOff, Play, RotateCcw, Save } from "lucide-react";
import {
  fetchLlmPromptOverrides,
  fetchLlmPromptPreview,
  saveLlmPromptOverrides,
  type PromptPreviewData,
  type PromptPreviewSection,
  type PromptSectionOverride,
} from "@/api/console";
import { axiosErrorDetail } from "@/api/http";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { pushConsoleToast } from "@/utils/consoleToast";
import { useAiGovernanceScope } from "@/components/ai/AiGovernanceScope";

function sectionPrompt(
  sections: PromptPreviewSection[],
  included: Set<string>,
  drafts: Record<string, PromptSectionOverride>,
): string {
  return sections
    .filter((section) => section.active && included.has(section.id))
    .map((section) => {
      const draft = drafts[section.id];
      if (!draft || draft.mode === "replace") return draft?.content ?? section.content;
      if (draft.mode === "disable") return "";
      return [section.content, draft.content].filter(Boolean).join("\n\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function PromptSection({
  section,
  included,
  onToggle,
  draft,
  onDraftChange,
  onSave,
  saving,
}: {
  section: PromptPreviewSection;
  included: boolean;
  onToggle: () => void;
  draft: PromptSectionOverride;
  onDraftChange: (draft: PromptSectionOverride) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const copy = async () => {
    await navigator.clipboard?.writeText(section.content);
    pushConsoleToast("已复制片段", "ok");
  };
  return (
    <article className="ai-governance-prompt-section">
      <div className="ai-governance-prompt-section__header">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-medium">{section.title}</h3>
            <code className="shrink-0 text-[10px] text-muted-foreground">{section.id}</code>
          </div>
          <p className="truncate text-xs text-muted-foreground">来源：{section.source}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className={section.active ? "text-xs text-emerald-600" : "text-xs text-muted-foreground"}>
            {section.active ? "已注入" : "未注入"}
          </span>
          {section.active && (
            <Button type="button" size="icon" variant="ghost" aria-label={included ? `从预览移除${section.title}` : `加入预览${section.title}`} onClick={onToggle}>
              {included ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </Button>
          )}
        </div>
      </div>
      {section.active && included && (
        <div className="ai-governance-prompt-section__body">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={draft.mode === "disable" ? "muted" : "info"}>
              {draft.mode === "disable" ? "本段不注入" : "本段可编辑"}
            </Badge>
            <span className="text-xs text-muted-foreground">保存后影响当前 Bot+群的实际 Prompt</span>
          </div>
          <fieldset className="ai-governance-prompt-section__modes">
            <legend className="text-xs font-medium text-muted-foreground">保存方式</legend>
            {([
              ["replace", "替换原片段", "完全使用下面的内容"],
              ["append", "追加到原片段", "保留原片段，再接上下面的内容"],
              ["disable", "不注入本段", "发送给模型时跳过这一段"],
            ] as const).map(([value, label, description]) => (
              <label key={value} className={`ai-governance-prompt-section__mode${draft.mode === value ? " is-selected" : ""}`}>
                <input
                  type="radio"
                  name={`${section.id}-override-mode`}
                  value={value}
                  checked={draft.mode === value}
                  onChange={() => onDraftChange({ ...draft, mode: value })}
                />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <Textarea
            aria-label={`${section.title}覆盖内容`}
            rows={6}
            value={draft.content}
            disabled={draft.mode === "disable"}
            placeholder={draft.mode === "append" ? "追加给模型的规则或上下文" : "输入保存后要发送给模型的本段内容"}
            onChange={(event) => onDraftChange({ ...draft, content: event.target.value })}
          />
          <details className="ai-governance-prompt-section__original">
            <summary>查看本轮原始片段</summary>
            <pre>{section.content || "本轮没有检索到内容。"}</pre>
          </details>
          <div className="ai-governance-prompt-section__actions">
            <Button type="button" size="sm" icon={Save} disabled={saving} onClick={onSave}>
              {saving ? "保存中…" : `保存${section.title}覆盖`}
            </Button>
            <Button type="button" size="sm" variant="ghost" icon={Clipboard} onClick={copy}>复制原片段</Button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function GovernancePipelineTab() {
  const { scope } = useAiGovernanceScope();
  const botReady = scope != null;
  const groupReady = scope?.groupId != null;
  const [userId, setUserId] = useState("");
  const [queryText, setQueryText] = useState("");
  const [preview, setPreview] = useState<PromptPreviewData | null>(null);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, PromptSectionOverride>>({});
  const queryClient = useQueryClient();
  const overridesQ = useQuery({
    queryKey: ["prompt-overrides", scope?.botId, scope?.groupId],
    queryFn: () => fetchLlmPromptOverrides({ botId: scope!.botId, groupId: scope!.groupId! }),
    enabled: groupReady,
  });
  const previewMut = useMutation({
    mutationFn: () => {
      if (!scope || scope.groupId == null) throw new Error("请先选择群号");
      const parsedUserId = Number(userId);
      if (!Number.isInteger(parsedUserId) || parsedUserId < 1) throw new Error("请输入有效的用户 QQ");
      if (!queryText.trim()) throw new Error("请输入一条模拟消息");
      return fetchLlmPromptPreview({ botId: scope.botId, groupId: scope.groupId, userId: parsedUserId, queryText: queryText.trim() });
    },
    onSuccess: (data) => {
      setPreview(data);
      setIncluded(new Set(data.sections.filter((section) => section.active).map((section) => section.id)));
      setDrafts(Object.fromEntries(data.sections.map((section) => [
        section.id,
        overridesQ.data?.[section.id] ?? { mode: "replace", content: section.content },
      ])));
    },
    onError: (error) => pushConsoleToast(axiosErrorDetail(error) || (error instanceof Error ? error.message : "预览失败"), "err"),
  });
  const overrideMut = useMutation({
    mutationFn: (section: { id: string; override: PromptSectionOverride }) => {
      if (!scope || scope.groupId == null) throw new Error("请先选择群号");
      return saveLlmPromptOverrides({ botId: scope.botId, groupId: scope.groupId, sections: { [section.id]: section.override } });
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["prompt-overrides", scope?.botId, scope?.groupId], (current: Record<string, PromptSectionOverride> | undefined) => ({
        ...(current ?? {}),
        ...(data[variables.id] ? { [variables.id]: data[variables.id] } : { [variables.id]: variables.override }),
      }));
      setDrafts((current) => ({ ...current, [variables.id]: data[variables.id] ?? variables.override }));
      pushConsoleToast("Prompt 覆盖已保存", "ok");
    },
    onError: (error) => pushConsoleToast(axiosErrorDetail(error) || "保存覆盖失败", "err"),
  });
  const assembledPrompt = useMemo(
    () => (preview ? sectionPrompt(preview.sections, included, drafts) : ""),
    [drafts, included, preview],
  );

  if (!botReady) return <p className="text-sm text-muted-foreground">请先选择 Bot QQ。</p>;
  return (
    <div className="space-y-3">
      <Card className="ai-governance-prompt-preview-card">
        <CardHeader>
          <CardTitle>本轮 Prompt 组装</CardTitle>
          <CardDescription>输入一条消息，查看这轮发送给模型的实际片段、来源和注入顺序。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!groupReady && <p className="text-sm text-muted-foreground">请在顶部选择群号后开始预览。</p>}
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
            <Input aria-label="用户 QQ" inputMode="numeric" placeholder="用户 QQ" value={userId} onChange={(event) => setUserId(event.target.value)} disabled={!groupReady} />
            <Textarea aria-label="模拟消息" placeholder="模拟消息，例如：明天要不要一起打游戏？" value={queryText} onChange={(event) => setQueryText(event.target.value)} rows={2} disabled={!groupReady} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" icon={Play} iconBusy={previewMut.isPending} disabled={!groupReady || previewMut.isPending} onClick={() => previewMut.mutate()}>生成本轮预览</Button>
            {preview && <Button type="button" variant="ghost" icon={RotateCcw} onClick={() => { setPreview(null); setIncluded(new Set()); }}>清除预览</Button>}
            {preview && <span className="text-xs text-muted-foreground">仅预览，不会执行模型或修改运行时配置</span>}
          </div>
        </CardContent>
      </Card>
      {preview && (
        <>
          <StateBlock loading={false} error={null} empty={!preview.sections.length} emptyText="本轮没有可展示的 Prompt 片段">
            <div className="space-y-2">
              {preview.sections.map((section) => (
                <PromptSection
                  key={section.id}
                  section={section}
                  included={included.has(section.id)}
                  draft={drafts[section.id] ?? { mode: "replace", content: section.content }}
                  saving={overrideMut.isPending && overrideMut.variables?.id === section.id}
                  onDraftChange={(draft) => setDrafts((current) => ({ ...current, [section.id]: draft }))}
                  onSave={() => overrideMut.mutate({ id: section.id, override: drafts[section.id] ?? { mode: "replace", content: section.content } })}
                  onToggle={() => setIncluded((current) => { const next = new Set(current); if (next.has(section.id)) next.delete(section.id); else next.add(section.id); return next; })}
                />
              ))}
            </div>
          </StateBlock>
          <Card className="ai-governance-prompt-result-card">
            <CardHeader><CardTitle>当前预览组装结果</CardTitle><CardDescription>取消片段只影响下面这份预览，不会改变实际配置。</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              <pre className="ai-governance-prompt-result">{assembledPrompt || "没有选择任何已注入片段。"}</pre>
              <Button type="button" size="sm" variant="ghost" icon={Clipboard} onClick={async () => { await navigator.clipboard?.writeText(assembledPrompt); pushConsoleToast("已复制组装结果", "ok"); }}>复制组装结果</Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
