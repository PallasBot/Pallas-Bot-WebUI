import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen, Brain, ClipboardList, FileCode2, Gauge, Layers, Library, MessagesSquare, Wrench, type LucideIcon,
} from "lucide-react";
import { fetchConversationKernelKnowledgeSources, fetchLlmToolsCatalog } from "@/api/console";
import type { AiConfigSaveState } from "@/components/ai/aiConfigSaveState";
import CommonConfigForm from "@/components/CommonConfigForm";
import { useRegisterAiConfigChrome } from "@/components/ai/AiConfigChromeContext";
import AiConfigSectionCard from "@/components/ai/AiConfigSectionCard";
import AiSectionHeader from "@/components/ai/AiSectionHeader";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import { CHROME_SELECT_TRIGGER } from "@/components/ChromeTools";
import { preserveShellMainScroll } from "@/utils/preserveShellScroll";
import SegTabs from "@/components/SegTabs";
import KnowledgeSourcesTable from "@/components/ai/KnowledgeSourcesTable";
import LlmToolsTable from "@/components/ai/LlmToolsTable";
import StateBlock from "@/components/StateBlock";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LLM_BUDGET_DETAIL_KEYS,
  LLM_MEMORY_DETAIL_KEYS,
  LLM_SESSION_DETAIL_KEYS,
} from "@/config/configFieldLabels";
import AiLlmFieldPanel from "@/pages/ai/sections/AiLlmFieldPanel";

type ContentPanel = "form" | "session" | "memory" | "budget" | "arknights" | "sources" | "tools";
type EditMode = "form" | "raw";
/** URL panel：兼容旧 raw；内容分区不含 TOML */
type Panel = ContentPanel | "raw";

const SELECT_OPTIONS: Array<{ value: ContentPanel; label: string; icon: LucideIcon; lead: string }> = [
  { value: "form", label: "策略", icon: ClipboardList, lead: "接话策略与对话通用参数。" },
  { value: "session", label: "会话", icon: MessagesSquare, lead: "多轮上下文、过期与摘要。" },
  { value: "memory", label: "记忆", icon: Brain, lead: "群记忆检索、向量模式与自动沉淀。" },
  { value: "budget", label: "上下文预算", icon: Gauge, lead: "单次闲聊可注入的上下文字符上限。" },
  { value: "arknights", label: "方舟知识库", icon: BookOpen, lead: "明日方舟知识库检索与注入。" },
  { value: "sources", label: "语料源", icon: Library, lead: "当前已登记的语料源清单。" },
  { value: "tools", label: "工具", icon: Wrench, lead: "已注册 LLM 工具与当前可调用状态。" },
];

const MODE_OPTIONS = [
  { value: "form", label: "表单" },
  { value: "raw", label: "原始 TOML" },
];

const PANEL_SET = new Set<string>([...SELECT_OPTIONS.map((p) => p.value), "raw"]);

