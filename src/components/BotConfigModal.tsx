import { useEffect, useId, useMemo, useState } from "react";
import { axiosErrorDetail } from "@/api/http";
import { putBotConfig } from "@/api/fullConsole";
import ConfigFieldHelp from "@/components/config/ConfigFieldHelp";
import FormSectionDivider from "@/components/config/FormSectionDivider";
import IdChipsInput from "@/components/config/IdChipsInput";
import SettingsFormField from "@/components/config/SettingsFormField";
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
import { Save, Undo2 } from "lucide-react";
import type { AccountPersonaAxis, AccountPersonaProfile, BotConfigPublic, PluginRow } from "@/api/pallasTypes";
import { readManualAccountPersonaProfile } from "@/api/pallasTypes";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_PERSONA_AXES,
  accountPersonaPayload,
  EMPTY_ACCOUNT_PERSONA_PROFILE,
  updateAccountPersonaAxis,
} from "@/utils/accountPersonaProfile";
import { qqAvatarUrl } from "@/utils/botDisplay";
import { pluginPickListFromRows } from "@/utils/pluginDisplay";

const ACCOUNT_PERSONA_AXIS_META: Array<{
  axis: AccountPersonaAxis;
  label: string;
  low: string;
  high: string;
}> = [
  { axis: "energy", label: "活力", low: "安静", high: "活跃" },
  { axis: "warmth", label: "亲和", low: "疏离", high: "亲近" },
  { axis: "mischief", label: "调皮", low: "正经", high: "爱逗" },
  { axis: "restraint", label: "克制", low: "随性", high: "收敛" },
];

type Draft = {
  security: boolean;
  auto_accept_friend: boolean;
  auto_accept_group: boolean;
  community_roster_show_qq: boolean;
  disabled_plugins: string[];
  admins: number[];
  accountProfile: AccountPersonaProfile;
  accountProfileManual: boolean;
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
    accountProfile: { ...EMPTY_ACCOUNT_PERSONA_PROFILE },
    accountProfileManual: false,
  };
}

