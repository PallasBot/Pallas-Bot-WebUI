import { useCallback, useEffect, useMemo, useState } from "react";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchGitMirrorInfo,
  postGitMirrorApplyAll,
  postGitMirrorApplyBot,
  postGitMirrorApplyCommunity,
  postGitMirrorApplyOfficial,
  postGitMirrorApplyPlugin,
  postGitMirrorProbe,
  putGitMirrorPreferred,
} from "@/api/fullConsole";
import type { GitMirrorInfo, GitMirrorScopes, GitMirrorTargetRow } from "@/api/pallasTypes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import UiBadge from "@/components/ui/UiBadge";
import UiButton from "@/components/ui/UiButton";
import { pushConsoleToast } from "@/utils/consoleToast";

const INHERIT = "__inherit__";

type Props = {
  open: boolean;
  onClose: () => void;
};

function shortRemote(url: string): string {
  const raw = (url || "").trim();
  if (!raw) return "—";
  if (raw.length <= 72) return raw;
  return `${raw.slice(0, 36)}…${raw.slice(-28)}`;
}

function scopeToSelect(value: string | undefined): string {
  return (value || "").trim() || INHERIT;
}

function selectToScope(value: string): string {
  return value === INHERIT ? "" : value;
}

function rowTitle(row: GitMirrorTargetRow): string {
  return row.label || row.id;
}

function canSwitch(row: GitMirrorTargetRow): boolean {
  if (row.kind === "official" || row.kind === "webui") return true;
  return Boolean(row.can_apply_remote ?? row.is_git_repo);
}

function rowScopeHint(row: GitMirrorTargetRow): string {
  if (row.kind === "bot") return "Bot 更新 scope";
  if (row.kind === "official") return "官方商店 · 独立仓库";
  if (row.kind === "webui") return "WebUI 下载 scope";
  if (row.kind === "plugin") return "社区插件 scope";
  return "";
}

function mirrorBadgeVariant(mirrorId: string, preferredId: string): "ok" | "muted" | "secondary" {
  if (mirrorId === "unknown") return "muted";
  if (mirrorId === preferredId) return "ok";
  return "secondary";
}

