import { lazy, Suspense, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Brain, GitBranch, MessageSquare, ShieldCheck } from "lucide-react";
import { AiGovernanceScope } from "@/components/ai/AiGovernanceScope";
import AiGovernanceScopeFields from "@/components/ai/AiGovernanceScopeFields";
import ChromeTools from "@/components/ChromeTools";
import PageMasthead from "@/components/PageMasthead";
import { Tabs } from "@heroui/react";
import GovernancePipelineTab from "./GovernancePipelineTab";
import "./AiGovernancePage.css";

const GovernanceStyleTab = lazy(() => import("./GovernanceStyleTab"));
const GovernancePeopleTab = lazy(() => import("./GovernancePeopleTab"));
const GovernanceMemoryTab = lazy(() => import("./GovernanceMemoryTab"));

export type GovernanceTabId = "pipeline" | "style" | "people" | "memory";

type GovernanceTabMeta = {
  id: GovernanceTabId;
  label: string;
  lead: string;
};

export const GOVERNANCE_TABS: readonly GovernanceTabMeta[] = [
  { id: "pipeline", label: "回复流水线", lead: "回复发送前依次经过的五个阶段，各阶段参数在此内联调整。" },
  { id: "style", label: "群风格与语义", lead: "群风格、语义、表情标签、人设导出与场景正反例。" },
  { id: "people", label: "人物", lead: "人物事实与关系笔记。" },
  { id: "memory", label: "记忆", lead: "知识图谱、条目、偏好、回收站与导入导出。" },
];

const TAB_PANEL_FOCUS_RING =
  "ring-offset-pallas-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function governanceTabMeta(id: string): GovernanceTabMeta {
  return GOVERNANCE_TABS.find((item) => item.id === id) ?? GOVERNANCE_TABS[0];
}

function GovernanceChrome() {
  return (
    <ChromeTools className="ai-governance-page__scope">
      <AiGovernanceScopeFields />
    </ChromeTools>
  );
}

function GovernanceWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") ?? "";
  const initialTab: GovernanceTabId = GOVERNANCE_TABS.some((item) => item.id === rawTab) ? (rawTab as GovernanceTabId) : "pipeline";
  const [tab, setTab] = useState<GovernanceTabId>(initialTab);
  const active = tab;
  const meta = governanceTabMeta(tab);

  const onTabChange = (value: string) => {
    const next = value as GovernanceTabId;
    setTab(next);
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        if (next === "pipeline") params.delete("tab");
        else params.set("tab", next);
        return params;
      },
      { replace: true },
    );
  };

  return (
    <div data-ui-zone="ai-governance" className="console-hub-page ai-governance-page w-full">
      <PageMasthead title="AI 治理" description={meta.lead} />
      <GovernanceChrome />
      <div className="ai-governance-page__tabs">
        <Tabs selectedKey={active} onSelectionChange={(key) => onTabChange(String(key))} className="w-full">
          <Tabs.ListContainer className="ai-memory-page__tabs-scroll">
            <Tabs.List aria-label="AI 治理分类" className="whitespace-nowrap">
              <Tabs.Tab id="pipeline" className="gap-1">
                <GitBranch className="size-3.5" /> 回复流水线
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="style" className="gap-1">
                <MessageSquare className="size-3.5" /> 群风格与语义
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="people" className="gap-1">
                <ShieldCheck className="size-3.5" /> 人物
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="memory" className="gap-1">
                <Brain className="size-3.5" /> 记忆
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="pipeline" className={`mt-3 ${TAB_PANEL_FOCUS_RING}`}>
            <GovernancePipelineTab />
          </Tabs.Panel>
          <Tabs.Panel id="style" className={`mt-3 ${TAB_PANEL_FOCUS_RING}`}>
            <Suspense fallback={<div className="text-sm text-muted-foreground">群风格与语义加载中…</div>}>
              <GovernanceStyleTab />
            </Suspense>
          </Tabs.Panel>
          <Tabs.Panel id="people" className={`mt-3 ${TAB_PANEL_FOCUS_RING}`}>
            <Suspense fallback={<div className="text-sm text-muted-foreground">人物加载中…</div>}>
              <GovernancePeopleTab />
            </Suspense>
          </Tabs.Panel>
          <Tabs.Panel id="memory" className={`mt-3 ${TAB_PANEL_FOCUS_RING}`}>
            <Suspense fallback={<div className="text-sm text-muted-foreground">记忆加载中…</div>}>
              <GovernanceMemoryTab />
            </Suspense>
          </Tabs.Panel>
        </Tabs>
      </div>
    </div>
  );
}

export default function AiGovernancePage() {
  return (
    <AiGovernanceScope>
      <GovernanceWorkspace />
    </AiGovernanceScope>
  );
}
