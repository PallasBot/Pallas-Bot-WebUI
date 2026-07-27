import type { ElementType, ReactNode } from "react";
import TruncatedText from "@/components/TruncatedText";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** 标题 + 右侧图标，下方大号数值与可选副标题。 */
export default function IconStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  className,
  inlineSuffix,
  valueClassName,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ElementType;
  className?: string;
  inlineSuffix?: ReactNode;
  valueClassName?: string;
}) {
  const valueText = String(value);
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 sm:p-6 sm:pb-2">
        <CardTitle className="min-w-0 truncate text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent className="min-w-0 p-3 pt-0 sm:p-6 sm:pt-0">
        <div className="flex min-w-0 items-baseline gap-2 text-xl font-bold tabular-nums leading-none sm:text-2xl">
          <TruncatedText
            text={valueText}
            className="max-w-full"
            contentClassName={valueClassName}
          />
          {inlineSuffix ? (
            <span className="shrink-0 text-xs font-normal text-muted-foreground">{inlineSuffix}</span>
          ) : null}
        </div>
        {subtitle ? (
          <div className="mt-1.5 min-w-0 overflow-hidden text-xs text-muted-foreground">
            <TruncatedText text={subtitle} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
