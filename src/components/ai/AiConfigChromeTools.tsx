import { Layers, Server, Sparkles, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  AI_CONFIG_SECTIONS,
  type AiConfigSectionId,
} from "@/config/aiConfigSections";
import { useAiConfigChromeSlots } from "@/components/ai/AiConfigChromeContext";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import ChromeTools, {
  CHROME_SELECT_TRIGGER,
  CHROME_TOOLS_TRAILING,
} from "@/components/ChromeTools";
import RefreshIconButton from "@/components/RefreshIconButton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SECTION_ICONS: Record<AiConfigSectionId, LucideIcon> = {
  provider: Server,
  dialogue: Sparkles,
  media: Layers,
};

/**
 * AI 配置工具条：选择分段 Select | 段内 middle | 搜索? | trailing（保存/测试）| 刷新。
 * 有分区筛选 → 刷新跟工具条；sticky 竖钉（标题可滚走）。
 * middle 直接进 chrome-row（与协议页一致），勿再包 CLUSTER。
 */
export default function AiConfigChromeTools({
  section,
  onSectionChange,
  onRefresh,
  refreshing = false,
  search,
  className,
  trailing,
}: {
  section: AiConfigSectionId;
  onSectionChange: (id: AiConfigSectionId) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  className?: string;
  trailing?: ReactNode;
}) {
  const slots = useAiConfigChromeSlots();
  const middle = slots.middle;
  const slotTrailing = slots.trailing;
  const refresh = slots.onRefresh ?? onRefresh;
  const currentMeta = AI_CONFIG_SECTIONS.find((s) => s.id === section);
  const currentLabel = currentMeta?.label ?? "分段";

  return (
    <ChromeTools sticky className={className}>
      <ChromeField label="选择" icon={Layers} className="shrink-0">
        <Select value={section} onValueChange={(v) => onSectionChange(v as AiConfigSectionId)}>
          <SelectTrigger className={CHROME_SELECT_TRIGGER}>
            <SelectValue placeholder="选择">{currentLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            {AI_CONFIG_SECTIONS.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <ChromeOptionLabel icon={SECTION_ICONS[s.id] ?? Layers}>{s.label}</ChromeOptionLabel>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ChromeField>

      {middle}

      {search ? (
        <Input
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
          placeholder={search.placeholder ?? "搜索…"}
          className="h-9 min-w-[8rem] w-[min(16rem,100%)] shrink-0"
        />
      ) : null}

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
