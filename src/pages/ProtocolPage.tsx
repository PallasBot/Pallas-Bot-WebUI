import { useCallback, useState } from "react";
import { Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import "@/styles/protocol-page-entry.css";
import { useProtocolMount } from "@/hooks/useProtocolMount";
import { ProtocolChromeProvider } from "@/components/protocol/ProtocolChromeContext";
import { Button } from "@/components/ui/button";
import PageMasthead from "@/components/PageMasthead";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton";

export default function ProtocolPage() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["protocol-accounts"] }),
        qc.invalidateQueries({ queryKey: ["protocol-snowluma-runtimes"] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [qc, reload]);

  return (
    <ProtocolChromeProvider>
      <div className="protocol-page console-hub-page">
        <PageMasthead
          title="协议连接"
          description="消息框架已接入的账号，以及本机协议插件托管的账号；外置连接可查看与断开。"
          actions={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              iconMotion="spin"
              iconBusy={refreshing}
              disabled={refreshing}
              onClick={() => void onRefresh()}
            >
              {refreshing ? "刷新中…" : "刷新"}
            </Button>
          }
        />

        {err ? <p className="alert alert--err">{err}</p> : null}

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
              onAccountsIndex: true,
            }}
          />
        )}
      </div>
    </ProtocolChromeProvider>
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
