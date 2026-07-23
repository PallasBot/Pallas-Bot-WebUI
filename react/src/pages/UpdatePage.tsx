import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import { fetchPluginConfig, putPluginConfig } from "@/api/console";
import {
  fetchUpdateCheckAll,
  postBotUpdateApply,
  postUpdateApply,
} from "@/api/fullConsole";
import { releaseNotesToSafeHtml } from "@/utils/releaseNotesHtml";
import { pallasBotVersionLabel, updateCheckCurrentTagLabel } from "@/utils/versionDisplay";
import {
  PALLAS_BOT_DOC,
  PALLAS_BOT_RELEASES,
  PALLAS_BOT_REPO,
  PALLAS_WEBUI_RELEASES,
  PALLAS_WEBUI_REPO,
} from "@/utils/pallasExternalLinks";
import GitMirrorDialog from "@/components/GitMirrorDialog";
import PageMasthead from "@/components/PageMasthead";
import RefreshIconButton from "@/components/RefreshIconButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import UiInput from "@/components/ui/UiInput";
import { useBotSystemRestart } from "@/hooks/useBotSystemRestart";
import { cn } from "@/lib/utils";
import { pushConsoleToast } from "@/utils/consoleToast";
import { ChevronRight, RefreshCw } from "lucide-react";

const PB_PROTOCOL_PLUGIN = "pb_protocol";
const GITHUB_TOKEN_FIELD = "pallas_protocol_github_token";
const WEBUI_RELEASES_PAGE = PALLAS_WEBUI_RELEASES;
const BOT_RELEASES_PAGE = PALLAS_BOT_RELEASES;

const UPDATE_PANEL = "update-page__panel flex flex-col overflow-hidden shadow-none";
const UPDATE_PANEL_HD =
  "panel__hd panel__hd--split update-page__panel-hd-nowrap flex-row items-center justify-between space-y-0 border-b px-4 py-3";
const UPDATE_PANEL_BD = "panel__bd update-page__bd update-page__bd--release space-y-0 px-4 pb-4 pt-3";
const UPDATE_OPS_BD = "panel__bd update-page__bd px-4 pb-4 pt-3";
const UPDATE_STATUS_PILL = "update-page__status-pill";

function UpdateFoldSummary({ children }: { children: ReactNode }) {
  return (
    <summary className="update-page__release-fold-summary">
      <ChevronRight className="update-page__release-fold-chevron" aria-hidden strokeWidth={2} />
      <span className="min-w-0">{children}</span>
    </summary>
  );
}

