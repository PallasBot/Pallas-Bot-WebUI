import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
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
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>扩展连接</CardTitle>
            <CardDescription>/ai-extension/config · test</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void invalidate()}>
            <RefreshCw />
            刷新
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <StateBlock loading={aiCfgQ.isLoading} error={aiCfgQ.error}>
            <label className="block space-y-1">
              <span className="text-muted-foreground">base_url</span>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="text-muted-foreground">api_prefix</span>
              <Input value={apiPrefix} onChange={(e) => setApiPrefix(e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="text-muted-foreground">timeout_sec</span>
              <Input type="number" value={timeoutSec} onChange={(e) => setTimeoutSec(e.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => { setMsg(null); void saveMut.mutateAsync(); }}>
                保存
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => { setMsg(null); void testMut.mutateAsync(); }}>
                测试连通
              </Button>
            </div>
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>运行时</CardTitle>
          <CardDescription>start / stop / status / install</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <StateBlock loading={runtimeQ.isLoading || installQ.isLoading} error={runtimeQ.error || installQ.error}>
            <div className="flex flex-wrap gap-2">
              <Badge variant={runtimeQ.data?.running ? "success" : "secondary"}>
                {runtimeQ.data?.running ? "运行中" : "未运行"}
              </Badge>
              <Badge variant="outline">{runtimeQ.data?.layout || installQ.data?.layout || "—"}</Badge>
              <Badge variant={runtimeQ.data?.health?.ok ? "success" : "warn"}>
                health {runtimeQ.data?.health?.ok ? "ok" : "fail"}
              </Badge>
            </div>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {runtimeQ.data?.ai_root || installQ.data?.ai_root || "—"}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={withMedia} onChange={(e) => setWithMedia(e.target.checked)} />
                含媒体
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />
                仅远程
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={useGpu} onChange={(e) => setUseGpu(e.target.checked)} />
                GPU
              </label>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={noStart} onChange={(e) => setNoStart(e.target.checked)} />
                安装后不启动
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => { setMsg(null); void startMut.mutateAsync(); }}>
                启动
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => { setMsg(null); void stopMut.mutateAsync(); }}>
                停止
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => { setMsg(null); void installMut.mutateAsync("bootstrap"); }}
              >
                Bootstrap
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => { setMsg(null); void installMut.mutateAsync("clone_and_bootstrap"); }}
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
