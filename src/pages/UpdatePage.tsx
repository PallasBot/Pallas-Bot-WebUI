import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import { fetchPluginConfig, putPluginConfig } from "@/api/console";
import {
  fetchUpdateChangelog,
  fetchUpdateCheckAll,
  openUpdateApplyJobEventSource,
  postBotUpdateApply,
  postUpdateApply,
  type UpdateChangelogTarget,
} from "@/api/fullConsole";
import { releaseNotesToSafeHtml } from "@/utils/releaseNotesHtml";
import { waitForUpdateApplyJob } from "@/utils/updateApplyJobStream";
import { InstallJobFailedError } from "@/utils/installJobStream";
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
import ReadmeMarkdown from "@/components/ReadmeMarkdown";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import UiInput from "@/components/ui/UiInput";
import { cn } from "@/lib/utils";
import { pushConsoleToast } from "@/utils/consoleToast";
import { readPrefs, writePrefs } from "@/theme/applyShellTheme";
import { ChevronRight, RefreshCw, LayoutDashboard, Bot } from "lucide-react";

const PB_PROTOCOL_PLUGIN = "pb_protocol";
const GITHUB_TOKEN_FIELD = "pallas_protocol_github_token";
const WEBUI_RELEASES_PAGE = PALLAS_WEBUI_RELEASES;
const BOT_RELEASES_PAGE = PALLAS_BOT_RELEASES;
const PENDING_CHANGELOG_KEY = "pallas.webui.pendingUpdateChangelog";

const UPDATE_PANEL = "update-page__panel flex flex-col overflow-hidden shadow-none";
const UPDATE_PANEL_HD =
  "panel__hd panel__hd--split update-page__panel-hd-nowrap flex-row items-center justify-between space-y-0 border-b px-4 py-3";
const UPDATE_PANEL_BD = "panel__bd update-page__bd update-page__bd--release space-y-0 px-4 pb-4 pt-3";
const UPDATE_STATUS_PILL = "update-page__status-pill";

type ApplyKind = "web" | "bot";

type PendingChangelog = {
  kind: ApplyKind;
  tag: string;
};

type ChangelogView = {
  kind: ApplyKind;
  tag: string;
  markdown: string;
  changelogUrl: string;
  loading: boolean;
  error: string;
};

function readPendingChangelog(): PendingChangelog | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CHANGELOG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingChangelog;
    if (!parsed?.tag || (parsed.kind !== "web" && parsed.kind !== "bot")) return null;
    return { kind: parsed.kind, tag: String(parsed.tag) };
  } catch {
    return null;
  }
}

