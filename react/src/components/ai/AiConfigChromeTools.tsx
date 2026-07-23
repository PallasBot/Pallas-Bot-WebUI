import { Layers, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import {
  aiConfigSectionsByGroup,
  type AiConfigSectionId,
} from "@/config/aiConfigSections";
import { useAiConfigChromeSlots } from "@/components/ai/AiConfigChromeContext";
import ChromeField from "@/components/ChromeField";
import ChromeTools from "@/components/ChromeTools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * AI 配置单行工具条：分段 Select | 段内分栏(middle) | 搜索? | trailing | 刷新。
 * 换分段时 middle/trailing 由段内 register 切换。
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
  const groups = aiConfigSectionsByGroup();
  const slots = useAiConfigChromeSlots();
  const middle = slots.middle;
  const slotTrailing = slots.trailing;
  const refresh = slots.onRefresh ?? onRefresh;

  return (
    <ChromeTools className={className}>
      <ChromeField label="分段" icon={Layers}>
        <Select value={section} onValueChange={(v) => onSectionChange(v as AiConfigSectionId)}>
          <SelectTrigger className="h-8 w-auto min-w-[6.5rem] max-w-[9rem] shrink-0 gap-1.5">
            <SelectValue placeholder="分段" />
          </SelectTrigger>
          <SelectContent align="start">
            {groups.map(({ group, sections }) => (
              <SelectGroup key={group.id}>
                <SelectLabel>{group.label}</SelectLabel>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </ChromeField>

      {middle ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">{middle}</div>
      ) : search ? (
        <Input
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
          placeholder={search.placeholder ?? "搜索…"}
          className="h-8 min-w-[8rem] flex-1"
        />
      ) : (
        <div className="min-w-0 flex-1" aria-hidden />
      )}

      {search && middle ? (
        <Input
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
          placeholder={search.placeholder ?? "搜索…"}
          className="h-8 min-w-[8rem] max-w-[16rem] flex-1"
        />
      ) : null}

      {slotTrailing}
      {trailing}

      {refresh ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          disabled={refreshing}
          onClick={() => refresh()}
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
          刷新
        </Button>
      ) : null}
    </ChromeTools>
  );
}
