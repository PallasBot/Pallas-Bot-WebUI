import { useCallback, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useProtocolMount } from "@/hooks/useProtocolMount";
import {
  protocolSectionFromPath,
  protocolSectionPath,
  type ProtocolSectionId,
} from "@/config/protocolSections";
import { ProtocolChromeProvider } from "@/components/protocol/ProtocolChromeContext";
import ProtocolChromeTools from "@/components/protocol/ProtocolChromeTools";
import PageMasthead from "@/components/PageMasthead";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton";

export default function ProtocolPage() {
  const location = useLocation();
  const navigate = useNavigate();
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

  const section = protocolSectionFromPath(location.pathname);
  const onAccountsIndex = section === "accounts";

  const onSectionChange = useCallback(
    (id: ProtocolSectionId) => {
      navigate(protocolSectionPath(id));
    },
    [navigate],
  );

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
        <PageMasthead title="协议连接" description="协议账号启停与批量操作。" />

        {err ? <p className="alert alert--err">{err}</p> : null}

        {!pageReady ? (
          <ConsolePageSkeleton panels={protocolExtensionInstalled ? 2 : 1} />
        ) : (
          <>
            <ProtocolChromeTools
              section={section}
              onSectionChange={onSectionChange}
              onRefresh={() => void onRefresh()}
              refreshing={refreshing}
              extensionInstalled={protocolExtensionInstalled}
            />
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
          </>
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
