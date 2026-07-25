import type { LlmToolCatalogItem, LlmToolCatalogPolicy } from "@/api/pallasTypes";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const SOURCE_LABEL: Record<string, string> = {
  builtin: "内置",
  plugin_command: "插件命令",
  mcp: "MCP",
};

const CAPABILITY_LABEL: Record<string, string> = {
  read_only: "只读",
  side_effecting: "有副作用",
  requires_group_context: "需群上下文",
};

const DISABLED_REASON_LABEL: Record<string, string> = {
  tools_disabled: "总开关关闭",
  blacklisted: "黑名单",
  arknights_kb_disabled: "方舟知识库关闭",
  plugin_not_in_process: "本进程未加载（Worker 侧可用）",
};

function labelOf(map: Record<string, string>, raw: string | undefined, fallback = "—") {
  const key = (raw || "").trim();
  if (!key) return fallback;
  return map[key] || key;
}

function asTool(row: Record<string, unknown> | LlmToolCatalogItem): LlmToolCatalogItem {
  return {
    name: String(row.name || ""),
    description: row.description != null ? String(row.description) : undefined,
    source: row.source != null ? String(row.source) : undefined,
    domains: Array.isArray(row.domains) ? row.domains.map((d) => String(d)) : [],
    capabilities: Array.isArray(row.capabilities) ? row.capabilities.map((c) => String(c)) : [],
    command_id: row.command_id != null ? String(row.command_id) : undefined,
    plugin_name: row.plugin_name != null ? String(row.plugin_name) : undefined,
    provider_name: row.provider_name != null ? String(row.provider_name) : undefined,
    mcp_server_id: row.mcp_server_id != null ? String(row.mcp_server_id) : undefined,
    eligible: Boolean(row.eligible),
    disabled_reason: row.disabled_reason != null ? String(row.disabled_reason) : null,
  };
}

function SourceBadge({ source }: { source?: string }) {
  const key = (source || "").trim();
  return <Badge variant={key === "builtin" ? "secondary" : "outline"}>{labelOf(SOURCE_LABEL, key)}</Badge>;
}

function PolicySummary({ policy }: { policy?: LlmToolCatalogPolicy | null }) {
  if (!policy) return null;
  const bits = [
    policy.tools_enabled ? "工具已启用" : "工具已关闭",
    policy.selective_enabled ? "按领域筛选" : "全量暴露",
    `最多 ${policy.max_rounds ?? "—"} 轮`,
    policy.arknights_kb_enabled ? "方舟知识库开" : "方舟知识库关",
  ];
  if ((policy.blacklist || []).length) {
    bits.push(`黑名单 ${policy.blacklist!.length} 项`);
  }
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      {bits.join(" · ")}
      {policy.selective_enabled ? (
        <span className="mt-1 block">选择性模式下，闲聊仅在文本命中领域时下发对应工具（如方舟资料）。</span>
      ) : null}
    </p>
  );
}

export default function LlmToolsTable({
  items,
  policy,
}: {
  items: Array<Record<string, unknown> | LlmToolCatalogItem>;
  policy?: LlmToolCatalogPolicy | null;
}) {
  const rows = items.map(asTool).filter((row) => row.name);
  const eligibleCount = rows.filter((row) => row.eligible).length;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="text-sm text-muted-foreground">
          共 <span className="tabular-nums text-foreground">{rows.length}</span> 个已注册工具
          {rows.length ? (
            <>
              ，其中 <span className="tabular-nums text-foreground">{eligibleCount}</span> 个当前可调用
            </>
          ) : null}
        </div>
        <PolicySummary policy={policy} />
      </div>

      <ul className="hidden max-[560px]:flex max-[560px]:flex-col max-[560px]:gap-2.5" aria-label="工具列表">
        {rows.map((row) => (
          <li key={row.name} className="rounded-[var(--radius-control,8px)] border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-mono text-sm font-medium" title={row.name}>
                  {row.name}
                </div>
                {row.description ? (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{row.description}</p>
                ) : null}
              </div>
              <SourceBadge source={row.source} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{(row.domains || []).join(", ") || "—"}</span>
              <span aria-hidden>·</span>
              <span>
                {(row.capabilities || []).map((c) => labelOf(CAPABILITY_LABEL, c, c)).join(" / ") || "—"}
              </span>
              <span aria-hidden>·</span>
              {row.eligible ? (
                <span className="text-emerald-500">可调用</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  {labelOf(DISABLED_REASON_LABEL, row.disabled_reason || undefined, "不可用")}
                </span>
              )}
            </div>
            {row.plugin_name || row.mcp_server_id || row.command_id ? (
              <div className="mt-1.5 truncate text-[11px] text-muted-foreground">
                {[row.plugin_name, row.mcp_server_id, row.command_id].filter(Boolean).join(" · ")}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="max-[560px]:hidden">
        <Table className="min-w-[44rem]">
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>领域</TableHead>
              <TableHead>能力</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.name}>
                <TableCell className="max-w-[18rem]">
                  <div className="truncate font-mono text-sm font-medium" title={row.name}>
                    {row.name}
                  </div>
                  {row.description ? (
                    <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground" title={row.description}>
                      {row.description}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <SourceBadge source={row.source} />
                </TableCell>
                <TableCell className="max-w-[10rem]">
                  <span className="block truncate" title={(row.domains || []).join(", ")}>
                    {(row.domains || []).join(", ") || "—"}
                  </span>
                </TableCell>
                <TableCell className="max-w-[10rem]">
                  <span
                    className="block truncate"
                    title={(row.capabilities || []).map((c) => labelOf(CAPABILITY_LABEL, c, c)).join(", ")}
                  >
                    {(row.capabilities || []).map((c) => labelOf(CAPABILITY_LABEL, c, c)).join(" / ") || "—"}
                  </span>
                </TableCell>
                <TableCell>
                  {row.eligible ? (
                    <Badge variant="success">可调用</Badge>
                  ) : (
                    <Badge variant="outline">
                      {labelOf(DISABLED_REASON_LABEL, row.disabled_reason || undefined, "不可用")}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
