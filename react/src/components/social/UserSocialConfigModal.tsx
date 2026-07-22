import { useEffect, useState } from "react";
import { axiosErrorDetail } from "@/api/http";
import { fetchUserConfigById, putUserConfig } from "@/api/fullConsole";
import ConsoleModal from "@/components/ConsoleModal";
import UiButton from "@/components/ui/UiButton";
import UiSelect from "@/components/ui/UiSelect";

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

  const busy = loadBusy || saveBusy;

  return (
    <ConsoleModal
      open={open}
      titleId="user-social-config-title"
      panelClass="social-config-dialog social-config-dialog--sm"
      busy={busy}
      onClose={() => {
        if (!busy) onOpenChange(false);
      }}
      header={
        <>
          <div className="console-modal__head-text">
            <h2 id="user-social-config-title" className="console-modal__title">
              {defaultBanned ? "添加用户封禁" : "编辑用户颗粒配置"}
            </h2>
            <p className="console-modal__subtitle muted">
              QQ {loadedId ?? userId ?? "—"}
              {userNickname?.trim() ? ` · ${userNickname.trim()}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="console-modal__close"
            aria-label="关闭"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            ×
          </button>
        </>
      }
      footer={
        !loadBusy && !loadErr && loadedId != null ? (
          <>
            <UiButton variant="outline" size="sm" disabled={saveBusy} onClick={() => onOpenChange(false)}>
              取消
            </UiButton>
            <UiButton variant="primary" size="sm" disabled={saveBusy} onClick={() => void save()}>
              {saveBusy ? "保存中…" : "保存"}
            </UiButton>
          </>
        ) : null
      }
    >
      {loadBusy ? <p className="muted">加载中…</p> : null}
      {loadErr ? <p className="alert alert--err">{loadErr}</p> : null}
      {!loadBusy && !loadErr && loadedId != null ? (
        <div className="social-config-dialog__body">
          {saveErr ? <p className="alert alert--err">{saveErr}</p> : null}
          <label className="social-config-dialog__row">
            <span>封禁</span>
            <UiSelect value={banned ? "1" : "0"} onValueChange={(v) => setBanned(v === "1")}>
              <option value="1">是</option>
              <option value="0">否</option>
            </UiSelect>
          </label>
        </div>
      ) : null}
    </ConsoleModal>
  );
}
