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
import { cn } from "@/lib/utils";
import { InstallJobFailedError, waitForInstallJob } from "@/utils/installJobStream";

type Panel = "connection" | "runtime";

const PANEL_OPTIONS = [
  { value: "connection", label: "扩展连接" },
  { value: "runtime", label: "运行时" },
];

export default function AiConfigConnectionSection() {
  const qc = useQueryClient();
  const [panel, setPanel] = useState<Panel>("connection");
  const [baseUrl, setBaseUrl] = useState("");
  const [timeoutSec, setTimeoutSec] = useState("30");
  const [msg, setMsg] = useState<string | null>(null);
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
      setMsg("扩展连接已保存");
      await invalidate();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const testMut = useMutation({
    mutationFn: () => postAiExtensionTest(),
    onSuccess: (r) => setMsg(r.reachable ? `连通性 OK (${r.latency_ms ?? "?"} ms)` : r.error || "不可达"),
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const startMut = useMutation({
    mutationFn: () => postAiRuntimeStart({ with_media: withMedia }),
    onSuccess: async () => {
      setMsg("运行时已启动");
      await invalidate();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const stopMut = useMutation({
    mutationFn: () => postAiRuntimeStop(),
    onSuccess: async () => {
      setMsg("运行时已停止");
      await invalidate();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const installMut = useMutation({
    mutationFn: async (action: "clone" | "bootstrap" | "clone_and_bootstrap") => {
      const job = await postAiInstall({
        action,
        no_start: noStart,
        remote_only: remoteOnly,
        with_media: withMedia,
        use_gpu: useGpu,
      });
      return waitForInstallJob(job.job_id, openAiInstallJobEventSource, setInstallProgress);
    },
    onSuccess: async () => {
      setMsg("安装任务已完成");
      setInstallProgress("");
      await invalidate();
    },
    onError: (e) => {
      setInstallProgress("");
      setMsg(e instanceof InstallJobFailedError ? e.message : axiosErrorDetail(e));
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
        {msg ? (
          <p className={cn("text-sm", /成功|OK|完成|已保存|已启动|已停止/.test(msg) ? "text-emerald-400" : "text-destructive")}>
            {msg}
          </p>
        ) : null}
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
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  setMsg(null);
                  void saveMut.mutateAsync();
                }}
              >
                保存
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setMsg(null);
                  void testMut.mutateAsync();
                }}
              >
                测试连通
              </Button>
            </div>
          </StateBlock>
        ) : (
          <StateBlock loading={runtimeQ.isLoading || installQ.isLoading} error={runtimeQ.error || installQ.error}>
            <div className="flex flex-wrap gap-2">
              <Badge variant={runtimeQ.data?.running ? "success" : "secondary"}>
                {runtimeQ.data?.running ? "运行中" : "未运行"}
              </Badge>
              <Badge variant="outline">{runtimeQ.data?.layout || installQ.data?.layout || "—"}</Badge>
              <Badge variant={runtimeQ.data?.health?.ok ? "success" : "warn"}>
                健康 {runtimeQ.data?.health?.ok ? "正常" : "异常"}
              </Badge>
            </div>
            <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
              {runtimeQ.data?.ai_root || installQ.data?.ai_root || "—"}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(
                [
                  ["包含媒体依赖", withMedia, setWithMedia],
                  ["仅从远程拉取", remoteOnly, setRemoteOnly],
                  ["使用 GPU", useGpu, setUseGpu],
                  ["安装后不启动", noStart, setNoStart],
                ] as const
              ).map(([label, checked, set]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-control,8px)] border border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-3 py-2"
                >
                  <span className="text-xs">{label}</span>
                  <Switch checked={checked} onCheckedChange={set} />
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  setMsg(null);
                  void startMut.mutateAsync();
                }}
              >
                启动
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setMsg(null);
                  void stopMut.mutateAsync();
                }}
              >
                停止
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                title="首次使用：下载媒体服务源码并安装依赖"
                onClick={() => {
                  setMsg(null);
                  void installMut.mutateAsync("clone_and_bootstrap");
                }}
              >
                下载并安装
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                title="已有源码目录时：仅重新安装依赖"
                onClick={() => {
                  setMsg(null);
                  void installMut.mutateAsync("bootstrap");
                }}
              >
                安装依赖
              </Button>
            </div>
          </StateBlock>
        )}
      </CardContent>
    </Card>
  );
}
