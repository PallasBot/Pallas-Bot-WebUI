import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
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
  type ProtocolDockerImageRow,
  type ProtocolRuntimeJob,
  type ProtocolRuntimeProfile,
} from "@/api/protocol";
import ProtocolDockerImageSelect from "@/components/protocol/ProtocolDockerImageSelect";
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
import { Boxes, Download, Package, Settings2 } from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import { cn } from "@/lib/utils";
import { pushConsoleToast } from "@/utils/consoleToast";
import { useRegisterProtocolChrome } from "@/components/protocol/ProtocolChromeContext";
import type { ProtocolOutletContext } from "@/pages/ProtocolPage";
import {
  dockerPullPercent,
  dockerPullPhaseLabel,
  waitForDockerPullJob,
} from "@/utils/protocolDockerPull";
import type { ProtocolDockerPullJob } from "@/api/protocol";

function DockerPullProgress({ job }: { job: ProtocolDockerPullJob }) {
  const pct = dockerPullPercent(job);
  return (
    <div className="protocol-assets-pull-progress" aria-live="polite">
      <div className="protocol-assets-pull-progress__meta muted">
        <span className="protocol-assets-pull-progress__label">{dockerPullPhaseLabel(job)}</span>
        <span className="protocol-assets-pull-progress__pct mono">{pct}%</span>
      </div>
      <div
        className="protocol-assets-pull-progress__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Docker 镜像拉取进度"
      >
        <div className="protocol-assets-pull-progress__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

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

function normalizeDockerImages(raw: unknown): ProtocolDockerImageRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    if (typeof item === "string") {
      const name = item.trim();
      return name ? { name } : { name: `<unknown-${index}>` };
    }
    if (item && typeof item === "object") {
      const row = item as ProtocolDockerImageRow;
      return {
        name: String(row.name ?? "").trim() || undefined,
        id: row.id != null ? String(row.id) : undefined,
        created_since: row.created_since != null ? String(row.created_since) : undefined,
        size: row.size != null ? String(row.size) : undefined,
      };
    }
    return { name: `<unknown-${index}>` };
  });
}

function dockerImageKey(img: ProtocolDockerImageRow, index: number): string {
  return [img.id, img.name, String(index)].filter(Boolean).join("|");
}

