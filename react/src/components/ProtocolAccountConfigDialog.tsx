import { useEffect, useRef, useState } from "react";
import type { SystemData } from "@pallas-vue/api/pallasTypes";
import ConsoleModal from "@/components/ConsoleModal";
import ProtocolAccountWorkspace, {
  type ProtocolAccountTab,
  type ProtocolAccountWorkspaceHandle,
} from "@/components/ProtocolAccountWorkspace";

export default function ProtocolAccountConfigDialog({
  open,
  accountId,
  mountUrl,
  system,
  initialTab = "overview",
  onClose,
  onDeleted,
}: {
  open: boolean;
  accountId: string;
  mountUrl: string | null;
  system: SystemData | null;
  initialTab?: ProtocolAccountTab;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const workspaceRef = useRef<ProtocolAccountWorkspaceHandle>(null);
  const [activeTab, setActiveTab] = useState<ProtocolAccountTab>("overview");
  const [title, setTitle] = useState("");
  const [statusLine, setStatusLine] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [loadBusy, setLoadBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab === "settings" ? "settings" : "overview");
  }, [open, accountId, initialTab]);

  useEffect(() => {
    if (!open) return;
    const tick = () => {
      const ws = workspaceRef.current;
      if (!ws) return;
      setTitle(ws.pageTitle);
      setStatusLine(ws.statusLine);
      setSaveBusy(ws.saveBusy);
      setLoadBusy(ws.loadBusy);
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [open, accountId, activeTab]);

  const canSave = activeTab === "settings" && Boolean(mountUrl && accountId) && !loadBusy && !saveBusy;

  return (
    <ConsoleModal
      open={open && Boolean(accountId)}
      titleId="protocol-account-config-dialog-title"
      panelClass="plugin-config-dialog protocol-account-config-dialog"
      bodyClass="plugin-config-dialog__bd protocol-account-config-dialog__bd"
      busy={saveBusy}
      onClose={onClose}
      header={
        <>
          <div className="console-modal__head-text protocol-account-config-dialog__head">
            <div className="protocol-account-config-dialog__head-text">
              <h2 id="protocol-account-config-dialog-title" className="console-modal__title">
                {title || (accountId ? `账号 ${accountId}` : "协议账号")}
              </h2>
              {statusLine ? <p className="console-modal__subtitle muted">{statusLine}</p> : null}
            </div>
          </div>
          <button type="button" className="console-modal__close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </>
      }
      footer={
        <div className="plugin-config-dialog__foot row-actions">
          {activeTab === "settings" ? (
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canSave}
              title="Ctrl+S"
              onClick={() => void workspaceRef.current?.saveSettings()}
            >
              {saveBusy ? "保存中…" : "保存并重启"}
            </button>
          ) : null}
        </div>
      }
    >
      {open && accountId ? (
        <ProtocolAccountWorkspace
          key={accountId}
          ref={workspaceRef}
          presentation="dialog"
          accountId={accountId}
          mountUrl={mountUrl}
          system={system}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          onDeleted={() => {
            onDeleted?.();
            onClose();
          }}
        />
      ) : null}
    </ConsoleModal>
  );
}
