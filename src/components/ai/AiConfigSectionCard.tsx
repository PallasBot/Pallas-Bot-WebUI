import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  /** 省略时不渲染 CardHeader（子内容自带段头时用，避免与下拉分区名重复）。 */
  title?: string;
  description?: string;
  /** 与标题同一行右侧（如开关），窄屏可换行。 */
  headerAction?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
  className?: string;
};

/** AI 配置页统一卡片：有 title/description 时用 CardHeader；否则内容区自带完整 padding。 */
export default function AiConfigSectionCard({
  title,
  description,
  headerAction,
  children,
  footer,
  contentClassName,
  className,
}: Props) {
  const showHeader = Boolean(title || description || headerAction);
  return (
    <Card className={className}>
      {showHeader ? (
        <CardHeader>
          {title || headerAction ? (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              {title ? <CardTitle className="min-w-0">{title}</CardTitle> : <span />}
              {headerAction ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">{headerAction}</div>
              ) : null}
            </div>
          ) : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn(showHeader ? undefined : "pt-5", contentClassName)}>
        {children}
      </CardContent>
      {footer ?? null}
    </Card>
  );
}
