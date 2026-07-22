import { useEffect, useState } from "react";
import { axiosErrorDetail } from "@/api/http";
import { fetchUserConfigById, putUserConfig } from "@/api/fullConsole";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  userId: number | null;
  userNickname?: string;
  defaultBanned?: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{defaultBanned ? "添加用户封禁" : "编辑用户颗粒配置"}</DialogTitle>
          <DialogDescription>
            QQ {loadedId ?? userId ?? "—"}
            {userNickname?.trim() ? ` · ${userNickname.trim()}` : ""}
          </DialogDescription>
        </DialogHeader>
        {loadBusy ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
        {loadErr ? <p className="text-sm text-destructive">{loadErr}</p> : null}
        {!loadBusy && !loadErr && loadedId != null ? (
          <div className="space-y-4">
            {saveErr ? <p className="text-sm text-destructive">{saveErr}</p> : null}
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>封禁</span>
              <select
                className="h-9 rounded-md border bg-background px-3"
                value={banned ? "1" : "0"}
                onChange={(e) => setBanned(e.target.value === "1")}
              >
                <option value="1">是</option>
                <option value="0">否</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={saveBusy} onClick={() => void save()}>
                保存
              </Button>
              <Button size="sm" variant="outline" disabled={saveBusy} onClick={() => onOpenChange(false)}>
                取消
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
