import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchConversationKernelMemory,
  fetchConversationKernelRelationshipNotes,
  fetchConversationKernelStatus,
  fetchConversationKernelTraces,
  postConversationKernelMemoryDelete,
  postConversationKernelRelationshipNoteDelete,
} from "@/api/console";
import StateBlock from "@/components/StateBlock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function AiConfigKernelSection() {
  const qc = useQueryClient();
  const [botId, setBotId] = useState("0");
  const [groupId, setGroupId] = useState("");
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const bot = Number(botId) || 0;
  const group = groupId.trim() ? Number(groupId) : null;

  const statusQ = useQuery({ queryKey: ["conversation-kernel-status"], queryFn: fetchConversationKernelStatus });
  const tracesQ = useQuery({
    queryKey: ["conversation-kernel-traces", bot, group],
    queryFn: () => fetchConversationKernelTraces({ botId: bot || null, groupId: group, limit: 30 }),
  });
  const memoryQ = useQuery({
    queryKey: ["conversation-kernel-memory", bot, group, query],
    queryFn: () => fetchConversationKernelMemory({ botId: bot, groupId: group, query, limit: 40 }),
    enabled: bot > 0,
  });
  const notesQ = useQuery({
    queryKey: ["conversation-kernel-notes", bot, group, query],
    queryFn: () => fetchConversationKernelRelationshipNotes({ botId: bot, groupId: group, query, limit: 40 }),
    enabled: bot > 0,
  });

  const delMemoryMut = useMutation({
    mutationFn: (id: number) => postConversationKernelMemoryDelete({ id, botId: bot }),
    onSuccess: async () => {
      setMsg("记忆已删除");
      await qc.invalidateQueries({ queryKey: ["conversation-kernel-memory"] });
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const delNoteMut = useMutation({
    mutationFn: (id: number) => postConversationKernelRelationshipNoteDelete({ id, botId: bot }),
    onSuccess: async () => {
      setMsg("关系笔记已删除");
      await qc.invalidateQueries({ queryKey: ["conversation-kernel-notes"] });
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  return (
    <div className="space-y-4">
      {msg ? <p className={cn("text-sm", msg.includes("已删除") ? "text-emerald-400" : "text-destructive")}>{msg}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>会话内核</CardTitle>
          <CardDescription>status / traces / memory / relationship-notes；用顶部工具条刷新。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">bot_id</span>
              <Input value={botId} onChange={(e) => setBotId(e.target.value)} />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">group_id（可选）</span>
              <Input value={groupId} onChange={(e) => setGroupId(e.target.value)} />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">搜索</span>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="memory / notes" />
            </label>
          </div>
          <StateBlock loading={statusQ.isLoading} error={statusQ.error}>
            <pre className="max-h-32 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
              {JSON.stringify(statusQ.data, null, 2)}
            </pre>
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>决策轨迹</CardTitle>
          <CardDescription>traces</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={tracesQ.isLoading} error={tracesQ.error} empty={!tracesQ.data?.items?.length}>
            <pre className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
              {JSON.stringify(tracesQ.data?.items || [], null, 2)}
            </pre>
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>记忆</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <StateBlock loading={memoryQ.isLoading} error={memoryQ.error} empty={bot <= 0} emptyText="请填写 bot_id">
            {(memoryQ.data?.items || []).map((row, i) => {
              const id = Number(row.id);
              return (
                <div key={i} className="flex items-start justify-between gap-2 rounded-md border p-2 text-xs">
                  <pre className="min-w-0 flex-1 overflow-auto">{JSON.stringify(row, null, 2)}</pre>
                  {Number.isFinite(id) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={delMemoryMut.isPending}
                      onClick={() => {
                        setMsg(null);
                        void delMemoryMut.mutateAsync(id);
                      }}
                    >
                      删除
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>关系笔记</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <StateBlock loading={notesQ.isLoading} error={notesQ.error} empty={bot <= 0} emptyText="请填写 bot_id">
            {(notesQ.data?.items || []).map((row, i) => {
              const id = Number(row.id);
              return (
                <div key={i} className="flex items-start justify-between gap-2 rounded-md border p-2 text-xs">
                  <pre className="min-w-0 flex-1 overflow-auto">{JSON.stringify(row, null, 2)}</pre>
                  {Number.isFinite(id) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={delNoteMut.isPending}
                      onClick={() => {
                        setMsg(null);
                        void delNoteMut.mutateAsync(id);
                      }}
                    >
                      删除
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </StateBlock>
        </CardContent>
      </Card>
    </div>
  );
}
