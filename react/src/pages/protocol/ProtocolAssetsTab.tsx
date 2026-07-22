import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  protocolApiErrorMessage,
  protocolCleanupRuntimeDist,
  protocolDownloadRuntime,
  protocolDownloadSnowlumaRuntime,
  protocolFetchRuntimeOverview,
  protocolFetchRuntimeProfile,
  protocolListDockerImages,
  protocolPullDockerImage,
  protocolUpdateRuntimeProfile,
  type ProtocolRuntimeJob,
  type ProtocolRuntimeProfile,
} from "@/api/protocol";
import UiInput from "@/components/ui/UiInput";
import type { ProtocolOutletContext } from "@/pages/ProtocolPage";

const RUNTIME_MODES = [
  { value: "docker", label: "Docker" },
  { value: "appimage", label: "AppImage" },
  { value: "shell", label: "Shell" },
];

const TARGET_PLATFORMS = [
  { value: "auto", label: "auto（跟随当前平台）" },
  { value: "linux-amd64", label: "linux-amd64" },
  { value: "linux-arm64", label: "linux-arm64" },
  { value: "windows-amd64", label: "windows-amd64" },
];

function jobFromOverview(ov: Record<string, unknown> | null, key: string): ProtocolRuntimeJob | null {
  if (!ov || typeof ov[key] !== "object" || ov[key] === null) return null;
  return ov[key] as ProtocolRuntimeJob;
}

function jobStatusLabel(job: ProtocolRuntimeJob | null): string {
  if (!job?.status) return "空闲";
  const msg = job.message?.trim();
  return msg ? `${job.status}：${msg}` : String(job.status);
}

