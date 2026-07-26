import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelAgentTask, fetchAgentPlatformOverview, fetchAgentTasks } from "@/api/agentPlatformApi";
import { useRegisterAiObservationChrome } from "@/components/ai/AiObservationChromeContext";
import {
  parseScopeBotId,
  parseScopeGroupId,
  useAiObservationScope,
} from "@/components/ai/AiObservationScopeContext";
import StateBlock from "@/components/StateBlock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function taskStatusLabel(raw: unknown): string {
  const status = String(raw || "");
  if (status === "pending") return "等待中";
  if (status === "running") return "进行中";
  if (status === "done") return "已完成";
  if (status === "cancelled") return "已取消";
  if (status === "failed") return "失败";
  return status || "—";
}

export default function AiTasksPage() {
  const qc = useQueryClient();
  const { botId, groupId } = useAiObservationScope();
  const scopeBot = parseScopeBotId(botId);
  const scopeGroup = parseScopeGroupId(groupId);
  useRegisterAiObservationChrome({ middle: null });

  const overviewQuery = useQuery({
    queryKey: ["agent-platform-overview", scopeBot, scopeGroup],
    queryFn: () => fetchAgentPlatformOverview({ botId: scopeBot, groupId: scopeGroup }),
  });
  const tasksQuery = useQuery({
    queryKey: ["agent-tasks", scopeGroup],
    queryFn: () => fetchAgentTasks({ groupId: scopeGroup }),
  });
  const cancelMutation = useMutation({
    mutationFn: (taskId: string) => cancelAgentTask(taskId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["agent-tasks"] }),
        qc.invalidateQueries({ queryKey: ["agent-platform-overview"] }),
      ]);
    },
  });

  const overview = overviewQuery.data as Record<string, unknown> | undefined;
  const tasks = useMemo(() => tasksQuery.data?.items || [], [tasksQuery.data]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">运行摘要</CardTitle>
          <CardDescription>按当前顶栏范围汇总：观察队列、工具、任务与口癖。</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={overviewQuery.isLoading} error={overviewQuery.error}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(
                [
                  ["观察队列", overview?.observation_queue_size],
                  ["工具数", overview?.tool_count],
                  ["任务总数", overview?.task_count],
                  ["未完成任务", overview?.open_tasks],
                  ["口癖待审", overview?.catchphrase_candidates],
                  ["口癖已启用", overview?.catchphrase_active],
                ] as Array<[string, unknown]>
              ).map(([label, value]) => (
                <div key={label} className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-1 text-lg font-semibold">{String(value ?? "—")}</div>
                </div>
              ))}
            </div>
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">任务列表</CardTitle>
          <CardDescription>提醒、周期任务与异步调研。完成后只会在对应群里投递结果。</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={tasksQuery.isLoading} error={tasksQuery.error}>
            <ul className="space-y-2">
              {tasks.map((item) => {
                const status = String(item.status || "");
                const canCancel = status !== "cancelled" && status !== "done" && status !== "failed";
                return (
                  <li
                    key={String(item.task_id)}
                    className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{String(item.name || item.task_id)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {taskStatusLabel(status)} · 群 {String(item.group_id ?? "—")}
                      </div>
                    </div>
                    {canCancel ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cancelMutation.mutate(String(item.task_id))}
                      >
                        取消
                      </Button>
                    ) : null}
                  </li>
                );
              })}
              {!tasks.length ? <li className="text-sm text-muted-foreground">当前没有任务。</li> : null}
            </ul>
          </StateBlock>
        </CardContent>
      </Card>
    </div>
  );
}
