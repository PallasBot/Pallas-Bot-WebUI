import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AudioLines, ScrollText, type LucideIcon } from "lucide-react";
import { fetchAiExtensionLogs, openAiExtensionLogsEventSource } from "@/api/console";
import {
  useAiConfigChromeSearch,
  useRegisterAiConfigChrome,
} from "@/components/ai/AiConfigChromeContext";
import { useRegisterAiObservationChrome } from "@/components/ai/AiObservationChromeContext";
import AiConfigSectionCard from "@/components/ai/AiConfigSectionCard";
import AiSectionHeader from "@/components/ai/AiSectionHeader";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import { CHROME_SELECT_TRIGGER } from "@/components/ChromeTools";
import StateBlock from "@/components/StateBlock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AI_EXTENSION_DOCKER_LOG_MOUNT, AI_EXTENSION_LOG_KINDS, AI_LOG_DEFAULTS, type AiExtensionLogKind } from "@/config/aiConstants";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import { Link } from "react-router-dom";

const LOG_KIND_ICONS: Record<AiExtensionLogKind, LucideIcon> = {
  uvicorn: ScrollText,
  "celery-media": AudioLines,
};

const LOG_KIND_OPTIONS = AI_EXTENSION_LOG_KINDS.map((k) => ({
  value: k.id,
  label: k.shortLabel,
  icon: LOG_KIND_ICONS[k.id],
  lead: k.label,
}));

type ChromeHost = "config" | "observation" | "none";

export default function AiConfigLogsSection({
  chrome = "observation",
}: {
  chrome?: ChromeHost;
}) {
  const configSearch = useAiConfigChromeSearch();
  const [localSearch, setLocalSearch] = useState("");
  const search = chrome === "config" ? configSearch.search : localSearch;

  const [kind, setKind] = useState<AiExtensionLogKind>("uvicorn");
  const [lines, setLines] = useState<number>(AI_LOG_DEFAULTS.lines);
  const [live, setLive] = useState(false);
  const [liveLines, setLiveLines] = useState<string[]>([]);
  const [streamError, setStreamError] = useState("");
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
      setStreamError("");
      return;
    }
    setLiveLines([]);
    setStreamError("");
    const es = openAiExtensionLogsEventSource(kind);
    esRef.current = es;
    es.onmessage = (ev) => {
      if (!ev.data) return;
      try {
        const payload = JSON.parse(ev.data) as {
          type?: string;
          line?: string;
          message?: string;
          error?: string;
        };
        if (payload.type === "error") {
          setStreamError(payload.error || "日志流不可用");
          return;
        }
        const line = payload.line || payload.message;
        if (line) setLiveLines((prev) => [...prev.slice(-1999), line]);
      } catch {
        setLiveLines((prev) => [...prev.slice(-1999), ev.data]);
      }
    };
    es.onerror = () => {
      setStreamError((prev) => prev || "日志流连接中断");
    };
    return () => es.close();
  }, [live, kind]);

  const payloadError = !live ? (logsQ.data?.error || "").trim() : streamError.trim();
  const displayLines = useMemo(() => {
    const raw = live ? liveLines : logsQ.data?.lines || [];
    const q = search.trim().toLowerCase();
    if (!q) return raw;
    return raw.filter((line) => line.toLowerCase().includes(q));
  }, [live, liveLines, logsQ.data?.lines, search]);

  const kindMeta = LOG_KIND_OPTIONS.find((k) => k.value === kind) || LOG_KIND_OPTIONS[0];
  const dockerHintVisible =
    Boolean(payloadError)
    && (payloadError.includes("不存在")
      || payloadError.includes("越界")
      || payloadError.includes("未找到")
      || payloadError.includes("远端")
      || payloadError.includes("路径"));

  const chromeMiddle = useMemo(
    () => (
      <ChromeField label="日志种类" icon={kindMeta.icon}>
        <Select value={kind} onValueChange={(v) => setKind(v as AiExtensionLogKind)}>
          <SelectTrigger className={CHROME_SELECT_TRIGGER}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {LOG_KIND_OPTIONS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                <ChromeOptionLabel icon={item.icon}>{item.label}</ChromeOptionLabel>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ChromeField>
    ),
    [kind, kindMeta.icon],
  );

  const chromeRefresh = useCallback(() => {
    if (!live) void logsQ.refetch();
  }, [live, logsQ]);

  useRegisterAiConfigChrome(
    chrome === "config"
      ? { middle: chromeMiddle, onRefresh: chromeRefresh }
      : {},
  );
  useRegisterAiObservationChrome(
    chrome === "observation"
      ? { middle: chromeMiddle, onRefresh: chromeRefresh }
      : {},
  );

  const queryError = !live ? logsQ.error : undefined;
  const empty = !displayLines.length && !payloadError && !queryError;

  return (
    <AiConfigSectionCard contentClassName="space-y-3">
      <AiSectionHeader icon={kindMeta.icon} title={kindMeta.label} lead={kindMeta.lead} />
      <p className="text-xs text-muted-foreground">
        查看 AI 扩展落盘日志（本机路径或远端回退），便于排查报错与任务失败。路径在{" "}
        <Link
          to={aiConfigSectionPath("media", "service")}
          className="text-primary underline-offset-2 hover:underline"
        >
          AI 配置 · 媒体服务
        </Link>{" "}
        中配置。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {chrome !== "config" ? (
          <Input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="搜索日志…"
            className="h-9 w-auto min-w-[8rem] max-w-[14rem] shrink-0"
          />
        ) : null}
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
          {live ? "停止跟随" : "实时跟随"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {live ? "实时推送中" : logsQ.data?.path || "历史拉取"}
          {logsQ.data?.source ? ` · ${logsQ.data.source === "remote" ? "远端" : "本机"}` : ""}
        </span>
      </div>
      {payloadError ? (
        <p className="text-sm text-destructive">{payloadError}</p>
      ) : null}
      {dockerHintVisible ? (
        <p className="text-xs text-muted-foreground">
          Docker 部署请确认 AI 日志目录已挂到 Bot 的{" "}
          <code className="font-mono">{AI_EXTENSION_DOCKER_LOG_MOUNT}</code>
          ，或在媒体服务填写 Bot 可读路径。
        </p>
      ) : null}
      <StateBlock
        loading={!live && logsQ.isLoading}
        error={queryError}
        empty={empty}
        emptyText="暂无日志记录。"
      >
        <pre className="max-h-[28rem] overflow-auto rounded-[var(--radius-control,8px)] border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
          {displayLines.join("\n") || "（空）"}
        </pre>
      </StateBlock>
    </AiConfigSectionCard>
  );
}
