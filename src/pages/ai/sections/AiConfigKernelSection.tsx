import { useMemo, useState } from "react";
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
import { Trash2 } from "lucide-react";
import { useRegisterAiConfigChrome } from "@/components/ai/AiConfigChromeContext";
import AiConfigSectionCard from "@/components/ai/AiConfigSectionCard";
import SegTabs from "@/components/SegTabs";
import StateBlock from "@/components/StateBlock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { preserveShellMainScroll } from "@/utils/preserveShellScroll";
import { pushConsoleToast } from "@/utils/consoleToast";

function notifyOk(message: string) {
  pushConsoleToast(message, "ok");
}

function notifyErr(message: string) {
  pushConsoleToast(message || "操作失败", "err");
}

type Panel = "status" | "traces" | "memory" | "notes";

const PANEL_OPTIONS = [
  { value: "status", label: "状态" },
  { value: "traces", label: "轨迹" },
  { value: "memory", label: "记忆" },
  { value: "notes", label: "关系笔记" },
];

export default function AiConfigKernelSection() {
  const qc = useQueryClient();
  const [panel, setPanel] = useState<Panel>("status");
  const [botId, setBotId] = useState("0");
  const [groupId, setGroupId] = useState("");
  const [query, setQuery] = useState("");

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
      notifyOk("记忆已删除");
      await qc.invalidateQueries({ queryKey: ["conversation-kernel-memory"] });
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  const delNoteMut = useMutation({
    mutationFn: (id: number) => postConversationKernelRelationshipNoteDelete({ id, botId: bot }),
    onSuccess: async () => {
      notifyOk("关系笔记已删除");
      await qc.invalidateQueries({ queryKey: ["conversation-kernel-notes"] });
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  const chromeMiddle = useMemo(
    () => (
      <SegTabs
        size="toolbar"
        ariaLabel="会话状态分区"
        value={panel}
        onValueChange={(v) => {
          preserveShellMainScroll(() => setPanel(v as Panel));
        }}
        options={PANEL_OPTIONS}
      />
    ),
    [panel],
  );

  useRegisterAiConfigChrome({ middle: chromeMiddle });

  const panelMeta = PANEL_OPTIONS.find((p) => p.value === panel) || PANEL_OPTIONS[0];

  return (
    <AiConfigSectionCard title={panelMeta.label} contentClassName="space-y-3">
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

        {panel === "status" ? (
          <StateBlock loading={statusQ.isLoading} error={statusQ.error}>
            <pre className="max-h-32 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
              {JSON.stringify(statusQ.data, null, 2)}
            </pre>
          </StateBlock>
        ) : null}

        {panel === "traces" ? (
          <StateBlock loading={tracesQ.isLoading} error={tracesQ.error} empty={!tracesQ.data?.items?.length}>
            <pre className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
              {JSON.stringify(tracesQ.data?.items || [], null, 2)}
            </pre>
          </StateBlock>
        ) : null}

        {panel === "memory" ? (
          <StateBlock loading={memoryQ.isLoading} error={memoryQ.error} empty={bot <= 0} emptyText="请填写 Bot QQ。">
            {(memoryQ.data?.items || []).map((row, i) => {
              const id = Number(row.id);
              return (
                <div key={i} className="flex items-start justify-between gap-2 rounded-md border p-2 text-xs">
                  <pre className="min-w-0 flex-1 overflow-auto">{JSON.stringify(row, null, 2)}</pre>
                  {Number.isFinite(id) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      icon={Trash2}
                      disabled={delMemoryMut.isPending}
                      onClick={() => {
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
        ) : null}

        {panel === "notes" ? (
          <StateBlock loading={notesQ.isLoading} error={notesQ.error} empty={bot <= 0} emptyText="请填写 Bot QQ。">
            {(notesQ.data?.items || []).map((row, i) => {
              const id = Number(row.id);
              return (
                <div key={i} className="flex items-start justify-between gap-2 rounded-md border p-2 text-xs">
                  <pre className="min-w-0 flex-1 overflow-auto">{JSON.stringify(row, null, 2)}</pre>
                  {Number.isFinite(id) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      icon={Trash2}
                      disabled={delNoteMut.isPending}
                      onClick={() => {
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
        ) : null}
    </AiConfigSectionCard>
  );
}
