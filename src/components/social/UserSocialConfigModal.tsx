import { useEffect, useId, useState } from "react";
import { axiosErrorDetail } from "@/api/http";
import { fetchUserConfigById, putUserConfig } from "@/api/fullConsole";
import ConfigFieldHelp from "@/components/config/ConfigFieldHelp";
import FormSectionDivider from "@/components/config/FormSectionDivider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

const SWITCH_CLASS = "data-[state=checked]:bg-[var(--accent)]";

type Props = {
  open: boolean;
  userId: number | null;
  userNickname?: string;
  defaultBanned?: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

function BoolSwitchField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const labelId = useId();
  return (
    <div className="form-bool-switch-field">
      <div className="form-bool-switch-field__row">
        <span className="form-bool-switch-field__label" id={labelId}>
          <span className="form-bool-switch-field__label-text">{label}</span>
          {hint ? <ConfigFieldHelp title={label} description={hint} /> : null}
        </span>
        <div className="prefs-switch-row__control">
          <Switch
            checked={checked}
            onCheckedChange={onChange}
            aria-labelledby={labelId}
            className={SWITCH_CLASS}
          />
          <span className="prefs-switch-row__state" aria-hidden="true">
            {checked ? "开" : "关"}
          </span>
        </div>
      </div>
    </div>
  );
}

/** 用户颗粒配置：对齐群配置弹窗头栏与封禁开关。 */
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

  const displayName = userNickname?.trim() || (defaultBanned ? "添加用户封禁" : "用户配置");
  const qqLabel = String(loadedId ?? userId ?? "—");

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
          <DialogTitle id="user-social-config-title" className="text-left">
            {displayName}
          </DialogTitle>
          <p className="muted text-sm">QQ {qqLabel}</p>
          <DialogDescription className="sr-only">
            {defaultBanned ? "为该用户添加全局封禁。" : "编辑用户全局封禁状态。"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {loadBusy ? <p className="muted">加载中…</p> : null}
          {loadErr ? <p className="alert alert--err">{loadErr}</p> : null}
          {!loadBusy && !loadErr && loadedId != null ? (
            <div className="bot-config-edit--modal bot-config-edit--modal-sections social-config-dialog__body">
              {saveErr ? <p className="alert alert--err mb-0">{saveErr}</p> : null}
              <div className="bot-config-dialog__block">
                <FormSectionDivider title="策略" />
                <BoolSwitchField
                  label="全局封禁"
                  hint="开启后该用户在所有群与私聊均无法触发牛牛（与群内屏蔽独立）。"
                  checked={banned}
                  onChange={setBanned}
                />
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
