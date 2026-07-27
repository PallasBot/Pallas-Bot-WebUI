import { Eye } from "lucide-react";
import type { ReactNode } from "react";
import {
  AI_OBSERVATION_SECTIONS,
  aiObservationMeta,
  type AiObservationSectionId,
} from "@/config/aiObservationSections";
import { useAiObservationChromeSlots } from "@/components/ai/AiObservationChromeContext";
import AiObservationScopeFields from "@/components/ai/AiObservationScopeFields";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import ChromeTools, {
  CHROME_SELECT_TRIGGER,
  CHROME_TOOLS_TRAILING,
} from "@/components/ChromeTools";
import RefreshIconButton from "@/components/RefreshIconButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * AI 观测工具条：选择分段 | 段内 scope（按需 Bot/群）| middle | trailing | 刷新。
 * middle 直接进 chrome-row；ScopeFields 自身包 CLUSTER；trailing 右钉。
 */
export default function AiObservationChromeTools({
  section,
  onSectionChange,
  onRefresh,
  refreshing = false,
  className,
  trailing,
}: {
  section: AiObservationSectionId;
  onSectionChange: (id: AiObservationSectionId) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  className?: string;
  trailing?: ReactNode;
}) {
  const slots = useAiObservationChromeSlots();
  const middle = slots.middle;
  const slotTrailing = slots.trailing;
  const refresh = slots.onRefresh ?? onRefresh;
  const currentLabel = AI_OBSERVATION_SECTIONS.find((s) => s.id === section)?.label ?? "分段";
  const scope = aiObservationMeta(section).scope;
  const showBot = Boolean(scope?.bot);
  const showGroup = Boolean(scope?.group);
  const showScope = showBot || showGroup;

  return (
    <ChromeTools className={className}>
      <ChromeField label="选择" icon={Eye} className="shrink-0">
        <Select
          value={section}
          onValueChange={(v) => onSectionChange(v as AiObservationSectionId)}
        >
          <SelectTrigger className={CHROME_SELECT_TRIGGER}>
            <SelectValue placeholder="选择">
              <ChromeOptionLabel icon={Eye}>{currentLabel}</ChromeOptionLabel>
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            {AI_OBSERVATION_SECTIONS.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <ChromeOptionLabel icon={Eye}>{s.label}</ChromeOptionLabel>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ChromeField>

      {showScope ? <AiObservationScopeFields showBot={showBot} showGroup={showGroup} /> : null}
      {middle}

      <div className={CHROME_TOOLS_TRAILING}>
        {slotTrailing}
        {trailing}
        {refresh ? (
          <RefreshIconButton
            busy={refreshing}
            label="刷新"
            showLabel
            onClick={() => refresh()}
          />
        ) : null}
      </div>
    </ChromeTools>
  );
}
