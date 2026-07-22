import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function UiField({
  label,
  required = false,
  secret = false,
  hideLabel = false,
  className,
  labelEnd,
  meta,
  children,
}: {
  label?: string;
  required?: boolean;
  secret?: boolean;
  hideLabel?: boolean;
  className?: string;
  labelEnd?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
}) {
  const showLabelRow = !hideLabel && Boolean(label || labelEnd || meta);

  return (
    <div className={cn("ui-field", className)}>
      {showLabelRow ? (
        <div className="ui-field__label-row">
          <div className="ui-field__label">
            <div className="ui-field__title">
              {label ? (
                <span className="ui-field__label-text" title={label}>
                  {label}
                </span>
              ) : null}
              {labelEnd}
            </div>
            {required ? (
              <span className="ui-field__required" aria-hidden="true">
                *
              </span>
            ) : null}
            {secret ? <span className="ui-field__secret">密钥</span> : null}
          </div>
          {meta ? <div className="ui-field__meta">{meta}</div> : null}
        </div>
      ) : null}
      <div className="ui-field__control">{children}</div>
    </div>
  );
}
