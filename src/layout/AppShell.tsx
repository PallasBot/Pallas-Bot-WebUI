import { Fragment, Suspense, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import brandMarkAsset from "@/assets/brand-avatar.png?url";
import { fetchHealth } from "@/api/health";
import {
  fetchCommunityPluginStore,
  fetchOfficialExtensions,
  fetchWebuiAutoUpdateStatus,
} from "@/api/fullConsole";
import { pendingAutoUpdateLabel } from "@/utils/autoUpdateNotice";
import { MAIN_NAV_ITEMS, buildNavEntries, isNavActive, sectionIcon } from "@/config/mainNav";
import type { MainNavItem } from "@/config/mainNav";
import { PLUGIN_STORE_SEEN_EVENT, summarizePluginStoreNotice } from "@/utils/pluginStoreNotice";
import BotRestartProgressDialog from "@/components/BotRestartProgressDialog";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton";
import ConsoleToastHost from "@/components/ConsoleToastHost";
import { useBotSystemRestart } from "@/hooks/useBotSystemRestart";
import { cn } from "@/lib/utils";
import {
  botRestartInProgress,
  getBotRestartSession,
  subscribeBotRestartSession,
} from "@/state/botRestartSession";
import { readSidebarCollapsed, writeSidebarCollapsed } from "@/theme/applyShellTheme";
import { PALLAS_SHELL_EXTERNAL_LINKS } from "@/utils/pallasExternalLinks";
import { prefetchConsoleShell } from "@/utils/prefetchConsoleShell";
import { querySettled } from "@/utils/querySettled";
import { consoleResourceVersionLabel } from "@/utils/versionDisplay";

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

/** 与现有控件一致：≤860px 走移动顶栏 + 抽屉 */
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

function navExact(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  if (to.startsWith("/ai/config")) return pathname.startsWith("/ai/config");
  return pathname === to;
}

function NavItemLink({
  item,
  linkClass,
  child,
  onNavigate,
  notices,
}: {
  item: MainNavItem;
  linkClass: string;
  child?: boolean;
  onNavigate?: () => void;
  notices?: Partial<Record<string, string | null | undefined>>;
}) {
  const location = useLocation();
  const Icon = item.icon;
  const active = isNavActive(location.pathname, item.to);
  const exact = navExact(location.pathname, item.to);
  const notice = notices?.[item.to] || null;
  const showNotice = Boolean(notice);
  return (
    <div className={cn("shell__nav-item", child && "shell__nav-item--child")}>
      <NavLink
        to={item.to}
        end={item.to === "/"}
        onClick={onNavigate}
        title={showNotice ? notice || item.label : item.label}
        className={cn(
          linkClass,
          child && "shell__nav-link--child",
          item.to === "/" && "shell__nav-link--root",
          active && "is-router-active",
          exact && "is-router-exact",
        )}
        aria-current={exact ? "page" : undefined}
        aria-label={showNotice ? `${item.label}（${notice}）` : item.label}
      >
        <Icon className="shell__nav-ico" width={18} height={18} aria-hidden />
        <span className="shell__nav-text">
          <span className="shell__nav-label">
            <span className="shell__nav-label-text">{item.label}</span>
            {showNotice ? <span className="shell__nav-notice-dot" aria-hidden /> : null}
          </span>
        </span>
      </NavLink>
    </div>
  );
}

function NavTree({
  onNavigate,
  mobile,
  railCollapsed,
  navNotices,
}: {
  onNavigate?: () => void;
  mobile?: boolean;
  /** 桌面侧栏收起：扁平图标轨，隐藏分组折叠头 */
  railCollapsed?: boolean;
  navNotices?: Partial<Record<string, string | null | undefined>>;
}) {
  const location = useLocation();
  const entries = useMemo(() => buildNavEntries(MAIN_NAV_ITEMS), []);
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>(() => readCollapsedGroups());
  const linkClass = mobile ? "shell-mobile-nav__link" : "shell__nav-link";

  function groupContainsActive(items: MainNavItem[]): boolean {
    return items.some((item) => isNavActive(location.pathname, item.to));
  }

  function isGroupOpen(section: string, items: MainNavItem[]): boolean {
    if (railCollapsed) return true;
    if (groupContainsActive(items)) return true;
    return !collapsedMap[section];
  }

  function toggleGroup(section: string, items: MainNavItem[]) {
    if (railCollapsed) return;
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
      {entries.map((entry) => {
        if (entry.kind === "item") {
          return (
            <NavItemLink
              key={entry.item.to}
              item={entry.item}
              linkClass={linkClass}
              onNavigate={onNavigate}
              notices={navNotices}
            />
          );
        }

        const open = isGroupOpen(entry.section, entry.items);
        const SectionIcon = sectionIcon(entry.section);
        const groupHasNotice = entry.items.some((item) => Boolean(navNotices?.[item.to]));
        return (
          <div key={entry.section} className={cn("shell__nav-group", open && "shell__nav-group--open")}>
            {railCollapsed ? null : (
              <button
                type="button"
                className={cn(mobile ? "shell-mobile-nav__link shell__nav-group-toggle" : "shell__nav-group-toggle")}
                aria-expanded={open}
                aria-label={`${entry.section}菜单`}
                onClick={() => toggleGroup(entry.section, entry.items)}
              >
                <SectionIcon className="shell__nav-ico" width={18} height={18} aria-hidden />
                <span className="shell__nav-text">
                  <span className="shell__nav-label">
                    <span className="shell__nav-label-text">{entry.section}</span>
                    {groupHasNotice ? <span className="shell__nav-notice-dot" aria-hidden /> : null}
                  </span>
                </span>
                <span className="shell__nav-group-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            )}
            {open ? (
              <div className="shell__nav-group-children">
                {entry.items.map((item) => (
                  <NavItemLink
                    key={item.to}
                    item={item}
                    linkClass={linkClass}
                    child={!mobile}
                    onNavigate={onNavigate}
                    notices={navNotices}
                  />
                ))}
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
  const qc = useQueryClient();
  const isNarrow = useIsShellNarrow();
  const [collapsed, setCollapsed] = useState(() => readSidebarCollapsed());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pluginStoreSeenRev, setPluginStoreSeenRev] = useState(0);
  useEffect(() => {
    const onSeen = () => setPluginStoreSeenRev((n) => n + 1);
    window.addEventListener(PLUGIN_STORE_SEEN_EVENT, onSeen);
    return () => window.removeEventListener(PLUGIN_STORE_SEEN_EVENT, onSeen);
  }, []);
  const healthQ = useQuery({ queryKey: ["health"], queryFn: () => fetchHealth(), refetchInterval: 15_000 });
  const autoUpdateQ = useQuery({
    queryKey: ["webui-auto-update-status"],
    queryFn: fetchWebuiAutoUpdateStatus,
    refetchInterval: 60_000,
  });
  const communityStoreQ = useQuery({
    queryKey: ["plugins-community-store", "nav-notice"],
    queryFn: () => fetchCommunityPluginStore({ skipAssets: true }),
    refetchInterval: 180_000,
    staleTime: 120_000,
    retry: 1,
  });
  const officialStoreQ = useQuery({
    queryKey: ["plugins-official-extensions", "nav-notice"],
    queryFn: () => fetchOfficialExtensions({ skipAssets: true }),
    refetchInterval: 180_000,
    staleTime: 120_000,
    retry: 1,
  });
  const updateNotice = pendingAutoUpdateLabel(autoUpdateQ.data?.pending_notice);
  const pluginStoreNotice = useMemo(() => {
    const community = communityStoreQ.data?.plugins || [];
    const official = officialStoreQ.data || [];
    let updateCount = 0;
    for (const row of community) {
      if (row.has_update === true) updateCount += 1;
    }
    for (const row of official) {
      if (row.has_update === true) updateCount += 1;
    }
    // 两侧目录都拉完再建「已见表」基线，避免先到一侧把另一侧整表标成上新
    if (!communityStoreQ.isFetched || !officialStoreQ.isFetched) {
      return summarizePluginStoreNotice({ catalogIds: [], updateCount }).label;
    }
    const catalogIds = [
      ...community.map((p) => `community:${p.plugin_id}`),
      ...official.map((p) => `official:${String(p.package || "").trim()}`).filter((x) => x !== "official:"),
    ];
    return summarizePluginStoreNotice({ catalogIds, updateCount }).label;
  }, [
    communityStoreQ.data,
    communityStoreQ.isFetched,
    officialStoreQ.data,
    officialStoreQ.isFetched,
    pluginStoreSeenRev,
  ]);
  const navNotices = useMemo(
    () => ({
      "/update": updateNotice,
      "/plugin-store": pluginStoreNotice,
    }),
    [updateNotice, pluginStoreNotice],
  );
  const {
    restartBusy,
    restartInProgress,
    restartAvailable,
    shardedRuntime,
    ensureRestartContext,
    restartBot,
    restartConfirmDialog,
  } = useBotSystemRestart();
  const restartSession = useSyncExternalStore(subscribeBotRestartSession, getBotRestartSession, getBotRestartSession);
  const restartActionBusy =
    restartBusy || restartInProgress || restartSession.busy || botRestartInProgress(restartSession);
  const fullRestartLabel = restartActionBusy
    ? "重启中…"
    : shardedRuntime
      ? "重启全部进程"
      : "重启 Bot";

  useEffect(() => setMobileOpen(false), [location.pathname]);

  useEffect(() => {
    void ensureRestartContext();
  }, [ensureRestartContext]);

  useEffect(() => {
    prefetchConsoleShell(qc);
  }, [qc]);

  const healthSettled = querySettled(healthQ);
  const connOk = Boolean(healthQ.data?.ok);
  const connPending = !healthSettled;
  const connText = connPending ? "探测中" : connOk ? "已连接" : "未连接";
  const connCls = connOk
    ? "shell__sidebar-conn--ok"
    : connPending
      ? "shell__sidebar-conn--pending"
      : "shell__sidebar-conn--err";
  const brandVersionDisplay = useMemo(
    () =>
      consoleResourceVersionLabel(healthQ.data, null, {
        webuiBuildVersion: __WEBUI_VERSION__,
      }),
    [healthQ.data],
  );

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    writeSidebarCollapsed(next);
  }

  async function triggerShellRestart(workersOnly = false) {
    setMobileOpen(false);
    await restartBot(workersOnly);
  }

  const mainMod =
    location.pathname.startsWith("/logs") || location.pathname.startsWith("/log-errors")
      ? "shell__main-inner--logs"
      : location.pathname.startsWith("/plugin-store")
        ? "shell__main-inner--plugin-store"
        : location.pathname === "/"
          ? "shell__main-inner--home"
          : "shell__main-inner--hub";

  return (
    <div className={cn("shell", collapsed && !isNarrow && "shell--sidebar-collapsed")}>
      {restartConfirmDialog}
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
            <div className="shell__brand-title-row shell__mobile-topbar-title-row">
              <span className="shell__mobile-topbar-title">Pallas Bot</span>
              <span className="shell__brand-badge shell__mobile-topbar-version" title="控制台资源版本">
                {brandVersionDisplay}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <aside className="shell__sidebar" aria-hidden={isNarrow || undefined}>
        <div className={cn("shell__sidebar-top", collapsed && !isNarrow && "shell__sidebar-top--collapsed")}>
          {collapsed && !isNarrow ? (
            <>
              <div className="shell__brand-slot shell__brand-slot--avatar">
                <div className="shell__brand-mark-wrap" title={connText}>
                  <img className="shell__brand-mark" src={brandMarkUrl} alt="" width={28} height={28} decoding="async" />
                  <span
                    className={cn(
                      "shell__sidebar-conn shell__sidebar-conn--brand shell__sidebar-conn--collapsed-dot",
                      connCls,
                    )}
                    aria-label={connText}
                  />
                </div>
              </div>
              <div className="shell__brand-slot shell__brand-slot--expand">
                <button
                  type="button"
                  className="shell__brand-collapse shell__brand-expand"
                  aria-label="展开菜单栏"
                  onClick={toggleCollapsed}
                >
                  <svg className="shell__brand-collapse-ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                    <path
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 5v14M10 8l4 4-4 4M19 5v14"
                    />
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
                </div>
                <div className="shell__brand-meta">
                  <span className={cn("shell__sidebar-conn shell__sidebar-conn--brand", connCls)}>{connText}</span>
                  <span className="shell__brand-badge" title="控制台资源版本">
                    {brandVersionDisplay}
                  </span>
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

        <div className="shell__nav-clip">
          <nav className="shell__nav" aria-label="主导航">
            <NavTree railCollapsed={collapsed && !isNarrow} navNotices={navNotices} />
          </nav>
        </div>

        <div className="shell__sidebar-tools">
          {restartAvailable ? (
            <div className="shell__sidebar-restart-group">
              {shardedRuntime ? (
                <button
                  type="button"
                  className="shell__sidebar-restart"
                  title="重启 Worker"
                  aria-label="重启 Worker"
                  disabled={restartActionBusy}
                  onClick={() => void triggerShellRestart(true)}
                >
                  <svg
                    className="shell__ico"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M21 12a9 9 0 1 1-3.2-6.9" />
                    <polyline points="21 3 21 9 15 9" />
                  </svg>
                  <span className="shell__sidebar-restart-label">重启 Worker</span>
                </button>
              ) : null}
              <button
                type="button"
                className="shell__sidebar-restart"
                title={fullRestartLabel}
                aria-label={fullRestartLabel}
                disabled={restartActionBusy}
                onClick={() => void triggerShellRestart(false)}
              >
                <svg
                  className="shell__ico"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M3 12a9 9 0 1 0 9-9" />
                  <polyline points="3 3 3 9 9 9" />
                </svg>
                <span className="shell__sidebar-restart-label">{fullRestartLabel}</span>
              </button>
            </div>
          ) : null}
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
            <nav className="shell__foot-links" aria-label="外部链接">
              {PALLAS_SHELL_EXTERNAL_LINKS.map((item, index) => (
                <Fragment key={item.href}>
                  {index > 0 ? (
                    <span className="shell__foot-sep" aria-hidden>
                      {" "}
                      ·{" "}
                    </span>
                  ) : null}
                  <a
                    className="shell__foot-link"
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.label}
                  </a>
                </Fragment>
              ))}
            </nav>
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
                    <span className="shell__brand-badge" title="控制台资源版本">
                      {brandVersionDisplay}
                    </span>
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
              <NavTree mobile onNavigate={() => setMobileOpen(false)} navNotices={navNotices} />
            </nav>
            <div className="shell-mobile-nav__tools">
              {restartAvailable ? (
                <>
                  {shardedRuntime ? (
                    <button
                      type="button"
                      className="shell__sidebar-restart shell__sidebar-restart--mobile"
                      disabled={restartActionBusy}
                      onClick={() => void triggerShellRestart(true)}
                    >
                      重启 Worker
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="shell__sidebar-restart shell__sidebar-restart--mobile"
                    disabled={restartActionBusy}
                    onClick={() => void triggerShellRestart(false)}
                  >
                    {fullRestartLabel}
                  </button>
                </>
              ) : null}
              <button type="button" className="shell__sidebar-exit shell__sidebar-exit--mobile" onClick={logout}>
                退出控制台
              </button>
            </div>
            <nav className="shell-mobile-nav__external" aria-label="外部链接">
              {PALLAS_SHELL_EXTERNAL_LINKS.map((item, index) => (
                <Fragment key={item.href}>
                  {index > 0 ? (
                    <span className="shell__foot-sep" aria-hidden>
                      {" "}
                      ·{" "}
                    </span>
                  ) : null}
                  <a
                    className="shell-mobile-nav__external-link"
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.label}
                  </a>
                </Fragment>
              ))}
            </nav>
          </aside>
          <button type="button" className="shell-mobile-nav__backdrop" aria-label="关闭菜单" onClick={() => setMobileOpen(false)} />
        </div>
      ) : null}

      <div className="shell__main">
        <div className={cn("shell__main-inner", mainMod)}>
          <Suspense fallback={<ConsolePageSkeleton panels={3} />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
      <ConsoleToastHost />
      <BotRestartProgressDialog />
    </div>
  );
}