export default function GitMirrorDialog({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [info, setInfo] = useState<GitMirrorInfo | null>(null);
  const [preferredId, setPreferredId] = useState("github");
  const [customPrefix, setCustomPrefix] = useState("");
  const [scopeBot, setScopeBot] = useState(INHERIT);
  const [scopeWebui, setScopeWebui] = useState(INHERIT);
  const [scopeCommunity, setScopeCommunity] = useState(INHERIT);
  const [saveBusy, setSaveBusy] = useState(false);
  const [applyAllBusy, setApplyAllBusy] = useState(false);
  const [probeBusy, setProbeBusy] = useState(false);
  const [applyBusyKey, setApplyBusyKey] = useState<string | null>(null);
  const [confirmApplyAllOpen, setConfirmApplyAllOpen] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<GitMirrorTargetRow | null>(null);
  const [switchMirrorId, setSwitchMirrorId] = useState("github");

  const selectedMirror = useMemo(
    () => info?.available_mirrors.find((row) => row.id === preferredId) ?? null,
    [info, preferredId],
  );
  const showCustomPrefix = preferredId === "custom" || selectedMirror?.type === "custom";

  const mirrorLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of info?.available_mirrors ?? []) map.set(row.id, row.label);
    map.set("unknown", "未知");
    map.set("ssh", "SSH");
    return map;
  }, [info]);

  const mirrorLabel = useCallback((id: string) => mirrorLabelMap.get(id) ?? id, [mirrorLabelMap]);

  const targetRows = useMemo(() => (info?.targets ?? []).filter((row) => row.kind !== "official"), [info]);
  const officialRows = useMemo(() => (info?.plugins ?? []).filter((row) => row.kind === "official"), [info]);
  const pluginRows = useMemo(() => (info?.plugins ?? []).filter((row) => row.kind !== "official"), [info]);

  const dialogBusy = saveBusy || applyAllBusy || probeBusy || Boolean(applyBusyKey);

  function syncFormFromInfo(data: GitMirrorInfo) {
    setInfo(data);
    setPreferredId(data.preferred_id || "github");
    setCustomPrefix(data.custom_proxy_prefix || "");
    const scopes = data.scopes || ({ bot: "", webui: "", community: "" } as GitMirrorScopes);
    setScopeBot(scopeToSelect(scopes.bot));
    setScopeWebui(scopeToSelect(scopes.webui));
    setScopeCommunity(scopeToSelect(scopes.community));
  }

  function currentScopesPayload(): GitMirrorScopes {
    return {
      bot: selectToScope(scopeBot),
      webui: selectToScope(scopeWebui),
      community: selectToScope(scopeCommunity),
    };
  }

  function effectiveMirrorId(scopeSelect: string): string {
    return scopeSelect === INHERIT ? preferredId : scopeSelect;
  }

  function isFormDirty(): boolean {
    if (!info) return false;
    const savedPreferred = info.preferred_id || "github";
    const savedCustom = info.custom_proxy_prefix || "";
    const saved = info.scopes || { bot: "", webui: "", community: "" };
    if (preferredId !== savedPreferred) return true;
    if (showCustomPrefix && customPrefix !== savedCustom) return true;
    const next = currentScopesPayload();
    return (
      next.bot !== (saved.bot || "")
      || next.webui !== (saved.webui || "")
      || next.community !== (saved.community || "")
    );
  }

  const loadInfo = useCallback(async () => {
    setLoading(true);
    setLoadErr("");
    try {
      syncFormFromInfo(await fetchGitMirrorInfo());
    } catch (e) {
      setInfo(null);
      setLoadErr(axiosErrorDetail(e) || "加载 Git 镜像配置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadInfo();
    else {
      setConfirmApplyAllOpen(false);
      setApplyBusyKey(null);
      setSwitchTarget(null);
    }
  }, [open, loadInfo]);

  async function savePreferred(): Promise<boolean> {
    if (saveBusy) return false;
    setSaveBusy(true);
    try {
      syncFormFromInfo(
        await putGitMirrorPreferred({
          preferred_id: preferredId,
          custom_proxy_prefix: showCustomPrefix ? customPrefix : "",
          scopes: currentScopesPayload(),
        }),
      );
      pushConsoleToast("Git 镜像偏好已保存", "ok");
      return true;
    } catch (e) {
      pushConsoleToast(axiosErrorDetail(e) || "保存失败", "err");
      return false;
    } finally {
      setSaveBusy(false);
    }
  }

  async function ensureSavedIfDirty(): Promise<boolean> {
    if (!isFormDirty()) return true;
    return savePreferred();
  }

  async function runProbe() {
    if (probeBusy) return;
    if (!(await ensureSavedIfDirty())) return;
    setProbeBusy(true);
    try {
      const result = await postGitMirrorProbe({ mirror_id: preferredId });
      if (result.ok) {
        pushConsoleToast(`连通正常：${mirrorLabel(result.mirror_id || preferredId)}`, "ok");
      } else {
        pushConsoleToast(
          `${mirrorLabel(result.mirror_id || preferredId)} 不可用${result.error ? `：${result.error}` : ""}`,
          "err",
        );
      }
    } catch (e) {
      pushConsoleToast(axiosErrorDetail(e) || "连通检测失败", "err");
    } finally {
      setProbeBusy(false);
    }
  }

  async function applyAll() {
    if (applyAllBusy) return;
    if (!(await ensureSavedIfDirty())) return;
    setApplyAllBusy(true);
    try {
      const summary = await postGitMirrorApplyAll({ preferred_id: preferredId });
      const { total, success_count, fail_count } = summary.summary;
      const level = fail_count === 0 ? "ok" : success_count === 0 ? "err" : "warn";
      pushConsoleToast(`已应用到全部：${success_count}/${total} 成功`, level);
      await loadInfo();
    } catch (e) {
      pushConsoleToast(axiosErrorDetail(e) || "批量应用失败", "err");
    } finally {
      setApplyAllBusy(false);
      setConfirmApplyAllOpen(false);
    }
  }

  async function applyCommunityBatch() {
    if (applyBusyKey) return;
    if (!(await ensureSavedIfDirty())) return;
    setApplyBusyKey("community-batch");
    try {
      const summary = await postGitMirrorApplyCommunity({
        preferred_id: effectiveMirrorId(scopeCommunity),
      });
      const { total, success_count, fail_count } = summary.summary;
      const level = fail_count === 0 ? "ok" : success_count === 0 ? "err" : "warn";
      pushConsoleToast(`已应用到社区插件：${success_count}/${total} 成功`, level);
      await loadInfo();
    } catch (e) {
      pushConsoleToast(axiosErrorDetail(e) || "批量应用社区插件失败", "err");
    } finally {
      setApplyBusyKey(null);
    }
  }

  async function confirmSwitch() {
    const row = switchTarget;
    if (!row || applyBusyKey) return;
    if (!(await ensureSavedIfDirty())) return;
    const key = `${row.kind}:${row.id}`;
    setApplyBusyKey(key);
    try {
      if (row.kind === "bot") {
        const result = await postGitMirrorApplyBot({ preferred_id: switchMirrorId });
        pushConsoleToast(
          result.success ? `Bot：${result.message}` : `Bot 失败：${result.message}`,
          result.success ? "ok" : "err",
        );
      } else if (row.kind === "webui") {
        syncFormFromInfo(
          await putGitMirrorPreferred({
            preferred_id: preferredId,
            custom_proxy_prefix: showCustomPrefix ? customPrefix : "",
            scopes: { ...currentScopesPayload(), webui: switchMirrorId },
          }),
        );
        pushConsoleToast(`WebUI 下载源已设为 ${mirrorLabel(switchMirrorId)}`, "ok");
      } else if (row.kind === "official") {
        const result = await postGitMirrorApplyOfficial(row.id, { preferred_id: switchMirrorId });
        pushConsoleToast(
          result.success ? `${rowTitle(row)}：${result.message}` : `${rowTitle(row)} 失败：${result.message}`,
          result.success ? "ok" : "err",
        );
      } else {
        const result = await postGitMirrorApplyPlugin(row.id, { preferred_id: switchMirrorId });
        pushConsoleToast(
          result.success ? `${row.id}：${result.message}` : `${row.id} 失败：${result.message}`,
          result.success ? "ok" : "err",
        );
      }
      await loadInfo();
      setSwitchTarget(null);
    } catch (e) {
      pushConsoleToast(axiosErrorDetail(e) || "切换失败", "err");
    } finally {
      setApplyBusyKey(null);
    }
  }

  function requestClose() {
    if (dialogBusy) return;
    onClose();
  }

  function TargetBlock({
    rows,
    title,
    empty,
    cardClass,
  }: {
    rows: GitMirrorTargetRow[];
    title: string;
    empty: string;
    cardClass: string;
  }) {
    return (
      <section className="git-mirror-dialog__section">
        <div className="git-mirror-dialog__section-head">
          <h3 className="git-mirror-dialog__section-title">{title}</h3>
          <span className="muted git-mirror-dialog__section-meta">{rows.length} 项</span>
        </div>
        {!rows.length ? (
          <div className="git-mirror-dialog__empty muted">{empty}</div>
        ) : (
          <>
            <div className="git-mirror-dialog__table-wrap">
              <table className="data console-data-table git-mirror-dialog__table">
                <thead>
                  <tr>
                    <th>目标</th>
                    <th>Remote / 说明</th>
                    <th>当前源</th>
                    <th className="git-mirror-dialog__col-action">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.kind}:${row.id}`}>
                      <td>
                        <div className="git-mirror-dialog__plugin-id">{rowTitle(row)}</div>
                        <div className="muted git-mirror-dialog__plugin-path">{row.path}</div>
                        {rowScopeHint(row) ? (
                          <div className="muted git-mirror-dialog__scope-hint">{rowScopeHint(row)}</div>
                        ) : null}
                      </td>
                      <td className="git-mirror-dialog__remote" title={row.remote_url || row.note || undefined}>
                        {row.remote_url ? shortRemote(row.remote_url) : row.note || "—"}
                      </td>
                      <td>
                        <UiBadge variant={mirrorBadgeVariant(row.mirror, preferredId)}>
                          {mirrorLabel(row.mirror)}
                        </UiBadge>
                      </td>
                      <td className="git-mirror-dialog__col-action">
                        {canSwitch(row) ? (
                          <UiButton
                            variant="ghost"
                            size="sm"
                            disabled={Boolean(applyBusyKey)}
                            onClick={() => {
                              setSwitchTarget(row);
                              setSwitchMirrorId(preferredId);
                            }}
                          >
                            切换
                          </UiButton>
                        ) : (
                          <span className="muted git-mirror-dialog__action-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className={`git-mirror-dialog__cards ${cardClass}`}>
              {rows.map((row) => (
                <li key={`card-${row.kind}-${row.id}`} className="git-mirror-dialog__card">
                  <div className="git-mirror-dialog__card-head">
                    <div>
                      <div className="git-mirror-dialog__plugin-id">{rowTitle(row)}</div>
                      <div className="muted git-mirror-dialog__plugin-path">{row.path}</div>
                      {rowScopeHint(row) ? (
                        <div className="muted git-mirror-dialog__scope-hint">{rowScopeHint(row)}</div>
                      ) : null}
                    </div>
                    <UiBadge variant={mirrorBadgeVariant(row.mirror, preferredId)}>
                      {mirrorLabel(row.mirror)}
                    </UiBadge>
                  </div>
                  <p className="git-mirror-dialog__card-remote muted" title={row.remote_url || row.note || undefined}>
                    {row.remote_url ? shortRemote(row.remote_url) : row.note || "—"}
                  </p>
                  {canSwitch(row) ? (
                    <UiButton
                      variant="outline"
                      size="sm"
                      block
                      disabled={Boolean(applyBusyKey)}
                      onClick={() => {
                        setSwitchTarget(row);
                        setSwitchMirrorId(preferredId);
                      }}
                    >
                      切换镜像源
                    </UiButton>
                  ) : (
                    <p className="git-mirror-dialog__action-muted muted">—</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    );
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        <DialogContent
          className="git-mirror-dialog flex max-h-[min(860px,calc(100dvh-32px))] w-[min(720px,calc(100vw-32px))] max-w-[min(720px,calc(100vw-32px))] gap-0 overflow-hidden bg-card p-0"
          onEscapeKeyDown={(e) => {
            if (dialogBusy) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (dialogBusy) e.preventDefault();
          }}
        >
          <DialogHeader className="border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 text-left">
            <DialogTitle id="git-mirror-dialog-title">Git 镜像源</DialogTitle>
            <DialogDescription className="muted">
              Bot 本体、WebUI、官方商店插件（独立仓库）与社区插件均可配置镜像；下方列表逐项说明。
            </DialogDescription>
          </DialogHeader>

          <div className="git-mirror-dialog__bd min-h-0 flex-1 overflow-auto px-4 py-3">
        {loading ? (
          <div className="git-mirror-dialog__state muted" role="status">
            正在加载…
          </div>
        ) : loadErr ? (
          <div className="git-mirror-dialog__state" role="status">
            <p className="git-mirror-dialog__err">{loadErr}</p>
            <UiButton size="sm" variant="outline" onClick={() => void loadInfo()}>
              重试
            </UiButton>
          </div>
        ) : info ? (
          <>
            <section className="git-mirror-dialog__section">
              <div className="git-mirror-dialog__field">
                <label className="git-mirror-dialog__label" htmlFor="git-mirror-preferred">
                  全局首选
                </label>
                <Select value={preferredId} onValueChange={setPreferredId}>
                  <SelectTrigger id="git-mirror-preferred" className="git-mirror-dialog__select h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {info.available_mirrors.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                    {!info.available_mirrors.some((row) => row.id === "custom") ? (
                      <SelectItem value="custom">自定义代理前缀</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
              {showCustomPrefix ? (
                <div className="git-mirror-dialog__field">
                  <label className="git-mirror-dialog__label" htmlFor="git-mirror-custom-prefix">
                    自定义 https 前缀
                  </label>
                  <Input
                    id="git-mirror-custom-prefix"
                    className="git-mirror-dialog__input h-9"
                    type="url"
                    value={customPrefix}
                    placeholder="https://ghproxy.example"
                    autoComplete="off"
                    onChange={(e) => setCustomPrefix(e.target.value)}
                  />
                </div>
              ) : null}

              <div className="git-mirror-dialog__scopes">
                {(
                  [
                    ["Bot 更新", "git-mirror-scope-bot", scopeBot, setScopeBot],
                    ["WebUI 下载", "git-mirror-scope-webui", scopeWebui, setScopeWebui],
                    ["社区插件", "git-mirror-scope-community", scopeCommunity, setScopeCommunity],
                  ] as Array<[string, string, string, (v: string) => void]>
                ).map(([label, id, value, setter]) => (
                  <div key={id} className="git-mirror-dialog__scope">
                    <label className="git-mirror-dialog__label" htmlFor={id}>
                      {label}
                    </label>
                    <Select value={value} onValueChange={setter}>
                      <SelectTrigger id={id} className="git-mirror-dialog__select h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={INHERIT}>跟随全局首选</SelectItem>
                        {info.available_mirrors.map((opt) => (
                          <SelectItem key={`${id}-${opt.id}`} value={opt.id}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <details className="git-mirror-dialog__coverage muted">
                <summary className="git-mirror-dialog__coverage-title">作用范围说明</summary>
                <ul className="git-mirror-dialog__coverage-list">
                  <li>
                    <strong>Bot 更新</strong>：Bot git 拉取 / 更新页；<code>packages/</code> 内核插件随 Bot
                  </li>
                  <li>
                    <strong>WebUI 下载</strong>：控制台 dist / Release 包下载（无 git remote，仅 scope）
                  </li>
                  <li>
                    <strong>官方商店</strong>：<code>pallas-plugin-*</code> 独立仓库；pip 装写入偏好，git 装可改写 origin
                  </li>
                  <li>
                    <strong>社区插件</strong>：<code>local/plugins/</code> 下从 Git 安装的插件（可改写 origin）
                  </li>
                </ul>
              </details>

              <div className="git-mirror-dialog__actions">
                <UiButton variant="primary" size="sm" disabled={saveBusy} onClick={() => void savePreferred()}>
                  {saveBusy ? "保存中…" : "保存"}
                </UiButton>
                <UiButton variant="outline" size="sm" disabled={probeBusy} onClick={() => void runProbe()}>
                  {probeBusy ? "检测中…" : "测试连通"}
                </UiButton>
                <div className="git-mirror-dialog__actions-spacer" />
                {!confirmApplyAllOpen ? (
                  <UiButton variant="ghost" size="sm" onClick={() => setConfirmApplyAllOpen(true)}>
                    应用到全部
                  </UiButton>
                ) : null}
                <UiButton
                  variant="ghost"
                  size="sm"
                  disabled={Boolean(applyBusyKey)}
                  onClick={() => void applyCommunityBatch()}
                >
                  改写社区 remote
                </UiButton>
              </div>

              {confirmApplyAllOpen ? (
                <div className="git-mirror-dialog__confirm">
                  <p className="git-mirror-dialog__confirm-msg">
                    将按当前全局首选改写 Bot 的 git origin。官方商店与社区插件请用列表「切换」或「改写社区 remote」。WebUI
                    仅靠上方 scope。确认继续？
                  </p>
                  <div className="git-mirror-dialog__confirm-actions">
                    <UiButton variant="ghost" size="sm" disabled={applyAllBusy} onClick={() => setConfirmApplyAllOpen(false)}>
                      取消
                    </UiButton>
                    <UiButton variant="primary" size="sm" disabled={applyAllBusy} onClick={() => void applyAll()}>
                      {applyAllBusy ? "应用中…" : "确认应用"}
                    </UiButton>
                  </div>
                </div>
              ) : null}
            </section>

            <TargetBlock
              rows={targetRows}
              title="Bot / WebUI"
              empty="暂无 Bot / WebUI 项。"
              cardClass="git-mirror-dialog__cards--targets"
            />
            <TargetBlock
              rows={officialRows}
              title="官方商店插件"
              empty="暂无官方扩展清单（需 Bot 后端支持）。"
              cardClass="git-mirror-dialog__cards--official"
            />
            <TargetBlock
              rows={pluginRows}
              title="社区插件"
              empty="暂无社区插件。"
              cardClass="git-mirror-dialog__cards--plugins"
            />
          </>
        ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(switchTarget)}
        onOpenChange={(next) => {
          if (!next && !applyBusyKey) setSwitchTarget(null);
        }}
      >
        <DialogContent
          className="git-mirror-switch-dialog flex max-h-[min(480px,calc(100dvh-32px))] w-[min(420px,calc(100vw-32px))] max-w-[min(420px,calc(100vw-32px))] gap-0 overflow-hidden bg-card p-0"
          onEscapeKeyDown={(e) => {
            if (applyBusyKey) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (applyBusyKey) e.preventDefault();
          }}
        >
          <DialogHeader className="border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 text-left">
            <DialogTitle id="git-mirror-switch-title">切换镜像源</DialogTitle>
            <DialogDescription className="muted">
              {switchTarget ? rowTitle(switchTarget) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 py-3">
        {switchTarget && info ? (
          <div className="git-mirror-dialog__section">
            <label className="git-mirror-dialog__label" htmlFor="git-mirror-switch-select">
              选择镜像源
            </label>
            <Select value={switchMirrorId} onValueChange={setSwitchMirrorId}>
              <SelectTrigger id="git-mirror-switch-select" className="git-mirror-dialog__select h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {info.available_mirrors.map((opt) => (
                  <SelectItem key={`sw-${opt.id}`} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="git-mirror-dialog__confirm-actions">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={Boolean(applyBusyKey)}
                onClick={() => setSwitchTarget(null)}
              >
                取消
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={Boolean(applyBusyKey)}
                onClick={() => void confirmSwitch()}
              >
                确认
              </Button>
            </div>
          </div>
        ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
