import type { ReactNode } from "react";
import { AlertTriangle, Sparkles, Zap } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type TierCardKind = "high" | "low";

type SlotProps = {
  label: string;
  description?: string;
  muted?: boolean;
  invalid?: boolean;
  invalidText?: string;
  children: ReactNode;
};

function TierSlot({ label, description, muted, invalid, invalidText, children }: SlotProps) {
  return (
    <div className={cn("space-y-2", muted && "border-l-2 border-primary/20 pl-3 ml-0.5")}>
      <div className="space-y-0.5">
        <Label className={cn(muted ? "text-xs font-medium text-muted-foreground" : "text-sm font-semibold")}>
          {label}
        </Label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
      {invalid ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="size-3.5 shrink-0" />
          {invalidText || "尚未配置该档模型。"}
        </p>
      ) : null}
    </div>
  );
}

type TierCardProps = {
  kind: TierCardKind;
  title: string;
  description: string;
  primary: ReactNode;
  backup: ReactNode;
  primaryInvalid?: boolean;
  backupInvalid?: boolean;
  /** 默认「主配置」——任务编排用；本地难度分流可改成「复杂 / 中等」等 */
  primaryLabel?: string;
  primaryDescription?: string;
  /** 默认「备用配置」+ 失败切换说明；本地路由应改成真实难度档名 */
  backupLabel?: string;
  backupDescription?: string;
  className?: string;
};

export function TierCard({
  kind,
  title,
  description,
  primary,
  backup,
  primaryInvalid,
  backupInvalid,
  primaryLabel = "主配置",
  primaryDescription,
  backupLabel = "备用配置",
  backupDescription = "主配置失败或限流时自动切换；可同提供方换模型。",
  className,
}: TierCardProps) {
  const Icon = kind === "high" ? Sparkles : Zap;
  return (
    <div
      className={cn(
        "space-y-4 rounded-[var(--radius-control,8px)] border border-[color-mix(in_srgb,var(--border)_70%,transparent)] p-4",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 space-y-0.5">
          <h3 className="text-sm font-semibold leading-snug">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <TierSlot label={primaryLabel} description={primaryDescription} invalid={primaryInvalid}>
        {primary}
      </TierSlot>
      <TierSlot
        label={backupLabel}
        muted
        description={backupDescription}
        invalid={backupInvalid}
      >
        {backup}
      </TierSlot>
    </div>
  );
}

type TierPairCardsProps = {
  high: ReactNode;
  low: ReactNode;
  className?: string;
};

/** 高低双卡并排；窄屏单列 */
export default function TierPairCards({ high, low, className }: TierPairCardsProps) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2", className)}>
      {high}
      {low}
    </div>
  );
}
