import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clipboard, Eye, EyeOff, Play, RotateCcw, Save } from "lucide-react";
import {
  fetchLlmPromptOverrides,
  fetchLlmPromptPreview,
  saveLlmPromptOverrides,
  tryLlmPrompt,
  type PromptPreviewData,
  type PromptPreviewSection,
  type PromptSectionOverride,
  type PromptTryData,
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

const FIXED_SECTION_IDS = new Set(["injection_guard", "persona", "identity", "reply_shape", "turn_policy"]);
type PipelinePanelId = "pipeline" | "assembled";

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
  dynamic,
}: {
  section: PromptPreviewSection;
  included: boolean;
  onToggle: () => void;
  draft: PromptSectionOverride;
  onDraftChange: (draft: PromptSectionOverride) => void;
  onSave: () => void;
  saving: boolean;
  dynamic: boolean;
}) {
  const copy = async () => {
    await navigator.clipboard?.writeText(section.content);
    pushConsoleToast("已复制片段", "ok");
  };
  return (
    <article className="ai-governance-prompt-section">
      <div className="ai-governance-prompt-section__body">
         <div className="ai-governance-prompt-section__editor">
           <fieldset className="ai-governance-prompt-section__modes">
             <legend>
               <span>覆盖策略</span>
               {section.active && (
                 <Button type="button" size="icon" variant="ghost" aria-label={included ? `从预览移除${section.title}` : `加入预览${section.title}`} onClick={onToggle}>
                   {included ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                 </Button>
               )}
             </legend>
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
          {!section.content && dynamic && (
            <p className="text-xs text-muted-foreground">需要填写本轮消息后刷新，才能召回这一段内容。</p>
          )}
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
      </div>
    </article>
  );
}

function PipelineStageNav({
  sections,
  activeSectionId,
  drafts,
  included,
  onSelect,
}: {
  sections: PromptPreviewSection[];
  activeSectionId: string;
  drafts: Record<string, PromptSectionOverride>;
  included: Set<string>;
  onSelect: (sectionId: string) => void;
}) {
  return (
    <nav className="ai-governance-workbench__stages" aria-label="回复流水线阶段">
      <div className="ai-governance-workbench__stages-heading">
        <span>回复阶段</span>
        <span className="text-xs text-muted-foreground">固定注入</span>
      </div>
      <div className="ai-governance-workbench__stage-list">
        {sections.map((section, index) => {
          const selected = section.id === activeSectionId;
          const draft = drafts[section.id];
          return (
            <button
              key={section.id}
              type="button"
              className={`ai-governance-workbench__stage${selected ? " is-active" : ""}`}
              aria-current={selected ? "true" : undefined}
              aria-label={`切换到${section.title}`}
              onClick={() => onSelect(section.id)}
            >
              <span className="ai-governance-workbench__stage-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="min-w-0 text-left">
                <strong>{section.title}</strong>
                <small>{draft?.mode === "disable" ? "已禁用" : included.has(section.id) ? "已注入" : "本地已移除"}</small>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function GovernancePipelineTab() {
  const { scope } = useAiGovernanceScope();
  const botReady = scope != null;
  const groupReady = scope?.groupId != null;
  const [userId, setUserId] = useState("");
  const [queryText, setQueryText] = useState("");
  const [preview, setPreview] = useState<PromptPreviewData | null>(null);
  const [tryResult, setTryResult] = useState<PromptTryData | null>(null);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, PromptSectionOverride>>({});
  const [activeSectionId, setActiveSectionId] = useState("persona");
  const [activePanel, setActivePanel] = useState<PipelinePanelId>("pipeline");
  const queryClient = useQueryClient();
  const overridesQ = useQuery({
    queryKey: ["prompt-overrides", scope?.botId, scope?.groupId],
    queryFn: () => fetchLlmPromptOverrides({ botId: scope!.botId, groupId: scope!.groupId! }),
    enabled: groupReady,
  });
  const staticPreviewQ = useQuery({
    queryKey: ["prompt-preview", scope?.botId, scope?.groupId, "static"],
    queryFn: () => fetchLlmPromptPreview({ botId: scope!.botId, groupId: scope!.groupId!, userId: 0, queryText: "" }),
    enabled: groupReady,
  });
  const displayPreview = preview ?? staticPreviewQ.data ?? null;
  useEffect(() => {
    if (preview || !staticPreviewQ.data) return;
    setIncluded(new Set(staticPreviewQ.data.sections.filter((section) => section.active).map((section) => section.id)));
    if (!staticPreviewQ.data.sections.some((section) => section.id === activeSectionId && FIXED_SECTION_IDS.has(section.id))) {
      setActiveSectionId(staticPreviewQ.data.sections.find((section) => FIXED_SECTION_IDS.has(section.id))?.id ?? "persona");
    }
    setDrafts(Object.fromEntries(staticPreviewQ.data.sections.map((section) => [
      section.id,
      overridesQ.data?.[section.id] ?? { mode: "replace", content: section.content },
    ])));
  }, [overridesQ.data, preview, staticPreviewQ.data]);
  const previewMut = useMutation({
    mutationFn: () => {
      if (!scope || scope.groupId == null) throw new Error("请先选择群号");
      const parsedUserId = Number(userId);
       if (!queryText.trim()) throw new Error("请输入一条模拟消息");
       return fetchLlmPromptPreview({ botId: scope.botId, groupId: scope.groupId, userId: Number.isInteger(parsedUserId) && parsedUserId > 0 ? parsedUserId : 0, queryText: queryText.trim() });
    },
    onSuccess: (data) => {
       setPreview(data);
       setIncluded(new Set(data.sections.filter((section) => section.active).map((section) => section.id)));
       if (!data.sections.some((section) => section.id === activeSectionId && FIXED_SECTION_IDS.has(section.id))) {
         setActiveSectionId(data.sections.find((section) => FIXED_SECTION_IDS.has(section.id))?.id ?? "persona");
       }
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
    () => (displayPreview ? sectionPrompt(displayPreview.sections, included, drafts) : ""),
    [displayPreview, drafts, included],
  );
  const tryMut = useMutation({
    mutationFn: () => {
      if (!scope || scope.groupId == null) throw new Error("请先选择群号");
      const parsedUserId = Number(userId);
      const message = queryText.trim();
      if (!Number.isInteger(parsedUserId) || parsedUserId < 1) throw new Error("请输入有效的用户 QQ");
      if (!message) throw new Error("请输入一条消息");
      if (!assembledPrompt) throw new Error("当前没有可发送的 Prompt 片段");
      return tryLlmPrompt({
        botId: scope.botId,
        groupId: scope.groupId,
        userId: parsedUserId,
        systemPrompt: assembledPrompt,
        queryText: message,
      });
    },
    onSuccess: setTryResult,
    onError: (error) => pushConsoleToast(axiosErrorDetail(error) || (error instanceof Error ? error.message : "试答失败"), "err"),
  });

  if (!botReady) return <p className="text-sm text-muted-foreground">请先选择 Bot QQ。</p>;
  return (
    <div className="space-y-3">
      <Card className="ai-governance-preview-card">
        <CardHeader className="ai-governance-preview-strip__heading">
          <div>
            <p className="ai-governance-workbench__eyebrow">Prompt inspector</p>
            <CardTitle>本轮 Prompt 组装</CardTitle>
            <CardDescription>用一条真实消息检查回复前的上下文和注入顺序。</CardDescription>
          </div>
          {!groupReady && <span className="ai-governance-preview-strip__hint">请先在上方选择群号</span>}
        </CardHeader>
        <CardContent className="ai-governance-preview-strip__controls">
          <label className="ai-governance-preview-strip__field ai-governance-preview-strip__field--user">
            <span>用户 QQ</span>
            <Input aria-label="用户 QQ" inputMode="numeric" placeholder="输入 QQ 号" value={userId} onChange={(event) => setUserId(event.target.value)} disabled={!groupReady} />
          </label>
          <label className="ai-governance-preview-strip__field ai-governance-preview-strip__field--message">
            <span>模拟消息</span>
            <Input aria-label="模拟消息" placeholder="例如：明天要不要一起打游戏？" value={queryText} onChange={(event) => setQueryText(event.target.value)} disabled={!groupReady} />
          </label>
          <div className="ai-governance-preview-strip__actions">
            <Button type="button" aria-label="刷新本轮上下文" icon={RotateCcw} iconBusy={previewMut.isPending} disabled={!groupReady || previewMut.isPending} onClick={() => previewMut.mutate()}>刷新上下文</Button>
            <Button type="button" aria-label="调用模型试答" variant="outline" icon={Play} iconBusy={tryMut.isPending} disabled={!groupReady || !queryText.trim() || !userId.trim() || !assembledPrompt || tryMut.isPending} onClick={() => tryMut.mutate()}>试答</Button>
            {preview && <Button type="button" variant="ghost" size="icon" aria-label="清除预览" icon={EyeOff} onClick={() => { setPreview(null); setIncluded(new Set()); }} />}
          </div>
        </CardContent>
      </Card>
      {groupReady && !displayPreview && (staticPreviewQ.isLoading || staticPreviewQ.error) && (
        <StateBlock
          loading={staticPreviewQ.isLoading}
          error={staticPreviewQ.error}
          empty={false}
          emptyText="Prompt 预览暂时不可用"
        >
          <span />
        </StateBlock>
      )}
      {displayPreview && (() => {
        const fixedSections = displayPreview.sections.filter((section) => FIXED_SECTION_IDS.has(section.id));
        const dynamicSections = displayPreview.sections.filter(
          (section) => !FIXED_SECTION_IDS.has(section.id) && (section.active || section.content.trim()),
        );
        const activeSection = fixedSections.find((section) => section.id === activeSectionId) ?? fixedSections[0];
        return (
          <div className="ai-governance-workbench">
            <aside className="ai-governance-workbench__stages">
              <Card className="ai-governance-workbench__stages-card">
                <CardHeader><CardTitle>治理面板</CardTitle><CardDescription>选择要检查的回复环节</CardDescription></CardHeader>
                <CardContent>
                  <nav className="ai-governance-workbench__panel-nav" aria-label="治理面板">
                    <button
                      type="button"
                      className={`ai-governance-workbench__panel-link${activePanel === "pipeline" ? " is-active" : ""}`}
                      aria-current={activePanel === "pipeline" ? "page" : undefined}
                      onClick={() => setActivePanel("pipeline")}
                    >
                      <span><strong>回复流水线</strong><small>阶段配置与本轮上下文</small></span>
                    </button>
                    <button
                      type="button"
                      className={`ai-governance-workbench__panel-link${activePanel === "assembled" ? " is-active" : ""}`}
                      aria-label="打开当前组装结果"
                      aria-current={activePanel === "assembled" ? "page" : undefined}
                      onClick={() => setActivePanel("assembled")}
                    >
                      <span><strong>当前组装结果</strong><small>查看发送给模型的 Prompt</small></span>
                    </button>
                  </nav>
                  {activePanel === "pipeline" && (
                    <PipelineStageNav sections={fixedSections} activeSectionId={activeSection?.id ?? ""} drafts={drafts} included={included} onSelect={setActiveSectionId} />
                  )}
                </CardContent>
              </Card>
            </aside>
            {activePanel === "assembled" ? (
              <main className="ai-governance-workbench__assembled-panel">
                <Card className="ai-governance-prompt-result-card ai-governance-inspector">
                  <CardHeader className="ai-governance-inspector__heading">
                    <div><span>ASSEMBLED PROMPT</span><CardTitle>当前组装结果</CardTitle><CardDescription>移除片段只影响本地预览，不会改变实际配置。</CardDescription></div>
                    <Button type="button" size="icon" variant="ghost" aria-label="复制组装结果" icon={Clipboard} onClick={async () => { await navigator.clipboard?.writeText(assembledPrompt); pushConsoleToast("已复制组装结果", "ok"); }} />
                  </CardHeader>
                  <CardContent><pre className="ai-governance-prompt-result">{assembledPrompt || "没有选择任何已注入片段。"}</pre></CardContent>
                </Card>
              </main>
            ) : (
            <main className="ai-governance-workbench__editor">
              <Card className="ai-governance-workbench__editor-card">
                 <CardHeader className="ai-governance-workbench__editor-heading">
                 <div>
                   <p className="ai-governance-workbench__eyebrow">当前阶段</p>
                    <div className="ai-governance-workbench__title-row">
                      <CardTitle>{activeSection?.title ?? "暂无固定注入"}</CardTitle>
                      {activeSection && (
                        <div className="ai-governance-workbench__title-meta">
                          <code>{activeSection.id}</code>
                          <Badge variant={activeSection.active && included.has(activeSection.id) ? "info" : "muted"}>
                            {!activeSection.active ? "本轮未召回" : included.has(activeSection.id) ? "已加入本地预览" : "已从本地预览移除"}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <CardDescription>只编辑当前阶段，切换阶段不会丢失未保存草稿。</CardDescription>
                  </div>
                 </CardHeader>
                <CardContent>{activeSection ? (
                <PromptSection
                  section={activeSection}
                  included={included.has(activeSection.id)}
                  draft={drafts[activeSection.id] ?? { mode: "replace", content: activeSection.content }}
                  saving={overrideMut.isPending && overrideMut.variables?.id === activeSection.id}
                  onDraftChange={(draft) => setDrafts((current) => ({ ...current, [activeSection.id]: draft }))}
                  onSave={() => overrideMut.mutate({ id: activeSection.id, override: drafts[activeSection.id] ?? { mode: "replace", content: activeSection.content } })}
                  onToggle={() => setIncluded((current) => { const next = new Set(current); if (next.has(activeSection.id)) next.delete(activeSection.id); else next.add(activeSection.id); return next; })}
                  dynamic={false}
                />
                ) : <p className="text-sm text-muted-foreground">当前没有可编辑的固定注入片段。</p>}</CardContent>
              </Card>
              {dynamicSections.length > 0 && (
                <Card className="ai-governance-workbench__dynamic">
                  <CardHeader className="ai-governance-workbench__dynamic-heading">
                    <div><CardTitle>本轮上下文</CardTitle><CardDescription>动态片段只随本轮消息召回，不占用固定阶段。</CardDescription></div>
                    {queryText.trim() && <Badge variant="outline">已按消息刷新</Badge>}
                  </CardHeader>
                  <CardContent className="ai-governance-workbench__dynamic-list">
                    {dynamicSections.map((section) => (
                      <div key={section.id} className="ai-governance-workbench__dynamic-item">
                        <div><strong>{section.title}</strong><span>{section.active ? "已召回" : "未召回"}</span></div>
                        <p>{section.content || "本轮没有检索到内容。"}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              {tryResult && <section className="ai-governance-workbench__preview">
                <div className="ai-governance-workbench__preview-heading">
                  <div><p className="ai-governance-workbench__eyebrow">Model response</p><h3>模型试答</h3></div>
                  <p>试答只用于检查当前 Prompt，不会发送到群聊。</p>
                </div>
                <Card className="ai-governance-prompt-try-card ai-governance-inspector">
                  <CardHeader className="ai-governance-inspector__heading"><div><span>MODEL RESPONSE</span><CardTitle>模型试答</CardTitle></div><Badge variant="info">测试调用</Badge></CardHeader>
                  <CardContent><div className="ai-governance-inspector__meta">{tryResult.model || "未返回模型"} · {tryResult.elapsed_ms} ms</div>
                    <pre className="ai-governance-prompt-try-result">{tryResult.text || "模型未返回文本。"}</pre>
                  </CardContent>
                </Card>
              </section>
              }
            </main>
            )}
          </div>
        );
      })()}
    </div>
  );
}