function formatCheckedAt(ts?: number | null): string {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return "—";
  try {
    return new Date(ts * 1000).toLocaleString(undefined, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function botDeployLabel(mode?: string | null): string {
  if (mode === "docker") return "Docker";
  if (mode === "release_tag") return "正式版";
  if (mode === "release_tag_dirty") return "正式版 · 有本地改动";
  if (mode === "dev_clone") return "开发克隆";
  return "—";
}

function releaseNotesFoldSummary(
  currentTag: string | null | undefined,
  latestTag: string | null | undefined,
  hasUpdate: boolean | null | undefined,
): string {
  const latest = (latestTag || "").trim();
  const current = (currentTag || "").trim();
  if (hasUpdate && current && latest) return `${current} → ${latest} 更新说明`;
  if (latest) return `「${latest}」发行说明`;
  return "发行说明";
}

export default function UpdatePage() {
  const qc = useQueryClient();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [gitMirrorOpen, setGitMirrorOpen] = useState(false);
  const [ghTokenInput, setGhTokenInput] = useState("");
  const [ghTokenHadValue, setGhTokenHadValue] = useState(false);
  const [ghTokenBusy, setGhTokenBusy] = useState(false);
  const [ghTokenErr, setGhTokenErr] = useState("");
  const [ghTokenOk, setGhTokenOk] = useState("");

  const q = useQuery({ queryKey: ["update-check-all"], queryFn: fetchUpdateCheckAll });
  const web = q.data?.webui;
  const bot = q.data?.bot;

  const {
    restartBusy,
    restartErr,
    restartMsg,
    restartProgressLabel,
    restartInProgress,
    restartAvailable,
    shardedRuntime,
    ensureRestartContext,
    restartBot,
  } = useBotSystemRestart({ botUpdateCheck: bot ?? null });

  const webCurrentDisplay = updateCheckCurrentTagLabel(web?.current_tag);
  const botCurrentDisplay = pallasBotVersionLabel(undefined, bot);
  const webReleaseNotesHtml = useMemo(() => releaseNotesToSafeHtml(web?.release_notes), [web?.release_notes]);
  const botReleaseNotesHtml = useMemo(() => releaseNotesToSafeHtml(bot?.release_notes), [bot?.release_notes]);
  const webReleaseNotesSummary = releaseNotesFoldSummary(web?.current_tag, web?.latest_tag, web?.has_update);
  const botReleaseNotesSummary = releaseNotesFoldSummary(bot?.current_tag, bot?.latest_tag, bot?.has_update);

  const webCallout = web?.has_update ? "更新完成后页面会自动刷新。" : null;
  const botCallout = useMemo((): { kind: "warn" | "info"; text: string } | null => {
    if (!bot) return null;
    if (bot.deployment_mode === "docker") {
      return { kind: "warn", text: "控制台不能 git 拉代码；请按下方步骤拉新镜像并重启容器。" };
    }
    if (bot.deployment_mode === "release_tag_dirty") {
      return {
        kind: "warn",
        text: `更新前会自动 stash ${bot.dirty_file_count ?? 0} 项本地改动；冲突时需 git stash pop。建议插件放 local/plugins/。`,
      };
    }
    if (bot.deployment_mode === "dev_clone") {
      return { kind: "info", text: "更新时执行 git pull --ff-only --autostash。" };
    }
    return null;
  }, [bot]);

  const botMetaParts = useMemo(() => {
    if (!bot) return [] as string[];
    const parts: string[] = [botDeployLabel(bot.deployment_mode)];
    if (bot.git_available && bot.current_branch) parts.push(`分支 ${bot.current_branch}`);
    if (bot.dirty && (bot.dirty_file_count ?? 0) > 0) parts.push(`改动 ${bot.dirty_file_count} 项`);
    return parts;
  }, [bot]);

  const updateMastheadLead = useMemo(() => {
    const parts: string[] = [];
    if (web) parts.push(`WebUI ${webCurrentDisplay}${web.has_update ? " · 有更新" : ""}`);
    if (bot) parts.push(`Bot ${botCurrentDisplay}${bot.has_update ? " · 有更新" : ""}`);
    return parts.length ? parts.join(" · ") : "WebUI 与 Bot 版本更新。";
  }, [bot, botCurrentDisplay, web, webCurrentDisplay]);

  const checkedAtDisplay = formatCheckedAt(q.data?.checked_at);
  const webApplyDisabled = busy || !web?.has_update || !web?.latest_tag;
  const botApplyDisabled =
    busy || !bot?.has_update || !bot?.latest_tag || bot?.deployment_mode === "docker";

  const botDocLinks = useMemo(() => {
    const isDocker = bot?.deployment_mode === "docker";
    const links: { href: string; label: string }[] = [
      { href: PALLAS_BOT_DOC.home, label: "在线文档" },
      { href: PALLAS_BOT_REPO, label: "Pallas-Bot 仓库" },
      { href: PALLAS_BOT_DOC.siteCustomization, label: "站点定制与更新" },
      { href: PALLAS_BOT_DOC.localReadme, label: "local 目录说明" },
    ];
    if (isDocker) links.unshift({ href: PALLAS_BOT_DOC.dockerDeployment, label: "Docker 部署" });
    else links.push({ href: PALLAS_BOT_DOC.deployment, label: "标准部署" });
    links.push({ href: PALLAS_BOT_DOC.faqUpdates, label: "FAQ · 更新与版本" });
    return links;
  }, [bot?.deployment_mode]);

  const webDocLinks = useMemo(
    () => [
      { href: (web?.release_url || "").trim() || WEBUI_RELEASES_PAGE, label: "GitHub Release" },
      { href: PALLAS_WEBUI_REPO, label: "Pallas-Bot-WebUI 仓库" },
      { href: PALLAS_BOT_DOC.siteCustomization, label: "站点定制与更新" },
      { href: PALLAS_BOT_DOC.faqUpdates, label: "FAQ · 更新与版本" },
    ],
    [web?.release_url],
  );

  useEffect(() => {
    void loadGithubTokenHint();
  }, []);

  useEffect(() => {
    if (q.isSuccess) void ensureRestartContext();
  }, [q.isSuccess, ensureRestartContext]);

  useEffect(() => {
    const raw = (location.hash || "").replace(/^#/, "").trim();
    if (!raw || q.isLoading) return;
    requestAnimationFrame(() => {
      document.getElementById(raw)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [location.hash, q.isLoading, q.dataUpdatedAt]);

  async function loadGithubTokenHint() {
    setGhTokenErr("");
    setGhTokenOk("");
    try {
      const data = await fetchPluginConfig(PB_PROTOCOL_PLUGIN);
      const f = data.fields.find((x) => x.name === GITHUB_TOKEN_FIELD);
      const cur = f?.current;
      const s = cur === null || cur === undefined ? "" : String(cur).trim();
      setGhTokenHadValue(s.length > 0);
      setGhTokenInput("");
    } catch (e) {
      setGhTokenErr(e instanceof Error ? e.message : String(e));
      setGhTokenHadValue(false);
    }
  }

  async function saveGithubToken() {
    const next = ghTokenInput.trim();
    if (!next) {
      setGhTokenErr("请输入新令牌，或使用下方「清除」移除已保存的令牌。");
      return;
    }
    setGhTokenBusy(true);
    setGhTokenErr("");
    setGhTokenOk("");
    try {
      await putPluginConfig(PB_PROTOCOL_PLUGIN, { [GITHUB_TOKEN_FIELD]: next });
      setGhTokenHadValue(true);
      setGhTokenInput("");
      setGhTokenOk("配置已保存；若未立即生效可重启 Bot。");
      pushConsoleToast("GitHub 令牌已保存", "ok");
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setGhTokenErr(detail);
      pushConsoleToast(detail, "err");
    } finally {
      setGhTokenBusy(false);
    }
  }

  async function clearGithubToken() {
    if (!window.confirm("确定清除已保存的 GitHub 令牌？")) return;
    setGhTokenBusy(true);
    setGhTokenErr("");
    setGhTokenOk("");
    try {
      await putPluginConfig(PB_PROTOCOL_PLUGIN, { [GITHUB_TOKEN_FIELD]: "" });
      setGhTokenHadValue(false);
      setGhTokenInput("");
      setGhTokenOk("已清除；重启 Bot 后生效。");
      pushConsoleToast("GitHub 令牌已清除", "ok");
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setGhTokenErr(detail);
      pushConsoleToast(detail, "err");
    } finally {
      setGhTokenBusy(false);
    }
  }

  async function applyWeb() {
    if (!web?.latest_tag) return;
    if (!window.confirm(`将 WebUI 更新到 ${web.latest_tag}？`)) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const r = await postUpdateApply();
      setMsg(r.message ? `${r.message} · 正在刷新页面以载入新版本…` : "WebUI 已更新，正在刷新页面…");
      window.setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setErr(axiosErrorDetail(e));
    } finally {
      setBusy(false);
    }
  }

  async function applyBot(restart = false) {
    if (!bot?.latest_tag) return;
    const prompt = restart
      ? `将 Bot 更新到 ${bot.latest_tag} 并重启进程？`
      : `将 Bot 更新到 ${bot.latest_tag}？`;
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const r = await postBotUpdateApply({ restart });
      setMsg(r.message || (restart ? "已触发更新与重启。" : "已触发。"));
      if (!restart) await qc.invalidateQueries({ queryKey: ["update-check-all"] });
    } catch (e) {
      setErr(axiosErrorDetail(e));
    } finally {
      setBusy(false);
    }
  }

  async function triggerBotRestart(workersOnly = false) {
    setErr("");
    setMsg("");
    const ok = await restartBot(workersOnly);
    if (ok) setMsg(restartProgressLabel || restartMsg || "Bot 已恢复在线。");
    else if (restartErr) setErr(restartErr);
  }

  return (
    <div className="update-page console-hub-page">
      {err ? <div className="alert alert--err">{err}</div> : null}
      {msg ? <div className="alert alert--ok">{msg}</div> : null}

      <PageMasthead
        title="更新"
        description={
          <>
            {updateMastheadLead}
            {checkedAtDisplay !== "—" ? (
              <span className="update-page__checked-at muted"> · 检查于 {checkedAtDisplay}</span>
            ) : null}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" variant="secondary" size="sm" onClick={() => setGitMirrorOpen(true)}>
              镜像源
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={q.isFetching || busy}
              onClick={() => void q.refetch()}
            >
              <RefreshCw className={cn("size-3.5", (q.isFetching || busy) && "animate-spin")} />
              {q.isFetching || busy ? "检查中…" : "重新检查"}
            </Button>
          </div>
        }
      />

      <div className="update-page__overview">
        <a
          href="#console-update-webui"
          className={cn("update-page__overview-card", web?.has_update && "update-page__overview-card--warn")}
        >
          <span className="update-page__overview-k">WebUI</span>
          <span className="update-page__overview-v">{webCurrentDisplay}</span>
          <span className="update-page__overview-meta muted">
            {web?.has_update ? `→ ${web?.latest_tag ?? "?"}` : "已是最新"}
          </span>
        </a>
        <a
          href="#console-update-bot"
          className={cn("update-page__overview-card", bot?.has_update && "update-page__overview-card--warn")}
        >
          <span className="update-page__overview-k">Bot</span>
          <span className="update-page__overview-v">{botCurrentDisplay}</span>
          <span className="update-page__overview-meta muted">
            {bot?.has_update ? `→ ${bot?.latest_tag ?? "?"}` : botDeployLabel(bot?.deployment_mode)}
          </span>
        </a>
      </div>

      <Card id="console-update-webui" className={UPDATE_PANEL}>
        <CardHeader className={UPDATE_PANEL_HD}>
          <CardTitle className="panel__title flex flex-wrap items-center gap-1.5">
            WebUI
            <RefreshIconButton
              embedded
              showLabel={false}
              busy={q.isFetching}
              disabled={busy}
              label="刷新 WebUI 更新检查"
              onClick={() => void q.refetch()}
            />
            {web?.has_update ? (
              <Badge className={UPDATE_STATUS_PILL} variant="warn">
                有更新
              </Badge>
            ) : (
              <Badge className={UPDATE_STATUS_PILL} variant="success">
                已是最新
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className={UPDATE_PANEL_BD}>
          <div className="update-page__release-summary">
            <div className="update-page__release-stat">
              <span className="update-page__release-stat-label">当前</span>
              <span className="update-page__release-stat-value">{webCurrentDisplay}</span>
            </div>
            <span className="update-page__release-stat-arrow muted" aria-hidden="true">
              →
            </span>
            <div className="update-page__release-stat">
              <span className="update-page__release-stat-label">远端</span>
              <span className="update-page__release-stat-value">{web?.latest_tag ?? "—"}</span>
            </div>
          </div>

          <div className="update-page__release-primary">
            <Button type="button" disabled={webApplyDisabled} onClick={() => void applyWeb()}>
              {busy ? "处理中…" : "应用 WebUI 更新"}
            </Button>
            <a
              className="update-page__link update-page__release-ext-link"
              href={(web?.release_url || "").trim() || WEBUI_RELEASES_PAGE}
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub Release
            </a>
          </div>

          {web?.error ? (
            <p className="alert alert--err update-page__release-inline-alert">{web.error}</p>
          ) : webCallout ? (
            <div className="update-page__release-callout update-page__release-callout--info">{webCallout}</div>
          ) : null}

          <details className="update-page__release-fold update-page__release-notes">
            <UpdateFoldSummary>{webReleaseNotesSummary}</UpdateFoldSummary>
            {(web?.release_notes || "").trim() ? (
              <div
                className="update-page__release-notes-body update-page__release-notes-body--md"
                dangerouslySetInnerHTML={{ __html: webReleaseNotesHtml }}
              />
            ) : (
              <p className="update-page__release-notes-empty muted">
                GitHub 未提供发行说明正文，请查看{" "}
                <a
                  className="update-page__link"
                  href={(web?.release_url || "").trim() || WEBUI_RELEASES_PAGE}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Release 页面
                </a>
                。
              </p>
            )}
          </details>

          <details className="update-page__release-fold update-page__doc-links">
            <UpdateFoldSummary>相关文档</UpdateFoldSummary>
            <ul className="update-page__doc-links-list">
              {webDocLinks.map((link) => (
                <li key={link.href}>
                  <a className="update-page__link" href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </details>

          <p className="update-page__release-foot muted">
            由 Bot 从 GitHub 下载 <code>dist.zip</code> 并解压到控制台静态目录。
          </p>
        </CardContent>
      </Card>

      <Card id="console-update-bot" className={UPDATE_PANEL}>
        <CardHeader className={UPDATE_PANEL_HD}>
          <CardTitle className="panel__title flex flex-wrap items-center gap-1.5">
            Bot 本体
            <RefreshIconButton
              embedded
              showLabel={false}
              busy={q.isFetching}
              disabled={busy}
              label="刷新 Bot 更新检查"
              onClick={() => void q.refetch()}
            />
            {bot?.has_update ? (
              <Badge className={UPDATE_STATUS_PILL} variant="warn">
                有更新
              </Badge>
            ) : bot?.development_build ? (
              <Badge
                className={UPDATE_STATUS_PILL}
                variant="secondary"
                title="当前 commit 超前于 GitHub 最新发行版，无需执行「应用 Bot 更新」"
              >
                开发构建
              </Badge>
            ) : (
              <Badge className={UPDATE_STATUS_PILL} variant="success">
                已是最新
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className={UPDATE_PANEL_BD}>
          <div className="update-page__release-summary">
            <div className="update-page__release-stat">
              <span className="update-page__release-stat-label">当前</span>
              <span className="update-page__release-stat-value">{botCurrentDisplay}</span>
              {bot?.current_commit ? (
                <span className="update-page__release-stat-sub muted">{bot.current_commit.slice(0, 7)}</span>
              ) : null}
            </div>
            <span className="update-page__release-stat-arrow muted" aria-hidden="true">
              →
            </span>
            <div className="update-page__release-stat">
              <span className="update-page__release-stat-label">远端</span>
              <span className="update-page__release-stat-value">{bot?.latest_tag ?? "—"}</span>
            </div>
          </div>

          {botMetaParts.length ? (
            <p className="update-page__release-meta muted">{botMetaParts.join(" · ")}</p>
          ) : null}

          <div className="update-page__release-primary">
            {bot?.deployment_mode !== "docker" ? (
              <Button type="button" disabled={botApplyDisabled} onClick={() => void applyBot(false)}>
                应用 Bot 更新
              </Button>
            ) : null}
            {bot?.deployment_mode !== "docker" && bot?.restart_available ? (
              <Button type="button" variant="outline" disabled={botApplyDisabled} onClick={() => void applyBot(true)}>
                更新并重启
              </Button>
            ) : null}
            <a
              className="update-page__link update-page__release-ext-link"
              href={(bot?.release_url || "").trim() || BOT_RELEASES_PAGE}
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub Release
            </a>
          </div>

          {bot?.error ? (
            <p className="alert alert--err update-page__release-inline-alert">{bot.error}</p>
          ) : botCallout ? (
            <div
              className={cn(
                "update-page__release-callout",
                botCallout.kind === "warn" ? "alert alert--warn" : "update-page__release-callout--info",
              )}
            >
              {botCallout.text}
            </div>
          ) : null}

          {bot?.deployment_mode === "docker" ? (
            <section className="update-page__release-section update-page__docker-hint">
              <h3 className="update-page__release-section-title">Docker 更新步骤</h3>
              <ol className="update-page__docker-steps">
                <li>
                  <code>docker compose pull pallasbot</code>
                </li>
                <li>
                  <code>docker compose up -d pallasbot</code>（未换镜像时加 <code>--force-recreate</code>）
                </li>
                <li>
                  未用 <code>:latest</code> 时，先把 compose 里 image tag 改为目标版本
                </li>
              </ol>
              <p className="muted update-page__docker-foot">
                数据与配置通常在卷中（<code>data/</code>、<code>config/pallas.toml</code>、<code>local/plugins/</code>）。
              </p>
            </section>
          ) : null}

          <details className="update-page__release-fold update-page__release-notes">
            <UpdateFoldSummary>{botReleaseNotesSummary}</UpdateFoldSummary>
            {(bot?.release_notes || "").trim() ? (
              <div
                className="update-page__release-notes-body update-page__release-notes-body--md"
                dangerouslySetInnerHTML={{ __html: botReleaseNotesHtml }}
              />
            ) : (
              <p className="update-page__release-notes-empty muted">
                GitHub 未提供发行说明正文，请查看{" "}
                <a
                  className="update-page__link"
                  href={(bot?.release_url || "").trim() || BOT_RELEASES_PAGE}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Release 页面
                </a>
                。
              </p>
            )}
          </details>

          <details className="update-page__release-fold update-page__doc-links">
            <UpdateFoldSummary>相关文档</UpdateFoldSummary>
            <ul className="update-page__doc-links-list">
              {botDocLinks.map((link) => (
                <li key={link.href}>
                  <a className="update-page__link" href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </details>

          {bot?.deployment_mode !== "docker" ? (
            <p className="update-page__release-foot muted">
              配置与数据请放在 <code>config/pallas.toml</code>、<code>data/</code>，避免改主仓 <code>src/</code>。
            </p>
          ) : null}
        </CardContent>
      </Card>

      {restartAvailable ? (
        <Card id="console-update-restart" className={cn(UPDATE_PANEL, "update-page__panel--ops")}>
          <CardHeader className={cn(UPDATE_PANEL_HD, "update-page__ops-hd")}>
            <CardTitle className="panel__title">运维</CardTitle>
          </CardHeader>
          <CardContent className={UPDATE_OPS_BD}>
            <p className="muted update-page__ops-lead">
              安装/更新插件或修改需重启生效的配置后，可在此触发 Bot 进程重启。与「更新并重启」不同，此处不会拉取新代码。
              {shardedRuntime ? "分片部署下可选择仅重启分片节点或重启全部进程。" : null}
            </p>
            {restartInProgress || restartMsg ? (
              <p className="muted update-page__ops-lead" role="status">
                {restartProgressLabel || restartMsg}
              </p>
            ) : null}
            {restartErr ? (
              <p className="alert alert--err update-page__ops-lead" role="alert">
                {restartErr}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-1.5 update-page__ops-actions">
              {shardedRuntime ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={restartBusy || restartInProgress}
                  onClick={() => void triggerBotRestart(true)}
                >
                  重启 Worker
                </Button>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={restartBusy || restartInProgress}
                onClick={() => void triggerBotRestart(false)}
              >
                {restartInProgress ? "重启中…" : shardedRuntime ? "重启全部进程" : "重启 Bot"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <details id="console-update-github" className="update-page__gh-fold">
        <summary className="update-page__gh-fold-summary">
          GitHub 令牌
          <span className="muted"> · {ghTokenHadValue ? "已配置" : "未配置"}</span>
        </summary>
        <div className="update-page__gh-fold-body muted update-page__bd">
          <p>
            可选。用于 Release 检查与下载、协议端在线拉包等。也可在{" "}
            <Link to={`/plugins/${PB_PROTOCOL_PLUGIN}`}>插件配置 → 协议端</Link> 填写{" "}
            <code>PALLAS_PROTOCOL_GITHUB_TOKEN</code>。
          </p>
          <div className="update-page__gh-row">
            <UiInput
              className="update-page__gh-inp"
              type="password"
              revealable
              autoComplete="off"
              placeholder="粘贴 fine-grained 或 classic PAT"
              disabled={ghTokenBusy}
              value={ghTokenInput}
              onValueChange={setGhTokenInput}
            />
            <Button type="button" size="sm" disabled={ghTokenBusy} onClick={() => void saveGithubToken()}>
              {ghTokenBusy ? "保存中…" : "保存"}
            </Button>
            {ghTokenHadValue ? (
              <Button type="button" variant="outline" size="sm" disabled={ghTokenBusy} onClick={() => void clearGithubToken()}>
                清除
              </Button>
            ) : null}
          </div>
          {ghTokenErr ? <div className="alert alert--err update-page__gh-alert">{ghTokenErr}</div> : null}
          {ghTokenOk ? <div className="alert alert--ok update-page__gh-alert">{ghTokenOk}</div> : null}
        </div>
      </details>

      <GitMirrorDialog open={gitMirrorOpen} onClose={() => setGitMirrorOpen(false)} />
    </div>
  );
}
