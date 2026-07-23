import { useCallback, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AI_CONFIG_SECTIONS,
  aiConfigSectionPath,
  normalizeAiConfigSection,
  type AiConfigSectionId,
} from "@/config/aiConfigSections";
import { AiConfigChromeProvider } from "@/components/ai/AiConfigChromeContext";
import AiConfigChromeTools from "@/components/ai/AiConfigChromeTools";
import PageMasthead from "@/components/PageMasthead";
import AiConfigBehaviorSection from "@/pages/ai/sections/AiConfigBehaviorSection";
import AiConfigCapabilitiesSection from "@/pages/ai/sections/AiConfigCapabilitiesSection";
import AiConfigConnectionSection from "@/pages/ai/sections/AiConfigConnectionSection";
import AiConfigDrawSection from "@/pages/ai/sections/AiConfigDrawSection";
import AiConfigKernelSection from "@/pages/ai/sections/AiConfigKernelSection";
import AiConfigKnowledgeSection from "@/pages/ai/sections/AiConfigKnowledgeSection";
import AiConfigLogsSection from "@/pages/ai/sections/AiConfigLogsSection";
import AiConfigNcmSection from "@/pages/ai/sections/AiConfigNcmSection";
import AiConfigProviderSection from "@/pages/ai/sections/AiConfigProviderSection";
import AiConfigStrategySection from "@/pages/ai/sections/AiConfigStrategySection";

const SECTION_BODY: Record<string, () => JSX.Element> = {
  provider: AiConfigProviderSection,
  strategy: AiConfigStrategySection,
  knowledge: AiConfigKnowledgeSection,
  connection: AiConfigConnectionSection,
  capabilities: AiConfigCapabilitiesSection,
  draw: AiConfigDrawSection,
  ncm: AiConfigNcmSection,
  logs: AiConfigLogsSection,
  kernel: AiConfigKernelSection,
  behavior: AiConfigBehaviorSection,
};

/** 工具条刷新：按段 invalidate 相关 query（前缀匹配） */
const SECTION_REFRESH_KEYS: Record<string, string[][]> = {
  provider: [["llm-model-admin"]],
  strategy: [
    ["common-config", "llm"],
    ["common-config-raw", "llm"],
  ],
  knowledge: [["conversation-kernel-knowledge-sources"]],
  connection: [["ai-extension-config"], ["ai-runtime"], ["ai-install"]],
  capabilities: [["media-assets"], ["sing-models"], ["tts-voices"]],
  draw: [
    ["common-config", "draw"],
    ["common-config-raw", "draw"],
  ],
  ncm: [["ai-ncm"]],
  logs: [["ai-extension-logs"]],
  kernel: [
    ["conversation-kernel-status"],
    ["conversation-kernel-traces"],
    ["conversation-kernel-memory"],
    ["conversation-kernel-notes"],
  ],
  behavior: [
    ["llm-behavior-runs"],
    ["llm-behavior-patterns"],
    ["llm-repeater-feedback"],
    ["llm-repeater-summary"],
    ["llm-promotion-candidates"],
    ["llm-persona-observe"],
  ],
};

/** 工具条展示搜索的分段（段内通过 useAiConfigChromeSearch 消费） */
const SEARCHABLE_SECTIONS = new Set<AiConfigSectionId | string>(["logs"]);

export default function AiConfigPage() {
  const { section: rawSection } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const section = normalizeAiConfigSection(rawSection);
  const meta = AI_CONFIG_SECTIONS.find((s) => s.id === section) || AI_CONFIG_SECTIONS[0];
  const Body = SECTION_BODY[section] ?? AiConfigProviderSection;

  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const showSearch = SEARCHABLE_SECTIONS.has(section);

  const onRefresh = useCallback(async () => {
    const keys = SECTION_REFRESH_KEYS[section] || [];
    setRefreshing(true);
    try {
      await Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
    } finally {
      setRefreshing(false);
    }
  }, [qc, section]);

  if (!rawSection) {
    return <Navigate to={aiConfigSectionPath("provider")} replace />;
  }

  return (
    <AiConfigChromeProvider search={search} setSearch={setSearch}>
      <div>
        <PageMasthead title="AI 配置" description={meta.lead} />

        <AiConfigChromeTools
          section={section}
          onSectionChange={(id) => {
            setSearch("");
            void navigate(aiConfigSectionPath(id));
          }}
          onRefresh={() => void onRefresh()}
          refreshing={refreshing}
          search={
            showSearch
              ? {
                  value: search,
                  onChange: setSearch,
                  placeholder: "过滤日志…",
                }
              : undefined
          }
        />

        <Body />
      </div>
    </AiConfigChromeProvider>
  );
}
