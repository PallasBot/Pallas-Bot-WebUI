import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import "@/styles/git-mirror-dialog.css";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchGitMirrorInfo,
  postGitMirrorApplyBot,
  postGitMirrorApplyCommunity,
  postGitMirrorApplyOfficial,
  postGitMirrorApplyPlugin,
  postGitMirrorProbe,
  putGitMirrorPreferred,
} from "@/api/fullConsole";
import type { GitMirrorInfo, GitMirrorScopes, GitMirrorTargetRow } from "@/api/pallasTypes";
import FormSectionDivider from "@/components/config/FormSectionDivider";
import SettingsFormField from "@/components/config/SettingsFormField";
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
  const [confirmApplyBotOpen, setConfirmApplyBotOpen] = useState(false);
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
      setConfirmApplyBotOpen(false);
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

  async function applyBotRemote() {
    if (applyAllBusy) return;
    if (!(await ensureSavedIfDirty())) return;
    setApplyAllBusy(true);
    try {
      const result = await postGitMirrorApplyBot({
        preferred_id: effectiveMirrorId(scopeBot),
      });
      pushConsoleToast(
        result.success ? `Bot：${result.message}` : `Bot 失败：${result.message}`,
        result.success ? "ok" : "err",
      );
      await loadInfo();
    } catch (e) {
      pushConsoleToast(axiosErrorDetail(e) || "改写 Bot remote 失败", "err");
    } finally {
      setApplyAllBusy(false);
      setConfirmApplyBotOpen(false);
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
      pushConsoleToast(`已改写社区 remote：${success_count}/${total} 成功`, level);
      await loadInfo();
    } catch (e) {
      pushConsoleToast(axiosErrorDetail(e) || "改写社区 remote 失败", "err");
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

  function openSwitch(row: GitMirrorTargetRow) {
    setSwitchTarget(row);
    setSwitchMirrorId(preferredId);
  }

  function TargetBlock({
    rows,
    title,
    empty,
    cardClass,
    headerAction,
    footer,
  }: {
    rows: GitMirrorTargetRow[];
    title: string;
    empty: string;
    cardClass: string;
    headerAction?: ReactNode;
    footer?: ReactNode;
  }) {
    return (
      <section className="git-mirror-dialog__block">
        <FormSectionDivider title={title} action={headerAction} />
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
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={Boolean(applyBusyKey)}
                            onClick={() => openSwitch(row)}
                          >
                            切换
                          </Button>
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={Boolean(applyBusyKey)}
                      onClick={() => openSwitch(row)}
                    >
                      切换镜像源
                    </Button>
                  ) : (
                    <p className="git-mirror-dialog__action-muted muted">—</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {footer}
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
          className="plugin-config-dialog git-mirror-dialog flex max-h-[min(860px,calc(100dvh-32px))] w-[min(720px,calc(100vw-32px))] max-w-[min(720px,calc(100vw-32px))] gap-0 overflow-hidden bg-card p-0"
          onEscapeKeyDown={(e) => {
            if (dialogBusy) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (dialogBusy) e.preventDefault();
          }}
        >
          <DialogHeader className="plugin-config-dialog__head border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 text-left sm:text-left">
            <DialogTitle id="git-mirror-dialog-title" className="text-left">
              Git 镜像源
            </DialogTitle>
            <DialogDescription className="muted">
              先保存偏好，再按目标改写 remote 或切换单项镜像。
            </DialogDescription>
          </DialogHeader>

          <div className="plugin-config-dialog__bd git-mirror-dialog__bd min-h-0 flex-1 overflow-auto px-4 py-3">
            {loading ? (
              <div className="git-mirror-dialog__state muted" role="status">
                正在加载…
              </div>
            ) : loadErr ? (
              <div className="git-mirror-dialog__state" role="status">
                <p className="git-mirror-dialog__err">{loadErr}</p>
                <Button type="button" size="sm" variant="outline" onClick={() => void loadInfo()}>
                  重试
                </Button>
              </div>
            ) : info ? (
              <>
                <section className="git-mirror-dialog__block">
                  <FormSectionDivider title="镜像偏好" />
                  <SettingsFormField
                    label="全局首选"
                    hint="未单独覆盖的通道会跟随此项。保存后写入偏好配置。"
                  >
                    <Select value={preferredId} onValueChange={setPreferredId}>
                      <SelectTrigger id="git-mirror-preferred" className="h-9 w-full">
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
                  </SettingsFormField>

                  {showCustomPrefix ? (
                    <SettingsFormField
                      label="自定义 https 前缀"
                      hint="用作 GitHub 等上游的 HTTPS 代理前缀，例如 https://ghproxy.example。"
                    >
                      <Input
                        id="git-mirror-custom-prefix"
                        className="h-9"
                        type="url"
                        value={customPrefix}
                        placeholder="https://ghproxy.example"
                        autoComplete="off"
                        onChange={(e) => setCustomPrefix(e.target.value)}
                      />
                    </SettingsFormField>
                  ) : null}

                  <div className="git-mirror-dialog__scopes">
                    <SettingsFormField
                      label="Bot 更新"
                      hint="Bot git 拉取与更新页；packages/ 内核插件随 Bot。"
                    >
                      <Select value={scopeBot} onValueChange={setScopeBot}>
                        <SelectTrigger id="git-mirror-scope-bot" className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={INHERIT}>跟随全局首选</SelectItem>
                          {info.available_mirrors.map((opt) => (
                            <SelectItem key={`bot-${opt.id}`} value={opt.id}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </SettingsFormField>
                    <SettingsFormField
                      label="WebUI 下载"
                      hint="控制台 dist / Release 下载；无 git remote，仅走此通道。"
                    >
                      <Select value={scopeWebui} onValueChange={setScopeWebui}>
                        <SelectTrigger id="git-mirror-scope-webui" className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={INHERIT}>跟随全局首选</SelectItem>
                          {info.available_mirrors.map((opt) => (
                            <SelectItem key={`webui-${opt.id}`} value={opt.id}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </SettingsFormField>
                    <SettingsFormField
                      label="社区插件"
                      hint="local/plugins/ 下从 Git 安装的插件默认跟随此通道。"
                    >
                      <Select value={scopeCommunity} onValueChange={setScopeCommunity}>
                        <SelectTrigger id="git-mirror-scope-community" className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={INHERIT}>跟随全局首选</SelectItem>
                          {info.available_mirrors.map((opt) => (
                            <SelectItem key={`community-${opt.id}`} value={opt.id}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </SettingsFormField>
                  </div>

                  <div className="git-mirror-dialog__actions">
                    <Button type="button" size="sm" disabled={saveBusy} onClick={() => void savePreferred()}>
                      {saveBusy ? "保存中…" : "保存"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={probeBusy}
                      onClick={() => void runProbe()}
                    >
                      {probeBusy ? "检测中…" : "测试连通"}
                    </Button>
                  </div>
                </section>

                <TargetBlock
                  rows={targetRows}
                  title="Bot / WebUI"
                  empty="暂无 Bot / WebUI 项。"
                  cardClass="git-mirror-dialog__cards--targets"
                  headerAction={
                    !confirmApplyBotOpen ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={applyAllBusy}
                        onClick={() => setConfirmApplyBotOpen(true)}
                      >
                        改写 Bot remote
                      </Button>
                    ) : null
                  }
                  footer={
                    confirmApplyBotOpen ? (
                      <div className="git-mirror-dialog__confirm">
                        <p className="git-mirror-dialog__confirm-msg">
                          将按当前全局首选改写 Bot 的 git origin。官方商店与社区插件请用列表「切换」或下方「改写社区
                          remote」。WebUI 仅靠上方下载通道。确认继续？
                        </p>
                        <div className="git-mirror-dialog__confirm-actions">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={applyAllBusy}
                            onClick={() => setConfirmApplyBotOpen(false)}
                          >
                            取消
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={applyAllBusy}
                            onClick={() => void applyBotRemote()}
                          >
                            {applyAllBusy ? "改写中…" : "确认改写"}
                          </Button>
                        </div>
                      </div>
                    ) : null
                  }
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
                  headerAction={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={Boolean(applyBusyKey)}
                      onClick={() => void applyCommunityBatch()}
                    >
                      {applyBusyKey === "community-batch" ? "改写中…" : "改写社区 remote"}
                    </Button>
                  }
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
              {switchTarget ? `${rowTitle(switchTarget)} · 选择镜像后确认` : "选择镜像后确认"}
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 py-3">
            {switchTarget && info ? (
              <div className="git-mirror-dialog__section">
                <SettingsFormField
                  label="镜像源"
                  hint="将改写该目标的 git origin，或更新 WebUI 下载通道。"
                >
                  <Select value={switchMirrorId} onValueChange={setSwitchMirrorId}>
                    <SelectTrigger id="git-mirror-switch-select" className="h-9 w-full">
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
                </SettingsFormField>
                <div className="git-mirror-dialog__confirm-actions">
                  <Button
                    type="button"
                    variant="outline"
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
                    {applyBusyKey ? "切换中…" : "确认切换"}
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
