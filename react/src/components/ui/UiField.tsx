/**
 * @deprecated 新代码可用 Label + 自建布局，或后续 Field 原语。
 * 本壳保留 Vue 期字段标签行结构。
 */
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function UiField({
  label,
  required = false,
  secret = false,
  hideLabel = false,
  className,
  labelStart,
  labelEnd,
  meta,
  children,
}: {
  label?: string;
  required?: boolean;
  secret?: boolean;
  hideLabel?: boolean;
  className?: string;
  labelStart?: ReactNode;
  labelEnd?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
}) {
  const showLabelRow = !hideLabel && Boolean(label || labelStart || labelEnd || meta);

  return (
    <div className={cn("ui-field space-y-1.5", className)}>
      {showLabelRow ? (
        <div className="ui-field__label-row flex items-start justify-between gap-2">
          <div className="ui-field__label flex min-w-0 items-center gap-1.5">
            {labelStart}
            <div className="ui-field__title flex min-w-0 items-center gap-1.5">
              {label ? (
                <Label className="ui-field__label-text truncate" title={label}>
                  {label}
                </Label>
              ) : null}
              {labelEnd}
            </div>
            {required ? (
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            ) : null}
            {secret ? (
              <span className="rounded-[var(--radius-control,6px)] bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                密钥
              </span>
            ) : null}
          </div>
          {meta ? <div className="ui-field__meta shrink-0 text-xs text-muted-foreground">{meta}</div> : null}
        </div>
      ) : null}
      <div className="ui-field__control">{children}</div>
    </div>
  );
}
