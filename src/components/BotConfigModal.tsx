import { useEffect, useId, useMemo, useState } from "react";
import { axiosErrorDetail } from "@/api/http";
import { putBotConfig } from "@/api/fullConsole";
import IdChipsInput from "@/components/config/IdChipsInput";
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
import type { BotConfigPublic, PersonaSeedPref, PluginRow } from "@/api/pallasTypes";
import {
  PERSONA_SEED_PREF_OPTIONS,
  readBotPersonaSeedPrefs,
} from "@/api/pallasTypes";
import { cn } from "@/lib/utils";
import { pluginPickListFromRows } from "@/utils/pluginDisplay";

const BOT_SWITCH_CLASS = "data-[state=checked]:bg-[var(--accent)]";

type Draft = {
  security: boolean;
  auto_accept_friend: boolean;
  auto_accept_group: boolean;
  community_roster_show_qq: boolean;
  disabled_plugins: string[];
  admins: number[];
  seedPrefs: PersonaSeedPref[];
  seedManual: boolean;
};

type Props = {
  account: number | null;
  isInit: boolean;
  botNickname?: string;
  initialConfig?: BotConfigPublic | null;
  plugins: PluginRow[];
  onClose: () => void;
  onSaved: () => void;
};

function defaultDraft(): Draft {
  return {
    security: false,
    auto_accept_friend: false,
    auto_accept_group: false,
    community_roster_show_qq: true,
    disabled_plugins: [],
    admins: [],
    seedPrefs: [],
    seedManual: false,
  };
}

function draftFromConfig(c: BotConfigPublic): Draft {
  const seed = readBotPersonaSeedPrefs(c.persona ?? null);
  return {
    security: c.security,
    auto_accept_friend: c.auto_accept_friend,
    auto_accept_group: c.auto_accept_group,
    community_roster_show_qq: c.community_roster_show_qq !== false,
    disabled_plugins: [...(c.disabled_plugins ?? [])],
    admins: [...(c.admins ?? [])],
    seedPrefs: [...seed.prefs],
    seedManual: seed.source === "manual",
  };
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
          {label}
        </span>
        <div className="prefs-switch-row__control">
          <Switch
            checked={checked}
            onCheckedChange={onChange}
            aria-labelledby={labelId}
            className={BOT_SWITCH_CLASS}
          />
          <span className="prefs-switch-row__state" aria-hidden="true">
            {checked ? "开" : "关"}
          </span>
        </div>
      </div>
      {hint ? <p className="form-bool-switch-field__hint muted">{hint}</p> : null}
    </div>
  );
}

