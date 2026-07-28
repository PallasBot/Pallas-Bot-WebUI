import { Fragment, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { patchLlmToolOverride, previewLlmToolIntent } from "@/api/console";
import type { LlmToolCatalogItem, LlmToolCatalogPolicy, LlmToolOverridePatch } from "@/api/pallasTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SOURCE_LABEL: Record<string, string> = {
  builtin: "内置",
  plugin_command: "插件命令",
  mcp: "MCP",
};

const DISABLED_REASON_LABEL: Record<string, string> = {
  tools_disabled: "总开关关闭",
  blacklisted: "黑名单",
  arknights_kb_disabled: "方舟知识库关闭",
  plugin_not_in_process: "本进程未加载（Worker 侧可用）",
  override_disabled: "已手动停用",
};

/** visible / deferred → 面向维护者的短标签（列表）与完整说明（编辑）。 */
const VISIBILITY_SHORT: Record<string, string> = {
  visible: "相关即带",
  deferred: "触发才带",
};

const VISIBILITY_OPTION_LABEL: Record<string, string> = {
  visible: "话题相关就带上",
  deferred: "说到触发词才带上",
};

function visibilityShort(raw: string | undefined): string {
  const key = (raw || "visible").trim() || "visible";
  return VISIBILITY_SHORT[key] || key;
}

function labelOf(map: Record<string, string>, raw: string | undefined, fallback = "—") {
  const key = (raw || "").trim();
  if (!key) return fallback;
  return map[key] || key;
}

function asTool(row: Record<string, unknown> | LlmToolCatalogItem): LlmToolCatalogItem {
  const overrideRaw = row.override;
  const override =
    overrideRaw && typeof overrideRaw === "object"
      ? (overrideRaw as LlmToolCatalogItem["override"])
      : null;
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
    hints: Array.isArray(row.hints) ? row.hints.map((h) => String(h)) : [],
    effective_hints: Array.isArray(row.effective_hints)
      ? row.effective_hints.map((h) => String(h))
      : [],
    visibility: row.visibility != null ? String(row.visibility) : "visible",
    declared_visibility:
      row.declared_visibility != null ? String(row.declared_visibility) : "visible",
    override,
  };
}

function SourceBadge({ source }: { source?: string }) {
  const key = (source || "").trim();
  return <Badge variant={key === "builtin" ? "secondary" : "outline"}>{labelOf(SOURCE_LABEL, key)}</Badge>;
}

function PolicySummary({ policy }: { policy?: LlmToolCatalogPolicy | null }) {
  if (!policy) return null;
  const mcpRegistered = Number(policy.mcp?.registered_count || 0);
  const mcpErrors = policy.mcp?.errors?.length || 0;
  const bits = [
    policy.tools_enabled ? "工具已启用" : "工具已关闭",
    policy.selective_enabled ? "按意图筛选" : "全量暴露",
    `最多 ${policy.max_rounds ?? "—"} 轮`,
    policy.arknights_kb_enabled ? "方舟知识库开" : "方舟知识库关",
    mcpRegistered || mcpErrors ? `MCP 工具 ${mcpRegistered}${mcpErrors ? `（失败 ${mcpErrors}）` : ""}` : null,
  ].filter(Boolean);
  if ((policy.blacklist || []).length) {
    bits.push(`黑名单 ${policy.blacklist!.length} 项`);
  }
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      {bits.join(" · ")}
      <span className="mt-1 block">
        策略开关在「对话 · 策略」修改；MCP 服务器在本页上方配置。下方可预览口语会带上哪些工具，也可覆盖单工具的触发说法。
      </span>
      <span className="mt-1 block">
        「相关即带」：话题沾边就把工具交给模型；「触发才带」：平时不带，只有说到触发说法（或模型主动找工具）后才出现，更省上下文。
      </span>
    </p>
  );
}

