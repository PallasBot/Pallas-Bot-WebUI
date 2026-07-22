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
import type { GitMirrorInfo, GitMirrorScopes, GitMirrorTargetRow } from "@pallas-vue/api/pallasTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  const [toast, setToast] = useState<{ text: string; level: "ok" | "warn" | "err" } | null>(null);

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
      next.bot !== (saved.bot || "") ||
      next.webui !== (saved.webui || "") ||
      next.community !== (saved.community || "")
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
      setToast(null);
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
      setToast({ text: "Git 镜像偏好已保存", level: "ok" });
      return true;
    } catch (e) {
      setToast({ text: axiosErrorDetail(e) || "保存失败", level: "err" });
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
        setToast({ text: `连通正常：${mirrorLabel(result.mirror_id || preferredId)}`, level: "ok" });
      } else {
        setToast({
          text: `${mirrorLabel(result.mirror_id || preferredId)} 不可用${result.error ? `：${result.error}` : ""}`,
          level: "err",
        });
      }
    } catch (e) {
      setToast({ text: axiosErrorDetail(e) || "连通检测失败", level: "err" });
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
      setToast({ text: `已应用到全部：${success_count}/${total} 成功`, level });
      await loadInfo();
    } catch (e) {
      setToast({ text: axiosErrorDetail(e) || "批量应用失败", level: "err" });
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
      setToast({ text: `已应用到社区插件：${success_count}/${total} 成功`, level });
      await loadInfo();
    } catch (e) {
      setToast({ text: axiosErrorDetail(e) || "批量应用社区插件失败", level: "err" });
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
        setToast({
          text: result.success ? `Bot：${result.message}` : `Bot 失败：${result.message}`,
          level: result.success ? "ok" : "err",
        });
      } else if (row.kind === "webui") {
        syncFormFromInfo(
          await putGitMirrorPreferred({
            preferred_id: preferredId,
            custom_proxy_prefix: showCustomPrefix ? customPrefix : "",
            scopes: { ...currentScopesPayload(), webui: switchMirrorId },
          }),
        );
        setToast({ text: `WebUI 下载源已设为 ${mirrorLabel(switchMirrorId)}`, level: "ok" });
      } else if (row.kind === "official") {
        const result = await postGitMirrorApplyOfficial(row.id, { preferred_id: switchMirrorId });
        setToast({
          text: result.success ? `${rowTitle(row)}：${result.message}` : `${rowTitle(row)} 失败：${result.message}`,
          level: result.success ? "ok" : "err",
        });
      } else {
        const result = await postGitMirrorApplyPlugin(row.id, { preferred_id: switchMirrorId });
        setToast({
          text: result.success ? `${row.id}：${result.message}` : `${row.id} 失败：${result.message}`,
          level: result.success ? "ok" : "err",
        });
      }
      await loadInfo();
      setSwitchTarget(null);
    } catch (e) {
      setToast({ text: axiosErrorDetail(e) || "切换失败", level: "err" });
    } finally {
      setApplyBusyKey(null);
    }
  }

  function requestClose() {
    if (dialogBusy) return;
    onClose();
  }

  function TargetTable({ rows, title }: { rows: GitMirrorTargetRow[]; title: string }) {
    if (!rows.length) {
      return <p className="text-sm text-muted-foreground">暂无{title}。</p>;
    }
    return (
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-2 py-2">目标</th>
              <th className="px-2 py-2">Remote</th>
              <th className="px-2 py-2">当前源</th>
              <th className="px-2 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.kind}:${row.id}`} className="border-b border-border/60">
                <td className="px-2 py-2 align-top">
                  <div className="font-medium">{rowTitle(row)}</div>
                  <div className="text-xs text-muted-foreground">{row.path}</div>
                </td>
                <td className="max-w-[14rem] px-2 py-2 align-top text-xs break-all" title={row.remote_url || row.note || undefined}>
                  {row.remote_url ? shortRemote(row.remote_url) : row.note || "—"}
                </td>
                <td className="px-2 py-2 align-top">
                  <Badge variant={row.mirror === preferredId ? "success" : "secondary"}>{mirrorLabel(row.mirror)}</Badge>
                </td>
                <td className="px-2 py-2 align-top">
                  {canSwitch(row) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={Boolean(applyBusyKey)}
                      onClick={() => {
                        setSwitchTarget(row);
                        setSwitchMirrorId(preferredId);
                      }}
                    >
                      切换
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && requestClose()}>
        <DialogContent className="max-w-3xl overflow-hidden p-0">
          <div className="flex max-h-[min(90vh,52rem)] flex-col">
            <DialogHeader className="border-b px-4 py-3">
              <DialogTitle>Git 镜像源</DialogTitle>
              <DialogDescription>
                Bot 本体、WebUI、官方商店插件与社区插件均可配置镜像。
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
              {toast ? (
                <p
                  className={cn(
                    "text-sm",
                    toast.level === "ok" && "text-emerald-400",
                    toast.level === "warn" && "text-amber-300",
                    toast.level === "err" && "text-destructive",
                  )}
                >
                  {toast.text}
                </p>
              ) : null}

              {loading ? (
                <p className="text-sm text-muted-foreground">正在加载…</p>
              ) : loadErr ? (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">{loadErr}</p>
                  <Button size="sm" variant="outline" onClick={() => void loadInfo()}>
                    重试
                  </Button>
                </div>
              ) : info ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">全局首选</span>
                      <select
                        className="h-9 w-full rounded-md border bg-background px-3"
                        value={preferredId}
                        onChange={(e) => setPreferredId(e.target.value)}
                      >
                        {info.available_mirrors.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                        {!info.available_mirrors.some((row) => row.id === "custom") ? (
                          <option value="custom">自定义代理前缀</option>
                        ) : null}
                      </select>
                    </label>
                    {showCustomPrefix ? (
                      <label className="space-y-1 text-sm">
                        <span className="text-muted-foreground">自定义 https 前缀</span>
                        <Input
                          type="url"
                          value={customPrefix}
                          placeholder="https://ghproxy.example"
                          onChange={(e) => setCustomPrefix(e.target.value)}
                        />
                      </label>
                    ) : null}
                  </div>

                  <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
                    {(
                      [
                        ["Bot 更新", scopeBot, (v: string) => setScopeBot(v)],
                        ["WebUI 下载", scopeWebui, (v: string) => setScopeWebui(v)],
                        ["社区插件", scopeCommunity, (v: string) => setScopeCommunity(v)],
                      ] as Array<[string, string, (v: string) => void]>
                    ).map(([label, value, setter]) => (
                      <label key={label} className="space-y-1 text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <select
                          className="h-9 w-full rounded-md border bg-background px-3"
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                        >
                          <option value={INHERIT}>跟随全局首选</option>
                          {info.available_mirrors.map((opt) => (
                            <option key={`${label}-${opt.id}`} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={saveBusy} onClick={() => void savePreferred()}>
                      {saveBusy ? "保存中…" : "保存"}
                    </Button>
                    <Button size="sm" variant="outline" disabled={probeBusy} onClick={() => void runProbe()}>
                      {probeBusy ? "检测中…" : "测试连通"}
                    </Button>
                    {!confirmApplyAllOpen ? (
                      <Button size="sm" variant="ghost" onClick={() => setConfirmApplyAllOpen(true)}>
                        应用到全部
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" disabled={Boolean(applyBusyKey)} onClick={() => void applyCommunityBatch()}>
                      改写社区 remote
                    </Button>
                  </div>

                  {confirmApplyAllOpen ? (
                    <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                      <p className="text-sm">
                        将按当前全局首选批量改写 remote（含 Bot 与社区插件）。WebUI 仅靠 scope。确认继续？
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="ghost" disabled={applyAllBusy} onClick={() => setConfirmApplyAllOpen(false)}>
                          取消
                        </Button>
                        <Button size="sm" disabled={applyAllBusy} onClick={() => void applyAll()}>
                          {applyAllBusy ? "应用中…" : "确认应用"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <section className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Bot / WebUI ({targetRows.length})</h3>
                    <TargetTable rows={targetRows} title="Bot / WebUI 项" />
                  </section>
                  <section className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">官方商店插件 ({officialRows.length})</h3>
                    <TargetTable rows={officialRows} title="官方扩展" />
                  </section>
                  <section className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">社区插件 ({pluginRows.length})</h3>
                    <TargetTable rows={pluginRows} title="社区插件" />
                  </section>
                </>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(switchTarget)} onOpenChange={(next) => !next && !applyBusyKey && setSwitchTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>切换镜像源</DialogTitle>
            <DialogDescription>{switchTarget ? rowTitle(switchTarget) : ""}</DialogDescription>
          </DialogHeader>
          {switchTarget && info ? (
            <div className="space-y-3">
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={switchMirrorId}
                onChange={(e) => setSwitchMirrorId(e.target.value)}
              >
                {info.available_mirrors.map((opt) => (
                  <option key={`sw-${opt.id}`} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" disabled={Boolean(applyBusyKey)} onClick={() => setSwitchTarget(null)}>
                  取消
                </Button>
                <Button size="sm" disabled={Boolean(applyBusyKey)} onClick={() => void confirmSwitch()}>
                  确认
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
