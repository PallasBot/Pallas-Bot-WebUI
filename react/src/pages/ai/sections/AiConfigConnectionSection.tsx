import { useEffect, useState } from "react";
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
import AiConfigField from "@/components/ai/AiConfigField";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { InstallJobFailedError, waitForInstallJob } from "@/utils/installJobStream";

export default function AiConfigConnectionSection() {
  const qc = useQueryClient();
  const [baseUrl, setBaseUrl] = useState("");
  const [apiPrefix, setApiPrefix] = useState("");
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
    setApiPrefix(aiCfgQ.data.api_prefix || "");
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
        api_prefix: apiPrefix.trim(),
        timeout_sec: Number(timeoutSec) || 30,
      }),
    onSuccess: async () => {
      setMsg("AI 扩展连接已保存");
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
      setMsg("AI Runtime 已启动");
      await invalidate();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const stopMut = useMutation({
    mutationFn: () => postAiRuntimeStop(),
    onSuccess: async () => {
      setMsg("AI Runtime 已停止");
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
      setMsg("安装任务完成");
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

  return (
    <div className="space-y-4">
      {msg ? (
        <p className={cn("text-sm", /成功|OK|完成|已保存|已启动|已停止/.test(msg) ? "text-emerald-400" : "text-destructive")}>
          {msg}
        </p>
      ) : null}
      {installProgress ? <p className="text-xs text-muted-foreground">{installProgress}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>扩展连接</CardTitle>
          <CardDescription>Bot 访问 AI 扩展的地址与超时。</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={aiCfgQ.isLoading} error={aiCfgQ.error}>
            <div className="grid gap-3 sm:grid-cols-2">
              <AiConfigField label="服务地址" description="base_url，例如 http://127.0.0.1:9099">
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              </AiConfigField>
              <AiConfigField label="API 前缀" description="api_prefix，通常为 /api">
                <Input value={apiPrefix} onChange={(e) => setApiPrefix(e.target.value)} />
              </AiConfigField>
              <AiConfigField label="超时（秒）" description="请求超时上限">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>运行时</CardTitle>
          <CardDescription>启动 / 停止 / 安装 AI 扩展进程。</CardDescription>
        </CardHeader>
        <CardContent>
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
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["含媒体依赖", withMedia, setWithMedia],
                  ["仅远程拉取", remoteOnly, setRemoteOnly],
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
                onClick={() => {
                  setMsg(null);
                  void installMut.mutateAsync("bootstrap");
                }}
              >
                Bootstrap
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setMsg(null);
                  void installMut.mutateAsync("clone_and_bootstrap");
                }}
              >
                Clone+Bootstrap
              </Button>
            </div>
          </StateBlock>
        </CardContent>
      </Card>
    </div>
  );
}
