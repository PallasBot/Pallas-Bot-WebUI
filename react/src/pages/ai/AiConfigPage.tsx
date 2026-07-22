import { NavLink, Navigate, useParams } from "react-router-dom";
import {
  AI_CONFIG_SECTIONS,
  aiConfigSectionPath,
  normalizeAiConfigSection,
  type AiConfigSectionId,
} from "@/config/aiConfigSections";
import PageHeader from "@/components/PageHeader";
import { cn } from "@/lib/utils";
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

const SECTION_BODY: Record<AiConfigSectionId, () => JSX.Element> = {
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

export default function AiConfigPage() {
  const { section: rawSection } = useParams();
  const section = normalizeAiConfigSection(rawSection);
  const meta = AI_CONFIG_SECTIONS.find((s) => s.id === section) || AI_CONFIG_SECTIONS[0];
  const Body = SECTION_BODY[section];

  if (!rawSection) {
    return <Navigate to={aiConfigSectionPath("provider")} replace />;
  }

  return (
    <div>
      <PageHeader title="AI 配置" description={meta.lead} />

      <div className="mb-4 flex flex-wrap gap-2 border-b pb-3">
        {AI_CONFIG_SECTIONS.map((s) => (
          <NavLink
            key={s.id}
            to={aiConfigSectionPath(s.id)}
            className={({ isActive }) =>
              cn(
                "rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
          >
            {s.label}
          </NavLink>
        ))}
      </div>

      <Body />
    </div>
  );
}
