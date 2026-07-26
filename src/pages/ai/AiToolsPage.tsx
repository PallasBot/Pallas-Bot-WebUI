import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchAgentToolsCatalog } from "@/api/agentPlatformApi";
import { useRegisterAiObservationChrome } from "@/components/ai/AiObservationChromeContext";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function truncateText(raw: string, max = 96): string {
  const text = String(raw || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function policyLabel(enabled: unknown): string {
  if (enabled === true) return "开";
  if (enabled === false) return "关";
  return "—";
}

export default function AiToolsPage() {
  const [queryText, setQueryText] = useState("");
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const query = useQuery({
    queryKey: ["agent-tools-catalog"],
    queryFn: () => fetchAgentToolsCatalog(),
  });
  const items = useMemo(() => query.data?.items || [], [query.data]);
  const policy = query.data?.policy || {};
  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return items.filter((item) => {
      if (eligibleOnly && !item.eligible) return false;
      if (!q) return true;
      const hay = [
        item.name,
        item.description,
        item.source,
        ...(Array.isArray(item.domains) ? item.domains : []),
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [eligibleOnly, items, queryText]);

  const hasWebSearch = items.some((item) => String(item.name) === "web.search");

  const chromeSearch = useMemo(
    () => (
      <div className="relative w-28 shrink-0 sm:w-44">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--text-muted)]"
          strokeWidth={1.75}
          aria-hidden
        />
        <Input
          type="search"
          className="h-9 w-full pl-8"
          placeholder="搜索工具"
          aria-label="搜索工具"
          autoComplete="off"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
        />
      </div>
    ),
    [queryText],
  );

  useRegisterAiObservationChrome({
    middle: chromeSearch,
    onRefresh: () => {
      void query.refetch();
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">工具清单</CardTitle>
              <CardDescription>
                内置、插件与 MCP 合并后的可调用项。工具总开关 {policyLabel(policy.tools_enabled)}，
                按意图筛选 {policyLabel(policy.selective_enabled)}。共 {items.length} 项
                {filtered.length !== items.length ? `，当前显示 ${filtered.length}` : ""}。
              </CardDescription>
            </div>
            <label className="inline-flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border"
                checked={eligibleOnly}
                onChange={(e) => setEligibleOnly(e.target.checked)}
              />
              仅看可用
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasWebSearch ? (
            <p className="rounded-md border border-dashed px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              联网搜索（web.search）的接口地址与密钥在{" "}
              <Link
                to="/ai/config/dialogue?panel=form"
                className="text-primary underline-offset-2 hover:underline"
              >
                AI 配置 · 对话 · 策略
              </Link>{" "}
              的「联网搜索」分组。两项都填后才会真正搜网页。
            </p>
          ) : null}
          <StateBlock loading={query.isLoading} error={query.error}>
            <ul className="max-h-[min(32rem,60vh)] divide-y overflow-y-auto overscroll-contain rounded-md border">
              {filtered.map((item) => (
                <li key={String(item.name)} className="px-2.5 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="font-medium leading-snug">{String(item.name)}</div>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {String(item.source || "tool")}
                    </Badge>
                    <Badge variant={item.eligible ? "default" : "outline"} className="h-5 px-1.5 text-[10px]">
                      {item.eligible ? "可用" : String(item.disabled_reason || "不可用")}
                    </Badge>
                    {item.visibility && String(item.visibility) !== "visible" ? (
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        {String(item.visibility)}
                      </Badge>
                    ) : null}
                  </div>
                  {item.description ? (
                    <p className="mt-1 text-xs leading-snug text-muted-foreground" title={String(item.description)}>
                      {truncateText(String(item.description), 120)}
                    </p>
                  ) : null}
                  {(Array.isArray(item.domains) ? item.domains : []).length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(Array.isArray(item.domains) ? item.domains : []).slice(0, 6).map((domain) => (
                        <Badge key={String(domain)} variant="outline" className="h-5 px-1.5 text-[10px]">
                          {String(domain)}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
              {!filtered.length ? (
                <li className="px-2.5 py-3 text-sm text-muted-foreground">没有匹配的工具。</li>
              ) : null}
            </ul>
          </StateBlock>
        </CardContent>
      </Card>
    </div>
  );
}
