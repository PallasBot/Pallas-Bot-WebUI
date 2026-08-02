import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  ConversationKernelKnowledgeSource,
  KnowledgeSourceDetail,
  KnowledgeSourceRetrieveData,
} from "@/api/pallasTypes";
import { Search } from "lucide-react";
import {
  fetchConversationKernelKnowledgeSourceDetail,
  postConversationKernelKnowledgeSourceRetrieve,
} from "@/api/console";
import { axiosErrorDetail } from "@/api/http";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StateBlock from "@/components/StateBlock";

const ORIGIN_LABEL: Record<string, string> = {
  builtin: "内置",
  plugin: "插件",
};

const SCOPE_LABEL: Record<string, string> = {
  global: "全局",
  group: "群",
  user: "用户",
};

const RETRIEVAL_LABEL: Record<string, string> = {
  prompt_inject: "注入提示",
  metadata_only: "仅元数据",
  tool_only: "工具调用",
  tool: "工具调用",
};

function labelOf(map: Record<string, string>, raw: string | undefined, fallback = "—") {
  const key = (raw || "").trim();
  if (!key) return fallback;
  return map[key] || key;
}

function asSource(row: Record<string, unknown> | ConversationKernelKnowledgeSource): ConversationKernelKnowledgeSource {
  return {
    source_id: String(row.source_id || ""),
    title: String(row.title || row.source_id || "未命名"),
    description: row.description != null ? String(row.description) : undefined,
    scope: row.scope != null ? String(row.scope) : undefined,
    retrieval_mode: row.retrieval_mode != null ? String(row.retrieval_mode) : undefined,
    origin: row.origin != null ? String(row.origin) : undefined,
    plugin_name: row.plugin_name != null ? String(row.plugin_name) : undefined,
    plugin_title: row.plugin_title != null ? String(row.plugin_title) : undefined,
    default: Boolean(row.default),
    chunk_count: typeof row.chunk_count === "number" ? row.chunk_count : Number(row.chunk_count) || 0,
  };
}

function OriginBadge({ origin }: { origin?: string }) {
  const key = (origin || "").trim();
  return <Badge variant={key === "builtin" ? "secondary" : "outline"}>{labelOf(ORIGIN_LABEL, key)}</Badge>;
}

