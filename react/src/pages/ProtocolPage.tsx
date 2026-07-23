import { Outlet, useLocation } from "react-router-dom";
import { useProtocolMount } from "@/hooks/useProtocolMount";
import PageHeader from "@/components/PageHeader";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton";

export default function ProtocolPage() {
  const location = useLocation();
  const {
    pageReady,
    err,
    snap,
    mountUrl,
    reload,
    system,
    instances,
    protocolExtensionInstalled,
    protoActionsEnabled,
  } = useProtocolMount();

  const onAccountsIndex =
    location.pathname.replace(/\/$/, "") === "/protocol" ||
    location.pathname.replace(/\/$/, "") === "/pallas/protocol";

  return (
    <div className="protocol-page console-hub-page">
      <PageHeader
        title="协议连接"
        description="查看协议端已连接账号，启停与批量操作；协议资产与创建入口见下方卡片。"
      />

      {err ? <p className="alert alert--err mb-4">{err}</p> : null}

      {!pageReady ? (
        <ConsolePageSkeleton panels={protocolExtensionInstalled ? 2 : 1} />
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