function IntentPreviewBox() {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (value: string) => previewLlmToolIntent(value),
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "预览失败");
    },
    onSuccess: () => setError(null),
  });
  const preview = mutation.data;

  return (
    <div className="space-y-2 rounded-[var(--radius-control,8px)] border p-3">
      <div className="text-sm font-medium">口语选型预览</div>
      <div className="flex flex-col gap-2 min-[561px]:flex-row min-[561px]:items-center">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例如：放首铁花飞 / 来杯酒 / 怎么用"
          className="h-8 text-xs min-[561px]:flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) mutation.mutate(text.trim());
          }}
        />
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0"
          disabled={!text.trim() || mutation.isPending}
          onClick={() => mutation.mutate(text.trim())}
        >
          {mutation.isPending ? "预览中…" : "预览"}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {preview ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            命中域：
            <span className="text-foreground">
              {(preview.domains || []).join(", ") || (preview.selective_empty ? "（空，不注入工具）" : "—")}
            </span>
          </p>
          {(preview.structure_domains || []).length ? (
            <p>结构召回：{(preview.structure_domains || []).join(", ")}</p>
          ) : null}
          <p>
            将下发 {preview.schema_count ?? 0} 个工具
            {(preview.schema_tools || []).length
              ? `：${(preview.schema_tools || []).slice(0, 8).join(", ")}${(preview.schema_tools || []).length > 8 ? "…" : ""}`
              : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ToolOverrideEditor({
  row,
  onSaved,
}: {
  row: LlmToolCatalogItem;
  onSaved: () => void;
}) {
  const [hintsText, setHintsText] = useState(
    () => (row.override?.hints ?? row.effective_hints ?? row.hints ?? []).join(", "),
  );
  const [description, setDescription] = useState(() => row.override?.description || "");
  const [visibility, setVisibility] = useState(row.visibility || "visible");
  const [disabled, setDisabled] = useState(Boolean(row.override?.disabled));
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (patch: LlmToolOverridePatch) => patchLlmToolOverride(row.name, patch),
    onSuccess: () => {
      setError(null);
      onSaved();
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "保存失败");
    },
  });

  return (
    <div className="mt-2 space-y-2 rounded-[var(--radius-control,8px)] border border-dashed bg-muted/20 p-2.5">
      <div className="space-y-1">
        <label className="text-[11px] text-muted-foreground">描述覆盖（留空保持原描述）</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="可选：自定义交给模型看的工具说明"
          className="h-8 text-xs"
          title={row.description || undefined}
        />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] text-muted-foreground">触发说法（逗号分隔，留空则恢复声明默认）</label>
        <Input
          value={hintsText}
          onChange={(e) => setHintsText(e.target.value)}
          placeholder="可选：说法一, 说法二, 说法三"
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] text-muted-foreground">何时交给模型</label>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger className="h-8 w-[11.5rem] text-xs">
              <SelectValue placeholder="何时交给模型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="visible">{VISIBILITY_OPTION_LABEL.visible}</SelectItem>
              <SelectItem value="deferred">{VISIBILITY_OPTION_LABEL.deferred}</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={disabled}
              onChange={(e) => setDisabled(e.target.checked)}
              className="size-3.5"
            />
            停用此工具
          </label>
          <Button
            type="button"
            size="sm"
            className="h-8"
            disabled={mutation.isPending}
            onClick={() => {
              const hints = hintsText
                .split(/[,，]/)
                .map((s) => s.trim())
                .filter(Boolean);
              mutation.mutate({
                description: description.trim() || null,
                hints: hints.length ? hints : null,
                visibility: visibility === "deferred" ? "deferred" : "visible",
                disabled,
              });
            }}
          >
            {mutation.isPending ? "保存中…" : "保存覆盖"}
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {visibility === "deferred"
            ? "平时不把这个工具交给模型；用户说到上方触发说法，或模型主动找工具后，才会带上。"
            : "话题与该工具所属领域相关时就会带上，方便常用能力；工具很多时更占上下文。"}
        </p>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export default function LlmToolsTable({
  items,
  policy,
}: {
  items: Array<Record<string, unknown> | LlmToolCatalogItem>;
  policy?: LlmToolCatalogPolicy | null;
}) {
  const queryClient = useQueryClient();
  const rows = useMemo(() => items.map(asTool).filter((row) => row.name), [items]);
  const eligibleCount = rows.filter((row) => row.eligible).length;
  const [editing, setEditing] = useState<string | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["llm-tools-catalog"] });
    setEditing(null);
  };

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

      <IntentPreviewBox />

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
              <span>{visibilityShort(row.visibility)}</span>
              <span aria-hidden>·</span>
              {row.eligible ? (
                <span className="text-emerald-500">可调用</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  {labelOf(DISABLED_REASON_LABEL, row.disabled_reason || undefined, "不可用")}
                </span>
              )}
            </div>
            {(row.effective_hints || []).length ? (
              <p className="mt-1.5 line-clamp-2 text-[11px] text-muted-foreground">
                触发：{(row.effective_hints || []).join("、")}
              </p>
            ) : null}
            <div className="mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setEditing((cur) => (cur === row.name ? null : row.name))}
              >
                {editing === row.name ? "收起" : "覆盖"}
              </Button>
            </div>
            {editing === row.name ? <ToolOverrideEditor row={row} onSaved={refresh} /> : null}
          </li>
        ))}
      </ul>

      <div className="max-[560px]:hidden">
        <Table className="min-w-[52rem]">
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>领域</TableHead>
              <TableHead>触发 / 何时带上</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="w-[5rem]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <Fragment key={row.name}>
                <TableRow>
                  <TableCell className="max-w-[16rem]">
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
                  <TableCell className="max-w-[9rem]">
                    <span className="block truncate" title={(row.domains || []).join(", ")}>
                      {(row.domains || []).join(", ") || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[14rem]">
                    <div className="text-xs">
                      <span
                        className="text-muted-foreground"
                        title={
                          row.visibility === "deferred"
                            ? VISIBILITY_OPTION_LABEL.deferred
                            : VISIBILITY_OPTION_LABEL.visible
                        }
                      >
                        {visibilityShort(row.visibility)}
                      </span>
                      {(row.effective_hints || []).length ? (
                        <div className="mt-0.5 line-clamp-2" title={(row.effective_hints || []).join("、")}>
                          {(row.effective_hints || []).join("、")}
                        </div>
                      ) : (
                        <div className="mt-0.5 text-muted-foreground">无触发说法</div>
                      )}
                    </div>
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
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setEditing((cur) => (cur === row.name ? null : row.name))}
                    >
                      {editing === row.name ? "收起" : "覆盖"}
                    </Button>
                  </TableCell>
                </TableRow>
                {editing === row.name ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <ToolOverrideEditor row={row} onSaved={refresh} />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
