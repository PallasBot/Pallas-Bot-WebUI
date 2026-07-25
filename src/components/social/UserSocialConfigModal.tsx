import { useEffect, useState } from "react";
import { axiosErrorDetail } from "@/api/http";
import { fetchUserConfigById, putUserConfig } from "@/api/fullConsole";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  open: boolean;
  userId: number | null;
  userNickname?: string;
  defaultBanned?: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

/** 用户颗粒配置：shadcn Dialog，标题左对齐。 */
export default function UserSocialConfigModal({
  open,
  userId,
  userNickname,
  defaultBanned,
  onOpenChange,
  onSaved,
}: Props) {
  const [banned, setBanned] = useState(false);
  const [loadBusy, setLoadBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [loadedId, setLoadedId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setLoadErr("");
      setSaveErr("");
      setLoadedId(null);
      return;
    }
    const uid = userId;
    if (uid == null || !Number.isFinite(uid) || uid < 1) {
      setLoadErr("无效用户 QQ。");
      return;
    }
    let cancelled = false;
    setLoadBusy(true);
    setLoadErr("");
    setSaveErr("");
    void fetchUserConfigById(uid)
      .then((u) => {
        if (cancelled) return;
        setLoadedId(u.user_id);
        setBanned(defaultBanned ? true : Boolean(u.banned));
      })
      .catch((e) => {
        if (!cancelled) setLoadErr(axiosErrorDetail(e));
      })
      .finally(() => {
        if (!cancelled) setLoadBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId, defaultBanned]);

  async function save() {
    if (loadedId == null || saveBusy) return;
    setSaveBusy(true);
    setSaveErr("");
    try {
      await putUserConfig(loadedId, { banned });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setSaveErr(axiosErrorDetail(e));
    } finally {
      setSaveBusy(false);
    }
  }

  const busy = loadBusy || saveBusy;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onOpenChange(false);
      }}
    >
      <DialogContent
        className="social-config-dialog social-config-dialog--sm flex max-h-[min(92vh,480px)] w-[min(420px,96vw)] max-w-[min(420px,96vw)] gap-0 overflow-hidden bg-card p-0"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader className="border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 text-left">
          <DialogTitle id="user-social-config-title">
            {defaultBanned ? "添加用户封禁" : "编辑用户颗粒配置"}
          </DialogTitle>
          <DialogDescription className="muted">
            QQ {loadedId ?? userId ?? "—"}
            {userNickname?.trim() ? ` · ${userNickname.trim()}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {loadBusy ? <p className="muted">加载中…</p> : null}
          {loadErr ? <p className="alert alert--err">{loadErr}</p> : null}
          {!loadBusy && !loadErr && loadedId != null ? (
            <div className="social-config-dialog__body">
              {saveErr ? <p className="alert alert--err">{saveErr}</p> : null}
              <div className="social-config-dialog__row">
                <span>封禁</span>
                <Select value={banned ? "1" : "0"} onValueChange={(v) => setBanned(v === "1")}>
                  <SelectTrigger className="h-9 w-auto min-w-[5rem]" aria-label="封禁">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">是</SelectItem>
                    <SelectItem value="0">否</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
        </div>

        {!loadBusy && !loadErr && loadedId != null ? (
          <DialogFooter className="social-config-dialog__foot border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 flex-row flex-nowrap items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={saveBusy} onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="button" size="sm" disabled={saveBusy} onClick={() => void save()}>
              {saveBusy ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
