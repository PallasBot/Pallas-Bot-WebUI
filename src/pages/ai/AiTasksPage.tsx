import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelAgentTask, fetchAgentPlatformOverview, fetchAgentTasks } from "@/api/agentPlatformApi";
import { useRegisterAiObservationChrome } from "@/components/ai/AiObservationChromeContext";
import {
  parseScopeBotId,
  parseScopeGroupId,
  useAiObservationScope,
} from "@/components/ai/AiObservationScopeContext";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type TaskFilter = "open" | "closed" | "all";

function truncateText(raw: string, max = 72): string {
  const text = raw.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function taskStatusLabel(raw: unknown): string {
  const status = String(raw || "");
  if (status === "pending") return "等待中";
  if (status === "running") return "进行中";
  if (status === "done") return "已完成";
  if (status === "cancelled") return "已取消";
  if (status === "failed") return "失败";
  return status || "—";
}

function isOpenTask(status: string): boolean {
  return status === "pending" || status === "running";
}

function taskNameLabel(name: string): string {
  if (name === "once") return "一次性";
  if (name === "research") return "调研";
  if (name === "remind") return "提醒";
  return name || "任务";
}

function taskPayloadSummary(item: Record<string, unknown>): string {
  const payload = item.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const bag = payload as Record<string, unknown>;
    for (const key of ["text", "query", "message", "content", "prompt"]) {
      const value = bag[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  const name = String(item.name || "").trim();
  return name ? taskNameLabel(name) : String(item.task_id || "任务");
}

export default function AiTasksPage() {
  const qc = useQueryClient();
  const { botId, groupId } = useAiObservationScope();
  const scopeBot = parseScopeBotId(botId);
  const scopeGroup = parseScopeGroupId(groupId);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("open");
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

  const taskCounts = useMemo(() => {
    let open = 0;
    let closed = 0;
    for (const item of tasks) {
      if (isOpenTask(String(item.status || ""))) open += 1;
      else closed += 1;
    }
    return { open, closed, all: tasks.length };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (taskFilter === "all") return tasks;
    if (taskFilter === "open") return tasks.filter((item) => isOpenTask(String(item.status || "")));
    return tasks.filter((item) => !isOpenTask(String(item.status || "")));
  }, [taskFilter, tasks]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">范围摘要</CardTitle>
          <CardDescription>按顶栏 Bot / 群汇总观察、任务与口癖。</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={overviewQuery.isLoading} error={overviewQuery.error}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(
                [
                  ["待整理观察", overview?.observation_queue_size],
                  ["工具数", overview?.tool_count],
                  ["任务总数", overview?.task_count],
                  ["未完成", overview?.open_tasks],
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">提醒与任务</CardTitle>
              <CardDescription>提醒与异步任务，结果只投到对应群。</CardDescription>
            </div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["open", `未完成 ${taskCounts.open}`],
                  ["closed", `已结束 ${taskCounts.closed}`],
                  ["all", `全部 ${taskCounts.all}`],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={taskFilter === key ? "secondary" : "ghost"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setTaskFilter(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <StateBlock loading={tasksQuery.isLoading} error={tasksQuery.error}>
            <ul className="max-h-[min(22rem,50vh)] divide-y overflow-y-auto overscroll-contain rounded-md border">
              {filteredTasks.map((item) => {
                const status = String(item.status || "");
                const summary = taskPayloadSummary(item);
                const canCancel = isOpenTask(status);
                return (
                  <li
                    key={String(item.task_id)}
                    className="flex flex-col gap-1.5 px-2.5 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium leading-snug" title={summary}>
                        {truncateText(summary, 80)}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Badge
                          variant={isOpenTask(status) ? "default" : "outline"}
                          className="h-5 px-1.5 text-[10px]"
                        >
                          {taskStatusLabel(status)}
                        </Badge>
                        <span>{taskNameLabel(String(item.name || ""))}</span>
                        <span>群 {String(item.group_id ?? "—")}</span>
                      </div>
                    </div>
                    {canCancel ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 px-2"
                        disabled={cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate(String(item.task_id))}
                      >
                        取消
                      </Button>
                    ) : null}
                  </li>
                );
              })}
              {!filteredTasks.length ? (
                <li className="px-2.5 py-3 text-sm text-muted-foreground">
                  {taskFilter === "open" ? "当前没有未完成任务。" : "当前筛选下没有任务。"}
                </li>
              ) : null}
            </ul>
          </StateBlock>
        </CardContent>
      </Card>
    </div>
  );
}
