import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function ConsoleHubToolbarStrip({
  search,
  middle,
  actions,
  actionsOnly = false,
  className,
}: {
  search?: ReactNode;
  middle?: ReactNode;
  actions?: ReactNode;
  actionsOnly?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "console-hub-toolbar-strip",
        actionsOnly && "console-hub-toolbar-strip--actions-only",
        className,
      )}
    >
      <div className="console-hub-toolbar-strip__main">
        {search ? <div className="console-hub-toolbar-strip__search">{search}</div> : null}
        {middle ? <div className="console-hub-toolbar-strip__middle">{middle}</div> : null}
        {actions ? <div className="console-hub-toolbar-strip__actions">{actions}</div> : null}
      </div>
    </div>
  );
}