function KnowledgeSourceProbe({
  sourceId,
  defaultTopK,
}: {
  sourceId: string;
  defaultTopK?: number;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<KnowledgeSourceRetrieveData | null>(null);

  useEffect(() => {
    setQuery("");
    setResult(null);
  }, [sourceId]);

  const probeM = useMutation({
    mutationFn: () =>
      postConversationKernelKnowledgeSourceRetrieve({
        query: query.trim(),
        sourceId,
        topK: defaultTopK,
      }),
    onSuccess: (data) => setResult(data),
  });

  const hits = result?.items || [];

  return (
    <div className="space-y-2 border-t pt-4">
      <div className="text-sm font-medium">检索试探</div>
      <p className="text-xs text-muted-foreground">
        用与线上一致的检索逻辑打分；受 min_score / top_k 影响。
      </p>
      <form
        className="flex flex-col gap-2 max-[560px]:gap-2 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          if (!query.trim() || probeM.isPending) return;
          probeM.mutate();
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入试探问句，例如：怎么清空会话"
          className="min-w-0 flex-1"
        />
        <Button
          type="submit"
          size="sm"
          className="shrink-0"
          icon={Search}
          disabled={!query.trim() || probeM.isPending}
        >
          {probeM.isPending ? "检索中…" : "试探"}
        </Button>
      </form>
      {probeM.isError ? (
        <p className="text-xs text-destructive">{axiosErrorDetail(probeM.error)}</p>
      ) : null}
      {result ? (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            {result.enabled === false ? (
              <span>通用语料检索当前未启用。</span>
            ) : (
              <>
                命中 <span className="tabular-nums text-foreground">{result.count ?? hits.length}</span> 条
                {result.min_score != null && result.min_score > 0 ? (
                  <>
                    {" "}
                    · min_score <span className="tabular-nums">{result.min_score}</span>
                  </>
                ) : null}
              </>
            )}
          </div>
          {hits.length ? (
            <ul className="flex flex-col gap-2" aria-label="检索命中">
              {hits.map((hit, idx) => (
                <li
                  key={`${hit.source_id}-${hit.title}-${idx}`}
                  className="rounded-[var(--radius-control,8px)] border p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 font-medium">{hit.title || "未命名"}</div>
                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                      {hit.score ?? 0}
                    </Badge>
                  </div>
                  {hit.content ? (
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {hit.content}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : result.enabled !== false ? (
            <p className="text-sm text-muted-foreground">无命中。</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function KnowledgeSourceDetailBody({ detail }: { detail: KnowledgeSourceDetail }) {
  const chunks = detail.chunks_preview || [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <OriginBadge origin={detail.origin} />
        <span aria-hidden>·</span>
        <span className="font-mono">{detail.source_id}</span>
        <span aria-hidden>·</span>
        <span>{detail.plugin_title || detail.plugin_name || "—"}</span>
        <span aria-hidden>·</span>
        <span>{labelOf(SCOPE_LABEL, detail.scope)}</span>
        <span aria-hidden>·</span>
        <span>{labelOf(RETRIEVAL_LABEL, detail.retrieval_mode)}</span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">top_k {detail.top_k ?? "—"}</span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">截断 {detail.max_chunk_len ?? "—"}</span>
      </div>
      {detail.description ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{detail.description}</p>
      ) : null}

      <KnowledgeSourceProbe sourceId={detail.source_id} defaultTopK={detail.top_k} />

      <div className="space-y-2 border-t pt-4">
        <div className="text-sm text-muted-foreground">
          共 <span className="tabular-nums text-foreground">{detail.chunk_count ?? 0}</span> 条
          {chunks.length ? (
            <>
              ，预览前 <span className="tabular-nums text-foreground">{chunks.length}</span> 条
            </>
          ) : null}
          {detail.chunks_preview_truncated ? "（已截断）" : null}
        </div>
        {chunks.length ? (
          <ul className="flex flex-col gap-2.5" aria-label="语料条目预览">
            {chunks.map((chunk) => (
              <li
                key={`${chunk.index}-${chunk.title || ""}`}
                className="rounded-[var(--radius-control,8px)] border p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 font-medium">
                    {chunk.title?.trim() || `条目 ${(chunk.index ?? 0) + 1}`}
                  </div>
                  <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
                    {chunk.content_len ?? 0} 字
                  </span>
                </div>
                {chunk.keywords ? (
                  <div className="mt-1 text-[11px] text-muted-foreground">关键词：{chunk.keywords}</div>
                ) : null}
                {chunk.content_preview ? (
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                    {chunk.content_preview}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">该语料源暂无条目。</p>
        )}
      </div>
    </div>
  );
}

export default function KnowledgeSourcesTable({
  items,
}: {
  items: Array<Record<string, unknown> | ConversationKernelKnowledgeSource>;
}) {
  const rows = items.map(asSource).filter((row) => row.source_id);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const detailQ = useQuery({
    queryKey: ["conversation-kernel-knowledge-source-detail", selectedId],
    queryFn: () => fetchConversationKernelKnowledgeSourceDetail(selectedId!),
    enabled: Boolean(selectedId),
  });

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        共 <span className="tabular-nums text-foreground">{rows.length}</span> 个已登记语料源
        <span className="ml-1 text-xs">· 点击查看条目预览与检索试探</span>
      </div>

      <ul className="hidden max-[560px]:flex max-[560px]:flex-col max-[560px]:gap-2.5" aria-label="语料源列表">
        {rows.map((row) => (
          <li key={row.source_id}>
            <button
              type="button"
              className="w-full rounded-[var(--radius-control,8px)] border p-3 text-left transition-colors hover:bg-muted/40"
              onClick={() => setSelectedId(row.source_id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{row.title}</div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={row.source_id}>
                    {row.source_id}
                  </div>
                </div>
                <OriginBadge origin={row.origin} />
              </div>
              {row.description ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{row.description}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{row.plugin_title || row.plugin_name || "—"}</span>
                <span aria-hidden>·</span>
                <span>{labelOf(SCOPE_LABEL, row.scope)}</span>
                <span aria-hidden>·</span>
                <span>{labelOf(RETRIEVAL_LABEL, row.retrieval_mode)}</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{row.chunk_count ?? 0} 条</span>
                {row.default ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="text-emerald-500">默认</span>
                  </>
                ) : null}
              </div>
            </button>
          </li>
        ))}
      </ul>

      <div className="max-[560px]:hidden">
        <Table className="min-w-[40rem]">
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>插件</TableHead>
              <TableHead>作用域</TableHead>
              <TableHead>检索</TableHead>
              <TableHead className="text-right">条目</TableHead>
              <TableHead>默认</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.source_id}
                className="cursor-pointer"
                onClick={() => setSelectedId(row.source_id)}
              >
                <TableCell className="max-w-[12rem]">
                  <div className="truncate font-medium" title={row.title}>
                    {row.title}
                  </div>
                  {row.description ? (
                    <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground" title={row.description}>
                      {row.description}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-[10rem]">
                  <span className="block truncate font-mono text-xs text-muted-foreground" title={row.source_id}>
                    {row.source_id}
                  </span>
                </TableCell>
                <TableCell>
                  <OriginBadge origin={row.origin} />
                </TableCell>
                <TableCell className="max-w-[8rem]">
                  <span className="block truncate" title={row.plugin_title || row.plugin_name || undefined}>
                    {row.plugin_title || row.plugin_name || "—"}
                  </span>
                </TableCell>
                <TableCell>{labelOf(SCOPE_LABEL, row.scope)}</TableCell>
                <TableCell>{labelOf(RETRIEVAL_LABEL, row.retrieval_mode)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.chunk_count ?? 0}</TableCell>
                <TableCell>
                  {row.default ? <Badge variant="success">是</Badge> : <span className="text-muted-foreground">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(selectedId)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="flex max-h-[min(860px,calc(100dvh-32px))] w-[min(640px,calc(100vw-32px))] max-w-[min(640px,calc(100vw-32px))] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-4 py-3 pr-12 text-left sm:px-5">
            <DialogTitle className="truncate">
              {detailQ.data?.title || selectedId || "语料源详情"}
            </DialogTitle>
            <DialogDescription className="truncate font-mono text-xs">
              {selectedId}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <StateBlock
              loading={detailQ.isLoading}
              error={detailQ.error}
              empty={!detailQ.isLoading && !detailQ.data}
              emptyText="未找到该语料源。"
            >
              {detailQ.data ? <KnowledgeSourceDetailBody detail={detailQ.data} /> : null}
            </StateBlock>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
