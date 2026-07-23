import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Hub 页头：title / lead / actions。
 * 表面契约：挂在 Canvas 上，本身不是 Card。
 */
export default function PageChrome({
  title,
  description,
  actions,
  className,
  hideLeadOnNarrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** hub 窄屏默认藏 masthead-main；传 false 可保留 */
  hideLeadOnNarrow?: boolean;
}) {
  return (
    <header className={cn("console-hub-page__masthead page-chrome", className)}>
      <div
        className={cn(
          "console-hub-page__masthead-main",
          hideLeadOnNarrow === false ? "console-hub-page__masthead-main--keep" : undefined,
        )}
      >
        <h2 className="console-hub-page__title">{title}</h2>
        {description ? <div className="console-hub-page__lead muted">{description}</div> : null}
      </div>
      {actions ? <div className="row-actions console-hub-page__masthead-actions">{actions}</div> : null}
    </header>
  );
}
