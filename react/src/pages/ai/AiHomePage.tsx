import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import {
  fetchAiInstallStatus,
  fetchAiRuntimeStatus,
  fetchLlmRuntimeOverview,
} from "@/api/console";
import Metric from "@/components/Metric";
import PageMasthead from "@/components/PageMasthead";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AiHomePage() {
  const overviewQ = useQuery({ queryKey: ["llm-runtime-overview"], queryFn: fetchLlmRuntimeOverview });
  const runtimeQ = useQuery({ queryKey: ["ai-runtime"], queryFn: fetchAiRuntimeStatus });
  const installQ = useQuery({ queryKey: ["ai-install"], queryFn: fetchAiInstallStatus });

  const health = overviewQ.data?.health;
  const providers = health?.llm_health?.provider_status || [];
  const services = runtimeQ.data?.services || {};

  return (
    <div>
      <PageMasthead
        title="AI 观测"
        description="运行时健康与提供方状态。"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void overviewQ.refetch();
              void runtimeQ.refetch();
              void installQ.refetch();
            }}
          >
            <RefreshCw />
            刷新
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="LLM 健康" value={health?.ok ? "正常" : health ? "异常" : "…"} />
        <Metric label="AI 进程" value={runtimeQ.data?.running ? "运行中" : "未全开"} />
        <Metric label="安装检测" value={installQ.data?.detected ? "已检测" : "未检测"} />
        <Metric label="提供方" value={providers.length || "…"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>运行时</CardTitle>
            <CardDescription>{health?.llm_runtime_detail || health?.url || "—"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <StateBlock loading={runtimeQ.isLoading} error={runtimeQ.error}>
              <div className="flex flex-wrap gap-2">
                <Badge variant={runtimeQ.data?.health?.ok ? "success" : "warn"}>
                  health {runtimeQ.data?.health?.ok ? "ok" : runtimeQ.data?.health?.error || "fail"}
                </Badge>
                <Badge variant="outline">
                  {runtimeQ.data?.endpoint?.host}:{runtimeQ.data?.endpoint?.port}
                </Badge>
                <Badge variant="secondary">{runtimeQ.data?.layout || installQ.data?.layout || "—"}</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {Object.entries(services).map(([name, svc]) => (
                  <div key={name} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <span>{name}</span>
                    <Badge variant={svc.running ? "success" : "secondary"}>
                      {svc.running ? `pid ${svc.pid ?? "?"}` : "stopped"}
                    </Badge>
                  </div>
                ))}
              </div>
              <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
                {runtimeQ.data?.ai_root || installQ.data?.ai_root || "—"}
              </p>
            </StateBlock>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>提供方</CardTitle>
            <CardDescription>{health?.llm_health?.health_state || "—"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <StateBlock loading={overviewQ.isLoading} error={overviewQ.error} empty={!providers.length}>
              {providers.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{p.id}</div>
                    <div className="text-xs text-muted-foreground">{p.kind || "—"}</div>
                  </div>
                  <div className="flex gap-1.5">
                    <Badge variant={p.enabled ? "outline" : "secondary"}>
                      {p.enabled ? "启用" : "停用"}
                    </Badge>
                    <Badge variant={p.reachable ? "success" : "warn"}>
                      {p.reachable ? "可达" : "不可达"}
                    </Badge>
                  </div>
                </div>
              ))}
            </StateBlock>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
