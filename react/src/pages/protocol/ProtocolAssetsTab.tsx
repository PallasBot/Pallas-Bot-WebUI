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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
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

const ASSET_PANEL = "protocol-sub-page__panel flex flex-col overflow-hidden shadow-none";
const ASSET_PANEL_HD =
  "panel__hd flex-row items-start justify-between space-y-0 border-b px-4 py-3";
const ASSET_PANEL_BD = "panel__bd space-y-4 px-4 pb-4 pt-3";

function jobFromOverview(ov: Record<string, unknown> | null, key: string): ProtocolRuntimeJob | null {
  if (!ov || typeof ov[key] !== "object" || ov[key] === null) return null;
  return ov[key] as ProtocolRuntimeJob;
}

function jobStatusLabel(job: ProtocolRuntimeJob | null): string {
  if (!job?.status) return "空闲";
  const msg = job.message?.trim();
  return msg ? `${job.status}：${msg}` : String(job.status);
}

function ProfileSelect(props: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const { id, label, value, options, onChange } = props;
  return (
    <div className="field space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-9 w-full">
          <SelectValue placeholder="请选择" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
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
    <div className="protocol-sub-page space-y-4">
      <Card className={cn(ASSET_PANEL, "mb-0")}>
        <CardHeader className={cn(ASSET_PANEL_HD, "inst-db-panel__hd")}>
          <div>
            <CardTitle className="panel__title">协议资产</CardTitle>
            <CardDescription className="muted mt-1">发行包、运行模式与 Docker 镜像。</CardDescription>
          </div>
          <div className="row-actions inst-db-panel__hd-side">
            <Button asChild type="button" variant="outline" size="sm">
              <Link to="/protocol">返回实例列表</Link>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loadBusy}
              onClick={() => void loadAssets()}
            >
              {loadBusy ? "刷新中…" : "刷新"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {msg ? <p className="muted mb-0 text-sm">{msg}</p> : null}

      <Card className={ASSET_PANEL}>
        <CardHeader className={ASSET_PANEL_HD}>
          <CardTitle className="panel__title protocol-assets-section-title">
            全局运行配置
          </CardTitle>
        </CardHeader>
        <CardContent className={ASSET_PANEL_BD}>
          <div className="protocol-form-grid">
            <ProfileSelect
              id="napcat-runtime-mode"
              label="NapCat 运行模式"
              value={profileForm.napcat_runtime_mode ?? ""}
              options={RUNTIME_MODES}
              onChange={(v) => setProfileForm((p) => ({ ...p, napcat_runtime_mode: v }))}
            />
            <ProfileSelect
              id="snowluma-runtime-mode"
              label="SnowLuma 运行模式"
              value={profileForm.snowluma_runtime_mode ?? ""}
              options={RUNTIME_MODES}
              onChange={(v) => setProfileForm((p) => ({ ...p, snowluma_runtime_mode: v }))}
            />
            <ProfileSelect
              id="target-platform"
              label="下载目标平台（NapCat）"
              value={profileForm.target_platform ?? ""}
              options={TARGET_PLATFORMS}
              onChange={(v) => setProfileForm((p) => ({ ...p, target_platform: v }))}
            />
            <div className="field field--check flex items-center gap-2 pt-6">
              <Switch
                id="follow-bot-lifecycle"
                checked={Boolean(profileForm.follow_bot_lifecycle)}
                onCheckedChange={(checked) =>
                  setProfileForm((p) => ({ ...p, follow_bot_lifecycle: checked }))
                }
              />
              <Label htmlFor="follow-bot-lifecycle">实例随 Bot 启停（全局）</Label>
            </div>
          </div>
          {showDockerSection ? (
            <div className="protocol-form-grid protocol-assets-docker-grid">
              <div className="field space-y-1.5">
                <Label htmlFor="napcat-docker-image">NapCat Docker 镜像</Label>
                <Input
                  id="napcat-docker-image"
                  className="h-9"
                  placeholder="mlikiowa/napcat-docker:latest"
                  autoComplete="off"
                  value={profileForm.docker_image ?? ""}
                  onChange={(e) => setProfileForm((p) => ({ ...p, docker_image: e.target.value }))}
                />
              </div>
              <div className="field space-y-1.5">
                <Label htmlFor="snowluma-docker-image">SnowLuma Docker 镜像</Label>
                <Input
                  id="snowluma-docker-image"
                  className="h-9"
                  placeholder="motricseven7/snowluma:latest"
                  autoComplete="off"
                  value={profileForm.snowluma_docker_image ?? ""}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, snowluma_docker_image: e.target.value }))
                  }
                />
              </div>
            </div>
          ) : null}
          <div className="row-actions protocol-assets-actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={cleanupBusy || !mountUrl}
              onClick={() => void cleanupDist()}
            >
              {cleanupBusy ? "清理中…" : "清理下载缓存"}
            </Button>
            <span className="flex-1" />
            <Button
              type="button"
              size="sm"
              disabled={saveBusy || !mountUrl}
              onClick={() => void saveProfile()}
            >
              {saveBusy ? "保存中…" : "保存设置"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className={ASSET_PANEL}>
        <CardHeader className={ASSET_PANEL_HD}>
          <CardTitle className="panel__title protocol-assets-section-title">
            运行时下载
          </CardTitle>
        </CardHeader>
        <CardContent className={ASSET_PANEL_BD}>
          <div className="protocol-assets-runtime-block">
            <div className="protocol-assets-runtime-block__hd">
              <strong>NapCat</strong>
              <span className="muted protocol-assets-job">{jobStatusLabel(napcatJob)}</span>
            </div>
            <div className="row-actions protocol-assets-download">
              <Input
                className="protocol-assets-download__tag h-9 min-w-[10rem] flex-1"
                placeholder="版本 tag（可选，默认 latest）"
                value={napcatTag}
                onChange={(e) => setNapcatTag(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                disabled={!mountUrl || napcatDownloadBusy}
                onClick={() => void downloadNapcat()}
              >
                {napcatDownloadBusy ? "下载中…" : "下载 NapCat 运行时"}
              </Button>
            </div>
          </div>
          <div className="protocol-assets-runtime-block">
            <div className="protocol-assets-runtime-block__hd">
              <strong>SnowLuma</strong>
              <span className="muted protocol-assets-job">{jobStatusLabel(snowlumaJob)}</span>
            </div>
            <div className="row-actions protocol-assets-download">
              <Input
                className="protocol-assets-download__tag h-9 min-w-[10rem] flex-1"
                placeholder="版本 tag（可选，默认 latest）"
                value={snowlumaTag}
                onChange={(e) => setSnowlumaTag(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                disabled={!mountUrl || snowlumaDownloadBusy}
                onClick={() => void downloadSnowluma()}
              >
                {snowlumaDownloadBusy ? "下载中…" : "下载 SnowLuma 运行时"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showDockerSection ? (
        <Card className={ASSET_PANEL}>
          <CardHeader className={ASSET_PANEL_HD}>
            <CardTitle className="panel__title protocol-assets-section-title">
              Docker 镜像
            </CardTitle>
          </CardHeader>
          <CardContent className={ASSET_PANEL_BD}>
            <p className="muted">
              需在宿主机或已挂载 docker.sock 的环境执行；Bot 容器内无 Docker CLI 时会提示在宿主机手动
              pull。
            </p>
            <div className="protocol-assets-docker-row">
              <div className="row-actions protocol-assets-download">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!mountUrl || napcatPullBusy}
                  onClick={() => void pullDocker("napcat")}
                >
                  {napcatPullBusy ? "拉取中…" : "拉取 NapCat 镜像"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!mountUrl || napcatListBusy}
                  onClick={() => void listDocker("napcat")}
                >
                  {napcatListBusy ? "查询中…" : "查看 NapCat 本地镜像"}
                </Button>
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
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!mountUrl || snowlumaPullBusy}
                  onClick={() => void pullDocker("snowluma")}
                >
                  {snowlumaPullBusy ? "拉取中…" : "拉取 SnowLuma 镜像"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!mountUrl || snowlumaListBusy}
                  onClick={() => void listDocker("snowluma")}
                >
                  {snowlumaListBusy ? "查询中…" : "查看 SnowLuma 本地镜像"}
                </Button>
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
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
