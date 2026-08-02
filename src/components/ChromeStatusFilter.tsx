import { Filter } from "lucide-react";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import { CHROME_SELECT_TRIGGER } from "@/components/ChromeTools";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ChromeStatusFilterOption<T extends string> = {
  value: T;
  label: string;
};

/** 工具条状态筛选：ChromeField + Select，选项由页面传入。 */
export default function ChromeStatusFilter<T extends string>({
  value,
  onValueChange,
  options,
  disabled = false,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly ChromeStatusFilterOption<T>[];
  disabled?: boolean;
  className?: string;
}) {
  const currentLabel = options.find((o) => o.value === value)?.label ?? "筛选";
  return (
    <ChromeField label="筛选" icon={Filter} className={className}>
      <Select
        value={value}
        onValueChange={(v) => onValueChange(v as T)}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn(
            CHROME_SELECT_TRIGGER,
            "min-w-[6.75rem] whitespace-nowrap [&>span]:whitespace-nowrap",
          )}
          aria-label="列表筛选"
        >
          <SelectValue placeholder="筛选">
            <span className="inline-flex items-center">{currentLabel}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end" className="min-w-[8.5rem]">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <ChromeOptionLabel icon={Filter}>{opt.label}</ChromeOptionLabel>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ChromeField>
  );
}
