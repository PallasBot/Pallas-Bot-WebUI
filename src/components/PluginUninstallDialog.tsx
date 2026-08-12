import { useEffect, useRef, useState } from "react";
import { PackageX, RotateCw } from "lucide-react";
import type { PluginRow } from "@/api/pallasTypes";
import { openPluginInstallJobEventSource, uninstallLocalPluginAsync } from "@/api/console";
import { axiosErrorDetail } from "@/api/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBotSystemRestart } from "@/hooks/useBotSystemRestart";
import { InstallJobFailedError, InstallJobStreamInterruptedError } from "@/utils/installJobStream";
import { waitForPluginStoreJob } from "@/utils/pluginStoreJobStream";

type Props = {
  open: boolean;
  pluginRow: PluginRow | null;
  onClose: () => void;
  onUninstalled?: () => void;
};

function uninstallTargetText(row: PluginRow): string {
  const kind = row.uninstall_kind;
  const target = (row.uninstall_target || "").trim() || row.name;
  if (kind === "dir") return `删除源码目录 ${target}/`;
  if (kind === "pip") return `卸载 pip 包 ${target}`;
  if (kind === "community") return `删除本地目录 ${target}/`;
  if (kind === "official") return `卸载 pip 包 ${target}`;
  return "移除插件";
}

/** 本地插件卸载二级确认：需输入插件名才能确认，含进度与重启提示。 */
export default function PluginUninstallDialog({ open, pluginRow, onClose, onUninstalled }: Props) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [percent, setPercent] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError] = useState("");
  const [resultMsg, setResultMsg] = useState("");
  const [needsRestart, setNeedsRestart] = useState(false);
  const uninstalledRef = useRef(false);
  const {
    restartAvailable,
    ensureRestartContext,
    restartBot,
    restartBusy,
    restartConfirmDialog,
  } = useBotSystemRestart();

  const pluginId = (pluginRow?.name || "").trim();
  const displayTitle = pluginRow?.metadata?.name || pluginId;
  const targetText = pluginRow ? uninstallTargetText(pluginRow) : "";
  const isUninstallable = Boolean(pluginRow?.uninstallable);
  const canConfirm = Boolean(pluginId && confirmText.trim() === pluginId && !busy && !finished);

  useEffect(() => {
    if (!open) return;
    uninstalledRef.current = false;
    setConfirmText("");
    setBusy(false);
    setFinished(false);
    setPercent(0);
    setProgressMsg("");
    setError("");
    setResultMsg("");
    setNeedsRestart(false);
  }, [open]);

  useEffect(() => {
    if (open) void ensureRestartContext();
  }, [open, ensureRestartContext]);

  function finishAndClose() {
    if (!uninstalledRef.current) {
      uninstalledRef.current = true;
      onUninstalled?.();
    }
    onClose();
  }

  async function handleConfirm() {
    if (!pluginRow || !isUninstallable || busy || finished) return;
    setBusy(true);
    setError("");
    setPercent(0);
    setProgressMsg("正在卸载…");
    try {
      const job = await uninstallLocalPluginAsync(pluginId);
      const payload = await waitForPluginStoreJob(
        job.job_id,
        openPluginInstallJobEventSource,
        (progress) => {
          setPercent(progress.percent);
          if (progress.message) setProgressMsg(progress.message);
        },
        { kind: "local", target: pluginId, action: "uninstall" },
      );
      const out = (payload.result ?? {}) as { message?: string; needs_restart?: boolean };
      setResultMsg(out.message || payload.message || "已卸载。");
      setNeedsRestart(Boolean(out.needs_restart));
      setFinished(true);
    } catch (e) {
      if (e instanceof InstallJobStreamInterruptedError) {
        setError("操作仍在后台进行，可稍后查看插件列表确认结果。");
      } else {
        setError(e instanceof InstallJobFailedError ? e.message : axiosErrorDetail(e));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRestart() {
    const ok = await restartBot();
    if (ok) {
      finishAndClose();
    }
  }

  return (
    <>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            if (finished) finishAndClose();
            else if (!busy) onClose();
          }
        }}
      >
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle id="plugin-uninstall-dialog-title">卸载插件「{displayTitle}」</AlertDialogTitle>
            <AlertDialogDescription>
              {isUninstallable
                ? `将${targetText}。此操作不可撤销，卸载后需重启 Bot 才能从内存移除。`
                : "该插件为内置 / 核心插件，随 Bot 本体一同分发，不支持卸载。"}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {!isUninstallable ? (
            <p className="alert alert--err m-0">「{displayTitle}」为内置 / 核心插件，无法卸载。</p>
          ) : finished ? (
            <div className="space-y-3">
              <p className="plugin-store-page__hint plugin-store-page__hint--ok m-0">{resultMsg}</p>
              {needsRestart && restartAvailable ? (
                <Button
                  type="button"
                  size="sm"
                  icon={RotateCw}
                  iconMotion="spin"
                  iconBusy={restartBusy}
                  disabled={restartBusy}
                  onClick={() => void handleRestart()}
                >
                  {restartBusy ? "重启中…" : "重启 Bot 生效"}
                </Button>
              ) : null}
            </div>
          ) : busy ? (
            <div className="plugin-store-page__detail-skeleton space-y-2" aria-live="polite">
              <p className="muted m-0 text-sm">{progressMsg || "正在卸载…"}</p>
              <div className="plugin-store-card__progress-track" aria-hidden="true">
                <div className="plugin-store-card__progress-fill" style={{ width: `${percent || 6}%` }} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="alert alert--err m-0">
                卸载会{targetText}。请确认后输入插件名以继续。
              </p>
              <label className="block space-y-1.5">
                <span className="text-[13px] text-muted-foreground">
                  输入插件名 <code>{pluginId}</code> 以确认卸载
                </span>
                <Input
                  className="h-9"
                  value={confirmText}
                  autoComplete="off"
                  autoFocus
                  placeholder={pluginId}
                  onChange={(e) => setConfirmText(e.target.value)}
                />
              </label>
              {error ? <p className="alert alert--err m-0">{error}</p> : null}
            </div>
          )}

          <AlertDialogFooter>
            {!isUninstallable ? (
              <Button type="button" size="sm" onClick={onClose}>
                完成
              </Button>
            ) : finished ? (
              <Button type="button" size="sm" onClick={finishAndClose}>
                完成
              </Button>
            ) : (
              <>
                <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  icon={PackageX}
                  iconMotion="scale"
                  disabled={!canConfirm}
                  onClick={() => void handleConfirm()}
                >
                  {busy ? "卸载中…" : "确认卸载"}
                </Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {restartConfirmDialog}
    </>
  );
}
