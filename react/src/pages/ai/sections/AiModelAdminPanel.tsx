import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchLlmProviderModels,
  fetchLlmModelAdminStatus,
  postLlmModelAdminNumGpu,
  postLlmModelAdminReload,
  postLlmModelAdminSwitch,
  postLlmModelAdminUnload,
} from "@/api/console";
import StateBlock from "@/components/StateBlock";
import AiConfigField, { AiModelSelect } from "@/components/ai/AiConfigField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export default function AiModelAdminPanel() {
  const qc = useQueryClient();
  const [model, setModel] = useState("");
  const [numGpu, setNumGpu] = useState("");
  const [pull, setPull] = useState(true);
  const [models, setModels] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const statusQ = useQuery({ queryKey: ["llm-model-admin"], queryFn: fetchLlmModelAdminStatus });

  useEffect(() => {
    void fetchLlmProviderModels("local", { kind: "local" })
      .then((result) => {
        if (result.ok) setModels(result.models || []);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!statusQ.data) return;
    if (!model) setModel(statusQ.data.model || "");
    if (!numGpu && statusQ.data.num_gpu != null) setNumGpu(String(statusQ.data.num_gpu));
  }, [statusQ.data, model, numGpu]);

  const onDone = async (label: string) => {
    setMsg(`${label}成功`);
    await qc.invalidateQueries({ queryKey: ["llm-model-admin"] });
  };

  const switchMut = useMutation({
    mutationFn: () => postLlmModelAdminSwitch(model.trim(), pull),
    onSuccess: () => void onDone("切换模型"),
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const reloadMut = useMutation({
    mutationFn: () => postLlmModelAdminReload(),
    onSuccess: () => void onDone("重载"),
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const unloadMut = useMutation({
    mutationFn: () => postLlmModelAdminUnload(),
    onSuccess: () => void onDone("卸载"),
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const gpuMut = useMutation({
    mutationFn: () => postLlmModelAdminNumGpu(Number(numGpu) || 0),
    onSuccess: () => void onDone("GPU 设置"),
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const busy = switchMut.isPending || reloadMut.isPending || unloadMut.isPending || gpuMut.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>本地模型管理</CardTitle>
        <CardDescription>Ollama 切换 / 重载 / GPU 层数；用顶部工具条刷新。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {msg ? (
          <p className={cn("text-sm", msg.includes("成功") ? "text-emerald-400" : "text-destructive")}>{msg}</p>
        ) : null}
        <StateBlock loading={statusQ.isLoading} error={statusQ.error}>
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusQ.data?.ai_reachable ? "success" : "warn"}>
              AI {statusQ.data?.ai_reachable ? "可达" : "不可达"}
            </Badge>
            <Badge variant="outline">当前 {statusQ.data?.model || "—"}</Badge>
            <Badge variant="secondary">GPU {statusQ.data?.num_gpu ?? "—"}</Badge>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <AiConfigField label="模型名" description="选择本地 Provider 已发现的模型。">
              <AiModelSelect value={model} options={[...(statusQ.data?.model ? [statusQ.data.model] : []), ...models]} placeholder="选择模型" onValueChange={setModel} />
            </AiConfigField>
            <AiConfigField label="num_gpu">
              <Input value={numGpu} onChange={(e) => setNumGpu(e.target.value)} type="number" />
            </AiConfigField>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={pull} onCheckedChange={setPull} />
            <span>切换时尝试 pull</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy || !model.trim()}
              onClick={() => {
                setMsg(null);
                void switchMut.mutateAsync();
              }}
            >
              切换
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { setMsg(null); void reloadMut.mutateAsync(); }}>
              重载
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { setMsg(null); void unloadMut.mutateAsync(); }}>
              卸载
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { setMsg(null); void gpuMut.mutateAsync(); }}>
              应用 GPU
            </Button>
          </div>
        </StateBlock>
      </CardContent>
    </Card>
  );
}
