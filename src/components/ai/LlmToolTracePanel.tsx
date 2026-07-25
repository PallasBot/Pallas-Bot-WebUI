import { useQuery } from "@tanstack/react-query";
import type {
  LlmHistoryBehaviorAgentTrace,
  LlmHistoryBehaviorAgentTraceToolCall,
  LlmToolTraceUi,
} from "@/api/pallasTypes";
import { fetchLlmRuntimeDebug } from "@/api/console";
import { Badge } from "@/components/ui/badge";

function asTrace(raw: unknown): LlmHistoryBehaviorAgentTrace | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as LlmHistoryBehaviorAgentTrace;
}

function collectCalls(trace: LlmHistoryBehaviorAgentTrace | null | undefined): LlmHistoryBehaviorAgentTraceToolCall[] {
  if (!trace) return [];
  const out: LlmHistoryBehaviorAgentTraceToolCall[] = [];
  for (const round of trace.rounds || []) {
    if (Array.isArray(round.calls) && round.calls.length) {
      out.push(...round.calls);
      continue;
    }
    for (const name of round.tool_calls || []) {
      const tool = String(name || "").trim();
      if (tool) out.push({ tool });
    }
  }
  for (const stage of trace.stages || []) {
    if (Array.isArray(stage.tool_calls)) out.push(...stage.tool_calls);
  }
  return out;
}

function ToolCallRow({ call }: { call: LlmHistoryBehaviorAgentTraceToolCall }) {
  const ok = call.ok !== false;
  return (
    <li className="rounded-[var(--radius-control,8px)] border p-2.5 text-left">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 truncate font-mono text-xs font-medium" title={call.tool}>
          {call.tool || "—"}
        </div>
        <Badge variant={ok ? "success" : "destructive"} className="shrink-0">
          {ok ? "ok" : "失败"}
        </Badge>
      </div>
      {(call.args_keys || []).length ? (
        <div className="mt-1 text-[11px] text-muted-foreground">参数：{(call.args_keys || []).join(", ")}</div>
      ) : null}
      {call.error ? <div className="mt-1 text-[11px] text-destructive">{call.error}</div> : null}
      {call.result_preview ? (
        <p className="mt-1.5 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">
          {call.result_preview}
        </p>
      ) : null}
    </li>
  );
}

function TraceBody({
  toolTrace,
  agentTrace,
}: {
  toolTrace?: LlmToolTraceUi | null;
  agentTrace?: LlmHistoryBehaviorAgentTrace | null;
}) {
  const trace = agentTrace || toolTrace?.agent_trace || null;
  const names = toolTrace?.tool_names?.length
    ? toolTrace.tool_names
    : trace?.tool_names || [];
  const schemaCount = toolTrace?.tool_schema_count ?? trace?.tool_schema_count ?? names.length;
  const callCount = toolTrace?.tool_call_count ?? trace?.tool_call_count ?? 0;
  const calls = collectCalls(trace);
  const selective = Boolean(
    toolTrace?.selection &&
      typeof toolTrace.selection === "object" &&
      (toolTrace.selection as { selective_enabled?: boolean }).selective_enabled,
  );

  return (
    <div className="space-y-2 text-left">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          下发 <span className="tabular-nums text-foreground">{schemaCount}</span> 个 schema
        </span>
        <span aria-hidden>·</span>
        <span>
          调用 <span className="tabular-nums text-foreground">{callCount}</span> 次
        </span>
        {selective ? (
          <>
            <span aria-hidden>·</span>
            <span>选择性领域</span>
          </>
        ) : null}
        {trace?.status ? (
          <>
            <span aria-hidden>·</span>
            <span>{trace.status}</span>
          </>
        ) : null}
      </div>
      {names.length ? (
        <div className="flex flex-wrap gap-1">
          {names.map((name) => (
            <Badge key={name} variant="outline" className="font-mono text-[10px] font-normal">
              {name}
            </Badge>
          ))}
        </div>
      ) : null}
      {calls.length ? (
        <ul className="flex flex-col gap-2" aria-label="工具调用明细">
          {calls.map((call, idx) => (
            <ToolCallRow key={`${call.tool}-${idx}`} call={call} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          {schemaCount > 0 ? "本轮已下发工具 schema，但模型未发起调用。" : "本轮未下发工具。"}
        </p>
      )}
    </div>
  );
}

export default function LlmToolTracePanel({
  agentTrace,
  requestId,
  fetchDebug = false,
}: {
  agentTrace?: LlmHistoryBehaviorAgentTrace | null;
  requestId?: string | null;
  /** 有 requestId 时拉取 runtime-debug，补齐 catalog / tool_trace */
  fetchDebug?: boolean;
}) {
  const rid = (requestId || "").trim();
  const debugQ = useQuery({
    queryKey: ["llm-runtime-debug-tool-trace", rid],
    queryFn: () => fetchLlmRuntimeDebug(rid),
    enabled: Boolean(fetchDebug && rid),
    retry: false,
  });

  const inline = asTrace(agentTrace);
  const fromDebug = (debugQ.data?.tool_trace as LlmToolTraceUi | undefined) || null;
  const debugTrace = asTrace(debugQ.data?.trace) || fromDebug?.agent_trace || null;
  const hasInline = Boolean(
    inline &&
      ((inline.tool_call_count ?? 0) > 0 ||
        (inline.tool_schema_count ?? 0) > 0 ||
        (inline.tool_names || []).length > 0 ||
        (inline.rounds || []).length > 0),
  );

  if (!hasInline && !rid) {
    return <p className="text-xs text-muted-foreground">本轮无工具轨迹。</p>;
  }

  if (!hasInline && rid && debugQ.isLoading) {
    return <p className="text-xs text-muted-foreground">加载工具轨迹…</p>;
  }

  if (!hasInline && rid && debugQ.isError && !fromDebug && !debugTrace) {
    return <p className="text-xs text-muted-foreground">未找到 runtime debug 记录（可能已滚动清理）。</p>;
  }

  if (!hasInline && !fromDebug && !debugTrace) {
    return <p className="text-xs text-muted-foreground">本轮无工具轨迹。</p>;
  }

  return (
    <div className="space-y-2">
      {debugQ.isFetching ? <p className="text-[11px] text-muted-foreground">正在补齐 runtime debug…</p> : null}
      <TraceBody toolTrace={fromDebug} agentTrace={inline || debugTrace} />
    </div>
  );
}
