import { useEffect, useRef, useState } from "react";
import type { SystemData } from "@/api/pallasTypes";
import ProtocolAccountWorkspace, {
  type ProtocolAccountHeaderProfile,
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
import { cn } from "@/lib/utils";
import { qqAvatarUrl } from "@/utils/botDisplay";
import StatusTone from "@/components/StatusTone";
import { Save } from "lucide-react";

const ACCOUNT_TABS = [
  { id: "overview" as const, label: "概览" },
  { id: "settings" as const, label: "设置" },
];

const EMPTY_PROFILE: ProtocolAccountHeaderProfile = {
  displayName: "",
  qq: "",
  backendLabel: "—",
  runtimeModeLabel: "—",
  processRunning: false,
  connected: false,
};

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
  const [headerProfile, setHeaderProfile] = useState<ProtocolAccountHeaderProfile>(EMPTY_PROFILE);
  const [saveBusy, setSaveBusy] = useState(false);
  const [loadBusy, setLoadBusy] = useState(false);
  const [headerHydrated, setHeaderHydrated] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab === "settings" ? "settings" : "overview");
  }, [open, accountId, initialTab]);

  useEffect(() => {
    if (!open) {
      setHeaderHydrated(false);
      setHeaderProfile(EMPTY_PROFILE);
      return;
    }
    setHeaderHydrated(false);
    setHeaderProfile(EMPTY_PROFILE);
    const tick = () => {
      const ws = workspaceRef.current;
      if (!ws) return;
      setTitle(ws.pageTitle);
      setStatusLine(ws.statusLine);
      setHeaderProfile(ws.headerProfile);
      setSaveBusy(ws.saveBusy);
      setLoadBusy(ws.loadBusy);
      if (!ws.loadBusy && (ws.headerProfile.qq || ws.pageTitle)) {
        setHeaderHydrated(true);
      }
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [open, accountId, activeTab]);

  const canSave = activeTab === "settings" && Boolean(mountUrl && accountId) && !loadBusy && !saveBusy;
  const qq = headerProfile.qq || accountId;
  const displayName = headerProfile.displayName || title || (accountId ? `账号 ${accountId}` : "协议账号");
  const metaBits = [headerProfile.backendLabel, headerProfile.runtimeModeLabel]
    .filter((x) => x && x !== "—")
    .join(" · ");
  const headerPending = !headerHydrated || loadBusy;

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
        className="plugin-config-dialog protocol-account-config-dialog flex max-h-[min(960px,calc(100dvh-32px))] w-[min(960px,calc(100vw-32px))] max-w-[min(960px,calc(100vw-32px))] gap-0 overflow-hidden bg-card p-0"
        onEscapeKeyDown={(e) => {
          if (saveBusy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (saveBusy) e.preventDefault();
        }}
      >
        <DialogHeader className="plugin-config-dialog__head protocol-account-config-dialog__head border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 text-left sm:text-left">
          <div className="protocol-account-config-dialog__head-row flex flex-wrap items-start justify-between gap-3 pr-6">
            <div className="protocol-account-config-dialog__identity min-w-0 flex-1">
              <div className="protocol-account-config-dialog__identity-main">
                <img
                  src={qqAvatarUrl(qq)}
                  alt=""
                  width={44}
                  height={44}
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="protocol-account-config-dialog__avatar"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.visibility = "hidden";
                  }}
                />
                <div className="plugin-config-dialog__head-text min-w-0 flex-1 space-y-1 text-left">
                  <DialogTitle id="protocol-account-config-dialog-title" className="text-left">
                    {displayName}
                  </DialogTitle>
                  <p className="protocol-account-config-dialog__sub muted">
                    QQ <span className="protocol-account-config-dialog__qq">{qq}</span>
                    {metaBits ? ` · ${metaBits}` : ""}
                  </p>
                  <div className="protocol-account-config-dialog__pills" aria-label="账号状态">
                    <StatusTone
                      className="protocol-account-config-dialog__pill data-conn-capsule"
                      pending={headerPending}
                      ok={headerProfile.processRunning}
                      showDot
                      pendingLabel="探测中"
                      okLabel="运行中"
                      offLabel="已停止"
                    />
                    <StatusTone
                      className="protocol-account-config-dialog__pill data-conn-capsule"
                      pending={headerPending}
                      ok={headerProfile.connected}
                      showDot
                      pendingLabel="探测中"
                      okLabel="已连接"
                      offLabel="未连接"
                    />
                  </div>
                  {statusLine ? (
                    <DialogDescription className="sr-only">{statusLine}</DialogDescription>
                  ) : (
                    <DialogDescription className="sr-only">协议账号配置</DialogDescription>
                  )}
                </div>
              </div>
            </div>
            <div
              className="protocol-account-workspace__portal-tabs shrink-0"
              role="tablist"
              aria-label="账号分区"
            >
              {ACCOUNT_TABS.map((tab) => {
                const on = activeTab === tab.id;
                return (
                  <Button
                    key={tab.id}
                    type="button"
                    size="sm"
                    role="tab"
                    aria-selected={on}
                    variant={on ? "secondary" : "ghost"}
                    className={cn(
                      "h-8 min-w-[4.5rem] px-3 text-xs max-[560px]:h-10 max-[560px]:min-w-0 max-[560px]:flex-1 max-[560px]:text-sm",
                      on ? "font-medium" : "text-muted-foreground",
                    )}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </DialogHeader>

        <div className="plugin-config-dialog__bd protocol-account-config-dialog__bd min-h-[240px] flex-1 overflow-auto">
          {open && accountId ? (
            <ProtocolAccountWorkspace
              key={accountId}
              ref={workspaceRef}
              presentation="dialog"
              hideTabNav
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
              icon={Save}
              iconMotion="scale"
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
