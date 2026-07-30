import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchAiExtensionConfig,
  fetchAiInstallStatus,
  fetchAiRuntimeStatus,
  openAiInstallJobEventSource,
  postAiExtensionTest,
  postAiInstall,
  postAiRuntimeStart,
  postAiRuntimeStop,
  putAiExtensionConfig,
} from "@/api/console";
import { useRegisterAiConfigChrome } from "@/components/ai/AiConfigChromeContext";
import AiConfigField from "@/components/ai/AiConfigField";
import SegTabs from "@/components/SegTabs";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { InstallJobFailedError, waitForInstallJob } from "@/utils/installJobStream";
import { pushConsoleToast } from "@/utils/consoleToast";

type Panel = "connection" | "runtime";

const PANEL_OPTIONS = [
  { value: "connection", label: "扩展连接" },
  { value: "runtime", label: "运行时" },
];

function notifyOk(message: string) {
  pushConsoleToast(message, "ok");
}

function notifyErr(message: string) {
  pushConsoleToast(message || "操作失败", "err");
}

export default function AiConfigConnectionSection() {
  const qc = useQueryClient();
  const [panel, setPanel] = useState<Panel>("connection");
  const [baseUrl, setBaseUrl] = useState("");
  const [timeoutSec, setTimeoutSec] = useState("30");
  const [installProgress, setInstallProgress] = useState("");
  const [withMedia, setWithMedia] = useState(false);
  const [remoteOnly, setRemoteOnly] = useState(true);
  const [useGpu, setUseGpu] = useState(false);
  const [noStart, setNoStart] = useState(false);

  const aiCfgQ = useQuery({ queryKey: ["ai-extension-config"], queryFn: fetchAiExtensionConfig });
  const runtimeQ = useQuery({ queryKey: ["ai-runtime"], queryFn: fetchAiRuntimeStatus });
  const installQ = useQuery({ queryKey: ["ai-install"], queryFn: fetchAiInstallStatus });

  useEffect(() => {
    if (!aiCfgQ.data) return;
    setBaseUrl(aiCfgQ.data.base_url || "");
    setTimeoutSec(String(aiCfgQ.data.timeout_sec ?? 30));
  }, [aiCfgQ.data]);

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["ai-extension-config"] }),
      qc.invalidateQueries({ queryKey: ["ai-runtime"] }),
      qc.invalidateQueries({ queryKey: ["ai-install"] }),
    ]);
  };

  const saveMut = useMutation({
    mutationFn: () =>
      putAiExtensionConfig({
        base_url: baseUrl.trim(),
        api_prefix: (aiCfgQ.data?.api_prefix || "/api").trim() || "/api",
        timeout_sec: Number(timeoutSec) || 30,
      }),
    onSuccess: async () => {
      notifyOk("扩展连接已保存");
      await invalidate();
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  const testMut = useMutation({
    mutationFn: () => postAiExtensionTest(),
    onSuccess: (r) =>
      r.ok
        ? notifyOk(r.status_code != null ? `连通性 OK (HTTP ${r.status_code})` : "连通性 OK")
        : notifyErr(r.error || "不可达"),
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  const startMut = useMutation({
    mutationFn: () => postAiRuntimeStart({ with_media: withMedia }),
    onSuccess: async () => {
      notifyOk("运行时已启动");
      await invalidate();
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  const stopMut = useMutation({
    mutationFn: () => postAiRuntimeStop(),
    onSuccess: async () => {
      notifyOk("运行时已停止");
      await invalidate();
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  const installMut = useMutation({
    mutationFn: async (action: "clone" | "bootstrap" | "clone_and_bootstrap" | "update") => {
      const job = await postAiInstall({
        action,
        no_start: noStart,
        remote_only: remoteOnly,
        with_media: withMedia,
        use_gpu: useGpu,
      });
      return waitForInstallJob(job.job_id, openAiInstallJobEventSource, (p) => {
        setInstallProgress(p.message || `${p.percent}%`);
      });
    },
    onSuccess: async () => {
      notifyOk("安装任务已完成");
      setInstallProgress("");
      await invalidate();
    },
    onError: (e) => {
      setInstallProgress("");
      notifyErr(e instanceof InstallJobFailedError ? e.message : axiosErrorDetail(e));
    },
  });

  const busy =
    saveMut.isPending || testMut.isPending || startMut.isPending || stopMut.isPending || installMut.isPending;

  const chromeMiddle = useMemo(
    () => (
      <SegTabs
        size="toolbar"
        ariaLabel="媒体服务分区"
        value={panel}
        onValueChange={(v) => setPanel(v as Panel)}
        options={PANEL_OPTIONS}
      />
    ),
    [panel],
  );

  useRegisterAiConfigChrome({ middle: chromeMiddle });

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        {installProgress ? <p className="text-xs text-muted-foreground">{installProgress}</p> : null}

        {panel === "connection" ? (
          <StateBlock loading={aiCfgQ.isLoading} error={aiCfgQ.error}>
            <div className="grid grid-cols-2 gap-3">
              <AiConfigField label="服务地址" description="例如 http://127.0.0.1:9099">
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              </AiConfigField>
              <AiConfigField label="超时（秒）" description="请求超时限制">
                <Input type="number" value={timeoutSec} onChange={(e) => setTimeoutSec(e.target.value)} />
              </AiConfigField>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => void saveMut.mutateAsync()}>
                保存
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void testMut.mutateAsync()}>
                测试连通
              </Button>
            </div>
          </StateBlock>
        ) : null}

        {panel === "runtime" ? (
          <StateBlock loading={runtimeQ.isLoading || installQ.isLoading} error={runtimeQ.error || installQ.error}>
            <div className="flex flex-wrap gap-2">
              <Badge variant={runtimeQ.data?.running ? "success" : "secondary"}>
                {runtimeQ.data?.running ? "运行中" : "未运行"}
              </Badge>
              <Badge variant="outline">{installQ.data?.detected ? "已安装" : "未安装"}</Badge>
            </div>
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <label className="flex items-center gap-2">
                <Switch checked={withMedia} onCheckedChange={setWithMedia} />
                同时拉起媒体服务
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={remoteOnly} onCheckedChange={setRemoteOnly} />
                仅远程依赖
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={useGpu} onCheckedChange={setUseGpu} />
                使用 GPU
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={noStart} onCheckedChange={setNoStart} />
                安装后不自动启动
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => void startMut.mutateAsync()}>
                启动
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void stopMut.mutateAsync()}>
                停止
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void installMut.mutateAsync("clone_and_bootstrap")}
              >
                安装并引导
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void installMut.mutateAsync("clone")}>
                仅克隆
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void installMut.mutateAsync("bootstrap")}
              >
                仅引导
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || installQ.data?.can_update !== true}
                title="托管目录：git pull --ff-only 后重新 bootstrap"
                onClick={() => void installMut.mutateAsync("update")}
              >
                更新 Runtime
              </Button>
            </div>
          </StateBlock>
        ) : null}
      </CardContent>
    </Card>
  );
}
