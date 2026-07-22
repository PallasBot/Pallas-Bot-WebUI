import { ExternalLink, RefreshCw } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useProtocolMount } from "@/hooks/useProtocolMount";
import PageHeader from "@/components/PageHeader";
import { protocolDisp } from "@/utils/protocolUi";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/protocol", label: "账号", end: true },
  { to: "/protocol/create", label: "创建" },
  { to: "/protocol/import", label: "导入" },
  { to: "/protocol/assets", label: "资产" },
];

function boolPillClass(on: boolean): string {
  return on ? "data-pill data-pill--on" : "data-pill data-pill--off";
}

function pillLabel(d: ReturnType<typeof protocolDisp>): string {
  return d.kind === "pill" ? (d.on ? d.onLabel : d.offLabel) : d.text;
}

function pillOn(d: ReturnType<typeof protocolDisp>): boolean {
  return d.kind === "pill" && d.on;
}

export default function ProtocolPage() {
  const location = useLocation();
  const {
    pageReady,
    err,
    snap,
    mountUrl,
    reload,
    isFetching,
    system,
    instances,
    protocolExtensionInstalled,
    protoActionsEnabled,
  } = useProtocolMount();

  const webuiPath = snap?.webui_path || "/protocol/console";
  const onAccountsIndex =
    location.pathname.replace(/\/$/, "") === "/protocol" ||
    location.pathname.replace(/\/$/, "") === "/pallas/protocol";

  const webuiEnabledDisp = protocolDisp(snap?.webui_enabled, "已启用", "未启用");
  const consoleAuthDisp = protocolDisp(snap?.console_auth_configured, "已配置", "未配置");

  return (
    <div className="protocol-page console-hub-page">
      <PageHeader
        title="协议连接"
        description="查看协议端已连接账号，启停与批量操作；协议资产与创建入口见下方卡片。"
        actions={
          <div className="row-actions console-hub-toolbar-strip__masthead-actions">
            {snap?.webui_enabled ? (
              <button
                type="button"
                className="btn"
                onClick={() => window.open(webuiPath, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink size={16} />
                协议控制台
              </button>
            ) : null}
            <button type="button" className="btn" disabled={isFetching} onClick={() => void reload()}>
              <RefreshCw className={isFetching ? "animate-spin" : undefined} size={16} />
              刷新
            </button>
          </div>
        }
      />

      {err ? <p className="alert alert--err mb-4">{err}</p> : null}

      <div className="console-view-toggle protocol-page__tabs mb-6" role="tablist" aria-label="协议管理">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => cn(isActive && "is-on")}
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      {!pageReady ? (
        <p className="muted text-sm">加载中…</p>
      ) : (
        <>
          <Outlet
            context={{
              mountUrl,
              snap,
              system,
              instances,
              protocolExtensionInstalled,
              protoActionsEnabled,
              reload,
            }}
          />

          {protocolExtensionInstalled && onAccountsIndex ? (
            <section className="panel protocol-page__panel mt-6">
              <div className="panel__hd panel__hd--split inst-db-panel__hd">
                <h2 className="panel__title">协议端入口</h2>
                <div className="row-actions" />
              </div>
              <div className="panel__bd">
                <div className="protocol-page__meta console-kv-block">
                  <div className="data-summary-card__row">
                    <span className="data-summary-card__label">内置 WebUI</span>
                    {webuiEnabledDisp.kind === "pill" ? (
                      <span className={boolPillClass(pillOn(webuiEnabledDisp))}>{pillLabel(webuiEnabledDisp)}</span>
                    ) : (
                      <span className="muted">{pillLabel(webuiEnabledDisp)}</span>
                    )}
                  </div>
                  {snap?.webui_path ? (
                    <p className="muted protocol-page__meta-path">
                      路径 <code>{snap.webui_path}</code>
                    </p>
                  ) : null}
                  <div className="data-summary-card__row">
                    <span className="data-summary-card__label">控制台鉴权</span>
                    {consoleAuthDisp.kind === "pill" ? (
                      <span className={boolPillClass(pillOn(consoleAuthDisp))}>{pillLabel(consoleAuthDisp)}</span>
                    ) : (
                      <span className="muted">{pillLabel(consoleAuthDisp)}</span>
                    )}
                  </div>
                </div>
                <p className="muted protocol-page__entry-hint">
                  运行时下载、Docker 镜像与全局运行模式已迁入本控制台{" "}
                  <Link className="link-quiet" to="/protocol/assets">
                    协议资产
                  </Link>
                  ；下方按钮仍可打开协议插件内置页（创建 / 导入账号等）。
                </p>
                <div className="row-actions protocol-page__actions protocol-page__entry-actions">
                  <Link className="btn" to="/protocol/create">
                    创建账号
                  </Link>
                  <Link className="btn" to="/protocol/import">
                    导入账号
                  </Link>
                  <Link className="btn" to="/protocol/assets">
                    协议资产
                  </Link>
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

export type ProtocolOutletContext = {
  mountUrl: string | null;
  snap: ReturnType<typeof useProtocolMount>["snap"];
  system: ReturnType<typeof useProtocolMount>["system"];
  instances: ReturnType<typeof useProtocolMount>["instances"];
  protocolExtensionInstalled: boolean;
  protoActionsEnabled: boolean;
  reload: () => Promise<unknown>;
};
