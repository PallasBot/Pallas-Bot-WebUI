import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { fetchAiExtensionLogs, openAiExtensionLogsEventSource } from "@/api/console";
import { AI_EXTENSION_LOG_KINDS, AI_LOG_DEFAULTS, type AiExtensionLogKind } from "@/config/aiConstants";
import StateBlock from "@/components/StateBlock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AiConfigLogsSection() {
  const [kind, setKind] = useState<AiExtensionLogKind>("uvicorn");
  const [lines, setLines] = useState<number>(AI_LOG_DEFAULTS.lines);
  const [live, setLive] = useState(false);
  const [liveLines, setLiveLines] = useState<string[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const logsQ = useQuery({
    queryKey: ["ai-extension-logs", kind, lines],
    queryFn: () => fetchAiExtensionLogs(kind, lines),
    enabled: !live,
  });

  useEffect(() => {
    if (!live) {
      esRef.current?.close();
      esRef.current = null;
      return;
    }
    setLiveLines([]);
    const es = openAiExtensionLogsEventSource(kind);
    esRef.current = es;
    es.onmessage = (ev) => {
      if (!ev.data) return;
      try {
        const payload = JSON.parse(ev.data) as { line?: string; message?: string };
        const line = payload.line || payload.message;
        if (line) setLiveLines((prev) => [...prev.slice(-1999), line]);
      } catch {
        setLiveLines((prev) => [...prev.slice(-1999), ev.data]);
      }
    };
    return () => es.close();
  }, [live, kind]);

  const displayLines = live ? liveLines : logsQ.data?.lines || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>扩展日志</CardTitle>
          <CardDescription>fetch + SSE stream</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (live) setLive(false);
            else void logsQ.refetch();
          }}
        >
          <RefreshCw className={logsQ.isFetching ? "animate-spin" : undefined} />
          刷新
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {AI_EXTENSION_LOG_KINDS.map((k) => (
            <Button
              key={k.id}
              size="sm"
              variant={kind === k.id ? "default" : "outline"}
              onClick={() => setKind(k.id)}
            >
              {k.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={lines}
            onChange={(e) => setLines(Number(e.target.value))}
            disabled={live}
          >
            {AI_LOG_DEFAULTS.lineOptions.map((n) => (
              <option key={n} value={n}>
                {n} 行
              </option>
            ))}
          </select>
          <Button size="sm" variant={live ? "default" : "outline"} onClick={() => setLive((v) => !v)}>
            {live ? "停止 SSE" : "实时 SSE"}
          </Button>
        </div>
        <StateBlock loading={!live && logsQ.isLoading} error={!live ? logsQ.error : undefined} empty={!displayLines.length}>
          <p className="text-xs text-muted-foreground">{live ? "SSE" : logsQ.data?.path || "—"}</p>
          <pre className="max-h-[28rem] overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
            {displayLines.join("\n") || "（空）"}
          </pre>
        </StateBlock>
      </CardContent>
    </Card>
  );
}
