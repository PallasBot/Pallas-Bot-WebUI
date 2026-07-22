import { useEffect, useMemo, useState } from "react";
import { axiosErrorDetail } from "@/api/http";
import { putBotConfig } from "@/api/fullConsole";
import ConsoleModal from "@/components/ConsoleModal";
import type { BotConfigPublic, PersonaSeedPref, PluginRow } from "@pallas-vue/api/pallasTypes";
import {
  PERSONA_SEED_PREF_OPTIONS,
  readBotPersonaSeedPrefs,
} from "@pallas-vue/api/pallasTypes";
import { pluginPickListFromRows } from "@pallas-vue/utils/pluginDisplay";

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
  return (
    <div className="form-bool-switch-field">
      <div className="form-bool-switch-field__row">
        <span className="form-bool-switch-field__label">{label}</span>
        <label className="console-switch">
          <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
          <span className="console-switch__track" aria-hidden="true" />
          <span className="console-switch__label">{checked ? "开启" : "关闭"}</span>
        </label>
      </div>
      {hint ? <p className="form-bool-switch-field__hint muted">{hint}</p> : null}
    </div>
  );
}

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
  const [addAdminInput, setAddAdminInput] = useState("");
  const [adminAddHint, setAdminAddHint] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const pluginPickList = useMemo(() => pluginPickListFromRows(plugins), [plugins]);

  useEffect(() => {
    if (!open) {
      setDraft(null);
      setAddAdminInput("");
      setAdminAddHint("");
      setSaveErr("");
      return;
    }
    if (isInit) setDraft(defaultDraft());
    else if (initialConfig) setDraft(draftFromConfig(initialConfig));
    else setDraft(defaultDraft());
    setAddAdminInput("");
    setAdminAddHint("");
    setSaveErr("");
  }, [open, isInit, initialConfig, account]);

  function setDraftBool(
    field: "security" | "auto_accept_friend" | "auto_accept_group" | "community_roster_show_qq",
    value: boolean,
  ) {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function addAdminFromInput() {
    if (!draft) return;
    setAdminAddHint("");
    const raw = addAdminInput.trim();
    if (!raw) return;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) {
      setAdminAddHint("请输入有效的 QQ 号。");
      return;
    }
    if (draft.admins.includes(n)) {
      setAdminAddHint("该号码已在列表中。");
      return;
    }
    setDraft({ ...draft, admins: [...draft.admins, n].sort((a, b) => a - b) });
    setAddAdminInput("");
  }

  function removeAdminFromDraft(id: number) {
    setDraft((prev) => (prev ? { ...prev, admins: prev.admins.filter((x) => x !== id) } : prev));
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

  return (
    <ConsoleModal
      open={open}
      titleId="bot-config-modal-title"
      busy={saveBusy}
      onClose={onClose}
      header={
        <>
          <div className="console-modal__head-text">
            <h2 id="bot-config-modal-title" className="console-modal__title">
              {isInit ? "初始化 Bot 配置" : "编辑 Bot 配置"}
            </h2>
            <p className="console-modal__subtitle">
              <span className="console-modal__subtitle-strong">{botNickname?.trim() || "BOT"}</span>
              <span className="muted"> · 账号 {account}</span>
            </p>
            {isInit ? (
              <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
                首次写入数据库配置；请至少添加一名号主 QQ。保存后该牛牛会出现在上方「数据库中的实例」列表。
              </p>
            ) : null}
          </div>
          <button type="button" className="console-modal__close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </>
      }
      footer={
        <div className="plugin-config-dialog__foot row-actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={saveBusy}
            title="Ctrl+S"
            onClick={() => void saveBotConfig()}
          >
            {saveBusy ? "保存中…" : isInit ? "初始化" : "保存"}
          </button>
        </div>
      }
    >
      {draft ? (
        <div className="bot-config-edit bot-config-edit--modal">
          {saveErr ? (
            <p className="alert alert--err" style={{ marginBottom: 12 }}>
              {saveErr}
            </p>
          ) : null}
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
            <p className="muted" style={{ margin: "0 0 8px", fontSize: 12 }}>
              输入号码后点击添加；每个账号右上角 × 可移除。
            </p>
            <div className="row-actions" style={{ marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
              <input
                className="inp"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="QQ 号"
                style={{ maxWidth: 200, minWidth: 0, flex: "1 1 140px" }}
                value={addAdminInput}
                onChange={(e) => setAddAdminInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAdminFromInput();
                  }
                }}
              />
              <button type="button" className="btn btn--outline" onClick={addAdminFromInput}>
                添加
              </button>
            </div>
            {adminAddHint ? (
              <p className="alert alert--err" style={{ margin: "0 0 8px", padding: "8px 10px", fontSize: 12 }}>
                {adminAddHint}
              </p>
            ) : null}
            {draft.admins.length ? (
              <div className="admin-chip-list">
                {draft.admins.map((id) => (
                  <div key={`adm-${account}-${id}`} className="admin-chip">
                    <span className="admin-chip__id">{id}</span>
                    <button
                      type="button"
                      className="admin-chip__rm"
                      aria-label={`移除管理员 ${id}`}
                      title="移除"
                      onClick={() => removeAdminFromDraft(id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
                尚未添加管理员。
              </p>
            )}
          </div>
          <div className="bot-config-edit__field">
            <label>牛格种子（最多 2 项）</label>
            <p className="muted" style={{ margin: "0 0 8px", fontSize: 12 }}>
              自动按账号派生；勾选后为手改覆盖，主要影响复读选句风格。清空勾选可恢复自动。
            </p>
            <div className="plugin-check-grid">
              {PERSONA_SEED_PREF_OPTIONS.map((opt) => (
                <label key={`seed-${account}-${opt.id}`}>
                  <input
                    type="checkbox"
                    checked={draft.seedPrefs.includes(opt.id)}
                    disabled={!draft.seedPrefs.includes(opt.id) && draft.seedPrefs.length >= 2}
                    onChange={(e) => toggleSeedPref(opt.id, e.target.checked)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
            {draft.seedManual ? (
              <p className="muted" style={{ margin: "8px 0 0", fontSize: 12 }}>
                当前：手改覆盖
                <button type="button" className="btn btn--ghost" style={{ marginLeft: 8 }} onClick={clearSeedOverride}>
                  恢复自动
                </button>
              </p>
            ) : (
              <p className="muted" style={{ margin: "8px 0 0", fontSize: 12 }}>
                当前：自动种子（未手改）
              </p>
            )}
          </div>
          <div className="bot-config-edit__field">
            <label>禁用插件（勾选表示禁用）</label>
            {!pluginPickList.length ? (
              <p className="muted" style={{ margin: "0 0 8px", fontSize: 12 }}>
                无插件清单，无法勾选禁用项。
              </p>
            ) : (
              <div className="plugin-check-grid">
                {pluginPickList.map((p) => (
                  <label key={`mod-pl-${account}-${p.name}`}>
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
    </ConsoleModal>
  );
}
