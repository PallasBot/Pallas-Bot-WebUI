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
import { Server } from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import StateBlock from "@/components/StateBlock";
import AiConfigField, { AiModelSelect } from "@/components/ai/AiConfigField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Props = {
  /** 嵌在接入页「本地」Tab 内时去掉外层 Card，避免双重卡片。 */
  embedded?: boolean;
};

export default function AiModelAdminPanel({ embedded = false }: Props) {
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

  const body = (
    <div className="space-y-3 text-sm">
      {msg ? (
        <p className={cn("text-sm", msg.includes("成功") ? "text-emerald-400" : "text-destructive")}>{msg}</p>
      ) : null}
      <StateBlock loading={statusQ.isLoading} error={statusQ.error}>
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusQ.data?.ai_reachable ? "success" : "warn"}>
            AI {statusQ.data?.ai_reachable ? "可达" : "不可达"}
          </Badge>
          <Badge variant="outline">当前 {statusQ.data?.model || "—"}</Badge>
          <Badge variant="secondary">GPU 层数 {statusQ.data?.num_gpu ?? "—"}</Badge>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <AiConfigField label="模型名" description="本机 Ollama 已发现的模型。">
            <AiModelSelect
              value={model}
              options={[...(statusQ.data?.model ? [statusQ.data.model] : []), ...models]}
              placeholder="选择模型"
              onValueChange={setModel}
            />
          </AiConfigField>
          <AiConfigField label="GPU 层数" description="加载到 GPU 的层数，越大越吃显存。">
            <Input value={numGpu} onChange={(e) => setNumGpu(e.target.value)} type="number" />
          </AiConfigField>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={pull} onCheckedChange={setPull} />
          <span>切换时尝试拉取模型</span>
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
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setMsg(null);
              void reloadMut.mutateAsync();
            }}
          >
            重载
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setMsg(null);
              void unloadMut.mutateAsync();
            }}
          >
            卸载
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setMsg(null);
              void gpuMut.mutateAsync();
            }}
          >
            应用 GPU
          </Button>
        </div>
      </StateBlock>
    </div>
  );

  if (embedded) {
    return (
      <section aria-label="Ollama 运行" className="space-y-3">
        {body}
      </section>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <PanelTitleIcon icon={Server} />
          本地模型管理
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
