import { ExternalLink, RefreshCw } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useProtocolMount } from "@/hooks/useProtocolMount";
import PageHeader from "@/components/PageHeader";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/protocol", label: "账号", end: true },
  { to: "/protocol/create", label: "创建" },
  { to: "/protocol/import", label: "导入" },
  { to: "/protocol/assets", label: "资产" },
];

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
        <Outlet
          context={{
            mountUrl,
            snap,
            system,
            instances,
            protocolExtensionInstalled,
            protoActionsEnabled,
            reload,
            onAccountsIndex,
          }}
        />
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
  onAccountsIndex?: boolean;
};
