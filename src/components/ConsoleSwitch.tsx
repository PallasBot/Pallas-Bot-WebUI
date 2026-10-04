import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** 带可选文案的开关；视觉与全站 `Switch`（console-bool-switch）一致。 */
export default function ConsoleSwitch({
  checked,
  disabled = false,
  label,
  showLabel = true,
  tone = "default",
  ariaLabel,
  ariaDescribedBy,
  id,
  className,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label?: string;
  showLabel?: boolean;
  tone?: "default" | "amber";
  ariaLabel?: string;
  ariaDescribedBy?: string;
  id?: string;
  className?: string;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        tone={tone}
        aria-label={ariaLabel || label}
        aria-describedby={ariaDescribedBy}
        onCheckedChange={onCheckedChange}
      />
      {showLabel && label ? (
        <span className={cn("console-bool-switch__label", checked && "text-[var(--text)]")}>{label}</span>
      ) : null}
    </span>
  );
}
