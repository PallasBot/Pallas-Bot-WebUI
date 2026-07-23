import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { fetchLlmRuntimeOverview } from "@/api/console";
import { fetchLlmTaskStats } from "@/api/fullConsole";
import PageMasthead from "@/components/PageMasthead";
import StateBlock from "@/components/StateBlock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AiStatisticsPage() {
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState(todayIso());

  const overviewQ = useQuery({ queryKey: ["llm-runtime-overview"], queryFn: fetchLlmRuntimeOverview });
  const taskStatsQ = useQuery({
    queryKey: ["llm-task-stats", start, end],
    queryFn: () => fetchLlmTaskStats({ start, end }),
  });

  const overviewStats = overviewQ.data?.task_stats;
  const taskStats = taskStatsQ.data;

  const summary = useMemo(() => {
    const bot = taskStats?.bot;
    const ai = taskStats?.ai;
    const botOk = bot?.by_task
      ? Object.values(bot.by_task).reduce((sum, row) => sum + (Number(row.submit_ok) || 0), 0)
      : 0;
    const aiOk = ai?.by_task
      ? Object.values(ai.by_task).reduce((sum, row) => sum + (Number(row.task_ok) || 0), 0)
      : 0;
    const aiFail = ai?.by_task
      ? Object.values(ai.by_task).reduce((sum, row) => sum + (Number(row.task_fail) || 0), 0)
      : 0;
    return { botOk, aiOk, aiFail, reachable: taskStats?.ai_reachable };
  }, [taskStats]);

  const refreshing = overviewQ.isFetching || taskStatsQ.isFetching;

  return (
    <div>
      <PageMasthead
        title="AI 统计"
        description="任务统计与运行时快照。"
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => {
              void overviewQ.refetch();
              void taskStatsQ.refetch();
            }}
          >
            <RefreshCw className={refreshing ? "animate-spin" : undefined} />
            刷新
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="max-w-[10rem]" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input className="max-w-[10rem]" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">AI 连通</div>
            <div className="text-xl font-medium">{summary.reachable == null ? "…" : summary.reachable ? "正常" : "异常"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Bot 提交</div>
            <div className="text-xl font-medium tabular-nums">{summary.botOk}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">AI 成功</div>
            <div className="text-xl font-medium tabular-nums">{summary.aiOk}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">AI 失败</div>
            <div className="text-xl font-medium tabular-nums">{summary.aiFail}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>task_stats（API）</CardTitle>
          <CardDescription>fetchLlmTaskStats · {start} ~ {end}</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={taskStatsQ.isLoading} error={taskStatsQ.error} empty={taskStats == null} emptyText="暂无统计">
            <JsonBlock value={taskStats} />
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>runtime overview</CardTitle>
          <CardDescription>fetchLlmRuntimeOverview.task_stats</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={overviewQ.isLoading} error={overviewQ.error} empty={overviewStats == null} emptyText="暂无快照">
            <JsonBlock value={overviewStats} />
          </StateBlock>
        </CardContent>
      </Card>
    </div>
  );
}
