import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2 } from "lucide-react";
import { axiosErrorDetail } from "@/api/http";
import { fetchCommonConfig, putCommonConfig } from "@/api/console";
import type { LlmToolCatalogPolicy } from "@/api/pallasTypes";
import TagsInput from "@/components/config/TagsInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pushConsoleToast } from "@/utils/consoleToast";

export type McpServerDraft = {
  id: string;
  transport: "stdio" | "http";
  command: string[];
  url: string;
  enabled_tools: string[];
};

function blankServer(): McpServerDraft {
  return { id: "", transport: "stdio", command: [], url: "", enabled_tools: [] };
}

function asServers(raw: unknown): McpServerDraft[] {
  if (!Array.isArray(raw)) return [];
  const out: McpServerDraft[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const transportRaw = String(row.transport || "stdio").trim().toLowerCase();
    const transport: "stdio" | "http" = transportRaw === "http" || transportRaw === "sse" ? "http" : "stdio";
    out.push({
      id: String(row.id || "").trim(),
      transport,
      command: Array.isArray(row.command) ? row.command.map((x) => String(x)) : [],
      url: String(row.url || "").trim(),
      enabled_tools: Array.isArray(row.enabled_tools)
        ? row.enabled_tools.map((x) => String(x).trim()).filter(Boolean)
        : [],
    });
  }
  return out;
}

function normalizeForSave(servers: McpServerDraft[]): McpServerDraft[] {
  const seen = new Set<string>();
  const out: McpServerDraft[] = [];
  for (const server of servers) {
    const id = server.id.trim();
    if (!id) continue;
    if (seen.has(id)) throw new Error(`MCP 服务器 id 重复：${id}`);
    seen.add(id);
    const transport = server.transport === "http" ? "http" : "stdio";
    if (transport === "stdio" && server.command.every((x) => !String(x).trim())) {
      throw new Error(`「${id}」stdio 需要填写启动命令`);
    }
    if (transport === "http" && !server.url.trim()) {
      throw new Error(`「${id}」HTTP 需要填写 URL`);
    }
    out.push({
      id,
      transport,
      command: transport === "stdio" ? server.command.map((x) => String(x).trim()).filter(Boolean) : [],
      url: transport === "http" ? server.url.trim() : "",
      enabled_tools: server.enabled_tools.map((x) => String(x).trim()).filter(Boolean),
    });
  }
  return out;
}

