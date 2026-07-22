import { useEffect, useMemo, useState } from "react";
import { axiosErrorDetail } from "@/api/http";
import { fetchGroupConfigById, fetchPlugins, putGroupConfig } from "@/api/fullConsole";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { pluginPickListFromRows } from "@pallas-vue/utils/pluginDisplay";
import {
  parseRouletteModeSelect,
  rouletteModeSelectOptions,
  rouletteModeSelectValue,
} from "@pallas-vue/utils/rouletteMode";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑群颗粒配置</DialogTitle>
          <DialogDescription>
            群 {loadedId ?? groupId ?? "—"}
            {groupName?.trim() ? ` · ${groupName.trim()}` : ""}
          </DialogDescription>
        </DialogHeader>
        {loadBusy ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
        {loadErr ? <p className="text-sm text-destructive">{loadErr}</p> : null}
        {!loadBusy && !loadErr && draft ? (
          <div className="space-y-4 text-sm">
            {saveErr ? <p className="text-destructive">{saveErr}</p> : null}
            <label className="flex items-center justify-between gap-3">
              <span>封禁本群</span>
              <select
                className="h-9 rounded-md border bg-background px-3"
                value={draft.banned ? "1" : "0"}
                onChange={(e) => setDraft({ ...draft, banned: e.target.value === "1" })}
              >
                <option value="1">是</option>
                <option value="0">否</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>轮盘模式</span>
              <select
                className="h-9 rounded-md border bg-background px-3"
                value={rouletteModeSelectValue(draft.roulette_mode)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    roulette_mode: parseRouletteModeSelect(e.target.value, draft.roulette_mode),
                  })
                }
              >
                {rouletteOpts.map((o) => (
                  <option key={o.value} value={String(o.value)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <div className="mb-2 font-medium">禁用插件</div>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {pluginNames.length === 0 ? (
                  <p className="text-muted-foreground">无插件列表</p>
                ) : (
                  pluginNames.map((p) => (
                    <label key={p.name} className="flex items-center gap-2">
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
            <div>
              <div className="mb-2 font-medium">屏蔽用户 QQ</div>
              <div className="mb-2 flex flex-wrap gap-2">
                <Input
                  className="w-40"
                  placeholder="QQ 号"
                  value={addBlocked}
                  onChange={(e) => setAddBlocked(e.target.value)}
                />
                <Button type="button" size="sm" variant="outline" onClick={addBlockedUser}>
                  添加
                </Button>
              </div>
              {blockedHint ? <p className="mb-2 text-xs text-destructive">{blockedHint}</p> : null}
              <div className="flex flex-wrap gap-1">
                {draft.blocked_user_ids.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="rounded border px-2 py-0.5 text-xs hover:bg-muted"
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
                {!draft.blocked_user_ids.length ? (
                  <span className="text-xs text-muted-foreground">无</span>
                ) : null}
              </div>
            </div>
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
