import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpToLine, CircleDot, GitBranch, RotateCcw, Tag, Undo2, Zap } from "lucide-react";
import {
  fetchBotGitHistory,
  fetchBotGitStatus,
  putPluginConfig,
} from "@/api/fullConsole";
import type { BotGitHistoryItem, BotGitUiMode } from "@/api/pallasTypes";
import { axiosErrorDetail } from "@/api/http";
import ChromeField from "@/components/ChromeField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHROME_SELECT_TRIGGER } from "@/components/ChromeTools";
import { cn } from "@/lib/utils";
import { pushConsoleToast } from "@/utils/consoleToast";

const PB_WEBUI_PLUGIN = "pb_webui";
const BOT_UPDATE_TRACK = "pallas_bot_update_track";
const BOT_UPDATE_BRANCH = "pallas_bot_update_branch";
/** 历史列表默认条数（近 N 个版本 / 提交） */
const HISTORY_LIMIT = 10;
/** 分支轨道仅允许官方主干，与后端 BOT_GIT_TRACK_BRANCHES 一致 */
const ALLOWED_TRACK_BRANCHES = ["dev", "main"] as const;
const BTN_ICO = "size-3.5 shrink-0 transition-transform duration-200 ease-out";

function coerceTrackBranch(value: string | undefined | null): (typeof ALLOWED_TRACK_BRANCHES)[number] {
  const name = String(value || "")
    .trim()
    .replace(/^origin\//, "");
  return ALLOWED_TRACK_BRANCHES.includes(name as (typeof ALLOWED_TRACK_BRANCHES)[number])
    ? (name as (typeof ALLOWED_TRACK_BRANCHES)[number])
    : "dev";
}

function trackToMode(track: string | undefined): BotGitUiMode {
  return track === "branch" || track === "commit" ? "commit" : "release";
}

function modeToTrack(mode: BotGitUiMode): "release" | "branch" {
  return mode === "commit" ? "branch" : "release";
}

function formatGitDate(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "—";
  // 2026-08-02 17:05:00 +0800 / ISO
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (m) return `${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
  const d = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (d) return `${d[2]}-${d[3]}`;
  return s.length > 16 ? s.slice(0, 16) : s;
}

type Props = {
  disabled?: boolean;
  applyBusy?: boolean;
  applyPercent?: number;
  applyHint?: string;
  onApply: (opts: {
    mode: BotGitUiMode;
    branch: string;
    ref: string;
    strategy: "safe" | "force";
    restart: boolean;
  }) => Promise<void>;
  confirm: (opts: {
    title: string;
    subtitle: string;
    confirmLabel?: string;
    confirmVariant?: "default" | "destructive";
  }) => Promise<boolean>;
};

export default function BotGitUpdatePanel({
  disabled = false,
  applyBusy = false,
  applyPercent = 0,
  applyHint = "",
  onApply,
  confirm,
}: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<BotGitUiMode>("release");
  const [branch, setBranch] = useState("");
  const [configBusy, setConfigBusy] = useState(false);

  const statusQ = useQuery({
    queryKey: ["bot-git-status"],
    queryFn: fetchBotGitStatus,
    staleTime: 30_000,
    retry: 1,
  });
  const releaseOnly = statusQ.data?.deployment_mode === "docker";
  const supportsForce = !releaseOnly;
  const historyEnabled =
    (Boolean(statusQ.data?.git_available) || (releaseOnly && mode === "release")) &&
    (mode === "release" || Boolean(branch));

  useEffect(() => {
    const data = statusQ.data;
    if (!data) return;
    setMode(data.deployment_mode === "docker" ? "release" : trackToMode(String(data.update_track || "")));
    const preferred = String(data.update_branch || "").trim();
    const cur = String(data.current_branch || "").trim();
    const next = coerceTrackBranch(preferred || (cur !== "HEAD" ? cur : "") || "dev");
    setBranch((prev) => (ALLOWED_TRACK_BRANCHES.includes(prev as (typeof ALLOWED_TRACK_BRANCHES)[number]) ? prev : next));
  }, [statusQ.data]);

  const historyQ = useQuery({
    queryKey: ["bot-git-history", mode, branch, HISTORY_LIMIT],
    queryFn: () =>
      fetchBotGitHistory({
        mode,
        branch: mode === "commit" ? branch : "",
        limit: HISTORY_LIMIT,
      }),
    enabled: historyEnabled,
    staleTime: 20_000,
    retry: 1,
  });

  const branches = [...ALLOWED_TRACK_BRANCHES];

  const items = historyQ.data?.items || [];
  const headIndex = useMemo(() => items.findIndex((it) => it.is_head), [items]);
  const head = statusQ.data?.head || historyQ.data?.head;
  const metaParts: string[] = [];
  // 「本地当前」标在对应历史行上；仅当 HEAD 不在近 N 条里时再提示
  if (headIndex < 0 && (head?.short_sha || head?.tag)) {
    metaParts.push(`本地当前 ${head.tag || head.short_sha}（不在近 ${HISTORY_LIMIT} 条内）`);
  }
  if (mode === "commit" && statusQ.data?.upstream_ref) {
    metaParts.push(`跟踪 ${statusQ.data.upstream_ref}`);
  }
  if (mode === "commit" && (statusQ.data?.commits_behind ?? 0) > 0) {
    metaParts.push(`落后 ${statusQ.data?.commits_behind} 个提交`);
  }
  if (statusQ.data?.deployment_mode) {
    metaParts.push(String(statusQ.data.deployment_mode));
  }

  const locked = disabled || applyBusy || configBusy;
  const hasUpdate =
    mode === "commit"
      ? (statusQ.data?.commits_behind ?? 0) > 0
      : items.some((it) => it.is_latest && !it.is_head);

  async function persistModeAndBranch(nextMode: BotGitUiMode, nextBranch: string) {
    setConfigBusy(true);
    try {
      await putPluginConfig(PB_WEBUI_PLUGIN, {
        [BOT_UPDATE_TRACK]: modeToTrack(nextMode),
        [BOT_UPDATE_BRANCH]: nextMode === "commit" ? nextBranch : "",
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["bot-git-status"] }),
        qc.invalidateQueries({ queryKey: ["bot-git-history"] }),
        qc.invalidateQueries({ queryKey: ["update-check-all"] }),
        qc.invalidateQueries({ queryKey: ["webui-auto-update-status"] }),
      ]);
    } catch (e) {
      const detail = axiosErrorDetail(e) || (e instanceof Error ? e.message : String(e));
      pushConsoleToast(detail, "err");
      throw e;
    } finally {
      setConfigBusy(false);
    }
  }

  async function onModeChange(next: BotGitUiMode) {
    if (next === mode) return;
    setMode(next);
    try {
      await persistModeAndBranch(next, branch);
      pushConsoleToast(next === "commit" ? "已切换为 Commit 更新" : "已切换为 Release 更新", "ok");
    } catch {
      setMode(trackToMode(String(statusQ.data?.update_track || "")));
    }
  }

  async function onBranchChange(next: string) {
    const allowed = coerceTrackBranch(next);
    if (allowed === branch) return;
    setBranch(allowed);
    try {
      await persistModeAndBranch("commit", allowed);
      pushConsoleToast(`已跟踪分支 ${allowed}`, "ok");
    } catch {
      setBranch(coerceTrackBranch(statusQ.data?.update_branch || statusQ.data?.current_branch));
    }
  }

  async function runApply(opts: {
    ref: string;
    strategy: "safe" | "force";
    restart: boolean;
    label: string;
    /** 相对当前 HEAD：更新（更新）或回退（更旧） */
    direction?: "update" | "rollback";
  }) {
    const force = opts.strategy === "force";
    const rollback = opts.direction === "rollback";
    const safeTitle = rollback ? "回退 Bot" : "更新 Bot";
    const forceTitle = rollback ? "强制回退 Bot" : "强制更新 Bot";
    const safeConfirm = rollback ? "回退到此" : opts.restart ? "更新并重启" : "更新";
    const forceConfirm = rollback ? "强制回退" : "强制更新";
    if (
      !(await confirm({
        title: force ? forceTitle : safeTitle,
        subtitle: force
          ? `将执行 git reset --hard 到 ${opts.label}，未提交改动会丢失。确定？`
          : rollback
            ? `将 Bot 回退到 ${opts.label}？`
            : `将 Bot ${opts.restart ? "更新并重启" : "更新"}到 ${opts.label}？`,
        confirmLabel: force ? forceConfirm : safeConfirm,
        confirmVariant: force || rollback ? "destructive" : "default",
      }))
    ) {
      return;
    }
    await onApply({
      mode,
      branch: mode === "commit" ? branch : "",
      ref: opts.ref,
      strategy: opts.strategy,
      restart: opts.restart,
    });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["bot-git-status"] }),
      qc.invalidateQueries({ queryKey: ["bot-git-history"] }),
      qc.invalidateQueries({ queryKey: ["update-check-all"] }),
    ]);
  }

  function rowLabel(item: BotGitHistoryItem): string {
    const raw = item.short_ref || item.ref;
    if (item.kind === "commit" || mode === "commit") {
      return raw.slice(0, 7);
    }
    return raw;
  }

  if (statusQ.isLoading) {
    return <p className="muted text-sm">加载 Bot git 状态…</p>;
  }

  if (statusQ.data && statusQ.data.git_available === false && !releaseOnly) {
    return null;
  }

  return (
    <div className="bot-git-panel">
      <div className="bot-git-panel__toolbar chrome-tools">
        <div className="bot-git-panel__toolbar-track">
          <ChromeField label="更新方式" icon={Tag}>
            <Select
              value={mode}
              onValueChange={(v) => void onModeChange(v === "commit" ? "commit" : "release")}
              disabled={locked || releaseOnly}
            >
              <SelectTrigger className={cn(CHROME_SELECT_TRIGGER, "w-[7.5rem]")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="release">Release</SelectItem>
                {!releaseOnly ? <SelectItem value="commit">Commit</SelectItem> : null}
              </SelectContent>
            </Select>
          </ChromeField>

          {!releaseOnly ? (
            <ChromeField label="分支" icon={GitBranch} className={mode !== "commit" ? "opacity-45" : undefined}>
              <Select
                value={branch || undefined}
                onValueChange={(v) => void onBranchChange(v)}
                disabled={locked || mode !== "commit" || !branches.length}
              >
                <SelectTrigger className={cn(CHROME_SELECT_TRIGGER, "w-[8.5rem]")}>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ChromeField>
          ) : null}

          <div className="bot-git-panel__actions">
            <Button
              type="button"
              size="sm"
              className="group bot-git-panel__btn-primary"
              disabled={locked || !hasUpdate}
              onClick={() =>
                void runApply({
                  ref: "",
                  strategy: "safe",
                  restart: Boolean(statusQ.data?.restart_available),
                  label: mode === "commit" ? `origin/${branch || "…"} 最新` : "最新 Release",
                  direction: "update",
                })
              }
            >
              <ArrowUpToLine className={cn(BTN_ICO, "group-hover:-translate-y-0.5")} aria-hidden />
              更新到最新
            </Button>
            {supportsForce ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="group"
                disabled={locked}
                onClick={() =>
                  void runApply({
                    ref: "",
                    strategy: "force",
                    restart: Boolean(statusQ.data?.restart_available),
                    label: mode === "commit" ? `origin/${branch || "…"} 最新` : "最新 Release",
                    direction: "update",
                  })
                }
              >
                <Zap className={cn(BTN_ICO, "group-hover:scale-110 group-hover:rotate-6")} aria-hidden />
                强制更新到最新
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {metaParts.length ? <p className="bot-git-panel__meta muted">{metaParts.join(" · ")}</p> : null}

      {applyBusy ? (
        <div className="bot-git-panel__progress muted text-sm">
          {applyHint || "正在应用…"}
          {applyPercent > 0 ? ` · ${Math.round(applyPercent)}%` : ""}
        </div>
      ) : null}

      {historyQ.isError ? (
        <p className="alert alert--err text-sm">历史加载失败：{axiosErrorDetail(historyQ.error)}</p>
      ) : null}

      <div className="bot-git-panel__table-wrap">
        <table className="bot-git-panel__table">
          <thead>
            <tr>
              <th>{mode === "release" ? "版本" : "提交"}</th>
              <th>说明</th>
              <th>日期</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {historyQ.isLoading ? (
              <tr>
                <td colSpan={4} className="muted">
                  加载历史…
                </td>
              </tr>
            ) : !items.length ? (
              <tr>
                <td colSpan={4} className="muted">
                  暂无记录
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                const rollback = headIndex >= 0 ? index > headIndex : !item.is_latest;
                const safeLabel = rollback ? "回退到此" : "更新到此";
                const forceLabel = rollback ? "强制回退" : "强制更新";
                return (
                  <tr key={`${item.kind}:${item.ref}`} className={cn(item.is_head && "bot-git-panel__row--head")}>
                    <td className="bot-git-panel__ref">
                      <code>{rowLabel(item)}</code>
                      {item.is_latest ? (
                        <Badge variant="outline" className="bot-git-panel__badge bot-git-panel__badge--latest">
                          最新
                        </Badge>
                      ) : null}
                      {item.is_head ? (
                        <Badge variant="secondary" className="bot-git-panel__badge">
                          本地当前
                        </Badge>
                      ) : null}
                    </td>
                    <td className="bot-git-panel__msg">{item.message || "—"}</td>
                    <td className="bot-git-panel__date muted">{formatGitDate(item.date)}</td>
                    <td className="bot-git-panel__row-actions">
                      {item.is_head ? (
                        <Button type="button" size="sm" variant="secondary" disabled>
                          <CircleDot className="size-3.5 shrink-0 opacity-70" aria-hidden />
                          本地当前
                        </Button>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant={rollback ? "outline" : "default"}
                            className={cn("group", !rollback && "bot-git-panel__btn-primary")}
                            disabled={locked}
                            onClick={() =>
                              void runApply({
                                ref: item.ref,
                                strategy: "safe",
                                restart: false,
                                label: rowLabel(item),
                                direction: rollback ? "rollback" : "update",
                              })
                            }
                          >
                            {rollback ? (
                              <Undo2 className={cn(BTN_ICO, "group-hover:-rotate-12")} aria-hidden />
                            ) : (
                              <ArrowUpToLine className={cn(BTN_ICO, "group-hover:-translate-y-0.5")} aria-hidden />
                            )}
                            {safeLabel}
                          </Button>
                          {supportsForce ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              className="group"
                              disabled={locked}
                              onClick={() =>
                                void runApply({
                                  ref: item.ref,
                                  strategy: "force",
                                  restart: false,
                                  label: rowLabel(item),
                                  direction: rollback ? "rollback" : "update",
                                })
                              }
                            >
                              {rollback ? (
                                <RotateCcw className={cn(BTN_ICO, "group-hover:-rotate-45")} aria-hidden />
                              ) : (
                                <Zap
                                  className={cn(BTN_ICO, "group-hover:scale-110 group-hover:rotate-6")}
                                  aria-hidden
                                />
                              )}
                              {forceLabel}
                            </Button>
                          ) : null}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="bot-git-panel__note muted">
        默认展示近 {HISTORY_LIMIT} 条。相对当前：更新用「更新到此 / 强制更新」，更旧版本用「回退到此 /
        强制回退」。安全操作优先快进/checkout（必要时 stash）；强制为 reset --hard。
      </p>
    </div>
  );
}
