import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchPluginConfig,
  putPluginConfig,
} from "@/api/console";
import {
  fetchUpdateCheckAll,
  postBotUpdateApply,
  postSystemRestart,
  postUpdateApply,
} from "@/api/fullConsole";
import { releaseNotesToSafeHtml } from "@pallas-vue/utils/releaseNotesHtml";
import { pallasBotVersionLabel, updateCheckCurrentTagLabel } from "@pallas-vue/utils/versionDisplay";
import GitMirrorDialog from "@/components/GitMirrorDialog";
import PageHeader from "@/components/PageHeader";
import RefreshIconButton from "@/components/RefreshIconButton";
import { cn } from "@/lib/utils";
import { pushConsoleToast } from "@/utils/consoleToast";

const PB_PROTOCOL_PLUGIN = "pb_protocol";
const GITHUB_TOKEN_FIELD = "pallas_protocol_github_token";

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

export default function UpdatePage() {
  const qc = useQueryClient();
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

  const webCurrentDisplay = updateCheckCurrentTagLabel(web?.current_tag);
  const botCurrentDisplay = pallasBotVersionLabel(undefined, bot);
  const webReleaseNotesHtml = useMemo(() => releaseNotesToSafeHtml(web?.release_notes), [web?.release_notes]);
  const botReleaseNotesHtml = useMemo(() => releaseNotesToSafeHtml(bot?.release_notes), [bot?.release_notes]);

  const webCallout = web?.has_update ? "更新完成后页面会自动刷新。" : null;
  const botCallout = useMemo(() => {
    if (!bot) return null;
    if (bot.deployment_mode === "docker") return "控制台不能 git 拉代码；请按文档拉新镜像并重启容器。";
    if (bot.deployment_mode === "release_tag_dirty") {
      return `更新前会自动 stash ${bot.dirty_file_count ?? 0} 项本地改动；冲突时需 git stash pop。`;
    }
    if (bot.deployment_mode === "dev_clone") return "更新时执行 git pull --ff-only --autostash。";
    return null;
  }, [bot]);

  const updateMastheadLead = useMemo(() => {
    const parts: string[] = [];
    if (web) parts.push(`WebUI ${webCurrentDisplay}${web.has_update ? " · 有更新" : ""}`);
    if (bot) parts.push(`Bot ${botCurrentDisplay}${bot.has_update ? " · 有更新" : ""}`);
    return parts.length ? parts.join(" · ") : "检查 WebUI 与 Bot 版本并应用更新。";
  }, [bot, botCurrentDisplay, web, webCurrentDisplay]);

  useEffect(() => {
    void loadGithubTokenHint();
  }, []);

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

  async function run(action: "web-apply" | "bot-apply" | "restart") {
    if (busy) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      if (action === "web-apply") {
        if (!window.confirm(`将 WebUI 更新到 ${web?.latest_tag || "最新"}？`)) return;
        const r = await postUpdateApply();
        setMsg(r.message || "WebUI 更新已应用，页面将刷新");
        window.setTimeout(() => window.location.reload(), 1500);
      } else if (action === "bot-apply") {
        if (!window.confirm(`将 Bot 更新到 ${bot?.latest_tag || "最新"}？`)) return;
        const r = await postBotUpdateApply({ restart: true });
        setMsg(r.message || "Bot 更新已应用");
      } else {
        const r = await postSystemRestart();
        setMsg(r.message || "已请求重启");
      }
      await qc.invalidateQueries({ queryKey: ["update-check-all"] });
    } catch (e) {
      setErr(axiosErrorDetail(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="update-page console-hub-page">
      <PageHeader
        title="更新"
        description={updateMastheadLead}
        actions={
          <div className="console-hub-toolbar-strip__masthead-actions row-actions">
            <button type="button" className="btn" onClick={() => setGitMirrorOpen(true)}>
              镜像源
            </button>
            <RefreshIconButton embedded={false} busy={q.isFetching || busy} label="检查更新" showLabel onClick={() => void q.refetch()} />
          </div>
        }
      />

      {msg ? <p className="alert alert--ok mb-3">{msg}</p> : null}
      {err ? <p className="alert alert--err mb-3">{err}</p> : null}
      <p className="update-page__checked-at muted mb-4 text-sm">上次检查：{formatCheckedAt(q.data?.checked_at)}</p>

      <div className="update-page__overview mb-4 grid gap-4 lg:grid-cols-2">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <div id="console-update-webui">
          <section className="panel update-page__panel">
            <div className="panel__hd panel__hd--split">
              <h2 className="panel__title">
                WebUI
                {web?.has_update ? <span className="badge badge--warn">有更新</span> : <span className="badge badge--ok">已是最新</span>}
              </h2>
            </div>
            <div className="panel__bd space-y-2 text-sm">
              {webCallout ? <p className="alert alert--info">{webCallout}</p> : null}
              <Row k="当前" v={webCurrentDisplay} />
              <Row k="最新" v={web?.latest_tag || "—"} />
              <Row
                k="发布页"
                v={
                  web?.release_url ? (
                    <a className="community-page__inline-link" href={web.release_url} target="_blank" rel="noreferrer">
                      打开 Release
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              {web?.error ? <p className="alert alert--err">{web.error}</p> : null}
              {webReleaseNotesHtml ? (
                <details className="update-page__release-notes">
                  <summary className="update-page__release-notes-summary">发行说明</summary>
                  <div className="update-page__release-notes-body readme-markdown" dangerouslySetInnerHTML={{ __html: webReleaseNotesHtml }} />
                </details>
              ) : null}
              <button type="button" className="btn btn--primary mt-2" disabled={busy || !web?.has_update} onClick={() => void run("web-apply")}>
                应用 WebUI 更新
              </button>
            </div>
          </section>
        </div>

        <div id="console-update-bot">
          <section className="panel update-page__panel">
            <div className="panel__hd panel__hd--split">
              <h2 className="panel__title">
                Bot
                {bot?.has_update ? <span className="badge badge--warn">有更新</span> : <span className="badge badge--ok">已是最新</span>}
              </h2>
            </div>
            <div className="panel__bd space-y-2 text-sm">
              <p className="muted">{botDeployLabel(bot?.deployment_mode)}</p>
              {botCallout ? <p className="alert alert--warn">{botCallout}</p> : null}
              <Row k="当前" v={botCurrentDisplay} />
              <Row k="最新" v={bot?.latest_tag || "—"} />
              <Row k="分支" v={bot?.current_branch || "—"} />
              {bot?.error ? <p className="alert alert--err">{bot.error}</p> : null}
              {botReleaseNotesHtml ? (
                <details className="update-page__release-notes">
                  <summary className="update-page__release-notes-summary">发行说明</summary>
                  <div className="update-page__release-notes-body readme-markdown" dangerouslySetInnerHTML={{ __html: botReleaseNotesHtml }} />
                </details>
              ) : null}
              <div className="row-actions flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={busy || !bot?.has_update || bot?.deployment_mode === "docker"}
                  onClick={() => void run("bot-apply")}
                >
                  应用 Bot 更新
                </button>
                <button type="button" className="btn" disabled={busy} onClick={() => void run("restart")}>
                  重启 Bot
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <details id="console-update-github" className="update-page__gh-fold">
        <summary className="update-page__gh-fold-summary">
          GitHub 令牌
          <span className="muted"> · {ghTokenHadValue ? "已配置" : "未配置"}</span>
        </summary>
        <div className="update-page__gh-fold-body muted update-page__bd">
          <p>
            可选。用于 Release 检查与下载、协议端在线拉包等。也可在{" "}
            <Link to={`/plugins/${PB_PROTOCOL_PLUGIN}`}>插件配置 → 协议端</Link>
            {" "}填写 <code>PALLAS_PROTOCOL_GITHUB_TOKEN</code>。
          </p>
          <div className="update-page__gh-row">
            <input
              className="inp update-page__gh-inp"
              type="password"
              autoComplete="off"
              placeholder="粘贴 fine-grained 或 classic PAT"
              disabled={ghTokenBusy}
              value={ghTokenInput}
              onChange={(e) => setGhTokenInput(e.target.value)}
            />
            <button type="button" className="btn btn--primary" disabled={ghTokenBusy} onClick={() => void saveGithubToken()}>
              {ghTokenBusy ? "保存中…" : "保存"}
            </button>
            {ghTokenHadValue ? (
              <button type="button" className="btn" disabled={ghTokenBusy} onClick={() => void clearGithubToken()}>
                清除
              </button>
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

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="home-dl update-page__meta-row">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
