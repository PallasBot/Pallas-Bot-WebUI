import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** 开关行：左文案右 Switch。 */
export default function AiToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  className,
}: {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-[var(--radius-control,8px)] border border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-3 py-2.5",
        className,
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
