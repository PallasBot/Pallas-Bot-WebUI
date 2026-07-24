import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { mainNavIconForPath } from "@/config/mainNav";
import { cn } from "@/lib/utils";

/**
 * Hub 页头：title / lead / actions。
 * 表面契约：挂在 Canvas 上，本身不是 Card。
 * 标题前缀图标与侧栏 MAIN_NAV_ITEMS 同源（按当前路由解析）。
 * 窄屏（≤560px）始终保留标题与图标；默认仅藏 lead。
 */
export default function PageChrome({
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
  /** 窄屏默认藏 lead；传 false 可保留。标题始终可见。 */
  hideLeadOnNarrow?: boolean;
  /** 默认按路由挂侧栏同款图标；无匹配项则不渲染 */
  showNavIcon?: boolean;
}) {
  const { pathname } = useLocation();
  const NavIcon = showNavIcon ? mainNavIconForPath(pathname) : undefined;

  return (
    <header className={cn("console-hub-page__masthead page-chrome", className)}>
      <div className="console-hub-page__masthead-main">
        <h2 className="console-hub-page__title">
          {NavIcon ? <NavIcon className="panel__title-ico" aria-hidden strokeWidth={2} /> : null}
          {title}
        </h2>
        {description ? (
          <div
            className={cn(
              "console-hub-page__lead muted",
              hideLeadOnNarrow ? "console-hub-page__lead--narrow-hide" : undefined,
            )}
          >
            {description}
          </div>
        ) : null}
      </div>
      {actions ? <div className="row-actions console-hub-page__masthead-actions">{actions}</div> : null}
    </header>
  );
}
