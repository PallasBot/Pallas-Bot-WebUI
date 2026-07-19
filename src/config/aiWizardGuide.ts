import { aiConfigSectionPath } from "@/config/aiConfigSections";

/** 收起 AI 配置页内的「接通自检」卡片（侧栏「AI 体检」仍可用）。 */
export const AI_WIZARD_CHECKLIST_DISMISS_KEY = "pallas.aiConfig.wizardChecklistDismissed";

export interface AiWizardCheckAction {
  to: string;
  label: string;
}

export interface AiWizardCheckDef {
  id: string;
  sectionIds?: string[];
}

export const AI_WIZARD_CHECK_DEFS: AiWizardCheckDef[] = [
  { id: "ai_service", sectionIds: ["connection"] },
  { id: "provider_configured", sectionIds: ["provider"] },
  { id: "provider_reachable", sectionIds: ["provider"] },
  { id: "llm_chat_enabled", sectionIds: ["strategy"] },
];

export function wizardActionForCheckId(checkId: string): AiWizardCheckAction {
  switch (checkId) {
    case "ai_service":
      return { to: aiConfigSectionPath("connection"), label: "安装或检查扩展连接" };
    case "provider_configured":
      return { to: aiConfigSectionPath("provider"), label: "配置 Provider" };
    case "provider_reachable":
      return { to: aiConfigSectionPath("provider"), label: "测试 Provider" };
    case "llm_chat_enabled":
      return { to: aiConfigSectionPath("strategy"), label: "开启智能对话" };
    default:
      return { to: "/ai/home", label: "运行总览" };
  }
}

export function wizardChecksForSection(sectionId: string): string[] {
  return AI_WIZARD_CHECK_DEFS.filter((row) => row.sectionIds?.includes(sectionId)).map((row) => row.id);
}
