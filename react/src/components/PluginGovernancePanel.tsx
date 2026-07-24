import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchPluginGovernance,
  fetchPluginsGroupFleetWhitelist,
  putPluginGovernance,
  putPluginsGroupFleetWhitelist,
} from "@/api/fullConsole";
import type {
  GroupFleetWhitelistEntry,
  PluginGovernanceBody,
  PluginGovernanceData,
} from "@/api/pallasTypes";
import PluginRuntimeSwitchRow from "@/components/config/PluginRuntimeSwitchRow";
import PluginGovernanceGroup from "@/components/config/PluginGovernanceGroup";
import StateBlock from "@/components/StateBlock";
import UiButton from "@/components/ui/UiButton";
import UiInput from "@/components/ui/UiInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { reloadPolicyLabel } from "@/utils/reloadPolicyLabel";

type Props = {
  pluginName: string;
  presentation?: "page" | "dialog";
};

function activationPolicyShortLabel(policy?: string | null): string {
  const p = (policy || "").trim().toLowerCase();
  if (!p) return "—";
  if (p === "immediate" || p === "hot") return "立即生效";
  if (p === "reload" || p === "restart") return "需重载";
  return policy || "—";
}

export default function PluginGovernancePanel({ pluginName, presentation = "page" }: Props) {
  const qc = useQueryClient();
  const isDialog = presentation === "dialog";
  const [msg, setMsg] = useState<string | null>(null);
  const [permSelections, setPermSelections] = useState<Record<string, string>>({});
  const [limitSelections, setLimitSelections] = useState<Record<string, string>>({});
  const [blockedUserIds, setBlockedUserIds] = useState<number[]>([]);
  const [blockedInput, setBlockedInput] = useState("");
  const [whitelistGroupInput, setWhitelistGroupInput] = useState("");
  const [whitelistHint, setWhitelistHint] = useState("");

  const govQ = useQuery({
    queryKey: ["plugin-governance", pluginName],
    queryFn: () => fetchPluginGovernance(pluginName),
  });

  const fleetQ = useQuery({
    queryKey: ["plugin-fleet-whitelist"],
    queryFn: fetchPluginsGroupFleetWhitelist,
  });

  useEffect(() => {
    const g = govQ.data;
    if (!g) return;
    const permNext: Record<string, string> = {};
    for (const pg of g.perm_ui_filtered?.plugins || []) {
      for (const c of pg.commands) permNext[c.command_id] = c.effective_level;
    }
    setPermSelections(permNext);
    const limitNext: Record<string, string> = {};
    for (const pg of g.limits_ui_filtered?.plugins || []) {
      for (const c of pg.commands) limitNext[c.command_id] = String(c.effective_cd_sec);
    }
    setLimitSelections(limitNext);
    setBlockedUserIds([...(g.blocked_user_ids ?? [])]);
  }, [govQ.data]);

  const whitelistedGroupIds = useMemo(() => {
    const entries = fleetQ.data?.entries || [];
    return entries
      .filter((e) => e.plugins.includes(pluginName))
      .map((e) => e.group_id)
      .sort((a, b) => a - b);
  }, [fleetQ.data, pluginName]);

  const saveGov = useMutation({
    mutationFn: async (
      patch: Partial<PluginGovernanceData["runtime"]> & {
        blocked?: number[];
        permSelectionsOverride?: Record<string, string>;
      },
    ) => {
      const g = govQ.data;
      if (!g) throw new Error("治理数据未加载");
      const effectivePerm = patch.permSelectionsOverride ?? permSelections;
      const permOverrides: Record<string, string> = {};
      for (const pg of g.perm_ui_filtered?.plugins || []) {
        for (const c of pg.commands) {
          const sel = effectivePerm[c.command_id] ?? c.effective_level;
          if (sel !== c.default_level) permOverrides[c.command_id] = sel;
        }
      }
      const limitOverrides: Record<string, number> = {};
      for (const pg of g.limits_ui_filtered?.plugins || []) {
        for (const c of pg.commands) {
          const raw = (limitSelections[c.command_id] ?? String(c.effective_cd_sec)).trim();
          const parsed = Number.parseInt(raw === "" ? String(c.default_cd_sec) : raw, 10);
          const safe = Number.isFinite(parsed) && parsed >= 0 ? parsed : c.default_cd_sec;
          if (safe !== c.default_cd_sec) limitOverrides[c.command_id] = safe;
        }
      }
      const body: PluginGovernanceBody = {
        command_permission_overrides: permOverrides,
        command_limit_overrides: limitOverrides,
        global_disable: Boolean(patch.global_disable ?? g.runtime.global_disable),
        help_hidden: Boolean(patch.help_hidden ?? g.runtime.help_hidden),
        blocked_user_ids: patch.blocked ?? blockedUserIds,
      };
      return putPluginGovernance(pluginName, body);
    },
    onSuccess: async () => {
      setMsg("治理配置已保存");
      await qc.invalidateQueries({ queryKey: ["plugin-governance", pluginName] });
      await qc.invalidateQueries({ queryKey: ["plugins"] });
      await qc.invalidateQueries({ queryKey: ["plugins-global-disable"] });
      await qc.invalidateQueries({ queryKey: ["plugins-help-menu-visibility"] });
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const saveFleet = useMutation({
    mutationFn: (entries: GroupFleetWhitelistEntry[]) => putPluginsGroupFleetWhitelist(entries),
    onSuccess: async () => {
      setWhitelistHint("");
      await qc.invalidateQueries({ queryKey: ["plugin-fleet-whitelist"] });
    },
    onError: (e) => setWhitelistHint(axiosErrorDetail(e)),
  });

  const g = govQ.data;
  const globalDisableProtected = Boolean(g?.runtime?.global_disable_protected);
  const helpIgnored = Boolean(g?.runtime?.help_ignored);
  const showInFlowHelpMenu = g ? !g.runtime.help_hidden : true;

  async function toggleRuntime(kind: "global_disable" | "help_hidden", next: boolean) {
    if (!g) return;
    if (kind === "global_disable" && globalDisableProtected) return;
    if (kind === "help_hidden" && helpIgnored) return;
    setMsg(null);
    await saveGov.mutateAsync({
      global_disable: kind === "global_disable" ? next : g.runtime.global_disable,
      help_hidden: kind === "help_hidden" ? next : g.runtime.help_hidden,
    });
  }

  async function persistBlocked(next: number[]) {
    setBlockedUserIds(next);
    setMsg(null);
    await saveGov.mutateAsync({ blocked: next });
  }

  async function addBlockedUser() {
    const raw = blockedInput.trim();
    if (!raw) return;
    const uid = Number.parseInt(raw, 10);
    if (!Number.isFinite(uid) || uid < 1) {
      setMsg("请输入有效 QQ 号");
      return;
    }
    if (blockedUserIds.includes(uid)) {
      setBlockedInput("");
      return;
    }
    setBlockedInput("");
    await persistBlocked([...blockedUserIds, uid].sort((a, b) => a - b));
  }

  function cloneFleetEntries(): GroupFleetWhitelistEntry[] {
    return (fleetQ.data?.entries || []).map((e) => ({
      group_id: e.group_id,
      plugins: [...e.plugins],
    }));
  }

  async function addFleetGroup() {
    const raw = whitelistGroupInput.trim();
    if (!raw) return;
    const groupId = Number.parseInt(raw, 10);
    if (!Number.isFinite(groupId) || groupId < 1) {
      setWhitelistHint("请输入有效群号");
      return;
    }
    const entries = cloneFleetEntries();
    const idx = entries.findIndex((e) => e.group_id === groupId);
    if (idx >= 0) {
      if (!entries[idx].plugins.includes(pluginName)) {
        entries[idx] = {
          group_id: groupId,
          plugins: [...entries[idx].plugins, pluginName].sort((a, b) => a.localeCompare(b)),
        };
      }
    } else {
      entries.push({ group_id: groupId, plugins: [pluginName] });
    }
    entries.sort((a, b) => a.group_id - b.group_id);
    setWhitelistGroupInput("");
    await saveFleet.mutateAsync(entries);
  }

  async function removeFleetGroup(groupId: number) {
    const entries = cloneFleetEntries()
      .map((entry) => {
        if (entry.group_id !== groupId) return entry;
        return {
          group_id: entry.group_id,
          plugins: entry.plugins.filter((p: string) => p !== pluginName),
        };
      })
      .filter((entry) => entry.plugins.length > 0);
    await saveFleet.mutateAsync(entries);
  }

  const permPlugin = g?.perm_ui_filtered?.plugins?.[0];
  const limitsPlugin = g?.limits_ui_filtered?.plugins?.[0];
  const switchVariant = isDialog ? "plain" : "card";

  return (
    <StateBlock loading={govQ.isLoading} error={govQ.error} empty={!g} emptyText="该插件暂无治理配置">
      {msg ? (
        <p className={cn("mb-3 text-sm", msg.includes("已保存") || msg.includes("已更新") ? "text-emerald-400" : "text-destructive")}>
          {msg}
        </p>
      ) : null}

      {g ? (
        <section className={cn("plugin-governance-panel", isDialog && "plugin-governance-panel--dialog")}>
          {!isDialog ? (
            <header className="plugin-governance-panel__head">
              <div>
                <h3 className="plugin-governance-panel__title">治理面板</h3>
                <p className="muted plugin-governance-panel__desc">
                  同屏调整运行开关、命令权限与命令冷却；改动会自动保存到治理接口。
                </p>
              </div>
              <div className="plugin-governance-panel__badges">
                {g.reload_policy ? (
                  <span className="plugin-governance-panel__badge">热更新：{reloadPolicyLabel(g.reload_policy)}</span>
                ) : null}
                {g.activation_policy ? (
                  <span className="plugin-governance-panel__badge">
                    生效方式：{activationPolicyShortLabel(g.activation_policy)}
                  </span>
                ) : null}
              </div>
            </header>
          ) : g.reload_policy || g.activation_policy ? (
            <div className="plugin-governance-panel__dialog-meta">
              {g.reload_policy ? (
                <span className="plugin-governance-panel__badge">热更新：{reloadPolicyLabel(g.reload_policy)}</span>
              ) : null}
              {g.activation_policy ? (
                <span className="plugin-governance-panel__badge">
                  生效方式：{activationPolicyShortLabel(g.activation_policy)}
                </span>
              ) : null}
            </div>
          ) : null}

          <PluginGovernanceGroup
            title="运行控制"
            description="控制插件是否运行，以及是否出现在帮助菜单；两项共用同一份全局配置。"
          >
            <div className="plugin-governance-panel__switches">
              <PluginRuntimeSwitchRow
                title="禁用此插件"
                checked={Boolean(g.runtime.global_disable)}
                variant={switchVariant}
                disabled={saveGov.isPending || globalDisableProtected}
                onCheckedChange={(v) => void toggleRuntime("global_disable", v)}
              >
                <p>
                  {globalDisableProtected
                    ? "基础设施插件，不能禁用。"
                    : Boolean(g.runtime.global_disable)
                      ? "已禁用：所有实例、所有群都不会再跑此插件。"
                      : "开启后全实例停用；下方白名单群仍可例外放行。"}
                </p>
              </PluginRuntimeSwitchRow>
              <PluginRuntimeSwitchRow
                title="在帮助菜单中显示"
                checked={showInFlowHelpMenu}
                variant={switchVariant}
                disabled={saveGov.isPending || helpIgnored}
                onCheckedChange={(v) => void toggleRuntime("help_hidden", !v)}
              >
                <p>
                  {helpIgnored
                    ? "此插件被帮助系统忽略，无法出现在帮助菜单。"
                    : showInFlowHelpMenu
                      ? "会出现在「牛牛帮助」。关掉只藏帮助条目，不影响命令是否还能用。"
                      : "已从「牛牛帮助」隐藏；插件本身是否运行看上面的禁用开关。"}
                </p>
              </PluginRuntimeSwitchRow>
            </div>
          </PluginGovernanceGroup>

          <PluginGovernanceGroup
            title="群级白名单"
            description="全实例禁用后，白名单群仍可使用该插件。"
          >
            <div className="plugin-governance-panel__chips">
              {whitelistedGroupIds.length ? (
                whitelistedGroupIds.map((gid) => (
                  <span key={gid} className="plugin-governance-panel__chip">
                    群 {gid}
                    <button
                      type="button"
                      className="plugin-governance-panel__chip-remove"
                      disabled={saveFleet.isPending}
                      onClick={() => void removeFleetGroup(gid)}
                    >
                      移除
                    </button>
                  </span>
                ))
              ) : (
                <span className="muted plugin-governance-panel__empty">暂无白名单群</span>
              )}
            </div>
            <div className="plugin-governance-panel__add-row">
              <UiInput
                wrapClassName="plugin-governance-panel__add-input"
                placeholder="群号"
                value={whitelistGroupInput}
                onValueChange={setWhitelistGroupInput}
              />
              <UiButton
                size="sm"
                variant="outline"
                disabled={saveFleet.isPending}
                onClick={() => void addFleetGroup()}
              >
                添加
              </UiButton>
            </div>
            {whitelistHint ? <p className="text-sm text-destructive">{whitelistHint}</p> : null}
          </PluginGovernanceGroup>

          <PluginGovernanceGroup
            title="用户禁用"
            description="名单中的 QQ 无法使用该插件（号主除外）。"
          >
            <div className="plugin-governance-panel__chips">
              {blockedUserIds.map((uid) => (
                <span key={uid} className="plugin-governance-panel__chip">
                  {uid}
                  <button
                    type="button"
                    className="plugin-governance-panel__chip-remove"
                    disabled={saveGov.isPending}
                    onClick={() => void persistBlocked(blockedUserIds.filter((x) => x !== uid))}
                  >
                    移除
                  </button>
                </span>
              ))}
              {!blockedUserIds.length ? <span className="muted plugin-governance-panel__empty">暂无</span> : null}
            </div>
            <div className="plugin-governance-panel__add-row">
              <UiInput
                wrapClassName="plugin-governance-panel__add-input"
                placeholder="QQ 号"
                value={blockedInput}
                onValueChange={setBlockedInput}
              />
              <UiButton size="sm" variant="outline" disabled={saveGov.isPending} onClick={() => void addBlockedUser()}>
                添加
              </UiButton>
            </div>
          </PluginGovernanceGroup>

          <PluginGovernanceGroup
            title="命令权限"
            description="展示命令中文名与实际触发口令；帮助图中的「何人可用」会随这里的配置同步变化。"
          >
            {permPlugin?.commands?.length ? (
              permPlugin.commands.map((cmd) => (
                <div key={cmd.command_id} className="plugin-governance-panel__cmd-row">
                  <div className="plugin-governance-panel__cmd-text min-w-0">
                    <div className="plugin-governance-panel__cmd-title">{cmd.label || cmd.command_id}</div>
                    <div className="plugin-governance-panel__cmd-meta">
                      {cmd.trigger_condition || cmd.command_id}
                    </div>
                  </div>
                  <Select
                    value={permSelections[cmd.command_id] ?? cmd.effective_level}
                    disabled={saveGov.isPending}
                    onValueChange={(v) => {
                      const next = { ...permSelections, [cmd.command_id]: v };
                      setPermSelections(next);
                      void saveGov.mutateAsync({ permSelectionsOverride: next });
                    }}
                  >
                    <SelectTrigger
                      className="plugin-governance-panel__cmd-control"
                      aria-label={`${cmd.label || cmd.command_id} 权限`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {(g.perm_ui_filtered?.levels || []).map((lv) => (
                        <SelectItem key={lv.id} value={lv.id}>
                          {lv.label || lv.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))
            ) : (
              <p className="muted plugin-governance-panel__empty">该插件暂无命令权限声明。</p>
            )}
          </PluginGovernanceGroup>

          <PluginGovernanceGroup
            title="命令冷却"
            description="输入秒数后自动保存；留空或设为默认值表示不覆盖默认冷却。"
          >
            {limitsPlugin?.commands?.length ? (
              limitsPlugin.commands.map((cmd) => (
                <div key={cmd.command_id} className="plugin-governance-panel__cmd-row plugin-governance-panel__cmd-row--limits">
                  <div className="plugin-governance-panel__cmd-text min-w-0">
                    <div className="plugin-governance-panel__cmd-title">{cmd.label || cmd.command_id}</div>
                    <div className="plugin-governance-panel__cmd-meta">
                      {cmd.trigger_condition || cmd.command_id}
                    </div>
                  </div>
                  <UiInput
                    wrapClassName="plugin-governance-panel__cmd-control"
                    type="number"
                    value={limitSelections[cmd.command_id] ?? String(cmd.effective_cd_sec)}
                    disabled={saveGov.isPending}
                    onValueChange={(v) => setLimitSelections((prev) => ({ ...prev, [cmd.command_id]: v }))}
                    onBlur={() => void saveGov.mutateAsync({})}
                  />
                </div>
              ))
            ) : (
              <p className="muted plugin-governance-panel__empty">该插件暂无命令冷却声明。</p>
            )}
          </PluginGovernanceGroup>

          {saveGov.isPending ? <p className="muted plugin-governance-panel__saving">保存中…</p> : null}
        </section>
      ) : null}
    </StateBlock>
  );
}
