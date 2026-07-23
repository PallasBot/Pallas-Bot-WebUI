import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAiExtensionLogs, openAiExtensionLogsEventSource } from "@/api/console";
import {
  useAiConfigChromeSearch,
  useRegisterAiConfigChrome,
} from "@/components/ai/AiConfigChromeContext";
import { AI_EXTENSION_LOG_KINDS, AI_LOG_DEFAULTS, type AiExtensionLogKind } from "@/config/aiConstants";
import StateBlock from "@/components/StateBlock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AiConfigLogsSection() {
  const { search } = useAiConfigChromeSearch();
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

  const displayLines = useMemo(() => {
    const raw = live ? liveLines : logsQ.data?.lines || [];
    const q = search.trim().toLowerCase();
    if (!q) return raw;
    return raw.filter((line) => line.toLowerCase().includes(q));
  }, [live, liveLines, logsQ.data?.lines, search]);

  const chromeMiddle = useMemo(
    () => (
      <div
        className="console-view-toggle console-view-toggle--toolbar-seg shrink-0"
        role="group"
        aria-label="日志种类"
      >
        {AI_EXTENSION_LOG_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            className={kind === k.id ? "is-on" : undefined}
            onClick={() => setKind(k.id)}
          >
            {k.shortLabel}
          </button>
        ))}
      </div>
    ),
    [kind],
  );

  const chromeRefresh = useCallback(() => {
    if (!live) void logsQ.refetch();
  }, [live, logsQ]);

  useRegisterAiConfigChrome({
    middle: chromeMiddle,
    onRefresh: chromeRefresh,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>拉取选项</CardTitle>
          <CardDescription>种类在顶部工具条切换；搜索框可过滤行。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(lines)} onValueChange={(v) => setLines(Number(v))} disabled={live}>
              <SelectTrigger className="h-9 w-auto min-w-[6.5rem] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_LOG_DEFAULTS.lineOptions.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} 行
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant={live ? "default" : "outline"} onClick={() => setLive((v) => !v)}>
              {live ? "停止 SSE" : "实时 SSE"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>扩展日志</CardTitle>
          <CardDescription>{live ? "SSE 实时" : logsQ.data?.path || "历史拉取"}</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock
            loading={!live && logsQ.isLoading}
            error={!live ? logsQ.error : undefined}
            empty={!displayLines.length}
          >
            <pre className="max-h-[28rem] overflow-auto rounded-[var(--radius-control,8px)] border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
              {displayLines.join("\n") || "（空）"}
            </pre>
          </StateBlock>
        </CardContent>
      </Card>
    </div>
  );
}
