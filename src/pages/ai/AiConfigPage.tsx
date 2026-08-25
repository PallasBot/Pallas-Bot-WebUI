import type { ComponentType } from "react";
import { useCallback, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AI_CONFIG_SECTIONS,
  AI_CONFIG_LOGS_REDIRECT,
  aiConfigSectionPath,
  legacyAiConfigPanel,
  normalizeAiConfigSection,
} from "@/config/aiConfigSections";
import { AiConfigChromeProvider } from "@/components/ai/AiConfigChromeContext";
import AiConfigChromeTools from "@/components/ai/AiConfigChromeTools";
import PageMasthead from "@/components/PageMasthead";
import AiConfigBehaviorSection from "@/pages/ai/sections/AiConfigBehaviorSection";
import AiConfigDialogueSection from "@/pages/ai/sections/AiConfigDialogueSection";
import AiConfigMediaSection from "@/pages/ai/sections/AiConfigMediaSection";
import AiConfigProviderSection from "@/pages/ai/sections/AiConfigProviderSection";

const SECTION_BODY: Record<string, ComponentType> = {
  provider: AiConfigProviderSection,
  dialogue: AiConfigDialogueSection,
  media: AiConfigMediaSection,
  behavior: AiConfigBehaviorSection,
};

/** 工具条刷新：按段 invalidate 相关 query（前缀匹配） */
const SECTION_REFRESH_KEYS: Record<string, string[][]> = {
  provider: [["llm-model-admin"]],
  dialogue: [
    ["common-config", "llm"],
    ["common-config-raw", "llm"],
    ["conversation-kernel-knowledge-sources"],
  ],
  media: [
    ["ai-extension-config"], ["ai-runtime"], ["ai-install"],
    ["media-assets"], ["sing-models"], ["tts-voices"],
    ["plugin-config", "draw"],
    ["plugin-config-raw", "draw"],
    ["ai-ncm"],
  ],
  behavior: [
    ["llm-behavior-runs"],
    ["llm-behavior-patterns"],
    ["llm-repeater-feedback"],
    ["llm-repeater-summary"],
    ["llm-persona-observe"],
  ],
};

export default function AiConfigPage() {
  const { section: rawSection } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const section = normalizeAiConfigSection(rawSection);
  const legacyPanel = legacyAiConfigPanel(rawSection);
  const meta = AI_CONFIG_SECTIONS.find((s) => s.id === section) || AI_CONFIG_SECTIONS[0];
  const Body = SECTION_BODY[section] ?? AiConfigProviderSection;

  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

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
  if (rawSection === "logs") {
    return <Navigate to={AI_CONFIG_LOGS_REDIRECT} replace />;
  }
  if (section !== rawSection) {
    return <Navigate to={aiConfigSectionPath(section, legacyPanel)} replace />;
  }

  return (
    <AiConfigChromeProvider search={search} setSearch={setSearch}>
      <div className="console-hub-page">
        <PageMasthead title="AI 配置" description={meta.lead} />

        <AiConfigChromeTools
          section={section}
          onSectionChange={(id) => {
            setSearch("");
            void navigate(aiConfigSectionPath(id));
          }}
          onRefresh={() => void onRefresh()}
          refreshing={refreshing}
        />

        <Body />
      </div>
    </AiConfigChromeProvider>
  );
}