function draftFromConfig(c: BotConfigPublic): Draft {
  const accountProfile = readManualAccountPersonaProfile(c.persona ?? null);
  return {
    security: c.security,
    auto_accept_friend: c.auto_accept_friend,
    auto_accept_group: c.auto_accept_group,
    community_roster_show_qq: c.community_roster_show_qq !== false,
    disabled_plugins: [...(c.disabled_plugins ?? [])],
    admins: [...(c.admins ?? [])],
    accountProfile: accountProfile ?? { ...EMPTY_ACCOUNT_PERSONA_PROFILE },
    accountProfileManual: accountProfile != null,
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

/** 数据库实例 Bot 配置：头像头栏 + hub 风格 divider 分段。 */
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
  const displayName = botNickname?.trim() || "BOT";
  const qq = account != null ? String(account) : "";

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

  function setAccountPersonaAxis(axis: AccountPersonaAxis, value: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const accountProfile = updateAccountPersonaAxis(prev.accountProfile, axis, value);
      const accountProfileManual = ACCOUNT_PERSONA_AXES.some((key) => accountProfile[key] !== 0);
      return { ...prev, accountProfile, accountProfileManual };
    });
  }

  function clearAccountProfile() {
    setDraft((prev) => prev ? {
      ...prev,
      accountProfile: { ...EMPTY_ACCOUNT_PERSONA_PROFILE },
      accountProfileManual: false,
    } : prev);
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
      const { accountProfile, accountProfileManual, ...rest } = draft;
      const body: Parameters<typeof putBotConfig>[1] = { ...rest };
      body.persona = accountPersonaPayload(accountProfile, accountProfileManual);
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
        className="plugin-config-dialog bot-config-dialog flex max-h-[min(800px,calc(100dvh-32px))] w-[min(720px,calc(100vw-32px))] max-w-[min(720px,calc(100vw-32px))] gap-0 overflow-hidden bg-card p-0"
        onEscapeKeyDown={(e) => {
          if (saveBusy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (saveBusy) e.preventDefault();
        }}
      >
        <DialogHeader className="plugin-config-dialog__head border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 text-left sm:text-left">
          <div className="protocol-account-config-dialog__identity-main pr-6">
            {qq ? (
              <img
                src={qqAvatarUrl(qq)}
                alt=""
                width={44}
                height={44}
                decoding="async"
                referrerPolicy="no-referrer"
                className="protocol-account-config-dialog__avatar"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.visibility = "hidden";
                }}
              />
            ) : null}
            <div className="plugin-config-dialog__head-text min-w-0 flex-1 space-y-1 text-left">
              <DialogTitle id="bot-config-modal-title" className="text-left">
                {displayName}
              </DialogTitle>
              <p className="protocol-account-config-dialog__sub muted">
                QQ <span className="protocol-account-config-dialog__qq">{qq || "—"}</span>
                {isInit ? " · 初始化配置" : " · 数据库实例"}
              </p>
              <DialogDescription className="sr-only">
                {isInit
                  ? "首次写入数据库配置；请至少添加一名号主 QQ。"
                  : "编辑 Bot 数据库配置。"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="plugin-config-dialog__bd bot-config-dialog__bd min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3">
          {draft ? (
            <div className="bot-config-edit--modal bot-config-edit--modal-sections">
              {saveErr ? <p className="alert alert--err mb-0">{saveErr}</p> : null}
              {isInit ? (
                <p className="bot-config-dialog__init-note muted">
                  首次写入数据库配置；请至少添加一名号主 QQ。保存后会出现在「数据库中的实例」列表。
                </p>
              ) : null}

              <div className="bot-config-dialog__block">
                <FormSectionDivider title="行为与安全" />
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
              </div>

              <div className="bot-config-dialog__block">
                <FormSectionDivider title="权限" />
                <div className="bot-config-dialog__section-body">
                  <SettingsFormField
                    label="管理员 QQ"
                    hint="点「更多」添加或管理；芯片 × 可移除。初始化时请至少添加一名号主。"
                  >
                    <IdChipsInput
                      value={draft.admins}
                      onChange={(admins) => setDraft({ ...draft, admins })}
                      placeholder="QQ 号"
                      emptyText="尚未添加管理员。"
                    />
                  </SettingsFormField>
                </div>
              </div>

              <div className="bot-config-dialog__block">
                <FormSectionDivider title="小姑娘稳定气质" />
                <div className="bot-config-dialog__section-body">
                  <SettingsFormField
                    label="四轴气质"
                    hint="数值范围 -1 到 1，最多保留 2 个非零轴；恢复自动后由账号稳定派生。"
                  >
                    <div className="bot-config-persona-axes" role="group" aria-label="账号稳定气质四轴">
                      {ACCOUNT_PERSONA_AXIS_META.map((meta) => {
                        const inputId = `account-profile-${account}-${meta.axis}`;
                        const activeCount = ACCOUNT_PERSONA_AXES.filter(
                          (axis) => draft.accountProfile[axis] !== 0,
                        ).length;
                        const locked = draft.accountProfile[meta.axis] === 0 && activeCount >= 2;
                        return (
                          <div key={meta.axis} className="bot-config-persona-axis">
                            <div className="bot-config-persona-axis__head">
                              <label htmlFor={inputId}>{meta.label}</label>
                              <output htmlFor={inputId}>{draft.accountProfile[meta.axis].toFixed(1)}</output>
                            </div>
                            <input
                              id={inputId}
                              type="range"
                              min="-1"
                              max="1"
                              step="0.1"
                              value={draft.accountProfile[meta.axis]}
                              disabled={locked}
                              aria-describedby={`${inputId}-ends`}
                              onChange={(event) => setAccountPersonaAxis(meta.axis, Number(event.target.value))}
                            />
                            <div id={`${inputId}-ends`} className="bot-config-persona-axis__ends">
                              <span>{meta.low} -1</span>
                              <span>{meta.high} 1</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="bot-config-seed-status">
                      <span className="muted">
                        来源：{draft.accountProfileManual ? "手动" : "账号自动派生"}
                      </span>
                      {draft.accountProfileManual ? (
                        <Button type="button" variant="outline" size="sm" icon={Undo2} iconMotion="undo" onClick={clearAccountProfile}>
                          恢复自动
                        </Button>
                      ) : null}
                    </div>
                  </SettingsFormField>
                </div>
              </div>

              <div className="bot-config-dialog__block">
                <FormSectionDivider title="插件" />
                <div className="bot-config-dialog__section-body">
                  <SettingsFormField
                    label="禁用插件"
                    hint="勾选后该插件对该账号不生效；清单来自当前已加载插件。"
                  >
                    {!pluginPickList.length ? (
                      <p className="bot-config-edit__empty muted">无插件清单，无法勾选禁用项。</p>
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
                  </SettingsFormField>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="plugin-config-dialog__foot border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 sm:justify-end">
          <Button
            type="button"
            size="sm"
            icon={Save}
            iconMotion="scale"
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
