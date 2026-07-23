import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { mainNavIconForPath } from "@/config/mainNav";
import { cn } from "@/lib/utils";

/** 控制台页头（shadcn/Tailwind），不依赖 hub `.console-hub-page__*`。 */
export default function PageMasthead({
  title,
  description,
  actions,
  className,
  hideLeadOnNarrow = true,
  showNavIcon = true,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  hideLeadOnNarrow?: boolean;
  /** 默认按路由挂侧栏同款图标；无匹配项则不渲染 */
  showNavIcon?: boolean;
}) {
  const { pathname } = useLocation();
  const NavIcon = showNavIcon ? mainNavIconForPath(pathname) : undefined;

  return (
    <header
      className={cn(
        /* 底边距由 --console-page-masthead-gap（.page-masthead）；父级有 gap 时 CSS 归零 */
        "page-masthead flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="flex items-center gap-1.5 text-[length:var(--console-page-title-size,1.15rem)] font-semibold tracking-tight text-foreground">
          {NavIcon ? (
            <NavIcon className="panel__title-ico size-[1.15em] shrink-0 opacity-80" aria-hidden strokeWidth={2} />
          ) : null}
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "text-[length:var(--console-page-lead-size,0.75rem)] leading-relaxed text-muted-foreground",
              hideLeadOnNarrow ? "hidden sm:block" : undefined,
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
