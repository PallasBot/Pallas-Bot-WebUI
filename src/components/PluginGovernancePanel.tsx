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
} from "@/api/pallasTypes";
import IdChipsInput from "@/components/config/IdChipsInput";
import PluginRuntimeSwitchRow from "@/components/config/PluginRuntimeSwitchRow";
import PluginGovernanceGroup from "@/components/config/PluginGovernanceGroup";
import {
  buildPluginGovernancePatch,
  type PluginGovernanceAction,
} from "@/components/config/pluginGovernancePatch";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
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
import { pushConsoleToast } from "@/utils/consoleToast";
import { useConsoleConfirm } from "@/hooks/useConsoleConfirm";

type Props = {
  pluginName: string;
  presentation?: "page" | "dialog";
};

function notifyOk(message: string) {
  pushConsoleToast(message, "ok");
}

function notifyErr(message: string) {
  pushConsoleToast(message || "操作失败", "err");
}

function activationPolicyShortLabel(policy?: string | null): string {
  const p = (policy || "").trim().toLowerCase();
  if (!p) return "—";
  if (p === "immediate" || p === "hot") return "立即生效";
  if (p === "reload" || p === "restart") return "需重载";
  return policy || "—";
}

export default function PluginGovernancePanel({ pluginName, presentation = "page" }: Props) {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConsoleConfirm();
  const isDialog = presentation === "dialog";
  const [permSelections, setPermSelections] = useState<Record<string, string>>({});
  const [limitSelections, setLimitSelections] = useState<Record<string, string>>({});
  const [blockedUserIds, setBlockedUserIds] = useState<number[]>([]);

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
    mutationFn: async ({
      action,
      permSelectionsOverride,
    }: {
      action: PluginGovernanceAction;
      permSelectionsOverride?: Record<string, string>;
    }) => {
      const g = govQ.data;
      if (!g) throw new Error("治理数据未加载");
      const effectivePerm = permSelectionsOverride ?? permSelections;
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
      const body: PluginGovernanceBody = buildPluginGovernancePatch({
        action,
        permissionOverrides: permOverrides,
        limitOverrides,
      });
      return putPluginGovernance(pluginName, body);
    },
    onSuccess: async () => {
      notifyOk("治理配置已保存");
      await qc.invalidateQueries({ queryKey: ["plugin-governance", pluginName] });
      await qc.invalidateQueries({ queryKey: ["plugins"] });
      await qc.invalidateQueries({ queryKey: ["plugins-global-disable"] });
      await qc.invalidateQueries({ queryKey: ["plugins-help-menu-visibility"] });
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  const saveFleet = useMutation({
    mutationFn: (entries: GroupFleetWhitelistEntry[]) => putPluginsGroupFleetWhitelist(entries),
    onSuccess: async () => {
      notifyOk("群白名单已更新");
      await qc.invalidateQueries({ queryKey: ["plugin-fleet-whitelist"] });
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  const g = govQ.data;
  const globalDisableProtected = Boolean(g?.runtime?.global_disable_protected);
  const helpIgnored = Boolean(g?.runtime?.help_ignored);
  const showInFlowHelpMenu = g ? !g.runtime.help_hidden : true;

  async function toggleRuntime(kind: "global_disable" | "help_hidden", next: boolean) {
    if (!g) return;
    if (kind === "global_disable" && globalDisableProtected) return;
    if (kind === "help_hidden" && helpIgnored) return;
    if (
      kind === "global_disable" &&
      next &&
      !(await confirm({
        title: "禁用此插件",
        subtitle: `确定全局禁用插件「${pluginName}」？`,
        warnings: ["所有实例、所有群都不会再运行此插件；白名单群除外。"],
        confirmLabel: "禁用",
      }))
    )
      return;
    await saveGov.mutateAsync({
      action: {
        kind,
        value: next,
        ...(kind === "global_disable" ? { revision: g.runtime.global_disable_revision } : {}),
      },
    });
  }

  async function persistBlocked(next: number[]) {
    setBlockedUserIds(next);
    await saveGov.mutateAsync({ action: { kind: "blocked_user_ids", value: next } });
  }

  function cloneFleetEntries(): GroupFleetWhitelistEntry[] {
    return (fleetQ.data?.entries || []).map((e) => ({
      group_id: e.group_id,
      plugins: [...e.plugins],
    }));
  }

  async function syncFleetGroups(nextIds: number[]) {
    const nextSet = new Set(nextIds.filter((n) => Number.isFinite(n) && n >= 1));
    const prev = whitelistedGroupIds;
    if (prev.length === nextSet.size && prev.every((id) => nextSet.has(id))) return;

    let entries = cloneFleetEntries()
      .map((entry) => {
        if (!entry.plugins.includes(pluginName)) return entry;
        if (nextSet.has(entry.group_id)) return entry;
        return {
          group_id: entry.group_id,
          plugins: entry.plugins.filter((p: string) => p !== pluginName),
        };
      })
      .filter((entry) => entry.plugins.length > 0);

    for (const groupId of nextSet) {
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
    }
    entries.sort((a, b) => a.group_id - b.group_id);
    await saveFleet.mutateAsync(entries);
  }

  const permPlugin = g?.perm_ui_filtered?.plugins?.[0];
  const limitsPlugin = g?.limits_ui_filtered?.plugins?.[0];
  const switchVariant = isDialog ? "plain" : "card";

  return (
    <StateBlock loading={govQ.isLoading} error={govQ.error} empty={!g} emptyText="该插件暂无治理配置">
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
                  <Badge variant="info" size="compact" className="plugin-governance-panel__badge">
                    热更新：{reloadPolicyLabel(g.reload_policy)}
                  </Badge>
                ) : null}
                {g.activation_policy ? (
                  <Badge variant="info" size="compact" className="plugin-governance-panel__badge">
                    生效方式：{activationPolicyShortLabel(g.activation_policy)}
                  </Badge>
                ) : null}
              </div>
            </header>
          ) : g.reload_policy || g.activation_policy ? (
            <div className="plugin-governance-panel__dialog-meta">
              {g.reload_policy ? (
                <Badge variant="info" size="compact" className="plugin-governance-panel__badge">
                  热更新：{reloadPolicyLabel(g.reload_policy)}
                </Badge>
              ) : null}
              {g.activation_policy ? (
                <Badge variant="info" size="compact" className="plugin-governance-panel__badge">
                  生效方式：{activationPolicyShortLabel(g.activation_policy)}
                </Badge>
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
            <IdChipsInput
              value={whitelistedGroupIds}
              onChange={(ids) => void syncFleetGroups(ids)}
              placeholder="群号"
              emptyText="暂无白名单群"
              disabled={saveFleet.isPending}
            />
          </PluginGovernanceGroup>

          <PluginGovernanceGroup
            title="用户禁用"
            description="名单中的 QQ 无法使用该插件（号主除外）。"
          >
            <IdChipsInput
              value={blockedUserIds}
              onChange={(ids) => void persistBlocked(ids)}
              placeholder="QQ 号"
              emptyText="暂无"
              disabled={saveGov.isPending}
            />
          </PluginGovernanceGroup>

          <PluginGovernanceGroup
            title="命令权限"
            description="展示命令中文名与实际触发命令；帮助图中的「何人可用」会随这里的配置同步变化。"
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
                      void saveGov.mutateAsync({
                        action: { kind: "permissions" },
                        permSelectionsOverride: next,
                      });
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
                    onBlur={() => void saveGov.mutateAsync({ action: { kind: "limits" } })}
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
      {confirmDialog}
    </StateBlock>
  );
}