export default function ProtocolAssetsTab() {
  const { mountUrl, reload } = useOutletContext<ProtocolOutletContext>();
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [profileForm, setProfileForm] = useState<ProtocolRuntimeProfile>({});
  const [loadBusy, setLoadBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [napcatDownloadBusy, setNapcatDownloadBusy] = useState(false);
  const [snowlumaDownloadBusy, setSnowlumaDownloadBusy] = useState(false);
  const [napcatTag, setNapcatTag] = useState("");
  const [snowlumaTag, setSnowlumaTag] = useState("");
  const [napcatPullBusy, setNapcatPullBusy] = useState(false);
  const [snowlumaPullBusy, setSnowlumaPullBusy] = useState(false);
  const [napcatListBusy, setNapcatListBusy] = useState(false);
  const [snowlumaListBusy, setSnowlumaListBusy] = useState(false);
  const [napcatImages, setNapcatImages] = useState<string[]>([]);
  const [snowlumaImages, setSnowlumaImages] = useState<string[]>([]);
  const [dockerPullLog, setDockerPullLog] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const napcatJob = useMemo(() => jobFromOverview(overview, "job"), [overview]);
  const snowlumaJob = useMemo(() => {
    const sl = overview?.snowluma;
    if (sl && typeof sl === "object" && "job" in sl) {
      return (sl as { job?: ProtocolRuntimeJob }).job ?? null;
    }
    return null;
  }, [overview]);

  const showDockerSection = useMemo(() => {
    const p = profileForm;
    return p.napcat_runtime_mode === "docker" || p.snowluma_runtime_mode === "docker";
  }, [profileForm]);

  async function loadAssets() {
    if (!mountUrl) return;
    setLoadBusy(true);
    setMsg(null);
    try {
      const [ov, pf] = await Promise.all([
        protocolFetchRuntimeOverview(mountUrl),
        protocolFetchRuntimeProfile(mountUrl),
      ]);
      setOverview(ov);
      setProfileForm({ ...pf });
    } catch (e) {
      setMsg(protocolApiErrorMessage(e, "加载失败"));
    } finally {
      setLoadBusy(false);
    }
  }

  useEffect(() => {
    void (async () => {
      await reload();
      await loadAssets();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [mountUrl]);

  async function saveProfile() {
    if (!mountUrl) return;
    setSaveBusy(true);
    setMsg(null);
    try {
      const next = await protocolUpdateRuntimeProfile(mountUrl, profileForm);
      setProfileForm(next);
      setMsg("全局运行配置已保存");
      await loadAssets();
    } catch (e) {
      setMsg(protocolApiErrorMessage(e, "保存失败"));
    } finally {
      setSaveBusy(false);
    }
  }

  async function cleanupDist() {
    if (!mountUrl) return;
    setCleanupBusy(true);
    setMsg(null);
    try {
      await protocolCleanupRuntimeDist(mountUrl);
      setMsg("已清理下载缓存");
      await loadAssets();
    } catch (e) {
      setMsg(protocolApiErrorMessage(e, "清理失败"));
    } finally {
      setCleanupBusy(false);
    }
  }

  async function downloadNapcat() {
    if (!mountUrl) return;
    setNapcatDownloadBusy(true);
    setMsg(null);
    try {
      await protocolDownloadRuntime(mountUrl, {
        tag: napcatTag.trim() || undefined,
        target_platform: profileForm.target_platform || undefined,
      });
      setMsg("已触发 NapCat 运行时下载");
      await loadAssets();
    } catch (e) {
      setMsg(protocolApiErrorMessage(e, "下载失败"));
    } finally {
      setNapcatDownloadBusy(false);
    }
  }

  async function downloadSnowluma() {
    if (!mountUrl) return;
    setSnowlumaDownloadBusy(true);
    setMsg(null);
    try {
      await protocolDownloadSnowlumaRuntime(mountUrl, {
        tag: snowlumaTag.trim() || undefined,
      });
      setMsg("已触发 SnowLuma 运行时下载");
      await loadAssets();
    } catch (e) {
      setMsg(protocolApiErrorMessage(e, "下载失败"));
    } finally {
      setSnowlumaDownloadBusy(false);
    }
  }

  async function pullDocker(which: "napcat" | "snowluma") {
    if (!mountUrl) return;
    const image =
      which === "napcat"
        ? String(profileForm.docker_image ?? "").trim()
        : String(profileForm.snowluma_docker_image ?? "").trim();
    if (which === "napcat") setNapcatPullBusy(true);
    else setSnowlumaPullBusy(true);
    setMsg(null);
    try {
      const res = await protocolPullDockerImage(mountUrl, image || undefined);
      setDockerPullLog(res.output?.trim() || (res.ok ? "拉取完成" : "拉取失败"));
      setMsg(res.ok ? "Docker 镜像拉取完成" : "Docker 镜像拉取失败");
    } catch (e) {
      setMsg(protocolApiErrorMessage(e, "拉取失败"));
    } finally {
      if (which === "napcat") setNapcatPullBusy(false);
      else setSnowlumaPullBusy(false);
    }
  }

  async function listDocker(which: "napcat" | "snowluma") {
    if (!mountUrl) return;
    if (which === "napcat") setNapcatListBusy(true);
    else setSnowlumaListBusy(true);
    setMsg(null);
    try {
      const res = await protocolListDockerImages(mountUrl, which);
      const imgs = Array.isArray(res.images) ? res.images : [];
      if (which === "napcat") setNapcatImages(imgs);
      else setSnowlumaImages(imgs);
      if (!res.ok && res.detail) setMsg(res.detail);
    } catch (e) {
      setMsg(protocolApiErrorMessage(e, "查询镜像失败"));
    } finally {
      if (which === "napcat") setNapcatListBusy(false);
      else setSnowlumaListBusy(false);
    }
  }

  if (!mountUrl) {
    return <p className="alert alert--err">协议 API 未就绪</p>;
  }

  return (
    <div className="protocol-sub-page">
      <div className="panel protocol-sub-page__lead mb-4">
        <div className="panel__hd panel__hd--split inst-db-panel__hd">
          <div>
            <h2 className="panel__title">协议资产</h2>
            <p className="muted">
              管理 NapCat / SnowLuma 发行包、全局运行模式与 Docker 镜像；保存后可能影响已有协议容器。
            </p>
          </div>
          <div className="row-actions">
            <Link className="btn" to="/protocol">
              返回实例列表
            </Link>
            <button type="button" className="btn" disabled={loadBusy} onClick={() => void loadAssets()}>
              {loadBusy ? "刷新中…" : "刷新"}
            </button>
          </div>
        </div>
      </div>

      {msg ? <p className="muted text-sm mb-4">{msg}</p> : null}

      <div className="ui-card ui-card--glass protocol-sub-page__panel">
        <div className="ui-card__content">
          <div className="panel__hd">
            <h2 className="panel__title protocol-assets-section-title">全局运行配置</h2>
          </div>
          <div className="panel__bd">
            <div className="protocol-form-grid">
              <label className="field">
                <span className="field__label">NapCat 运行模式</span>
                <select
                  className="sel ui-select"
                  value={profileForm.napcat_runtime_mode ?? ""}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, napcat_runtime_mode: e.target.value }))
                  }
                >
                  {RUNTIME_MODES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">SnowLuma 运行模式</span>
                <select
                  className="sel ui-select"
                  value={profileForm.snowluma_runtime_mode ?? ""}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, snowluma_runtime_mode: e.target.value }))
                  }
                >
                  {RUNTIME_MODES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">下载目标平台（NapCat）</span>
                <select
                  className="sel ui-select"
                  value={profileForm.target_platform ?? ""}
                  onChange={(e) => setProfileForm((p) => ({ ...p, target_platform: e.target.value }))}
                >
                  {TARGET_PLATFORMS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field field--check">
                <input
                  type="checkbox"
                  checked={Boolean(profileForm.follow_bot_lifecycle)}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, follow_bot_lifecycle: e.target.checked }))
                  }
                />
                实例随 Bot 启停（全局）
              </label>
            </div>
            {showDockerSection ? (
              <div className="protocol-form-grid protocol-assets-docker-grid">
                <label className="field">
                  <span className="field__label">NapCat Docker 镜像</span>
                  <UiInput
                    placeholder="mlikiowa/napcat-docker:latest"
                    autoComplete="off"
                    value={profileForm.docker_image ?? ""}
                    onValueChange={(v) => setProfileForm((p) => ({ ...p, docker_image: v }))}
                  />
                </label>
                <label className="field">
                  <span className="field__label">SnowLuma Docker 镜像</span>
                  <UiInput
                    placeholder="motricseven7/snowluma:latest"
                    autoComplete="off"
                    value={profileForm.snowluma_docker_image ?? ""}
                    onValueChange={(v) =>
                      setProfileForm((p) => ({ ...p, snowluma_docker_image: v }))
                    }
                  />
                </label>
              </div>
            ) : null}
            <div className="row-actions protocol-assets-actions">
              <button
                type="button"
                className="btn"
                disabled={cleanupBusy || !mountUrl}
                onClick={() => void cleanupDist()}
              >
                {cleanupBusy ? "清理中…" : "清理下载缓存"}
              </button>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className="btn btn--primary"
                disabled={saveBusy || !mountUrl}
                onClick={() => void saveProfile()}
              >
                {saveBusy ? "保存中…" : "保存设置"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="ui-card ui-card--glass protocol-sub-page__panel mt-4">
        <div className="ui-card__content">
          <div className="panel__hd">
            <h2 className="panel__title protocol-assets-section-title">运行时下载</h2>
          </div>
          <div className="panel__bd">
            <div className="protocol-assets-runtime-block">
              <div className="protocol-assets-runtime-block__hd">
                <strong>NapCat</strong>
                <span className="muted protocol-assets-job">{jobStatusLabel(napcatJob)}</span>
              </div>
              <div className="row-actions protocol-assets-download">
                <UiInput
                  className="protocol-assets-download__tag"
                  placeholder="版本 tag（可选，默认 latest）"
                  value={napcatTag}
                  onValueChange={setNapcatTag}
                />
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!mountUrl || napcatDownloadBusy}
                  onClick={() => void downloadNapcat()}
                >
                  {napcatDownloadBusy ? "下载中…" : "下载 NapCat 运行时"}
                </button>
              </div>
            </div>
            <div className="protocol-assets-runtime-block">
              <div className="protocol-assets-runtime-block__hd">
                <strong>SnowLuma</strong>
                <span className="muted protocol-assets-job">{jobStatusLabel(snowlumaJob)}</span>
              </div>
              <div className="row-actions protocol-assets-download">
                <UiInput
                  className="protocol-assets-download__tag"
                  placeholder="版本 tag（可选，默认 latest）"
                  value={snowlumaTag}
                  onValueChange={setSnowlumaTag}
                />
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!mountUrl || snowlumaDownloadBusy}
                  onClick={() => void downloadSnowluma()}
                >
                  {snowlumaDownloadBusy ? "下载中…" : "下载 SnowLuma 运行时"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showDockerSection ? (
        <div className="ui-card ui-card--glass protocol-sub-page__panel mt-4">
          <div className="ui-card__content">
            <div className="panel__hd">
              <h2 className="panel__title protocol-assets-section-title">Docker 镜像</h2>
            </div>
            <div className="panel__bd">
              <p className="muted">
                需在宿主机或已挂载 docker.sock 的环境执行；Bot 容器内无 Docker CLI 时会提示在宿主机手动 pull。
              </p>
              <div className="protocol-assets-docker-row">
                <div className="row-actions protocol-assets-download">
                  <button
                    type="button"
                    className="btn"
                    disabled={!mountUrl || napcatPullBusy}
                    onClick={() => void pullDocker("napcat")}
                  >
                    {napcatPullBusy ? "拉取中…" : "拉取 NapCat 镜像"}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={!mountUrl || napcatListBusy}
                    onClick={() => void listDocker("napcat")}
                  >
                    {napcatListBusy ? "查询中…" : "查看 NapCat 本地镜像"}
                  </button>
                </div>
                {napcatImages.length ? (
                  <ul className="protocol-assets-image-list muted">
                    {napcatImages.map((img) => (
                      <li key={img}>{img}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="protocol-assets-docker-row">
                <div className="row-actions protocol-assets-download">
                  <button
                    type="button"
                    className="btn"
                    disabled={!mountUrl || snowlumaPullBusy}
                    onClick={() => void pullDocker("snowluma")}
                  >
                    {snowlumaPullBusy ? "拉取中…" : "拉取 SnowLuma 镜像"}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={!mountUrl || snowlumaListBusy}
                    onClick={() => void listDocker("snowluma")}
                  >
                    {snowlumaListBusy ? "查询中…" : "查看 SnowLuma 本地镜像"}
                  </button>
                </div>
                {snowlumaImages.length ? (
                  <ul className="protocol-assets-image-list muted">
                    {snowlumaImages.map((img) => (
                      <li key={img}>{img}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {dockerPullLog ? <pre className="protocol-assets-pre">{dockerPullLog}</pre> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