export default function AiConfigDialogueSection() {
  const [params, setParams] = useSearchParams();
  const rawParam = params.get("panel") || "";
  const panel = (PANEL_SET.has(rawParam) ? rawParam : "form") as Panel;

  const contentPanel: ContentPanel = panel === "raw" ? "form" : panel;
  const editMode: EditMode = panel === "raw" ? "raw" : "form";
  const [saveState, setSaveState] = useState<AiConfigSaveState | null>(null);
  const onSaveState = useCallback((state: AiConfigSaveState | null) => {
    setSaveState(state);
  }, []);

  const setPanel = (next: Panel) => {
    preserveShellMainScroll(() => {
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("panel", next);
          return n;
        },
        { replace: true },
      );
    });
  };

  const sourcesQ = useQuery({
    queryKey: ["conversation-kernel-knowledge-sources"],
    queryFn: fetchConversationKernelKnowledgeSources,
    enabled: contentPanel === "sources",
  });

  const toolsQ = useQuery({
    queryKey: ["llm-tools-catalog"],
    queryFn: fetchLlmToolsCatalog,
    enabled: contentPanel === "tools",
  });

  const chromeMiddle = useMemo(
    () => (
      <>
        <ChromeField label="对话分区" icon={Layers}>
          <Select
            value={contentPanel}
            onValueChange={(v) => {
              setPanel(v as ContentPanel);
            }}
          >
            <SelectTrigger className={CHROME_SELECT_TRIGGER}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {SELECT_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  <ChromeOptionLabel icon={p.icon}>{p.label}</ChromeOptionLabel>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ChromeField>
        {contentPanel === "form" ? (
          <SegTabs
            size="toolbar"
            ariaLabel="策略编辑模式"
            value={editMode}
            onValueChange={(v) => setPanel(v === "raw" ? "raw" : "form")}
            options={MODE_OPTIONS}
          />
        ) : null}
      </>
    ),
    [contentPanel, editMode],
  );

  const chromeTrailing = useMemo(() => {
    if (contentPanel === "sources" || contentPanel === "tools") return null;
    return (
      <Button
        type="button"
        size="sm"
        className="shrink-0"
        disabled={!saveState?.dirty || Boolean(saveState?.saving)}
        onClick={() => saveState?.save()}
      >
        {saveState?.saving ? "保存中…" : "保存"}
      </Button>
    );
  }, [contentPanel, saveState]);

  useRegisterAiConfigChrome({ middle: chromeMiddle, trailing: chromeTrailing });

  const panelMeta =
    contentPanel === "form"
      ? editMode === "raw"
        ? { label: "原始 TOML", icon: FileCode2, lead: "直接编辑 llm 段 TOML。" }
        : SELECT_OPTIONS[0]
      : SELECT_OPTIONS.find((p) => p.value === contentPanel) || SELECT_OPTIONS[0];

  // 会话 / 记忆 / 上下文预算：AiLlmFieldPanel 已有图标段头，外层再写分区名会重复。
  const fieldPanelIds = new Set<ContentPanel>(["session", "memory", "budget"]);
  const showCardHeader = !fieldPanelIds.has(contentPanel);

  return (
    <AiConfigSectionCard contentClassName={showCardHeader ? "space-y-4" : undefined}>
      {showCardHeader ? (
        <AiSectionHeader icon={panelMeta.icon} title={panelMeta.label} lead={panelMeta.lead} />
      ) : null}
      {contentPanel === "form" && editMode === "form" ? (
        <CommonConfigForm
          sectionId="llm"
          savedMessage="对话配置已保存"
          inlineSave={false}
          onSaveState={onSaveState}
        />
      ) : null}
      {contentPanel === "form" && editMode === "raw" ? (
        <CommonConfigForm
          sectionId="llm"
          mode="raw"
          savedMessage="对话 TOML 已保存"
          inlineSave={false}
          onSaveState={onSaveState}
        />
      ) : null}
      {contentPanel === "session" ? (
        <AiLlmFieldPanel
          icon={MessagesSquare}
          title="会话"
          lead="多轮上下文、过期与摘要。关闭后每句独立。"
          masterKey="llm_session_enabled"
          masterLabel="启用会话"
          disabledHint="会话已关；开启后可调窗口、TTL 与摘要。"
          detailKeys={LLM_SESSION_DETAIL_KEYS}
          savedMessage="会话配置已保存"
          inlineSave={false}
          onSaveState={onSaveState}
        />
      ) : null}
      {contentPanel === "memory" ? (
        <AiLlmFieldPanel
          icon={Brain}
          title="记忆"
          lead="群记忆检索、向量与自动沉淀。关闭后不注入记忆。"
          masterKey="llm_memory_rag_enabled"
          masterLabel="启用记忆"
          disabledHint="记忆已关；开启后可调检索与沉淀参数。"
          detailKeys={LLM_MEMORY_DETAIL_KEYS}
          savedMessage="记忆配置已保存"
          inlineSave={false}
          onSaveState={onSaveState}
        />
      ) : null}
      {contentPanel === "budget" ? (
        <AiLlmFieldPanel
          icon={Gauge}
          title="上下文预算"
          lead="单次闲聊可注入的字符上限。0 表示不限制。"
          detailKeys={LLM_BUDGET_DETAIL_KEYS}
          savedMessage="上下文预算已保存"
          inlineSave={false}
          onSaveState={onSaveState}
        />
      ) : null}
      {contentPanel === "arknights" ? (
        <CommonConfigForm
          sectionId="arknights_kb"
          savedMessage="方舟知识库配置已保存"
          inlineSave={false}
          onSaveState={onSaveState}
        />
      ) : null}
      {contentPanel === "sources" ? (
        <StateBlock
          loading={sourcesQ.isLoading}
          error={sourcesQ.error}
          empty={!sourcesQ.data?.items?.length}
          emptyText="暂无已配置的语料源。"
        >
          <KnowledgeSourcesTable items={sourcesQ.data?.items || []} />
        </StateBlock>
      ) : null}
      {contentPanel === "tools" ? (
        <StateBlock
          loading={toolsQ.isLoading}
          error={toolsQ.error}
          empty={!toolsQ.data?.items?.length}
          emptyText="暂无已注册的 LLM 工具。"
        >
          <LlmToolsTable items={toolsQ.data?.items || []} policy={toolsQ.data?.policy} />
        </StateBlock>
      ) : null}
    </AiConfigSectionCard>
  );
}
