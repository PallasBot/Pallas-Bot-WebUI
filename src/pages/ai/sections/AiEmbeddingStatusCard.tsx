import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import { fetchLlmEmbeddingStatus, postLlmEmbeddingProbe } from "@/api/consoleApi";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { pushConsoleToast } from "@/utils/consoleToast";

const PROVIDER_LABEL: Record<string, string> = {
  stub: "占位",
  openai: "OpenAI 兼容",
  local: "本机 fastembed",
};

export default function AiEmbeddingStatusCard() {
  const qc = useQueryClient();
  const statusQ = useQuery({
    queryKey: ["llm-embedding-status"],
    queryFn: fetchLlmEmbeddingStatus,
    refetchInterval: 30_000,
  });

  const probeMut = useMutation({
    mutationFn: () => postLlmEmbeddingProbe("ping"),
    onSuccess: async (data) => {
      await qc.setQueryData(["llm-embedding-status"], data);
      if (data.probe_ok && !data.embedding_fallback) {
        pushConsoleToast(
          `探测成功${data.probe_ms != null ? `（${data.probe_ms} ms）` : ""}`,
          "ok",
        );
      } else if (data.embedding_fallback) {
        pushConsoleToast(data.embedding_error || "已回落占位向量", "err");
      } else {
        pushConsoleToast("探测未返回向量", "err");
      }
    },
    onError: (e) => pushConsoleToast(axiosErrorDetail(e) || "探测失败", "err"),
  });

  const data = statusQ.data;
  const provider = data?.embedding_provider || "—";
  const providerLabel = PROVIDER_LABEL[provider] || provider;

  return (
    <section
      aria-label="Embedding 诊断"
      className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3 sm:px-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">Embedding 状态</p>
          <p className="text-xs text-muted-foreground">
            当前提供方与是否回落占位；可点探测试算一条向量。
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={probeMut.isPending || statusQ.isLoading}
          onClick={() => void probeMut.mutateAsync()}
        >
          {probeMut.isPending ? "探测中…" : "探测"}
        </Button>
      </div>
      <StateBlock loading={statusQ.isLoading} error={statusQ.error}>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant={data?.semantic_available ? "success" : "warn"}>
            {data?.semantic_available ? "语义可用" : "语义不可用"}
          </Badge>
          <Badge variant="outline">提供方 {providerLabel}</Badge>
          <Badge variant="secondary">模型 {data?.resolved_model || data?.embedding_model || "—"}</Badge>
          {data?.embedding_fallback ? <Badge variant="warn">已回落占位</Badge> : null}
          {data?.local_dependency_ready === false && provider === "local" ? (
            <Badge variant="warn">未装 fastembed</Badge>
          ) : null}
        </div>
        <dl className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <div>
            <dt className="inline text-foreground/80">实际模型 </dt>
            <dd className="inline">{data?.resolved_model || data?.embedding_model || "—"}</dd>
          </div>
          <div>
            <dt className="inline text-foreground/80">Trigger 缓存 </dt>
            <dd className="inline">{data?.trigger_cache_count ?? 0} 条</dd>
          </div>
          {provider === "openai" && data?.endpoint_configured === false ? (
            <div className="sm:col-span-2 text-amber-700 dark:text-amber-400">
              还缺接口地址：在下方「Embedding 线路」点添加网关选 Provider，或手填地址；也可先配好对话主线。
            </div>
          ) : null}
          {data?.endpoint_provider_id ? (
            <div>
              <dt className="inline text-foreground/80">实际线路 </dt>
              <dd className="inline">{data.endpoint_provider_id}</dd>
            </div>
          ) : null}
          {provider === "openai" && data?.embedding_model === "stub" && data?.resolved_model ? (
            <div className="sm:col-span-2">
              模型仍写 stub，实际会用 {data.resolved_model}
              {data.remote_default_model ? `（默认 ${data.remote_default_model}）` : ""}；建议改成真实模型名。
            </div>
          ) : null}
          {data?.probe_ms != null ? (
            <div>
              <dt className="inline text-foreground/80">最近探测 </dt>
              <dd className="inline">
                {data.probe_ok ? "成功" : "失败"}
                {data.probe_dims != null ? ` · ${data.probe_dims} 维` : ""}
                {` · ${data.probe_ms} ms`}
              </dd>
            </div>
          ) : null}
          {data?.embedding_error ? (
            <div className="sm:col-span-2 break-words text-amber-700 dark:text-amber-400">
              {data.embedding_error}
            </div>
          ) : null}
          {provider === "local" && !data?.local_dependency_ready ? (
            <div className="sm:col-span-2">
              {"本机提供方需安装 fastembed（uv pip install 'fastembed>=0.5'；首次加载会占内存并较慢）"}
            </div>
          ) : null}
        </dl>
      </StateBlock>
    </section>
  );
}
