import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAgentToolsCatalog } from "@/api/agentPlatformApi";
import { useRegisterAiObservationChrome } from "@/components/ai/AiObservationChromeContext";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AiToolsPage() {
  useRegisterAiObservationChrome({ middle: null });
  const query = useQuery({
    queryKey: ["agent-tools-catalog"],
    queryFn: () => fetchAgentToolsCatalog(),
  });
  const items = useMemo(() => query.data?.items || [], [query.data]);
  const policy = query.data?.policy || {};

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">工具目录</CardTitle>
          <CardDescription>
            内置 / 插件 / MCP 统一清单。当前 tools_enabled=
            {String(policy.tools_enabled ?? "—")}，selective=
            {String(policy.selective_enabled ?? "—")}。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={query.isLoading} error={query.error}>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={String(item.name)} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium">{String(item.name)}</div>
                    <Badge variant="secondary">{String(item.source || "tool")}</Badge>
                    <Badge variant={item.eligible ? "default" : "outline"}>
                      {item.eligible ? "可用" : String(item.disabled_reason || "不可用")}
                    </Badge>
                    <Badge variant="outline">{String(item.visibility || "visible")}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{String(item.description || "")}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(Array.isArray(item.domains) ? item.domains : []).map((domain) => (
                      <Badge key={String(domain)} variant="outline">
                        {String(domain)}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
              {!items.length ? <li className="text-sm text-muted-foreground">暂无工具。</li> : null}
            </ul>
          </StateBlock>
        </CardContent>
      </Card>
    </div>
  );
}
