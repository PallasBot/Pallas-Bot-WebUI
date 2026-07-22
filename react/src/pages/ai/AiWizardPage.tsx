import { useMutation, useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { axiosErrorDetail } from "@/api/http";
import { fetchLlmWizardStatus, postAiExtensionTest } from "@/api/console";
import { postServiceGatewaysConnectivityCheck } from "@/api/fullConsole";
import PageHeader from "@/components/PageHeader";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AiWizardPage() {
  const q = useQuery({ queryKey: ["llm-wizard"], queryFn: fetchLlmWizardStatus });
  const testMut = useMutation({ mutationFn: postAiExtensionTest });
  const gatewayMut = useMutation({ mutationFn: () => postServiceGatewaysConnectivityCheck() });
  const d = q.data;
  const test = testMut.data;
  const gateway = gatewayMut.data;

  return (
    <div>
      <PageHeader
        title="AI 体检向导"
        description="连通性与提供方检查摘要。"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={gatewayMut.isPending}
              onClick={() => void gatewayMut.mutateAsync()}
            >
              网关连通检测
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={testMut.isPending}
              onClick={() => void testMut.mutateAsync()}
            >
              扩展探活
            </Button>
            <Button variant="outline" size="sm" disabled={q.isFetching} onClick={() => void q.refetch()}>
              <RefreshCw className={q.isFetching ? "animate-spin" : undefined} />
              刷新
            </Button>
          </>
        }
      />

      <StateBlock loading={q.isLoading} error={q.error}>
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge variant={d?.ai_reachable ? "success" : "warn"}>
            AI {d?.ai_reachable ? "可达" : "不可达"}
          </Badge>
          {test ? (
            <Badge variant={test.reachable ? "success" : "warn"}>
              扩展探活 {test.reachable ? `${test.latency_ms ?? "?"} ms` : test.error || "失败"}
            </Badge>
          ) : null}
          {testMut.error ? (
            <span className="text-xs text-destructive">{axiosErrorDetail(testMut.error)}</span>
          ) : null}
          <Badge variant="outline">mode {d?.provider_mode || "—"}</Badge>
          <Badge variant="secondary">
            提供方 {d?.providers_reachable ?? 0}/{d?.providers_configured ?? 0}
          </Badge>
          {d?.model ? <Badge variant="outline">{d.model}</Badge> : null}
        </div>

        {gatewayMut.error ? (
          <p className="mb-3 text-sm text-destructive">{axiosErrorDetail(gatewayMut.error)}</p>
        ) : null}
        {gateway ? (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>服务网关连通</CardTitle>
              <CardDescription>postServiceGatewaysConnectivityCheck</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(gateway.lines || []).map((line) => (
                <p key={line} className="text-muted-foreground">
                  {line}
                </p>
              ))}
              {(gateway.results || []).map((row, i) => (
                <div key={`${row.site}-${row.category}-${i}`} className="flex items-start justify-between gap-2 rounded border p-2">
                  <div>
                    <div className="font-medium">{row.site || row.category || `检查 ${i + 1}`}</div>
                    {row.error ? <div className="text-xs text-muted-foreground">{row.error}</div> : null}
                  </div>
                  <Badge variant={row.ok ? "success" : "destructive"}>{row.ok ? "通过" : "失败"}</Badge>
                </div>
              ))}
              {!gateway.lines?.length && !gateway.results?.length ? (
                <p className="text-muted-foreground">无检测结果</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {d?.next_step ? (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>下一步</CardTitle>
              <CardDescription>{d.health_url || "—"}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">{d.next_step}</CardContent>
          </Card>
        ) : null}

        <div className="space-y-2">
          {(d?.checks || []).map((c, i) => (
            <div key={c.id || i} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium">{c.label || c.id || `检查 ${i + 1}`}</div>
                {c.detail ? <div className="text-muted-foreground">{c.detail}</div> : null}
              </div>
              <Badge variant={c.ok ? "success" : "destructive"}>{c.ok ? "通过" : "失败"}</Badge>
            </div>
          ))}
          {!d?.checks?.length ? <p className="text-sm text-muted-foreground">无分项检查</p> : null}
        </div>
      </StateBlock>
    </div>
  );
}
