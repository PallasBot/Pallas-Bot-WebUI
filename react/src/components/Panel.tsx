import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 对齐 Vue `.panel` / `.panel__hd--split` */
export default function Panel({
  title,
  actions,
  children,
  className,
  bodyClassName,
  hdNowrap,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  hdNowrap?: boolean;
}) {
  return (
    <section className={cn("panel", className)}>
      {title != null || actions != null ? (
        <div className={cn("panel__hd", actions != null && "panel__hd--split", hdNowrap && "home-page__panel-hd-nowrap")}>
          {title != null ? <h3 className="panel__title">{title}</h3> : <span />}
          {actions != null ? <div className="row-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("panel__bd", bodyClassName)}>{children}</div>
    </section>
  );
}