function McpStatusNote({ policy }: { policy?: LlmToolCatalogPolicy | null }) {
  const mcp = policy?.mcp;
  if (!mcp) return null;
  const registered = Number(mcp.registered_count || 0);
  const errors = Array.isArray(mcp.errors) ? mcp.errors : [];
  const sessions = Array.isArray(mcp.sessions) ? mcp.sessions : [];
  const live = sessions.filter((s) => s?.alive).length;
  return (
    <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
      <p>
        当前已注册 MCP 工具{" "}
        <span className="tabular-nums text-foreground">{registered}</span> 个
        {Array.isArray(mcp.servers) ? (
          <>
            ；配置服务器 <span className="tabular-nums text-foreground">{mcp.servers.length}</span> 个
          </>
        ) : null}
        {sessions.length ? (
          <>
            ；常驻连接 <span className="tabular-nums text-foreground">{live}</span>/{sessions.length}
          </>
        ) : null}
      </p>
      {errors.length ? (
        <ul className="list-disc space-y-0.5 pl-4 text-destructive">
          {errors.map((err) => (
            <li key={`${err.server_id}-${err.error}`}>
              {err.server_id || "(无 id)"}：{err.error}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function McpServersCard({ policy }: { policy?: LlmToolCatalogPolicy | null }) {
  const qc = useQueryClient();
  const cfgQ = useQuery({
    queryKey: ["common-config", "llm"],
    queryFn: () => fetchCommonConfig("llm"),
  });

  const [servers, setServers] = useState<McpServerDraft[]>([]);
  const [allowlist, setAllowlist] = useState("");
  const [baseline, setBaseline] = useState("");

  useEffect(() => {
    if (!cfgQ.data?.fields) return;
    const byName = new Map(cfgQ.data.fields.map((f) => [f.name, f]));
    const mcpField = byName.get("mcp_servers");
    const allowField = byName.get("llm_mcp_http_allowlist");
    const nextServers = asServers(mcpField?.current);
    const nextAllow = String(allowField?.current ?? "").trim();
    setServers(nextServers);
    setAllowlist(nextAllow);
    setBaseline(JSON.stringify({ servers: nextServers, allowlist: nextAllow }));
  }, [cfgQ.data]);

  const dirty = useMemo(
    () => JSON.stringify({ servers, allowlist }) !== baseline,
    [servers, allowlist, baseline],
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      const normalized = normalizeForSave(servers);
      return putCommonConfig("llm", {
        mcp_servers: normalized,
        llm_mcp_http_allowlist: allowlist.trim(),
      });
    },
    onSuccess: async () => {
      pushConsoleToast("MCP 配置已保存", "ok");
      const normalized = normalizeForSave(servers);
      const nextAllow = allowlist.trim();
      setServers(normalized);
      setAllowlist(nextAllow);
      setBaseline(JSON.stringify({ servers: normalized, allowlist: nextAllow }));
      await qc.invalidateQueries({ queryKey: ["common-config", "llm"] });
      await qc.invalidateQueries({ queryKey: ["common-config-raw", "llm"] });
      await qc.invalidateQueries({ queryKey: ["llm-tools-catalog"] });
    },
    onError: (e) =>
      pushConsoleToast(
        (e instanceof Error && e.message) || axiosErrorDetail(e) || "保存 MCP 配置失败",
        "err",
      ),
  });

  function updateServer(index: number, patch: Partial<McpServerDraft>) {
    setServers((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <section className="space-y-3 rounded-[var(--radius-control,8px)] border p-3 max-[560px]:p-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-medium">MCP 服务器</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            接入外部 MCP（如 prts-mcp）。stdio 填启动命令；HTTP 须同时配置允许的 URL 前缀。保存后刷新下方工具目录。
          </p>
          <McpStatusNote policy={policy} />
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            icon={Plus}
            onClick={() => setServers((prev) => [...prev, blankServer()])}
          >
            添加
          </Button>
          <Button
            type="button"
            size="sm"
            icon={Save}
            iconMotion="scale"
            iconBusy={saveMut.isPending}
            disabled={!dirty || saveMut.isPending}
            onClick={() => void saveMut.mutateAsync()}
          >
            {saveMut.isPending ? "保存中…" : "保存 MCP"}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mcp-http-allowlist">HTTP 允许前缀</Label>
        <Input
          id="mcp-http-allowlist"
          value={allowlist}
          onChange={(e) => setAllowlist(e.target.value)}
          placeholder="http://127.0.0.1:8765,http://10.0.0.2:9000"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">逗号分隔；仅 HTTP/SSE 传输需要。留空则拒绝所有 HTTP MCP。</p>
      </div>

      {!servers.length ? (
        <p className="text-xs text-muted-foreground">尚未配置 MCP 服务器。可点「添加」接入。</p>
      ) : (
        <ul className="space-y-3">
          {servers.map((server, index) => (
            <li
              key={`mcp-${index}`}
              className="space-y-3 rounded-[var(--radius-control,8px)] border bg-muted/20 p-3 max-[560px]:p-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">服务器 {index + 1}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  icon={Trash2}
                  onClick={() => setServers((prev) => prev.filter((_, i) => i !== index))}
                >
                  删除
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`mcp-id-${index}`}>ID</Label>
                  <Input
                    id={`mcp-id-${index}`}
                    value={server.id}
                    onChange={(e) => updateServer(index, { id: e.target.value })}
                    placeholder="prts"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>传输</Label>
                  <Select
                    value={server.transport}
                    onValueChange={(value) =>
                      updateServer(index, { transport: value === "http" ? "http" : "stdio" })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stdio">stdio（本地进程）</SelectItem>
                      <SelectItem value="http">HTTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {server.transport === "stdio" ? (
                <div className="space-y-1.5">
                  <Label>启动命令</Label>
                  <TagsInput
                    value={server.command}
                    onChange={(command) => updateServer(index, { command })}
                    placeholder="回车添加一段，如 uvx / prts-mcp"
                    variant="stacked"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor={`mcp-url-${index}`}>URL</Label>
                  <Input
                    id={`mcp-url-${index}`}
                    value={server.url}
                    onChange={(e) => updateServer(index, { url: e.target.value })}
                    placeholder="http://127.0.0.1:8765/mcp"
                    className="font-mono text-sm"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>启用的工具名（可选）</Label>
                <TagsInput
                  value={server.enabled_tools}
                  onChange={(enabled_tools) => updateServer(index, { enabled_tools })}
                  placeholder="留空=全部；回车添加工具名"
                  variant="stacked"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