function DockerImageTable({
  images,
  listed,
}: {
  images: ProtocolDockerImageRow[];
  listed: boolean;
}) {
  if (!listed) return null;
  if (!images.length) {
    return <p className="muted protocol-assets-image-empty">本地暂无匹配镜像</p>;
  }
  return (
    <div className="protocol-assets-image-table-wrap">
      <table className="protocol-assets-image-table">
        <thead>
          <tr>
            <th scope="col">镜像</th>
            <th scope="col">创建</th>
            <th scope="col">大小</th>
          </tr>
        </thead>
        <tbody>
          {images.map((img, index) => (
            <tr key={dockerImageKey(img, index)}>
              <td className="protocol-assets-image-table__name mono" title={String(img.name ?? "")}>
                {String(img.name ?? "").trim() || "<none>:<none>"}
              </td>
              <td className="muted">{img.created_since?.trim() || "—"}</td>
              <td className="muted">{img.size?.trim() || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="protocol-assets-image-cards">
        {images.map((img, index) => (
          <li key={dockerImageKey(img, index)} className="protocol-assets-image-card">
            <code className="mono protocol-assets-image-card__name">
              {String(img.name ?? "").trim() || "<none>:<none>"}
            </code>
            <span className="muted protocol-assets-image-card__meta">
              {[img.created_since, img.size].filter(Boolean).join(" · ") || "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
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


function notifyOk(message: string) {
  pushConsoleToast(message, "ok");
}

function notifyErr(message: string) {
  pushConsoleToast(message || "操作失败", "err");
}

function notifyWarn(message: string) {
  pushConsoleToast(message, "warn");
}

export default function ProtocolAssetsTab() {
  const { mountUrl, reload } = useOutletContext<ProtocolOutletContext>();
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [profileForm, setProfileForm] = useState<ProtocolRuntimeProfile>({});
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
  const [napcatImages, setNapcatImages] = useState<ProtocolDockerImageRow[]>([]);
  const [snowlumaImages, setSnowlumaImages] = useState<ProtocolDockerImageRow[]>([]);
  const [napcatListed, setNapcatListed] = useState(false);
  const [snowlumaListed, setSnowlumaListed] = useState(false);
  const [dockerPullLog, setDockerPullLog] = useState("");
  const [dockerPullLogOpen, setDockerPullLogOpen] = useState(false);
  const [dockerPullJob, setDockerPullJob] = useState<ProtocolDockerPullJob | null>(null);
  const [dockerPullWhich, setDockerPullWhich] = useState<"napcat" | "snowluma" | null>(null);

  const napcatJob = useMemo(() => jobFromOverview(overview, "job"), [overview]);
  const snowlumaJob = useMemo(() => {
    const sl = overview?.snowluma;
    if (sl && typeof sl === "object" && "job" in sl) {
      return (sl as { job?: ProtocolRuntimeJob }).job ?? null;
    }
    return null;
  }, [overview]);

  const showNapcatDocker = profileForm.napcat_runtime_mode === "docker";
  const showSnowlumaDocker = profileForm.snowluma_runtime_mode === "docker";
  const showDockerSection = showNapcatDocker || showSnowlumaDocker;

  const napcatImageTarget =
    String(profileForm.docker_image ?? "").trim() || "mlikiowa/napcat-docker:latest";
  const snowlumaImageTarget =
    String(profileForm.snowluma_docker_image ?? "").trim() || "motricseven7/snowluma:latest";

  async function loadAssets() {
    if (!mountUrl) return;
    try {
      const [ov, pf] = await Promise.all([
        protocolFetchRuntimeOverview(mountUrl),
        protocolFetchRuntimeProfile(mountUrl),
      ]);
      setOverview(ov);
      setProfileForm({ ...pf });
    } catch (e) {
      notifyErr(protocolApiErrorMessage(e, "加载失败"));
    }
  }

  useEffect(() => {
    void (async () => {
      await reload();
      await loadAssets();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [mountUrl]);

  const chromeRefresh = useCallback(() => {
    void loadAssets();
  }, [mountUrl]);
  useRegisterProtocolChrome(
    useMemo(() => ({ onRefresh: chromeRefresh }), [chromeRefresh]),
  );

  async function saveProfile() {
    if (!mountUrl) return;
    setSaveBusy(true);
    try {
      const next = await protocolUpdateRuntimeProfile(mountUrl, profileForm);
      setProfileForm(next);
      notifyOk("全局运行配置已保存");
      await loadAssets();
    } catch (e) {
      notifyErr(protocolApiErrorMessage(e, "保存失败"));
    } finally {
      setSaveBusy(false);
    }
  }

  async function cleanupDist() {
    if (!mountUrl) return;
    setCleanupBusy(true);
    try {
      await protocolCleanupRuntimeDist(mountUrl);
      notifyOk("已清理下载缓存");
      await loadAssets();
    } catch (e) {
      notifyErr(protocolApiErrorMessage(e, "清理失败"));
    } finally {
      setCleanupBusy(false);
    }
  }

  async function downloadNapcat() {
    if (!mountUrl) return;
    setNapcatDownloadBusy(true);
    try {
      await protocolDownloadRuntime(mountUrl, {
        tag: napcatTag.trim() || undefined,
        target_platform: profileForm.target_platform || undefined,
      });
      notifyOk("已触发 NapCat 运行时下载");
      await loadAssets();
    } catch (e) {
      notifyErr(protocolApiErrorMessage(e, "下载失败"));
    } finally {
      setNapcatDownloadBusy(false);
    }
  }

  async function downloadSnowluma() {
    if (!mountUrl) return;
    setSnowlumaDownloadBusy(true);
    try {
      await protocolDownloadSnowlumaRuntime(mountUrl, {
        tag: snowlumaTag.trim() || undefined,
      });
      notifyOk("已触发 SnowLuma 运行时下载");
      await loadAssets();
    } catch (e) {
      notifyErr(protocolApiErrorMessage(e, "下载失败"));
    } finally {
      setSnowlumaDownloadBusy(false);
    }
  }

  async function pullDocker(which: "napcat" | "snowluma") {
    if (!mountUrl) return;
    const image = which === "napcat" ? napcatImageTarget : snowlumaImageTarget;
    if (which === "napcat") setNapcatPullBusy(true);
    else setSnowlumaPullBusy(true);
    setDockerPullWhich(which);
    setDockerPullJob({
      job_id: "",
      protocol: which,
      image,
      phase: "pending",
      status: "running",
      message: "正在启动拉取…",
      progress_percent: 1,
      output: "",
    });
    setDockerPullLog("");
    setDockerPullLogOpen(true);
    // 旧版插件 POST 会同步阻塞整次 pull：占位进度缓慢爬升，避免一直停在 1%
    let softTimer: number | null = window.setInterval(() => {
      setDockerPullJob((prev) => {
        if (!prev || prev.status !== "running" || prev.job_id) return prev;
        const next = Math.min(12, (Number(prev.progress_percent) || 1) + 1);
        if (next === prev.progress_percent) return prev;
        return {
          ...prev,
          progress_percent: next,
          message: prev.message || "正在拉取（等待服务端响应）…",
        };
      });
    }, 2500);
    try {
      const started = await protocolPullDockerImage(mountUrl, image, which);
      if (softTimer != null) {
        window.clearInterval(softTimer);
        softTimer = null;
      }
      const jobId = String(started.job_id ?? started.job?.job_id ?? "").trim();
      if (!jobId) {
        // 兼容旧插件：同步返回 ok/output
        setDockerPullLog(
          `${started.image ? `[${started.image}]\n` : ""}${
            started.output?.trim() || (started.ok ? "拉取完成" : "拉取失败")
          }`,
        );
        setDockerPullJob({
          job_id: "",
          protocol: which,
          image: started.image || image,
          phase: started.ok ? "completed" : "failed",
          status: started.ok ? "completed" : "failed",
          message: started.ok ? "拉取完成" : "拉取失败",
          progress_percent: 100,
          output: started.output ?? "",
          rebuild_ok: started.rebuild_ok,
          rebuild_image: started.rebuild_image,
        });
        if (started.ok) {
          notifyOk(
            which === "napcat"
              ? "NapCat 镜像拉取完成"
              : "SnowLuma 镜像拉取并重建派生镜像完成",
          );
          await listDocker(which, { quiet: true });
        } else if (which === "snowluma" && started.rebuild_ok === false) {
          notifyErr("SnowLuma 上游已拉取，但派生镜像重建失败");
        } else {
          notifyErr("Docker 镜像拉取失败");
        }
        return;
      }
      if (started.job) {
        setDockerPullJob(started.job);
        if (started.job.output) setDockerPullLog(started.job.output);
      }
      const job = await waitForDockerPullJob(mountUrl, jobId, {
        onProgress: (next) => {
          setDockerPullJob(next);
          if (next.output) setDockerPullLog(next.output);
        },
      });
      setDockerPullJob(job);
      if (job.output) setDockerPullLog(job.output);
      if (job.status === "completed") {
        notifyOk(
          which === "napcat"
            ? "NapCat 镜像拉取完成"
            : "SnowLuma 镜像拉取并重建派生镜像完成",
        );
        await listDocker(which, { quiet: true });
      } else if (which === "snowluma" && job.rebuild_ok === false) {
        notifyErr("SnowLuma 上游已拉取，但派生镜像重建失败");
      } else {
        notifyErr(job.message?.trim() || "Docker 镜像拉取失败");
      }
    } catch (e) {
      notifyErr(protocolApiErrorMessage(e, "拉取失败"));
      setDockerPullJob((prev) =>
        prev
          ? {
              ...prev,
              status: "failed",
              phase: "failed",
              message: protocolApiErrorMessage(e, "拉取失败"),
              progress_percent: 100,
            }
          : prev,
      );
    } finally {
      if (softTimer != null) window.clearInterval(softTimer);
      if (which === "napcat") setNapcatPullBusy(false);
      else setSnowlumaPullBusy(false);
    }
  }

  async function listDocker(which: "napcat" | "snowluma", opts?: { quiet?: boolean }) {
    if (!mountUrl) return;
    if (which === "napcat") setNapcatListBusy(true);
    else setSnowlumaListBusy(true);
    try {
      const res = await protocolListDockerImages(mountUrl, which);
      const imgs = normalizeDockerImages(res.images);
      if (which === "napcat") {
        setNapcatImages(imgs);
        setNapcatListed(true);
      } else {
        setSnowlumaImages(imgs);
        setSnowlumaListed(true);
      }
      if (!opts?.quiet) {
        if (!res.ok && res.detail) notifyErr(res.detail);
        else if (!imgs.length) notifyWarn("本地暂无匹配镜像");
      }
    } catch (e) {
      if (!opts?.quiet) notifyErr(protocolApiErrorMessage(e, "查询镜像失败"));
    } finally {
      if (which === "napcat") setNapcatListBusy(false);
      else setSnowlumaListBusy(false);
    }
  }

  if (!mountUrl) {
    return <p className="alert alert--err">协议 API 未就绪</p>;
  }

  return (
    <div className="protocol-sub-page console-panel-stack">
      <Card className={cn(ASSET_PANEL, "mb-0")}>
        <CardHeader className={cn(ASSET_PANEL_HD, "inst-db-panel__hd")}>
          <div>
            <CardTitle className="panel__title flex items-center gap-1.5">
              <PanelTitleIcon icon={Package} />
              协议资产
            </CardTitle>
            <CardDescription className="muted mt-1">发行包、运行模式与 Docker 镜像。</CardDescription>
          </div>
          </CardHeader>
      </Card>


      <Card className={ASSET_PANEL}>
        <CardHeader className={ASSET_PANEL_HD}>
          <CardTitle className="panel__title protocol-assets-section-title flex items-center gap-1.5">
            <PanelTitleIcon icon={Settings2} />
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
                <ProtocolDockerImageSelect
                  id="napcat-docker-image"
                  mountUrl={mountUrl}
                  protocol="napcat"
                  value={profileForm.docker_image ?? ""}
                  onValueChange={(v) => setProfileForm((p) => ({ ...p, docker_image: v }))}
                  placeholder="mlikiowa/napcat-docker:latest"
                />
              </div>
              <div className="field space-y-1.5">
                <Label htmlFor="snowluma-docker-image">SnowLuma Docker 镜像（上游）</Label>
                <Input
                  id="snowluma-docker-image"
                  className="h-9"
                  placeholder="motricseven7/snowluma:v1.12.9"
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
          <CardTitle className="panel__title protocol-assets-section-title flex items-center gap-1.5">
            <PanelTitleIcon icon={Download} />
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
            <CardTitle className="panel__title protocol-assets-section-title flex items-center gap-1.5">
              <PanelTitleIcon icon={Boxes} />
              Docker 镜像
            </CardTitle>
          </CardHeader>
          <CardContent className={ASSET_PANEL_BD}>
            <p className="muted protocol-assets-docker-hint">
              需在宿主机或已挂载 docker.sock 的环境执行；Bot 容器内无 Docker CLI 时请在宿主机手动
              pull。SnowLuma 拉取成功后会自动重建派生镜像{" "}
              <code className="mono">pallas/snowluma-auto-login</code>
              ，并打与上游相同的 tag（例如上游 <code className="mono">:v1.12.9</code> → 派生{" "}
              <code className="mono">:v1.12.9</code>；拉取 <code className="mono">:latest</code>{" "}
              时还会额外打上解析出的版本 tag）。
            </p>

            {showNapcatDocker ? (
              <div className="protocol-assets-runtime-block">
                <div className="protocol-assets-runtime-block__hd">
                  <strong>NapCat</strong>
                  <code className="mono protocol-assets-docker-target" title={napcatImageTarget}>
                    {napcatImageTarget}
                  </code>
                </div>
                <div className="row-actions protocol-assets-download">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!mountUrl || napcatPullBusy || snowlumaPullBusy}
                    onClick={() => void pullDocker("napcat")}
                  >
                    {napcatPullBusy ? "拉取中…" : "拉取镜像"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!mountUrl || napcatListBusy}
                    onClick={() => void listDocker("napcat")}
                  >
                    {napcatListBusy ? "查询中…" : "查看本地"}
                  </Button>
                </div>
                {dockerPullWhich === "napcat" && dockerPullJob ? (
                  <DockerPullProgress job={dockerPullJob} />
                ) : null}
                <DockerImageTable images={napcatImages} listed={napcatListed} />
              </div>
            ) : null}

            {showSnowlumaDocker ? (
              <div className="protocol-assets-runtime-block">
                <div className="protocol-assets-runtime-block__hd">
                  <strong>SnowLuma</strong>
                  <code className="mono protocol-assets-docker-target" title={snowlumaImageTarget}>
                    {snowlumaImageTarget}
                  </code>
                </div>
                <p className="muted protocol-assets-docker-note">
                  拉取目标为上游基础镜像；运行与「查看本地」使用同 tag 的派生镜像
                  （<code className="mono">pallas/snowluma-auto-login</code>）。填版本 tag 可固定版本，写法与
                  NapCat 镜像一致。
                </p>
                <div className="row-actions protocol-assets-download">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!mountUrl || snowlumaPullBusy || napcatPullBusy}
                    onClick={() => void pullDocker("snowluma")}
                  >
                    {snowlumaPullBusy ? "拉取中…" : "拉取并重建"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!mountUrl || snowlumaListBusy}
                    onClick={() => void listDocker("snowluma")}
                  >
                    {snowlumaListBusy ? "查询中…" : "查看本地"}
                  </Button>
                </div>
                {dockerPullWhich === "snowluma" && dockerPullJob ? (
                  <DockerPullProgress job={dockerPullJob} />
                ) : null}
                <DockerImageTable images={snowlumaImages} listed={snowlumaListed} />
              </div>
            ) : null}

            {dockerPullLog ? (
              <details
                className="protocol-assets-pull-log"
                open={dockerPullLogOpen}
                onToggle={(e) => setDockerPullLogOpen((e.target as HTMLDetailsElement).open)}
              >
                <summary>拉取日志</summary>
                <pre className="protocol-assets-pre">{dockerPullLog}</pre>
              </details>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
