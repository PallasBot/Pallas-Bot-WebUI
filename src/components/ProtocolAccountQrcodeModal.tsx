import { useEffect, useMemo, useState } from "react";
import {
  protocolApiErrorMessage,
  protocolFetchQrcodeImageBlob,
  protocolFetchQrcodeMeta,
  protocolRefreshAccountQrcode,
} from "@/api/protocol";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw, X } from "lucide-react";

/** 协议登录二维码：shadcn Dialog。 */
export default function ProtocolAccountQrcodeModal({
  open,
  mountUrl,
  accountId,
  accountTitle,
  onClose,
}: {
  open: boolean;
  mountUrl: string | null;
  accountId: string | null;
  accountTitle: string;
  onClose: () => void;
}) {
  const [hint, setHint] = useState("加载中…");
  const [updatedAt, setUpdatedAt] = useState(0);
  const [exists, setExists] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [imageErr, setImageErr] = useState(false);
  const [imageObjectUrl, setImageObjectUrl] = useState("");

  const updatedLabel = useMemo(() => {
    if (!updatedAt) return "";
    try {
      return `更新于 ${new Date(updatedAt * 1000).toLocaleString()} · 可直接扫码`;
    } catch {
      return "";
    }
  }, [updatedAt]);

  function revokeImageObjectUrl() {
    setImageObjectUrl((prev) => {
      if (prev) {
        try {
          URL.revokeObjectURL(prev);
        } catch {
          /* ignore */
        }
      }
      return "";
    });
  }

  async function loadQrcodeImage(ts: number) {
    if (!mountUrl || !accountId) return;
    const blob = await protocolFetchQrcodeImageBlob(mountUrl, accountId, ts || undefined);
    revokeImageObjectUrl();
    setImageObjectUrl(URL.createObjectURL(blob));
    setImageErr(false);
  }

  async function applyQrcodeMeta(
    meta: Awaited<ReturnType<typeof protocolFetchQrcodeMeta>>,
    bustCache = false,
  ) {
    const nowExists = meta.exists === true;
    const ts = meta.updated_at ?? 0;
    const deps = meta.host_deps;
    if (nowExists && (bustCache || ts !== updatedAt)) {
      setUpdatedAt(ts);
      await loadQrcodeImage(bustCache ? Date.now() : ts);
    }
    setExists(nowExists);
    if (nowExists) {
      setHint(updatedLabel || "可直接扫码登录");
    } else if (deps?.qr_capture_ready === false && Array.isArray(deps.issues) && deps.issues.length) {
      setHint(`暂无二维码（${deps.issues.join("；")}）`);
    } else {
      setHint("暂无二维码；请先启动协议进程并等待登录页生成。");
    }
  }

  async function refreshMeta(pollOnly = false) {
    if (!mountUrl || !accountId || refreshBusy) return;
    if (!pollOnly) {
      setRefreshBusy(true);
      setHint("正在刷新二维码…");
    }
    try {
      const meta = pollOnly
        ? await protocolFetchQrcodeMeta(mountUrl, accountId)
        : await protocolRefreshAccountQrcode(mountUrl, accountId);
      await applyQrcodeMeta(meta, !pollOnly);
    } catch (e) {
      if (!pollOnly) {
        setExists(false);
        setImageErr(false);
        revokeImageObjectUrl();
        setHint(protocolApiErrorMessage(e, "二维码刷新失败"));
      }
    } finally {
      if (!pollOnly) setRefreshBusy(false);
    }
  }

  function onImageError() {
    setImageErr(true);
    setHint("二维码加载失败，请点「刷新」重试");
  }

  useEffect(() => {
    if (exists && updatedLabel) setHint(updatedLabel);
  }, [exists, updatedLabel]);

  useEffect(() => {
    if (!open) {
      setHint("加载中…");
      setUpdatedAt(0);
      setExists(false);
      setImageErr(false);
      revokeImageObjectUrl();
      return;
    }
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    void (async () => {
      setRefreshBusy(true);
      try {
        if (mountUrl && accountId) {
          const meta = await protocolFetchQrcodeMeta(mountUrl, accountId);
          await applyQrcodeMeta(meta, false);
        }
      } catch {
        setHint("二维码加载失败");
      } finally {
        setRefreshBusy(false);
      }
    })();
    pollTimer = setInterval(() => {
      void refreshMeta(true);
    }, 3000);
    return () => {
      if (pollTimer) clearInterval(pollTimer);
      revokeImageObjectUrl();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when open/target changes
  }, [open, mountUrl, accountId]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="protocol-qrcode-modal__dialog gap-0 overflow-hidden bg-card p-0 sm:max-w-md">
        <DialogHeader className="border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 text-left">
          <DialogTitle id="protocol-qrcode-modal-title">登录二维码</DialogTitle>
          {accountTitle ? (
            <DialogDescription className="muted">{accountTitle}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">协议端登录二维码</DialogDescription>
          )}
        </DialogHeader>

        <div className="protocol-qrcode-modal__bd space-y-3 px-4 py-3">
          <p className="muted protocol-qrcode-modal__hint">{hint}</p>
          {exists && imageObjectUrl && !imageErr ? (
            <div className="protocol-qrcode-modal__frame">
              <img
                className="protocol-qrcode-modal__img"
                src={imageObjectUrl}
                alt="协议端登录二维码"
                onError={onImageError}
              />
            </div>
          ) : null}
        </div>

        <DialogFooter className="protocol-qrcode-modal__actions border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            iconMotion="spin"
            iconBusy={refreshBusy}
            disabled={refreshBusy}
            onClick={() => void refreshMeta(false)}
          >
            {refreshBusy ? "刷新中…" : "刷新"}
          </Button>
          <Button type="button" size="sm" icon={X} iconMotion="close" onClick={onClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
