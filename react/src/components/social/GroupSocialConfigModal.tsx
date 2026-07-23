import { useEffect, useMemo, useState } from "react";
import { axiosErrorDetail } from "@/api/http";
import { fetchGroupConfigById, fetchPlugins, putGroupConfig } from "@/api/fullConsole";
import ConsoleModal from "@/components/ConsoleModal";
import UiButton from "@/components/ui/UiButton";
import UiInput from "@/components/ui/UiInput";
import UiSelect from "@/components/ui/UiSelect";
import { pluginPickListFromRows } from "@/utils/pluginDisplay";
import {
  parseRouletteModeSelect,
  rouletteModeSelectOptions,
  rouletteModeSelectValue,
} from "@/utils/rouletteMode";

type Props = {
  open: boolean;
  groupId: number | null;
  groupName?: string;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

type Draft = {
  roulette_mode: number;
  banned: boolean;
  disabled_plugins: string[];
  blocked_user_ids: number[];
};

function normalizeBlocked(ids: number[]): number[] {
  const next = [...new Set(ids.map((n) => Math.floor(Number(n))))].filter((n) => Number.isFinite(n) && n > 0);
  next.sort((a, b) => a - b);
  return next;
}

export default function GroupSocialConfigModal({ open, groupId, groupName, onOpenChange, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const [pluginNames, setPluginNames] = useState<Array<{ name: string; label: string }>>([]);
  const [loadBusy, setLoadBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [addBlocked, setAddBlocked] = useState("");
  const [blockedHint, setBlockedHint] = useState("");

  const rouletteOpts = useMemo(
    () => rouletteModeSelectOptions(draft?.roulette_mode),
    [draft?.roulette_mode],
  );

  useEffect(() => {
    if (!open) {
      setDraft(null);
      setLoadedId(null);
      setLoadErr("");
      setSaveErr("");
      setAddBlocked("");
      setBlockedHint("");
      return;
    }
    const gid = groupId;
    if (gid == null || !Number.isFinite(gid) || gid < 1) {
      setLoadErr("无效群号。");
      return;
    }
    let cancelled = false;
    setLoadBusy(true);
    setLoadErr("");
    setSaveErr("");
    void (async () => {
      try {
        const [g, plugins] = await Promise.all([fetchGroupConfigById(gid), fetchPlugins()]);
        if (cancelled) return;
        setPluginNames(pluginPickListFromRows(plugins));
        setLoadedId(g.group_id);
        setDraft({
          roulette_mode: g.roulette_mode,
          banned: Boolean(g.banned),
          disabled_plugins: [...(g.disabled_plugins ?? [])].sort((a, b) => a.localeCompare(b)),
          blocked_user_ids: normalizeBlocked(g.blocked_user_ids ?? []),
        });
      } catch (e) {
        if (!cancelled) setLoadErr(axiosErrorDetail(e));
      } finally {
        if (!cancelled) setLoadBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, groupId]);

  function togglePlugin(name: string, disabled: boolean) {
    setDraft((prev) => {
      if (!prev) return prev;
      const set = new Set(prev.disabled_plugins);
      if (disabled) set.add(name);
      else set.delete(name);
      return { ...prev, disabled_plugins: [...set].sort((a, b) => a.localeCompare(b)) };
    });
  }

  function addBlockedUser() {
    if (!draft) return;
    setBlockedHint("");
    const n = parseInt(addBlocked.trim(), 10);
    if (!Number.isFinite(n) || n < 1) {
      setBlockedHint("请输入有效的 QQ 号。");
      return;
    }
    if (draft.blocked_user_ids.includes(n)) {
      setBlockedHint("该号码已在列表中。");
      return;
    }
    setDraft({
      ...draft,
      blocked_user_ids: [...draft.blocked_user_ids, n].sort((a, b) => a - b),
    });
    setAddBlocked("");
  }

  async function save() {
    if (loadedId == null || !draft || saveBusy) return;
    setSaveBusy(true);
    setSaveErr("");
    try {
      await putGroupConfig(loadedId, {
        roulette_mode: draft.roulette_mode,
        banned: draft.banned,
        disabled_plugins: draft.disabled_plugins,
        blocked_user_ids: normalizeBlocked(draft.blocked_user_ids),
      });
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
      titleId="group-social-config-title"
      panelClass="social-config-dialog"
      busy={busy}
      onClose={() => {
        if (!busy) onOpenChange(false);
      }}
      header={
        <>
          <div className="console-modal__head-text">
            <h2 id="group-social-config-title" className="console-modal__title">
              编辑群颗粒配置
            </h2>
            <p className="console-modal__subtitle muted">
              群 {loadedId ?? groupId ?? "—"}
              {groupName?.trim() ? ` · ${groupName.trim()}` : ""}
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
        !loadBusy && !loadErr && draft ? (
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
      {!loadBusy && !loadErr && draft ? (
        <div className="social-config-dialog__body">
          {saveErr ? <p className="alert alert--err">{saveErr}</p> : null}
          <label className="social-config-dialog__row">
            <span>封禁本群</span>
            <UiSelect
              value={draft.banned ? "1" : "0"}
              onValueChange={(v) => setDraft({ ...draft, banned: v === "1" })}
            >
              <option value="1">是</option>
              <option value="0">否</option>
            </UiSelect>
          </label>
          <label className="social-config-dialog__row">
            <span>轮盘模式</span>
            <UiSelect
              value={rouletteModeSelectValue(draft.roulette_mode)}
              onValueChange={(v) =>
                setDraft({
                  ...draft,
                  roulette_mode: parseRouletteModeSelect(v, draft.roulette_mode),
                })
              }
            >
              {rouletteOpts.map((o) => (
                <option key={o.value} value={String(o.value)}>
                  {o.label}
                </option>
              ))}
            </UiSelect>
          </label>
          <div className="social-config-dialog__block">
            <div className="social-config-dialog__block-hd">禁用插件</div>
            <div className="social-config-dialog__checklist">
              {pluginNames.length === 0 ? (
                <p className="muted">无插件列表</p>
              ) : (
                pluginNames.map((p) => (
                  <label key={p.name} className="social-config-dialog__check">
                    <input
                      type="checkbox"
                      checked={draft.disabled_plugins.includes(p.name)}
                      onChange={(e) => togglePlugin(p.name, e.target.checked)}
                    />
                    <span>{p.label}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="social-config-dialog__block">
            <div className="social-config-dialog__block-hd">屏蔽用户 QQ</div>
            <div className="social-config-dialog__add-row">
              <UiInput
                className="social-config-dialog__qq-inp"
                placeholder="QQ 号"
                value={addBlocked}
                onValueChange={setAddBlocked}
              />
              <UiButton type="button" size="sm" variant="outline" onClick={addBlockedUser}>
                添加
              </UiButton>
            </div>
            {blockedHint ? <p className="alert alert--err">{blockedHint}</p> : null}
            <div className="social-config-dialog__chips">
              {draft.blocked_user_ids.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="btn social-config-dialog__chip"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      blocked_user_ids: draft.blocked_user_ids.filter((x) => x !== id),
                    })
                  }
                >
                  {id} ×
                </button>
              ))}
              {!draft.blocked_user_ids.length ? <span className="muted">无</span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </ConsoleModal>
  );
}