/** 数据库实例 Bot 配置：shadcn Dialog（居中实心底，对齐插件配置弹窗）。 */
export default function BotConfigModal({
  account,
  isInit,
  botNickname,
  initialConfig,
  plugins,
  onClose,
  onSaved,
}: Props) {
  const open = account != null;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const pluginPickList = useMemo(() => pluginPickListFromRows(plugins), [plugins]);

  useEffect(() => {
    if (!open) {
      setDraft(null);
      setSaveErr("");
      return;
    }
    if (isInit) setDraft(defaultDraft());
    else if (initialConfig) setDraft(draftFromConfig(initialConfig));
    else setDraft(defaultDraft());
    setSaveErr("");
  }, [open, isInit, initialConfig, account]);

  function setDraftBool(
    field: "security" | "auto_accept_friend" | "auto_accept_group" | "community_roster_show_qq",
    value: boolean,
  ) {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function togglePluginDisabled(name: string, checked: boolean) {
    setDraft((prev) => {
      if (!prev) return prev;
      const set = new Set(prev.disabled_plugins);
      if (checked) set.add(name);
      else set.delete(name);
      return { ...prev, disabled_plugins: [...set].sort((a, b) => a.localeCompare(b)) };
    });
  }

  function toggleSeedPref(pref: PersonaSeedPref, checked: boolean) {
    setDraft((prev) => {
      if (!prev) return prev;
      const set = new Set(prev.seedPrefs);
      if (checked) {
        if (set.size >= 2 && !set.has(pref)) return prev;
        set.add(pref);
      } else {
        set.delete(pref);
      }
      const seedPrefs = PERSONA_SEED_PREF_OPTIONS.map((opt) => opt.id).filter((id) => set.has(id));
      return { ...prev, seedPrefs, seedManual: seedPrefs.length > 0 };
    });
  }

  function clearSeedOverride() {
    setDraft((prev) => (prev ? { ...prev, seedPrefs: [], seedManual: false } : prev));
  }

  async function saveBotConfig() {
    if (account == null || !draft || saveBusy) return;
    if (isInit && !draft.admins.length) {
      setSaveErr("请至少添加一名号主 QQ。");
      return;
    }
    setSaveBusy(true);
    setSaveErr("");
    try {
      const { seedPrefs, seedManual, ...rest } = draft;
      const body: Parameters<typeof putBotConfig>[1] = { ...rest };
      if (!isInit) {
        body.persona = seedManual ? { seed_override: { prefs: seedPrefs } } : { seed_override: null };
      }
      await putBotConfig(account, body);
      onSaved();
      onClose();
    } catch (e) {
      setSaveErr(axiosErrorDetail(e));
    } finally {
      setSaveBusy(false);
    }
  }

  function requestClose() {
    if (saveBusy) return;
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
    >
      <DialogContent
        className="plugin-config-dialog flex max-h-[min(720px,calc(100dvh-32px))] w-[min(640px,calc(100vw-32px))] max-w-[min(640px,calc(100vw-32px))] gap-0 overflow-hidden bg-card p-0"
        onEscapeKeyDown={(e) => {
          if (saveBusy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (saveBusy) e.preventDefault();
        }}
      >
        <DialogHeader className="plugin-config-dialog__head border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 text-left sm:text-left">
          <div className="plugin-config-dialog__head-text w-full space-y-1 pr-6 text-left">
            <DialogTitle id="bot-config-modal-title" className="text-left">
              {isInit ? "初始化 Bot 配置" : "编辑 Bot 配置"}
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                <p className="m-0 text-sm">
                  <span className="font-medium text-foreground">{botNickname?.trim() || "BOT"}</span>
                  <span className="text-muted-foreground"> · 账号 {account}</span>
                </p>
                {isInit ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    首次写入数据库配置；请至少添加一名号主 QQ。保存后该牛牛会出现在上方「数据库中的实例」列表。
                  </p>
                ) : null}
              </div>
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="plugin-config-dialog__bd min-h-0 flex-1 overflow-auto px-4 py-3">
          {draft ? (
            <div className="bot-config-edit--modal">
              {saveErr ? <p className="alert alert--err mb-3">{saveErr}</p> : null}
              <div className="bot-config-edit__grid bot-config-edit__grid--pair bot-config-edit__grid--switches">
                <BoolSwitchField
                  label="安全模式"
                  hint="开启后，牛牛回复发送失败时会直接 ban 掉这句话。"
                  checked={draft.security}
                  onChange={(v) => setDraftBool("security", v)}
                />
                <BoolSwitchField
                  label="自动同意好友"
                  hint="自动通过好友申请，无需在协议端手动确认。"
                  checked={draft.auto_accept_friend}
                  onChange={(v) => setDraftBool("auto_accept_friend", v)}
                />
                <BoolSwitchField
                  label="自动同意入群"
                  hint="自动通过入群邀请或加群申请。"
                  checked={draft.auto_accept_group}
                  onChange={(v) => setDraftBool("auto_accept_group", v)}
                />
                <BoolSwitchField
                  label="社区名册公开"
                  hint="关闭后该牛不上报社区名册（气泡墙不展示）。"
                  checked={draft.community_roster_show_qq}
                  onChange={(v) => setDraftBool("community_roster_show_qq", v)}
                />
              </div>

              <div className="bot-config-edit__field">
                <label>管理员 QQ</label>
                <p className="bot-config-edit__hint muted">点「更多」添加或管理；芯片 × 可移除。</p>
                <IdChipsInput
                  value={draft.admins}
                  onChange={(admins) => setDraft({ ...draft, admins })}
                  placeholder="QQ 号"
                  emptyText="尚未添加管理员。"
                />
              </div>

              <div className="bot-config-edit__field">
                <label>牛格种子（最多 2 项）</label>
                <p className="bot-config-edit__hint muted">
                  自动按账号派生；点选后为手改覆盖，主要影响复读选句风格。清空可恢复自动。
                </p>
                <div className="bot-config-seed-tiles" role="group" aria-label="牛格种子偏好">
                  {PERSONA_SEED_PREF_OPTIONS.map((opt) => {
                    const on = draft.seedPrefs.includes(opt.id);
                    const locked = !on && draft.seedPrefs.length >= 2;
                    return (
                      <button
                        key={`seed-${account}-${opt.id}`}
                        type="button"
                        className={cn(
                          "bot-config-seed-tiles__btn",
                          on && "bot-config-seed-tiles__btn--on",
                        )}
                        aria-pressed={on}
                        disabled={locked}
                        onClick={() => toggleSeedPref(opt.id, !on)}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <div className="bot-config-seed-status">
                  {draft.seedManual ? (
                    <>
                      <span className="muted">当前：手改覆盖</span>
                      <Button type="button" variant="ghost" size="sm" onClick={clearSeedOverride}>
                        恢复自动
                      </Button>
                    </>
                  ) : (
                    <span className="muted">当前：自动种子（未手改）</span>
                  )}
                </div>
              </div>

              <div className="bot-config-edit__field">
                <label>禁用插件（勾选表示禁用）</label>
                {!pluginPickList.length ? (
                  <p className="bot-config-edit__hint muted">无插件清单，无法勾选禁用项。</p>
                ) : (
                  <div className="plugin-check-grid plugin-check-grid--bot-modal">
                    {pluginPickList.map((p) => (
                      <label
                        key={`mod-pl-${account}-${p.name}`}
                        className={cn(
                          "plugin-check-grid__item",
                          draft.disabled_plugins.includes(p.name) && "plugin-check-grid__item--on",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={draft.disabled_plugins.includes(p.name)}
                          onChange={(e) => togglePluginDisabled(p.name, e.target.checked)}
                        />
                        <span>{p.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="plugin-config-dialog__foot border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 sm:justify-end">
          <Button
            type="button"
            size="sm"
            disabled={saveBusy}
            title="Ctrl+S"
            onClick={() => void saveBotConfig()}
          >
            {saveBusy ? "保存中…" : isInit ? "初始化" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