function writePendingChangelog(draft: PendingChangelog) {
  try {
    sessionStorage.setItem(PENDING_CHANGELOG_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

function clearPendingChangelog() {
  try {
    sessionStorage.removeItem(PENDING_CHANGELOG_KEY);
  } catch {
    /* ignore */
  }
}

function applyKindToTarget(kind: ApplyKind): UpdateChangelogTarget {
  return kind === "bot" ? "bot" : "webui";
}

function UpdateFoldSummary({ children }: { children: ReactNode }) {
  return (
    <summary className="update-page__release-fold-summary">
      <ChevronRight className="update-page__release-fold-chevron" aria-hidden strokeWidth={2} />
      <span className="min-w-0">{children}</span>
    </summary>
  );
}

function UpdateReleaseNotesTrigger({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="update-page__release-notes-trigger" onClick={onClick}>
      <ChevronRight className="update-page__release-fold-chevron" aria-hidden strokeWidth={2} />
      <span className="min-w-0">{label}</span>
    </button>
  );
}

function UpdateApplyProgress({
  label,
  percent,
}: {
  label: string;
  percent: number;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="update-page__apply-progress" role="status" aria-live="polite">
      <div className="update-page__apply-progress-head">
        <span className="update-page__apply-progress-label">{label}</span>
        <span className="update-page__apply-progress-pct muted">{pct}%</span>
      </div>
      <div
        className="update-page__apply-progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={label}
      >
        <span
          className={`update-page__apply-progress-fill${pct >= 100 ? " update-page__apply-progress-fill--done" : ""}`}
          style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
        />
      </div>
    </div>
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
  const [applyKind, setApplyKind] = useState<ApplyKind | null>(null);
  const [applyPercent, setApplyPercent] = useState(0);
  const [applyHint, setApplyHint] = useState("");
  const busy = applyKind != null;
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [gitMirrorOpen, setGitMirrorOpen] = useState(false);
  const [ghTokenInput, setGhTokenInput] = useState("");
  const [ghTokenHadValue, setGhTokenHadValue] = useState(false);
  const [ghTokenBusy, setGhTokenBusy] = useState(false);
  const [ghTokenErr, setGhTokenErr] = useState("");
  const [changelog, setChangelog] = useState<ChangelogView | null>(null);
  const [showChangelogAfterUpdate, setShowChangelogAfterUpdate] = useState(
    () => readPrefs().showUpdateChangelog,
  );

  const q = useQuery({ queryKey: ["update-check-all"], queryFn: fetchUpdateCheckAll });
  const web = q.data?.webui;
  const bot = q.data?.bot;

  const webCurrentDisplay = updateCheckCurrentTagLabel(web?.current_tag);
  const botCurrentDisplay = pallasBotVersionLabel(undefined, bot);
  const webReleaseNotesHtml = useMemo(() => releaseNotesToSafeHtml(web?.release_notes), [web?.release_notes]);
  const botReleaseNotesHtml = useMemo(() => releaseNotesToSafeHtml(bot?.release_notes), [bot?.release_notes]);
  const changelogNotesHtml = useMemo(
    () => releaseNotesToSafeHtml(changelog?.markdown),
    [changelog?.markdown],
  );
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
    if (!web && !bot) return "WebUI 与 Bot 版本更新。";
    const n = (web?.has_update ? 1 : 0) + (bot?.has_update ? 1 : 0);
    if (n > 0) return `有 ${n} 项可更新`;
    return "均已是最新";
  }, [bot, web]);

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
    const raw = (location.hash || "").replace(/^#/, "").trim();
    if (!raw || q.isLoading) return;
    requestAnimationFrame(() => {
      document.getElementById(raw)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [location.hash, q.isLoading, q.dataUpdatedAt]);

  async function openChangelogDialog(kind: ApplyKind, tag: string) {
    setChangelog({
      kind,
      tag,
      markdown: "",
      changelogUrl: "",
      loading: true,
      error: "",
    });
    try {
      const data = await fetchUpdateChangelog(applyKindToTarget(kind));
      setChangelog({
        kind,
        tag,
        markdown: data.markdown || "",
        changelogUrl: (data.changelog_url || "").trim(),
        loading: false,
        error: "",
      });
    } catch (e) {
      setChangelog({
        kind,
        tag,
        markdown: "",
        changelogUrl: "",
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  useEffect(() => {
    const pending = readPendingChangelog();
    if (!pending) return;
    clearPendingChangelog();
    if (!readPrefs().showUpdateChangelog) return;
    void openChangelogDialog(pending.kind, pending.tag);
  }, []);

  function queueChangelogAfterUpdate(kind: ApplyKind, tag: string) {
    if (!readPrefs().showUpdateChangelog) return;
    writePendingChangelog({ kind, tag });
  }

  async function loadGithubTokenHint() {
    setGhTokenErr("");
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
    try {
      await putPluginConfig(PB_PROTOCOL_PLUGIN, { [GITHUB_TOKEN_FIELD]: next });
      setGhTokenHadValue(true);
      setGhTokenInput("");
      pushConsoleToast("GitHub 令牌已保存；若未立即生效可重启 Bot", "ok");
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
    try {
      await putPluginConfig(PB_PROTOCOL_PLUGIN, { [GITHUB_TOKEN_FIELD]: "" });
      setGhTokenHadValue(false);
      setGhTokenInput("");
      pushConsoleToast("GitHub 令牌已清除；重启 Bot 后生效", "ok");
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
    setApplyKind("web");
    setApplyPercent(1);
    setApplyHint("排队中…");
    setErr("");
    setMsg("");
    try {
      const started = await postUpdateApply();
      if (!started.job_id) throw new Error("未返回更新任务 ID");
      const done = await waitForUpdateApplyJob(started.job_id, openUpdateApplyJobEventSource, (p) => {
        setApplyPercent(p.percent);
        if (p.message) setApplyHint(p.message);
      });
      setApplyPercent(100);
      const resultMsg = done.result?.message || done.message || "更新成功";
      queueChangelogAfterUpdate("web", web.latest_tag);
      setMsg(`${resultMsg} · 正在刷新页面以载入新版本…`);
      window.setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      const detail =
        e instanceof InstallJobFailedError
          ? e.message
          : e instanceof Error
            ? e.message
            : axiosErrorDetail(e);
      setErr(detail);
      setApplyKind(null);
      setApplyPercent(0);
      setApplyHint("");
    }
  }

  async function applyBot(restart = false) {
    if (!bot?.latest_tag) return;
    const prompt = restart
      ? `将 Bot 更新到 ${bot.latest_tag} 并重启进程？`
      : `将 Bot 更新到 ${bot.latest_tag}？`;
    if (!window.confirm(prompt)) return;
    setApplyKind("bot");
    setApplyPercent(1);
    setApplyHint("排队中…");
    setErr("");
    setMsg("");
    try {
      const started = await postBotUpdateApply({ restart });
      if (!started.job_id) throw new Error("未返回更新任务 ID");
      const done = await waitForUpdateApplyJob(started.job_id, openUpdateApplyJobEventSource, (p) => {
        setApplyPercent(p.percent);
        if (p.message) setApplyHint(p.message);
      });
      setApplyPercent(100);
      setMsg(done.result?.message || done.message || (restart ? "已触发更新与重启。" : "已触发。"));
      if (readPrefs().showUpdateChangelog) {
        if (restart) writePendingChangelog({ kind: "bot", tag: bot.latest_tag });
        else void openChangelogDialog("bot", bot.latest_tag);
      }
      if (!restart) await qc.invalidateQueries({ queryKey: ["update-check-all"] });
      setApplyKind(null);
      setApplyPercent(0);
      setApplyHint("");
    } catch (e) {
      const detail =
        e instanceof InstallJobFailedError
          ? e.message
          : e instanceof Error
            ? e.message
            : axiosErrorDetail(e);
      setErr(detail);
      setApplyKind(null);
      setApplyPercent(0);
      setApplyHint("");
    }
  }

  function openWebChangelog() {
    void openChangelogDialog(
      "web",
      (web?.latest_tag || web?.current_tag || webCurrentDisplay || "—").trim() || "—",
    );
  }

  function openBotChangelog() {
    void openChangelogDialog(
      "bot",
      (bot?.latest_tag || bot?.current_tag || botCurrentDisplay || "—").trim() || "—",
    );
  }

  function setShowChangelogPref(next: boolean) {
    writePrefs({ showUpdateChangelog: next });
    setShowChangelogAfterUpdate(next);
  }

  const webReleaseHref = (web?.release_url || "").trim() || WEBUI_RELEASES_PAGE;
  const botReleaseHref = (bot?.release_url || "").trim() || BOT_RELEASES_PAGE;

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
          <div className="flex flex-nowrap items-center gap-1.5">
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

      <div className="update-page__panels">
        <Card id="console-update-webui" className={UPDATE_PANEL}>
          <CardHeader className={UPDATE_PANEL_HD}>
            <CardTitle className="panel__title flex min-w-0 flex-wrap items-center gap-1.5">
              <PanelTitleIcon icon={LayoutDashboard} />
              WebUI
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
            <div className="update-page__panel-hd-actions">
              <Button asChild type="button" variant="secondary" size="sm">
                <a href={webReleaseHref} target="_blank" rel="noopener noreferrer">
                  GitHub Release
                </a>
              </Button>
            </div>
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

            {(web?.has_update || applyKind === "web") ? (
              <div className="update-page__release-actions">
                <div className="update-page__release-primary">
                  {web?.has_update ? (
                    <Button type="button" disabled={webApplyDisabled} onClick={() => void applyWeb()}>
                      {applyKind === "web" ? "处理中…" : "应用 WebUI 更新"}
                    </Button>
                  ) : null}
                </div>
                {applyKind === "web" ? (
                  <UpdateApplyProgress label={applyHint || "正在下载并应用 WebUI 更新…"} percent={applyPercent} />
                ) : null}
              </div>
            ) : null}

            {web?.error ? (
              <p className="alert alert--err update-page__release-inline-alert">{web.error}</p>
            ) : webCallout ? (
              <div className="update-page__release-callout update-page__release-callout--info">{webCallout}</div>
            ) : null}

            <details className="update-page__release-fold update-page__release-notes">
              <UpdateFoldSummary>{webReleaseNotesSummary}</UpdateFoldSummary>
              {(web?.release_notes || "").trim() ? (
                <ReadmeMarkdown
                  html={webReleaseNotesHtml}
                  className="update-page__release-notes-body update-page__release-notes-body--md"
                />
              ) : (
                <p className="update-page__release-notes-empty muted">
                  GitHub 未提供发行说明正文，请查看{" "}
                  <a className="update-page__link" href={webReleaseHref} target="_blank" rel="noopener noreferrer">
                    Release 页面
                  </a>
                  。
                </p>
              )}
            </details>

            <UpdateReleaseNotesTrigger label="CHANGELOG" onClick={openWebChangelog} />

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

            {web?.has_update ? (
              <p className="update-page__release-foot muted">
                由 Bot 从 GitHub 下载 <code>dist.zip</code> 并解压到控制台静态目录。
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card id="console-update-bot" className={UPDATE_PANEL}>
          <CardHeader className={UPDATE_PANEL_HD}>
            <div className="update-page__panel-hd-main min-w-0">
              <CardTitle className="panel__title flex min-w-0 flex-wrap items-center gap-1.5">
                <PanelTitleIcon icon={Bot} />
                Bot 本体
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
              {botMetaParts.length ? (
                <p className="update-page__panel-hd-meta muted">{botMetaParts.join(" · ")}</p>
              ) : null}
            </div>
            <div className="update-page__panel-hd-actions">
              <Button asChild type="button" variant="secondary" size="sm">
                <a href={botReleaseHref} target="_blank" rel="noopener noreferrer">
                  GitHub Release
                </a>
              </Button>
            </div>
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

            {(bot?.has_update && bot?.deployment_mode !== "docker") || applyKind === "bot" ? (
              <div className="update-page__release-actions">
                <div className="update-page__release-primary">
                  {bot?.has_update && bot?.deployment_mode !== "docker" ? (
                    <Button type="button" disabled={botApplyDisabled} onClick={() => void applyBot(false)}>
                      {applyKind === "bot" ? "处理中…" : "应用 Bot 更新"}
                    </Button>
                  ) : null}
                  {bot?.has_update && bot?.deployment_mode !== "docker" && bot?.restart_available ? (
                    <Button type="button" variant="outline" disabled={botApplyDisabled} onClick={() => void applyBot(true)}>
                      更新并重启
                    </Button>
                  ) : null}
                </div>
                {applyKind === "bot" ? (
                  <UpdateApplyProgress label={applyHint || "正在拉取并应用 Bot 更新…"} percent={applyPercent} />
                ) : null}
              </div>
            ) : null}

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
                <ReadmeMarkdown
                  html={botReleaseNotesHtml}
                  className="update-page__release-notes-body update-page__release-notes-body--md"
                />
              ) : (
                <p className="update-page__release-notes-empty muted">
                  GitHub 未提供发行说明正文，请查看{" "}
                  <a className="update-page__link" href={botReleaseHref} target="_blank" rel="noopener noreferrer">
                    Release 页面
                  </a>
                  。
                </p>
              )}
            </details>

            <UpdateReleaseNotesTrigger label="CHANGELOG" onClick={openBotChangelog} />

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

            {bot?.has_update && bot?.deployment_mode !== "docker" ? (
              <p className="update-page__release-foot muted">
                配置与数据请放在 <code>config/pallas.toml</code>、<code>data/</code>，避免改主仓 <code>src/</code>。
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

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
        </div>
      </details>

      <Dialog
        open={changelog != null}
        onOpenChange={(open) => {
          if (!open) setChangelog(null);
        }}
      >
        <DialogContent className="update-page__changelog-dialog gap-0 overflow-hidden bg-card p-0">
          <DialogHeader className="border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3">
            <DialogTitle>
              {changelog?.kind === "bot" ? "Bot" : "WebUI"} CHANGELOG
              {changelog?.tag ? ` · ${changelog.tag}` : ""}
            </DialogTitle>
            <DialogDescription>仓库 CHANGELOG.md，与发行说明分开。</DialogDescription>
          </DialogHeader>
          <div className="update-page__changelog-body min-h-0 flex-1 overflow-auto px-4 py-3">
            {changelog?.loading ? (
              <p className="muted" role="status">
                正在拉取 CHANGELOG…
              </p>
            ) : changelog?.error ? (
              <p className="alert alert--err">{changelog.error}</p>
            ) : (changelog?.markdown || "").trim() ? (
              <ReadmeMarkdown
                html={changelogNotesHtml}
                className="update-page__release-notes-body update-page__release-notes-body--md"
              />
            ) : (
              <p className="muted">
                暂无 CHANGELOG 正文
                {changelog?.changelogUrl ? (
                  <>
                    ，可查看{" "}
                    <a
                      className="update-page__link"
                      href={changelog.changelogUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      CHANGELOG.md
                    </a>
                  </>
                ) : null}
                。
              </p>
            )}
          </div>
          <DialogFooter className="update-page__changelog-footer border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 sm:items-center">
            <label className="update-page__changelog-pref mr-auto flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={!showChangelogAfterUpdate}
                onCheckedChange={(v) => setShowChangelogPref(v !== true)}
              />
              <span>关闭后不再自动弹出</span>
            </label>
            {changelog?.changelogUrl ? (
              <a
                className="update-page__link self-center"
                href={changelog.changelogUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                完整 CHANGELOG
              </a>
            ) : null}
            <Button type="button" onClick={() => setChangelog(null)}>
              知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GitMirrorDialog open={gitMirrorOpen} onClose={() => setGitMirrorOpen(false)} />
    </div>
  );
}
