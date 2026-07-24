import { useEffect, useRef, useState } from "react";
import type { SystemData } from "@/api/pallasTypes";
import ProtocolAccountWorkspace, {
  type ProtocolAccountTab,
  type ProtocolAccountWorkspaceHandle,
} from "@/components/ProtocolAccountWorkspace";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** 协议账号配置弹窗：shadcn Dialog（居中实心底，对齐插件配置弹窗）。 */
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

  function requestClose() {
    if (saveBusy) return;
    onClose();
  }

  return (
    <Dialog
      open={open && Boolean(accountId)}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
    >
      <DialogContent
        className="plugin-config-dialog protocol-account-config-dialog flex max-h-[min(92vh,960px)] w-[min(960px,96vw)] max-w-[min(960px,96vw)] gap-0 overflow-hidden bg-card p-0"
        onEscapeKeyDown={(e) => {
          if (saveBusy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (saveBusy) e.preventDefault();
        }}
      >
        <DialogHeader className="plugin-config-dialog__head border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 text-left sm:text-left">
          <div className="plugin-config-dialog__head-text protocol-account-config-dialog__head w-full space-y-1 pr-6 text-left">
            <DialogTitle id="protocol-account-config-dialog-title" className="text-left">
              {title || (accountId ? `账号 ${accountId}` : "协议账号")}
            </DialogTitle>
            {statusLine ? (
              <DialogDescription className="muted">{statusLine}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">协议账号配置</DialogDescription>
            )}
          </div>
        </DialogHeader>

        <div className="plugin-config-dialog__bd protocol-account-config-dialog__bd min-h-[240px] flex-1 overflow-auto">
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
        </div>

        {activeTab === "settings" ? (
          <DialogFooter className="plugin-config-dialog__foot border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 sm:justify-end">
            <Button
              type="button"
              size="sm"
              disabled={!canSave}
              title="Ctrl+S"
              onClick={() => void workspaceRef.current?.saveSettings()}
            >
              {saveBusy ? "保存中…" : "保存并重启"}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
