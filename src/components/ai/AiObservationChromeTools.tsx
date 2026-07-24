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
import ChromeTools from "@/components/ChromeTools";
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
 * 对齐 AI 配置 / 协议连接 ChromeTools。
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
          <SelectTrigger className="h-9 w-auto min-w-[10rem] max-w-[16rem] shrink-0 gap-1.5">
            <SelectValue placeholder="选择">{currentLabel}</SelectValue>
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

      {/* middle 直接进 chrome-row；包 shrink-0 避免窄屏被压窄换行导致无法横向滚动 */}
      {showScope ? <AiObservationScopeFields showBot={showBot} showGroup={showGroup} /> : null}
      {middle ? <div className="flex shrink-0 flex-nowrap items-center gap-1.5">{middle}</div> : null}

      <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-1.5 self-center">
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
