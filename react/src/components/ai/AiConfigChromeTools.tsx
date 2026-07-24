import { Layers, Server, Sparkles, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  AI_CONFIG_SECTIONS,
  type AiConfigSectionId,
} from "@/config/aiConfigSections";
import { useAiConfigChromeSlots } from "@/components/ai/AiConfigChromeContext";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import ChromeTools from "@/components/ChromeTools";
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
 * AI 配置工具条：选择分段 Select | 段内 middle | 搜索? | trailing | 刷新。
 * 整行共用 ChromeTools 横向滚动，勿再给 middle 单独 overflow。
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
  const SectionIcon = SECTION_ICONS[section] ?? Layers;

  return (
    <ChromeTools className={className}>
      <ChromeField label="选择" icon={SectionIcon} className="shrink-0">
        <Select value={section} onValueChange={(v) => onSectionChange(v as AiConfigSectionId)}>
          <SelectTrigger className="h-9 w-auto min-w-[10rem] max-w-[16rem] shrink-0 gap-1.5">
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

      {middle ? (
        <div className="flex shrink-0 items-center gap-1.5">{middle}</div>
      ) : null}

      {search ? (
        <Input
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
          placeholder={search.placeholder ?? "搜索…"}
          className="h-8 min-w-[8rem] w-[min(16rem,100%)] shrink-0"
        />
      ) : null}

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
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
