import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** 全站 hub 搜索：图标在输入框外（避免叠字），描边跟 control 面。 */
export default function ConsoleHubSearch({
  value,
  onValueChange,
  placeholder = "搜索…",
  ariaLabel,
  className,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("console-hub-page__search-wrap", className)}>
      <label className="console-hub-page__search">
        <span className="console-hub-page__search-ico" aria-hidden="true">
          <Search className="console-hub-page__search-svg text-[var(--text-muted)]" strokeWidth={1.75} />
        </span>
        <Input
          className="console-hub-page__search-input h-8 min-h-8 focus-visible:ring-0 focus-visible:ring-offset-0"
          type="search"
          placeholder={placeholder}
          aria-label={ariaLabel || placeholder}
          autoComplete="off"
          disabled={disabled}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        />
      </label>
    </div>
  );
}
