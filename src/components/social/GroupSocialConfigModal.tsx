import { useEffect, useId, useMemo, useState } from "react";
import { axiosErrorDetail } from "@/api/http";
import { deleteGroupConfig, fetchGroupConfigById, fetchPlugins, putGroupConfig } from "@/api/fullConsole";
import ConfigFieldHelp from "@/components/config/ConfigFieldHelp";
import FormSectionDivider from "@/components/config/FormSectionDivider";
import IdChipsInput from "@/components/config/IdChipsInput";
import SettingsFormField from "@/components/config/SettingsFormField";
import ConsoleDeleteConfirmModal from "@/components/ConsoleDeleteConfirmModal";
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
import { Switch } from "@/components/ui/switch";
import { Save, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
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
  onDeleted?: () => void;
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
          />
          <span className="prefs-switch-row__state" aria-hidden="true">
            {checked ? "开" : "关"}
          </span>
        </div>
      </div>
    </div>
  );
}

/** 群颗粒配置：对齐 Bot 配置弹窗的 divider / 字段「?」/ 开关。 */
export default function GroupSocialConfigModal({
  open,
  groupId,
  groupName,
  onOpenChange,
  onSaved,
  onDeleted,
}: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const [pluginNames, setPluginNames] = useState<Array<{ name: string; label: string }>>([]);
  const [loadBusy, setLoadBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [deleteErr, setDeleteErr] = useState("");

  const rouletteOpts = useMemo(
    () => rouletteModeSelectOptions(draft?.roulette_mode),
    [draft?.roulette_mode],
  );
  const displayName = groupName?.trim() || "群配置";
  const gidLabel = String(loadedId ?? groupId ?? "—");

  useEffect(() => {
    if (!open) {
      setDraft(null);
      setLoadedId(null);
      setLoadErr("");
      setSaveErr("");
      setDeleteErr("");
      setConfirmDelete(false);
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
    setDeleteErr("");
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

  async function save() {
    if (loadedId == null || !draft || saveBusy || deleteBusy) return;
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

  async function confirmDeleteConfig() {
    if (loadedId == null || deleteBusy || saveBusy) return;
    setDeleteBusy(true);
    setDeleteErr("");
    try {
      await deleteGroupConfig(loadedId);
      setConfirmDelete(false);
      onDeleted?.();
      onOpenChange(false);
    } catch (e) {
      setDeleteErr(axiosErrorDetail(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  const busy = loadBusy || saveBusy || deleteBusy;
  const ready = !loadBusy && !loadErr && draft != null && loadedId != null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !busy) onOpenChange(false);
        }}
      >
        <DialogContent
          className="social-config-dialog flex max-h-[min(92vh,720px)] w-[min(560px,96vw)] max-w-[min(560px,96vw)] gap-0 overflow-hidden bg-card p-0"
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <DialogHeader className="border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 text-left">
            <DialogTitle id="group-social-config-title" className="text-left">
              {displayName}
            </DialogTitle>
            <p className="muted text-sm">群号 · {gidLabel}</p>
            <DialogDescription className="sr-only">编辑本群封禁、轮盘、禁用插件与屏蔽用户。</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
            {loadBusy ? <p className="muted">加载中…</p> : null}
            {loadErr ? <p className="alert alert--err">{loadErr}</p> : null}
            {ready ? (
              <div className="bot-config-edit--modal bot-config-edit--modal-sections social-config-dialog__body">
                {saveErr ? <p className="alert alert--err mb-0">{saveErr}</p> : null}

                <div className="bot-config-dialog__block">
                  <FormSectionDivider title="策略" />
                  <div className="bot-config-dialog__section-body social-config-dialog__strategy">
                    <BoolSwitchField
                      label="封禁本群"
                      hint="开启后本群不响应命令与常规回复（与实例级配置独立）。"
                      checked={draft.banned}
                      onChange={(v) => setDraft({ ...draft, banned: v })}
                    />
                    <SettingsFormField
                      label="轮盘模式"
                      hint="本群轮盘玩法规则；选项随当前配置值解析。"
                    >
                      <Select
                        value={rouletteModeSelectValue(draft.roulette_mode)}
                        onValueChange={(v) =>
                          setDraft({
                            ...draft,
                            roulette_mode: parseRouletteModeSelect(v, draft.roulette_mode),
                          })
                        }
                      >
                        <SelectTrigger className="h-9 w-full" aria-label="轮盘模式">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {rouletteOpts.map((o) => (
                            <SelectItem key={o.value} value={String(o.value)}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </SettingsFormField>
                  </div>
                </div>

                <div className="bot-config-dialog__block">
                  <FormSectionDivider title="插件" />
                  <div className="bot-config-dialog__section-body">
                    <SettingsFormField
                      label="禁用插件"
                      hint="勾选后该插件对本群不生效；清单来自当前已加载插件。"
                    >
                      {!pluginNames.length ? (
                        <p className="bot-config-edit__empty muted">无插件列表</p>
                      ) : (
                        <div className="plugin-check-grid plugin-check-grid--bot-modal">
                          {pluginNames.map((p) => (
                            <label
                              key={p.name}
                              className={cn(
                                "plugin-check-grid__item",
                                draft.disabled_plugins.includes(p.name) && "plugin-check-grid__item--on",
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={draft.disabled_plugins.includes(p.name)}
                                onChange={(e) => togglePlugin(p.name, e.target.checked)}
                              />
                              <span>{p.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </SettingsFormField>
                  </div>
                </div>

                <div className="bot-config-dialog__block">
                  <FormSectionDivider title="屏蔽用户" />
                  <div className="bot-config-dialog__section-body">
                    <SettingsFormField
                      label="屏蔽用户 QQ"
                      hint="仅本群生效；被屏蔽用户在本群无法触发牛牛。点「更多」添加，芯片 × 可移除。"
                    >
                      <IdChipsInput
                        value={draft.blocked_user_ids}
                        onChange={(ids) => setDraft({ ...draft, blocked_user_ids: normalizeBlocked(ids) })}
                        placeholder="QQ 号"
                        emptyText="尚未屏蔽用户。"
                      />
                    </SettingsFormField>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {ready ? (
            <DialogFooter className="social-config-dialog__foot border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={X}
                iconMotion="close"
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button type="button" size="sm" icon={Save} iconMotion="scale" disabled={busy} onClick={() => void save()}>
                {saveBusy ? "保存中…" : "保存"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                icon={Trash2}
                disabled={busy}
                onClick={() => {
                  setDeleteErr("");
                  setConfirmDelete(true);
                }}
              >
                删除
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConsoleDeleteConfirmModal
        open={confirmDelete}
        title="删除群配置"
        subtitle="将移除该群的 group_config 记录（含封禁、轮盘、禁用插件、拉黑等），操作不可撤销。"
        items={loadedId != null ? [{ key: String(loadedId), label: `群 ${loadedId}` }] : []}
        listLabel="群"
        busy={deleteBusy}
        error={deleteErr}
        titleId="group-social-config-delete-title"
        onClose={() => {
          if (!deleteBusy) setConfirmDelete(false);
        }}
        onConfirm={() => void confirmDeleteConfig()}
      />
    </>
  );
}
