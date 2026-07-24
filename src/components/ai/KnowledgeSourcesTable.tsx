import type { ConversationKernelKnowledgeSource } from "@/api/pallasTypes";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

export default function KnowledgeSourcesTable({
  items,
}: {
  items: Array<Record<string, unknown> | ConversationKernelKnowledgeSource>;
}) {
  const rows = items.map(asSource).filter((row) => row.source_id);

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        共 <span className="tabular-nums text-foreground">{rows.length}</span> 个已登记语料源
      </div>

      {/* 窄屏卡片：避免多列表头与列错位 */}
      <ul className="hidden max-[560px]:flex max-[560px]:flex-col max-[560px]:gap-2.5" aria-label="语料源列表">
        {rows.map((row) => (
          <li key={row.source_id} className="rounded-[var(--radius-control,8px)] border p-3">
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
              <TableRow key={row.source_id}>
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
    </div>
  );
}
