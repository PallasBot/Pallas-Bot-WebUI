import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchPluginGovernance,
  fetchPluginsGlobalDisable,
  fetchPluginsGroupFleetWhitelist,
  fetchPluginsHelpMenuVisibility,
  putPluginGovernance,
  putPluginsGlobalDisable,
  putPluginsGroupFleetWhitelist,
  putPluginsHelpMenuVisibility,
} from "@/api/fullConsole";
import type {
  GroupFleetWhitelistEntry,
  PluginGovernanceBody,
  PluginGovernanceData,
} from "@/api/pallasTypes";
import PluginRuntimeSwitchRow from "@/components/config/PluginRuntimeSwitchRow";
import StateBlock from "@/components/StateBlock";
import UiButton from "@/components/ui/UiButton";
import UiInput from "@/components/ui/UiInput";
import UiSelect from "@/components/ui/UiSelect";
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

  const globalDisableQ = useQuery({
    queryKey: ["plugins-global-disable"],
    queryFn: fetchPluginsGlobalDisable,
  });

  const helpVisibilityQ = useQuery({
    queryKey: ["plugins-help-menu-visibility"],
    queryFn: fetchPluginsHelpMenuVisibility,
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
    mutationFn: async (patch: Partial<PluginGovernanceData["runtime"]> & { blocked?: number[] }) => {
      const g = govQ.data;
      if (!g) throw new Error("治理数据未加载");
      const permOverrides: Record<string, string> = {};
      for (const pg of g.perm_ui_filtered?.plugins || []) {
        for (const c of pg.commands) {
          const sel = permSelections[c.command_id] ?? c.effective_level;
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

  const globallyDisabled = globalDisableQ.data?.disabled_plugins.includes(pluginName) ?? false;
  const globalDisableProtectedByList = globalDisableQ.data?.protected_plugins.includes(pluginName) ?? false;
  const helpHiddenGlobal = helpVisibilityQ.data?.hidden_plugins.includes(pluginName) ?? false;
  const helpIgnoredGlobal = helpVisibilityQ.data?.ignored_plugins.includes(pluginName) ?? false;

  const saveGlobalDisable = useMutation({
    mutationFn: async (disabled: boolean) => {
      const current = globalDisableQ.data?.disabled_plugins || [];
      const protectedList = new Set(globalDisableQ.data?.protected_plugins || []);
      if (protectedList.has(pluginName)) throw new Error("该插件为基础设施插件，不可全实例禁用");
      const next = disabled
        ? [...new Set([...current, pluginName])]
        : current.filter((p) => p !== pluginName);
      return putPluginsGlobalDisable(next);
    },
    onSuccess: async () => {
      setMsg("全局禁用状态已更新");
      await globalDisableQ.refetch();
      await qc.invalidateQueries({ queryKey: ["plugin-governance", pluginName] });
      await qc.invalidateQueries({ queryKey: ["plugins"] });
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const saveHelpVisibility = useMutation({
    mutationFn: async (hidden: boolean) => {
      const current = helpVisibilityQ.data?.hidden_plugins || [];
      const next = hidden
        ? [...new Set([...current, pluginName])]
        : current.filter((p) => p !== pluginName);
      return putPluginsHelpMenuVisibility(next);
    },
    onSuccess: async () => {
      setMsg("帮助菜单可见性已更新");
      await helpVisibilityQ.refetch();
      await qc.invalidateQueries({ queryKey: ["plugin-governance", pluginName] });
      await qc.invalidateQueries({ queryKey: ["plugins"] });
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

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

          <section className="plugin-governance-panel__group">
            <header className="plugin-governance-panel__group-head">
              <h4 className="plugin-governance-panel__group-title">运行控制</h4>
              {!isDialog ? (
                <p className="muted plugin-governance-panel__group-desc">
                  控制插件是否参与运行，以及是否出现在帮助菜单中。
                </p>
              ) : null}
            </header>
            <div className="plugin-governance-panel__switches">
              <PluginRuntimeSwitchRow
                title="全实例禁用（所有牛牛、所有群）"
                checked={Boolean(g.runtime.global_disable)}
                variant={switchVariant}
                disabled={saveGov.isPending || globalDisableProtected}
                onCheckedChange={(v) => void toggleRuntime("global_disable", v)}
              >
                <p>
                  {globalDisableProtected
                    ? "基础设施插件，不可全实例禁用。"
                    : "开启后立即拦截该插件的 Matcher，与实例级、群级禁用共同生效。"}
                </p>
              </PluginRuntimeSwitchRow>
              <PluginRuntimeSwitchRow
                title="在「牛牛帮助」总列表中显示该插件"
                checked={showInFlowHelpMenu}
                variant={switchVariant}
                disabled={saveGov.isPending || helpIgnored}
                onCheckedChange={(v) => void toggleRuntime("help_hidden", !v)}
              >
                <p>
                  {helpIgnored
                    ? "该插件被帮助系统忽略，无法出现在帮助菜单。"
                    : "关闭后会立即从帮助菜单隐藏，但不影响实际 Matcher 运行。"}
                </p>
              </PluginRuntimeSwitchRow>
              <PluginRuntimeSwitchRow
                title="全局禁用列表（当前插件）"
                checked={globallyDisabled}
                variant={switchVariant}
                disabled={saveGlobalDisable.isPending || globalDisableProtectedByList}
                onCheckedChange={(v) => void saveGlobalDisable.mutateAsync(v)}
              >
                <p>
                  {globalDisableProtectedByList
                    ? "基础设施插件，不可加入全局禁用。"
                    : globallyDisabled
                      ? "已在全局禁用列表中。"
                      : "未在全局禁用列表中。"}
                </p>
              </PluginRuntimeSwitchRow>
              <PluginRuntimeSwitchRow
                title="帮助菜单隐藏列表（当前插件可见）"
                checked={!helpHiddenGlobal}
                variant={switchVariant}
                disabled={saveHelpVisibility.isPending || helpIgnoredGlobal}
                onCheckedChange={(v) => void saveHelpVisibility.mutateAsync(!v)}
              >
                <p>
                  {helpIgnoredGlobal
                    ? "该插件被帮助系统忽略。"
                    : helpHiddenGlobal
                      ? "已在帮助隐藏列表中。"
                      : "未在帮助隐藏列表中。"}
                </p>
              </PluginRuntimeSwitchRow>
            </div>
          </section>

          <section className="plugin-governance-panel__group">
            <header className="plugin-governance-panel__group-head">
              <h4 className="plugin-governance-panel__group-title">群级白名单</h4>
              {!isDialog ? (
                <p className="muted plugin-governance-panel__group-desc">
                  全实例禁用后，白名单群仍可使用该插件。
                </p>
              ) : null}
            </header>
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
                添加群
              </UiButton>
            </div>
            {whitelistHint ? <p className="text-sm text-destructive">{whitelistHint}</p> : null}
          </section>

          <section className="plugin-governance-panel__group">
            <header className="plugin-governance-panel__group-head">
              <h4 className="plugin-governance-panel__group-title">用户禁用</h4>
              {!isDialog ? (
                <p className="muted plugin-governance-panel__group-desc">
                  名单中的 QQ 无法使用该插件（号主除外）。
                </p>
              ) : null}
            </header>
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
              <UiInput placeholder="QQ 号" value={blockedInput} onValueChange={setBlockedInput} />
              <UiButton size="sm" variant="outline" disabled={saveGov.isPending} onClick={() => void addBlockedUser()}>
                添加
              </UiButton>
            </div>
          </section>

          <section className="plugin-governance-panel__group">
            <header className="plugin-governance-panel__group-head">
              <h4 className="plugin-governance-panel__group-title">命令权限</h4>
              {!isDialog ? (
                <p className="muted plugin-governance-panel__group-desc">
                  展示命令中文名与实际触发口令；帮助图中的「何人可用」会随这里的配置同步变化。
                </p>
              ) : null}
            </header>
            {permPlugin?.commands?.length ? (
              permPlugin.commands.map((cmd) => (
                <div key={cmd.command_id} className="plugin-governance-panel__cmd-row">
                  <div className="plugin-governance-panel__cmd-title">{cmd.label || cmd.command_id}</div>
                  <div className="plugin-governance-panel__cmd-meta">
                    {cmd.trigger_condition || cmd.command_id}
                  </div>
                  <UiSelect
                    value={permSelections[cmd.command_id] ?? cmd.effective_level}
                    disabled={saveGov.isPending}
                    onValueChange={(v) => {
                      setPermSelections((prev) => ({ ...prev, [cmd.command_id]: v }));
                    }}
                    onBlur={() => void saveGov.mutateAsync({})}
                  >
                    {(g.perm_ui_filtered?.levels || []).map((lv) => (
                      <option key={lv.id} value={lv.id}>
                        {lv.label || lv.id}
                      </option>
                    ))}
                  </UiSelect>
                </div>
              ))
            ) : (
              <p className="muted plugin-governance-panel__empty">该插件暂无命令权限声明。</p>
            )}
          </section>

          <section className="plugin-governance-panel__group">
            <header className="plugin-governance-panel__group-head">
              <h4 className="plugin-governance-panel__group-title">命令冷却</h4>
              {!isDialog ? (
                <p className="muted plugin-governance-panel__group-desc">
                  输入秒数后自动保存；留空或设为默认值表示不覆盖默认冷却。
                </p>
              ) : null}
            </header>
            {limitsPlugin?.commands?.length ? (
              limitsPlugin.commands.map((cmd) => (
                <div key={cmd.command_id} className="plugin-governance-panel__cmd-row plugin-governance-panel__cmd-row--limits">
                  <div className="min-w-0">
                    <div className="plugin-governance-panel__cmd-title">{cmd.label || cmd.command_id}</div>
                    <div className="plugin-governance-panel__cmd-meta">
                      {cmd.trigger_condition || cmd.command_id}
                    </div>
                  </div>
                  <UiInput
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
          </section>

          {saveGov.isPending ? <p className="muted plugin-governance-panel__saving">保存中…</p> : null}
        </section>
      ) : null}
    </StateBlock>
  );
}
