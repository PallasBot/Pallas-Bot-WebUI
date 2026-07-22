import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import brandMarkAsset from "@pallas-vue/assets/brand-avatar.png?url";
import { fetchHealth } from "@/api/health";
import { MAIN_NAV_ITEMS, sectionIcon } from "@/config/mainNav";
import ConsoleToastHost from "@/components/ConsoleToastHost";
import { cn } from "@/lib/utils";
import { readSidebarCollapsed, writeSidebarCollapsed } from "@/theme/applyShellTheme";

const brandMarkUrl = String(brandMarkAsset);
const SIDEBAR_GROUPS_KEY = "pallas.react.sidebar.groups.collapsed";

function logout() {
  const root = ((import.meta.env.BASE_URL as string) || "/pallas/").replace(/\/$/, "");
  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${root}/logout`;
  form.style.display = "none";
  document.body.appendChild(form);
  form.submit();
}

/** 与 Vue shell 一致：≤860px 走移动顶栏 + 抽屉 */
function useIsShellNarrow(bp = 860) {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(`(max-width: ${bp}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const fn = () => setNarrow(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [bp]);
  return narrow;
}

function navGroups() {
  const groups: { section: string; items: typeof MAIN_NAV_ITEMS }[] = [];
  for (const item of MAIN_NAV_ITEMS) {
    const last = groups[groups.length - 1];
    if (last?.section === item.section) last.items.push(item);
    else groups.push({ section: item.section, items: [item] });
  }
  return groups;
}

function readCollapsedGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(SIDEBAR_GROUPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function isNavActive(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  if (to === "/ai/home") {
    return (
      pathname === "/ai" ||
      pathname === "/ai/home" ||
      pathname.startsWith("/ai/home/") ||
      pathname === "/ai/statistics" ||
      pathname.startsWith("/ai/statistics/") ||
      pathname === "/ai/history" ||
      pathname.startsWith("/ai/history/")
    );
  }
  if (to === "/ai/wizard") {
    return pathname === "/ai/wizard" || pathname.startsWith("/ai/wizard/");
  }
  if (to === "/ai/config/provider" || to.startsWith("/ai/config/")) {
    return pathname.startsWith("/ai/config");
  }
  if (pathname === to || pathname.startsWith(`${to}/`)) {
    const moreSpecific = MAIN_NAV_ITEMS.some(
      (other) =>
        other.to !== to &&
        other.to.startsWith(`${to}/`) &&
        (pathname === other.to || pathname.startsWith(`${other.to}/`)),
    );
    return !moreSpecific;
  }
  return false;
}

function NavTree({
  onNavigate,
  mobile,
}: {
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const location = useLocation();
  const groups = useMemo(() => navGroups(), []);
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>(() => readCollapsedGroups());
  const linkClass = mobile ? "shell-mobile-nav__link" : "shell__nav-link";

  function groupContainsActive(items: typeof MAIN_NAV_ITEMS): boolean {
    return items.some((item) => isNavActive(location.pathname, item.to));
  }

  function isGroupOpen(section: string, items: typeof MAIN_NAV_ITEMS): boolean {
    if (groupContainsActive(items)) return true;
    return !collapsedMap[section];
  }

  function toggleGroup(section: string, items: typeof MAIN_NAV_ITEMS) {
    if (groupContainsActive(items)) return;
    setCollapsedMap((prev) => {
      const next = { ...prev, [section]: !prev[section] };
      try {
        localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <>
      {groups.map((g) => {
        const open = isGroupOpen(g.section, g.items);
        const SectionIcon = sectionIcon(g.section);
        return (
          <div key={g.section} className={cn("shell__nav-group", open && "shell__nav-group--open")}>
            <button
              type="button"
              className={cn(mobile ? "shell-mobile-nav__link shell__nav-group-toggle" : "shell__nav-group-toggle")}
              aria-expanded={open}
              aria-label={`${g.section}菜单`}
              onClick={() => toggleGroup(g.section, g.items)}
            >
              <SectionIcon className="shell__nav-ico" width={18} height={18} aria-hidden />
              <span className="shell__nav-text">
                <span className="shell__nav-label">{g.section}</span>
              </span>
              <span className="shell__nav-group-chevron" aria-hidden="true">
                ›
              </span>
            </button>
            {open ? (
              <div className="shell__nav-group-children">
                {g.items.map((item) => {
                  const Icon = item.icon;
                  const active = isNavActive(location.pathname, item.to);
                  const exact =
                    item.to === "/"
                      ? location.pathname === "/"
                      : item.to.startsWith("/ai/config")
                        ? location.pathname.startsWith("/ai/config")
                        : location.pathname === item.to;
                  return (
                    <div key={item.to} className="shell__nav-item shell__nav-item--child">
                      <NavLink
                        to={item.to}
                        end={item.to === "/"}
                        onClick={onNavigate}
                        className={cn(
                          linkClass,
                          !mobile && "shell__nav-link--child",
                          item.to === "/" && "shell__nav-link--root",
                          ["/logs", "/instances", "/plugins", "/database"].includes(item.to) &&
                            "shell__nav-link--heavy",
                          active && "is-router-active",
                          exact && "is-router-exact",
                        )}
                        aria-current={exact ? "page" : undefined}
                      >
                        <Icon className="shell__nav-ico" width={18} height={18} aria-hidden />
                        <span className="shell__nav-text">
                          <span className="shell__nav-label">{item.label}</span>
                        </span>
                      </NavLink>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export default function AppShell() {
  const location = useLocation();
  const isNarrow = useIsShellNarrow();
  const [collapsed, setCollapsed] = useState(() => readSidebarCollapsed());
  const [mobileOpen, setMobileOpen] = useState(false);
  const healthQ = useQuery({ queryKey: ["health"], queryFn: fetchHealth, refetchInterval: 15_000 });

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const connOk = Boolean(healthQ.data?.ok);
  const connText = connOk ? "已连接" : healthQ.isLoading ? "探测中" : "未连接";
  const connCls = connOk
    ? "shell__sidebar-conn--ok"
    : healthQ.isLoading
      ? "shell__sidebar-conn--pending"
      : "shell__sidebar-conn--err";

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    writeSidebarCollapsed(next);
  }

  const mainMod =
    location.pathname.startsWith("/logs")
      ? "shell__main-inner--logs"
      : location.pathname.startsWith("/plugin-store")
        ? "shell__main-inner--plugin-store"
        : location.pathname === "/"
          ? "shell__main-inner--home"
          : "shell__main-inner--hub";

  return (
    <div className={cn("shell", collapsed && !isNarrow && "shell--sidebar-collapsed")}>
      <div className="shell__bg" aria-hidden />

      {isNarrow ? (
        <div className="shell__mobile-topbar">
          <button
            type="button"
            className="shell__mobile-topbar-btn"
            aria-label="打开菜单"
            onClick={() => setMobileOpen(true)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <div className="shell__mobile-topbar-brand">
            <img className="shell__mobile-topbar-mark" src={brandMarkUrl} alt="" width={28} height={28} />
            <span className="shell__mobile-topbar-title">Pallas Bot</span>
          </div>
          <span className="shell__mobile-topbar-version">r{__WEBUI_VERSION__}</span>
        </div>
      ) : null}

      <aside className="shell__sidebar" aria-hidden={isNarrow || undefined}>
        <div className={cn("shell__sidebar-top", collapsed && !isNarrow && "shell__sidebar-top--collapsed")}>
          {collapsed && !isNarrow ? (
            <>
              <div className="shell__brand-slot shell__brand-slot--avatar">
                <div className="shell__brand-mark-wrap">
                  <img className="shell__brand-mark" src={brandMarkUrl} alt="" width={44} height={44} decoding="async" />
                </div>
                <span className={cn("shell__sidebar-conn shell__sidebar-conn--brand shell__sidebar-conn--collapsed-dot", connCls)} aria-label={connText}>
                  {connText}
                </span>
              </div>
              <div className="shell__brand-slot shell__brand-slot--expand">
                <button type="button" className="shell__brand-collapse shell__brand-expand" aria-label="展开菜单栏" onClick={toggleCollapsed}>
                  <svg className="shell__brand-collapse-ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                    <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 5v14M10 8l4 4-4 4M19 5v14" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <div className="shell__brand">
              <div className="shell__brand-mark-wrap">
                <img className="shell__brand-mark" src={brandMarkUrl} alt="" width={44} height={44} decoding="async" />
              </div>
              <div className="shell__brand-main">
                <div className="shell__brand-title-row">
                  <div className="shell__title">PBWebUI</div>
                  <span className="shell__brand-badge" title="控制台资源版本">
                    r{__WEBUI_VERSION__}
                  </span>
                </div>
                <div className="shell__brand-meta">
                  <span className={cn("shell__sidebar-conn shell__sidebar-conn--brand", connCls)}>{connText}</span>
                </div>
              </div>
              {!isNarrow ? (
                <button type="button" className="shell__brand-collapse shell__brand-collapse--edge" aria-label="收起菜单栏" onClick={toggleCollapsed}>
                  <svg className="shell__brand-collapse-ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                    <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 5v14M14 8l-4 4 4 4M19 5v14" />
                  </svg>
                </button>
              ) : null}
            </div>
          )}
        </div>

        <nav className="shell__nav" aria-label="主导航">
          <NavTree />
        </nav>

        <div className="shell__sidebar-tools">
          <button type="button" className="shell__sidebar-exit" title="退出控制台" aria-label="退出控制台" onClick={logout}>
            <svg className="shell__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="shell__sidebar-exit-label">退出</span>
          </button>
        </div>

        <div className="shell__sidebar-bottom">
          <footer className="shell__foot">
            <div className="shell__foot-copy">© PallasBot</div>
          </footer>
        </div>
      </aside>

      {isNarrow && mobileOpen ? (
        <div className="shell-mobile-nav">
          <aside className="shell-mobile-nav__panel" role="dialog" aria-modal="true" aria-label="主导航">
            <div className="shell-mobile-nav__head">
              <div className="shell-mobile-nav__brand-block">
                <div className="shell__brand-mark-wrap">
                  <img className="shell__brand-mark" src={brandMarkUrl} alt="" width={44} height={44} />
                </div>
                <div className="shell-mobile-nav__brand-text">
                  <div className="shell__brand-title-row">
                    <span className="shell-mobile-nav__brand">PBWebUI</span>
                    <span className="shell__brand-badge">r{__WEBUI_VERSION__}</span>
                  </div>
                  <div className="shell__brand-meta shell__brand-meta--mobile">
                    <span className={cn("shell__sidebar-conn shell__sidebar-conn--brand", connCls)}>{connText}</span>
                  </div>
                </div>
              </div>
              <button type="button" className="shell-mobile-nav__close" aria-label="关闭菜单" onClick={() => setMobileOpen(false)}>
                ×
              </button>
            </div>
            <nav className="shell-mobile-nav__links" aria-label="主导航">
              <NavTree mobile onNavigate={() => setMobileOpen(false)} />
            </nav>
            <div className="shell-mobile-nav__foot">
              <button type="button" className="shell__sidebar-exit" onClick={logout}>
                <span className="shell__sidebar-exit-label">退出控制台</span>
              </button>
            </div>
          </aside>
          <button type="button" className="shell-mobile-nav__backdrop" aria-label="关闭菜单" onClick={() => setMobileOpen(false)} />
        </div>
      ) : null}

      <div className="shell__main">
        <div className={cn("shell__main-inner", mainMod)}>
          <Outlet />
        </div>
      </div>
      <ConsoleToastHost />
    </div>
  );
}
