import { useCallback, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { AiConfigSaveState } from "@/components/ai/aiConfigSaveState";
import { useRegisterAiConfigChrome } from "@/components/ai/AiConfigChromeContext";
import AiConfigSectionCard from "@/components/ai/AiConfigSectionCard";
import { LLM_DAILY_BUDGET_DETAIL_KEYS } from "@/config/configFieldLabels";
import AiLlmFieldPanel from "@/pages/ai/sections/AiLlmFieldPanel";
import { Button } from "@/components/ui/button";

export default function AiConfigBudgetSection() {
  const [saveState, setSaveState] = useState<AiConfigSaveState | null>(null);
  const onSaveState = useCallback((state: AiConfigSaveState | null) => {
    setSaveState((prev) => {
      if (state == null) return null;
      if (
        prev &&
        prev.dirty === state.dirty &&
        prev.saving === state.saving &&
        prev.save === state.save
      ) {
        return prev;
      }
      return state;
    });
  }, []);

  const chromeTrailing = useMemo(
    () => (
      <Button
        type="button"
        size="sm"
        className="shrink-0"
        disabled={!saveState?.dirty || Boolean(saveState?.saving)}
        onClick={() => saveState?.save()}
      >
        {saveState?.saving ? "保存中…" : "保存"}
      </Button>
    ),
    [saveState],
  );

  useRegisterAiConfigChrome({ trailing: chromeTrailing });

  return (
    <AiConfigSectionCard contentClassName="space-y-4">
      <AiLlmFieldPanel
        icon={SlidersHorizontal}
        title="预算"
        lead="各任务每日上限与单次上下文预算。0 表示不限制。"
        detailKeys={LLM_DAILY_BUDGET_DETAIL_KEYS}
        savedMessage="预算配置已保存"
        inlineSave={false}
        onSaveState={onSaveState}
      />
    </AiConfigSectionCard>
  );
}
