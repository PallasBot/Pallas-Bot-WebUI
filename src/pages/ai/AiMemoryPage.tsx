import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  FolderTree,
  GitBranch,
  Globe,
  MessageSquare,
  Network,
  Search,
  ListChecks,
  Layers,
  Trash2,
  Upload,
} from "lucide-react";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchConversationKernelMemoryPreferences,
  fetchConversationKernelMidTerm,
  postConversationKernelMemory,
  postConversationKernelMemoryClear,
  postConversationKernelMemoryDelete,
  postConversationKernelMemoryLifecycle,
  postConversationKernelMemoryPreference,
} from "@/api/fullConsole";
import {
  fetchMemoryGraph,
  fetchMemoryGraphCategories,
  fetchMemoryGraphEdges,
  fetchMemoryGraphEntities,
  fetchMemoryGraphEpisodes,
  fetchMemoryGraphExport,
  fetchMemoryGraphHierStatus,
  fetchMemoryGraphScopes,
  fetchMemoryGraphStats,
  fetchMemoryGraphTrash,
  postMemoryGraphCategory,
  postMemoryGraphCategoryDelete,
  postMemoryGraphClear,
  postMemoryGraphEdge,
  postMemoryGraphEdgeDelete,
  postMemoryGraphEdgeRestore,
  postMemoryGraphEntity,
  postMemoryGraphEntityDelete,
  postMemoryGraphExtract,
  postMemoryGraphHierRebuild,
  postMemoryGraphImport,
  postMemoryGraphSearch,
  postMemoryGraphTrashPurge,
  postMemoryGraphTrashRestore,
  type MemoryCategory,
} from "@/api/memoryGraphApi";
import { useRegisterAiObservationChrome } from "@/components/ai/AiObservationChromeContext";
import {
  parseScopeBotId,
  parseScopeGroupId,
  useAiObservationScope,
} from "@/components/ai/AiObservationScopeContext";
import MemoryForceGraph from "@/components/ai/MemoryForceGraph";
import IconStatCard from "@/components/IconStatCard";
import StateBlock from "@/components/StateBlock";
import TruncatedText from "@/components/TruncatedText";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

type TabId =
  | "overview"
  | "graph"
  | "search"
  | "episodes"
  | "entities"
  | "edges"
  | "categories"
  | "trash"
  | "import"
  | "scopes"
  | "preferences";

function formatTs(ts?: number | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return String(ts);
  }
}

function groupCategoriesByLayer(items: MemoryCategory[]): { layer: number; items: MemoryCategory[] }[] {
  const map = new Map<number, MemoryCategory[]>();
  for (const c of items) {
    const layer = num(c.layer, 1);
    const list = map.get(layer) ?? [];
    list.push(c);
    map.set(layer, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([layer, list]) => ({ layer, items: list }));
}

export default function AiMemoryPage() {
  const qc = useQueryClient();
  const { botId, groupId } = useAiObservationScope();
  const [tab, setTab] = useState<TabId>("overview");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [prefRule, setPrefRule] = useState("");
  const [msg, setMsg] = useState("");
  const [entityName, setEntityName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryLayer, setCategoryLayer] = useState("1");
  const [importJson, setImportJson] = useState("");
  const [exportJson, setExportJson] = useState("");
  const [edgeFact, setEdgeFact] = useState("");
  const [edgeSource, setEdgeSource] = useState("");
  const [edgeTarget, setEdgeTarget] = useState("");
  const [includeInvalidEdges, setIncludeInvalidEdges] = useState(false);
  const [searchHits, setSearchHits] = useState<{
    episodes: { id: string; content: string }[];
    entities: { id: string; name: string; summary?: string }[];
    edges: { id: string; fact: string }[];
  } | null>(null);

  const bot = parseScopeBotId(botId) ?? 0;
  const group = parseScopeGroupId(groupId);
  const botReady = bot > 0;

  const statsQ = useQuery({
    queryKey: ["memory-graph-stats", bot || null, group],
    enabled: botReady,
    queryFn: () => fetchMemoryGraphStats({ botId: bot, groupId: group }),
  });
  const graphQ = useQuery({
    queryKey: ["memory-graph", bot || null, group],
    enabled: botReady && (tab === "graph" || tab === "overview"),
    queryFn: () => fetchMemoryGraph({ botId: bot, groupId: group }),
  });
  const episodesQ = useQuery({
    queryKey: ["memory-graph-episodes", bot || null, group, query],
    enabled: botReady && tab === "episodes",
    queryFn: () =>
      fetchMemoryGraphEpisodes({ botId: bot, groupId: group, query, limit: 50 }),
  });
  const entitiesQ = useQuery({
    queryKey: ["memory-graph-entities", bot || null, group, query],
    enabled: botReady && (tab === "entities" || tab === "edges"),
    queryFn: () =>
      fetchMemoryGraphEntities({ botId: bot, groupId: group, query, limit: 80 }),
  });
  const edgesQ = useQuery({
    queryKey: ["memory-graph-edges", bot || null, group, includeInvalidEdges],
    enabled: botReady && tab === "edges",
    queryFn: () =>
      fetchMemoryGraphEdges({
        botId: bot,
        groupId: group,
        includeInvalid: includeInvalidEdges,
        limit: 100,
      }),
  });
  const scopesQ = useQuery({
    queryKey: ["memory-graph-scopes", bot || null],
    enabled: botReady && tab === "scopes",
    queryFn: () => fetchMemoryGraphScopes({ botId: bot }),
  });
  const categoriesQ = useQuery({
    queryKey: ["memory-graph-categories", bot || null, group],
    enabled: botReady && (tab === "categories" || tab === "overview"),
    queryFn: () => fetchMemoryGraphCategories({ botId: bot, groupId: group, limit: 200 }),
  });
  const hierQ = useQuery({
    queryKey: ["memory-graph-hier", bot || null, group],
    enabled: botReady && (tab === "overview" || tab === "categories"),
    queryFn: () => fetchMemoryGraphHierStatus({ botId: bot, groupId: group }),
  });
  const trashQ = useQuery({
    queryKey: ["memory-graph-trash", bot || null, group],
    enabled: botReady && tab === "trash",
    queryFn: () => fetchMemoryGraphTrash({ botId: bot, groupId: group, limit: 100 }),
  });
  const prefsQ = useQuery({
    queryKey: ["conversation-kernel-memory-preferences", bot || null, group],
    enabled: botReady && tab === "preferences",
    queryFn: () =>
      fetchConversationKernelMemoryPreferences({
        botId: bot,
        groupId: group,
      }),
  });
  const midQ = useQuery({
    queryKey: ["conversation-kernel-mid-term", bot || null, group],
    enabled: botReady && tab === "preferences",
    queryFn: () =>
      fetchConversationKernelMidTerm({
        botId: bot,
        groupId: group,
        limit: 30,
      }),
  });

  const invalidateGraph = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["memory-graph-stats"] }),
      qc.invalidateQueries({ queryKey: ["memory-graph"] }),
      qc.invalidateQueries({ queryKey: ["memory-graph-episodes"] }),
      qc.invalidateQueries({ queryKey: ["memory-graph-entities"] }),
      qc.invalidateQueries({ queryKey: ["memory-graph-edges"] }),
      qc.invalidateQueries({ queryKey: ["memory-graph-scopes"] }),
      qc.invalidateQueries({ queryKey: ["memory-graph-categories"] }),
      qc.invalidateQueries({ queryKey: ["memory-graph-trash"] }),
      qc.invalidateQueries({ queryKey: ["memory-graph-hier"] }),
      qc.invalidateQueries({ queryKey: ["conversation-kernel-memory"] }),
      qc.invalidateQueries({ queryKey: ["conversation-kernel-memory-preferences"] }),
      qc.invalidateQueries({ queryKey: ["conversation-kernel-mid-term"] }),
    ]);
  }, [qc]);

  const createEpisodeM = useMutation({
    mutationFn: postConversationKernelMemory,
    onSuccess: async () => {
      setDraft("");
      setMsg("已写入 Episode（群记忆）");
      await invalidateGraph();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const deleteEpisodeM = useMutation({
    mutationFn: postConversationKernelMemoryDelete,
    onSuccess: async () => {
      setMsg("已删除 Episode");
      await invalidateGraph();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const clearM = useMutation({
    mutationFn: postConversationKernelMemoryClear,
    onSuccess: async (data) => {
      setMsg(`已清空 ${num((data as { deleted?: number }).deleted)} 条`);
      await invalidateGraph();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const lifeM = useMutation({
    mutationFn: postConversationKernelMemoryLifecycle,
    onSuccess: async () => {
      setMsg("生命周期已更新");
      await invalidateGraph();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const prefM = useMutation({
    mutationFn: postConversationKernelMemoryPreference,
    onSuccess: async () => {
      setPrefRule("");
      setMsg("偏好已保存");
      await qc.invalidateQueries({ queryKey: ["conversation-kernel-memory-preferences"] });
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const entityM = useMutation({
    mutationFn: postMemoryGraphEntity,
    onSuccess: async () => {
      setEntityName("");
      setMsg("实体已保存");
      await invalidateGraph();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const entityDelM = useMutation({
    mutationFn: postMemoryGraphEntityDelete,
    onSuccess: async () => {
      setMsg("实体已删除");
      await invalidateGraph();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const edgeM = useMutation({
    mutationFn: postMemoryGraphEdge,
    onSuccess: async () => {
      setEdgeFact("");
      setMsg("关系已保存");
      await invalidateGraph();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const edgeDelM = useMutation({
    mutationFn: postMemoryGraphEdgeDelete,
    onSuccess: async () => {
      setMsg("关系已删除（软删，可在「含失效」中恢复）");
      await invalidateGraph();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const edgeRestoreM = useMutation({
    mutationFn: postMemoryGraphEdgeRestore,
    onSuccess: async () => {
      setMsg("关系已恢复");
      await invalidateGraph();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const searchM = useMutation({
    mutationFn: postMemoryGraphSearch,
    onSuccess: (data) => {
      setSearchHits({
        episodes: data.episodes,
        entities: data.entities,
        edges: data.edges,
      });
      setMsg(`检索命中 ${data.count} 条`);
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const extractM = useMutation({
    mutationFn: postMemoryGraphExtract,
    onSuccess: async (data) => {
      setMsg(
        `抽取完成：实体 ${num(data.entities_upserted)} · 关系 ${num(data.edges_upserted)}${
          data.episodes != null ? ` · Episode ${num(data.episodes)}` : ""
        }`,
      );
      await invalidateGraph();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const hierRebuildM = useMutation({
    mutationFn: postMemoryGraphHierRebuild,
    onSuccess: async (data) => {
      setMsg(`分层重建完成：层 ${num(data.max_layer)} · 分类 ${num(data.categories)}`);
      await invalidateGraph();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const categoryM = useMutation({
    mutationFn: postMemoryGraphCategory,
    onSuccess: async () => {
      setCategoryName("");
      setMsg("分类已保存");
      await invalidateGraph();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const categoryDelM = useMutation({
    mutationFn: postMemoryGraphCategoryDelete,
    onSuccess: async () => {
      setMsg("分类已删除（可在回收站恢复）");
      await invalidateGraph();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const trashRestoreM = useMutation({
    mutationFn: postMemoryGraphTrashRestore,
    onSuccess: async () => {
      setMsg("已从回收站恢复");
      await invalidateGraph();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const trashPurgeM = useMutation({
    mutationFn: postMemoryGraphTrashPurge,
    onSuccess: async () => {
      setMsg("已彻底删除");
      await invalidateGraph();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const importM = useMutation({
    mutationFn: postMemoryGraphImport,
    onSuccess: async (data) => {
      setMsg(
        `导入完成：实体 ${num(data.entities_upserted)} · 关系 ${num(data.edges_upserted)} · 分类 ${num(data.categories_upserted)}`,
      );
      await invalidateGraph();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const clearGraphM = useMutation({
    mutationFn: postMemoryGraphClear,
    onSuccess: async (data) => {
      setMsg(
        `已清空图数据：实体 ${num(data.entities)} · 关系 ${num(data.edges)} · 分类 ${num(data.categories)}`,
      );
      await invalidateGraph();
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const exportM = useMutation({
    mutationFn: fetchMemoryGraphExport,
    onSuccess: (data) => {
      const text = JSON.stringify(data, null, 2);
      setExportJson(text);
      setMsg("导出完成");
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const filters = useMemo(
    () => (
      <div className="relative w-28 shrink-0 sm:w-40">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--text-muted)]"
          strokeWidth={1.75}
          aria-hidden
        />
        <Input
          type="search"
          className="h-9 w-full pl-8"
          placeholder="搜索记忆"
          aria-label="搜索记忆"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
    ),
    [query],
  );

  useRegisterAiObservationChrome({
    middle: filters,
    onRefresh: invalidateGraph,
  });

  const prefs = prefsQ.data?.items ?? [];
  const midItems = midQ.data?.items ?? [];
  const entities = entitiesQ.data?.items ?? [];
  const edges = edgesQ.data?.items ?? [];
  const episodes = episodesQ.data?.items ?? [];
  const categories = categoriesQ.data?.items ?? [];
  const categoriesByLayer = groupCategoriesByLayer(categories);
  const trash = trashQ.data;

  return (
    <div className="space-y-3">
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      {!botReady ? (
        <p className="text-sm text-muted-foreground">请在顶栏指定 Bot QQ。</p>
      ) : null}
      {botReady && group == null ? (
        <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          未指定群号时默认使用全局作用域。
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="space-y-3">
        <div className="ai-memory-page__tabs-scroll">
          <TabsList className="h-auto min-w-max flex-nowrap justify-start">
            <TabsTrigger value="overview" className="gap-1">
              <Brain className="size-3.5" /> 总览
            </TabsTrigger>
            <TabsTrigger value="graph" className="gap-1">
              <Network className="size-3.5" /> 图谱
            </TabsTrigger>
            <TabsTrigger value="search" className="gap-1">
              <Search className="size-3.5" /> 搜索
            </TabsTrigger>
            <TabsTrigger value="episodes" className="gap-1">
              <MessageSquare className="size-3.5" /> Episode
            </TabsTrigger>
            <TabsTrigger value="entities" className="gap-1">
              <FolderTree className="size-3.5" /> 实体
            </TabsTrigger>
            <TabsTrigger value="edges" className="gap-1">
              <GitBranch className="size-3.5" /> 关系
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-1">
              <Layers className="size-3.5" /> 分类
            </TabsTrigger>
            <TabsTrigger value="trash" className="gap-1">
              <Trash2 className="size-3.5" /> 回收站
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-1">
              <Upload className="size-3.5" /> 导入
            </TabsTrigger>
            <TabsTrigger value="scopes" className="gap-1">
              <Globe className="size-3.5" /> Scope
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-1">
              <ListChecks className="size-3.5" /> 偏好
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-3">
          <StateBlock loading={statsQ.isLoading} error={statsQ.error}>
            <div className="console-panel-grid grid-cols-2 lg:grid-cols-5">
              <IconStatCard
                title="Episode"
                value={num(statsQ.data?.episode_count)}
                icon={MessageSquare}
                subtitle="群记忆条目"
              />
              <IconStatCard
                title="实体"
                value={num(statsQ.data?.entity_count)}
                icon={Brain}
                subtitle={`发言者 ${num(statsQ.data?.speaker_entity_count)}`}
              />
              <IconStatCard
                title="关系"
                value={num(statsQ.data?.active_edge_count)}
                icon={GitBranch}
                subtitle={`含失效 ${num(statsQ.data?.edge_count)}`}
              />
              <IconStatCard
                title="分类"
                value={num(statsQ.data?.category_count)}
                icon={Layers}
                subtitle="图谱类目"
              />
              <IconStatCard
                title="Scope"
                value={num(statsQ.data?.scope_keys?.length)}
                icon={Globe}
                subtitle={statsQ.data?.scope_key || "—"}
              />
            </div>
          </StateBlock>
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">HierGraph 分层</CardTitle>
                <CardDescription>按层聚合的实体分类。</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!botReady || extractM.isPending}
                  onClick={() => extractM.mutate({ botId: bot, groupId: group, limit: 20 })}
                >
                  LLM 抽取
                </Button>
                <Button
                  size="sm"
                  disabled={!botReady || hierRebuildM.isPending}
                  onClick={() => {
                    if (!window.confirm("确认重建分层？旧分类会软删后按 LLM 重新生成。")) return;
                    hierRebuildM.mutate({ botId: bot, groupId: group });
                  }}
                >
                  重建分层
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <StateBlock loading={hierQ.isLoading} error={hierQ.error}>
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <div className="rounded-md border px-3 py-2">
                    <div className="text-xs text-muted-foreground">最大层</div>
                    <div className="font-medium">{num(hierQ.data?.max_layer)}</div>
                  </div>
                  <div className="rounded-md border px-3 py-2">
                    <div className="text-xs text-muted-foreground">上次重建</div>
                    <div className="font-medium">{formatTs(hierQ.data?.last_rebuild_at)}</div>
                  </div>
                  <div className="rounded-md border px-3 py-2 sm:col-span-1">
                    <div className="text-xs text-muted-foreground">摘要</div>
                    <div className="font-medium">
                      {hierQ.data?.group_summary?.trim() || "—"}
                    </div>
                  </div>
                </div>
                {hierQ.data?.entity_count_at_rebuild != null ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    重建时实体数 {num(hierQ.data.entity_count_at_rebuild)} · 当前分类{" "}
                    {num(categoriesQ.data?.total ?? statsQ.data?.category_count)}
                  </p>
                ) : null}
              </StateBlock>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">图谱预览</CardTitle>
              <CardDescription>实体与关系网络。</CardDescription>
            </CardHeader>
            <CardContent>
              <StateBlock loading={graphQ.isLoading} error={graphQ.error}>
                <MemoryForceGraph
                  nodes={graphQ.data?.nodes ?? []}
                  edges={graphQ.data?.edges ?? []}
                />
              </StateBlock>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graph">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">知识图谱</CardTitle>
              <CardDescription>
                {graphQ.data
                  ? `${graphQ.data.total_nodes} 节点 · ${graphQ.data.total_edges} 边 · ${graphQ.data.scope_key}`
                  : "加载中"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StateBlock loading={graphQ.isLoading} error={graphQ.error}>
                <MemoryForceGraph
                  nodes={graphQ.data?.nodes ?? []}
                  edges={graphQ.data?.edges ?? []}
                />
              </StateBlock>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">记忆搜索</CardTitle>
              <CardDescription>检索 Episode、实体与关系。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Input
                  className="min-w-[12rem] flex-1"
                  placeholder="输入关键词"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={!botReady || !query.trim() || searchM.isPending}
                  onClick={() =>
                    searchM.mutate({ botId: bot, groupId: group, query: query.trim() })
                  }
                >
                  搜索
                </Button>
              </div>
              {searchHits ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">Episode</div>
                    {searchHits.episodes.length ? (
                      searchHits.episodes.map((e) => (
                        <div key={e.id} className="rounded-md border px-2 py-1.5">
                          <TruncatedText text={e.content} lines={2} />
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">暂无匹配结果。</p>
                    )}
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">实体</div>
                    {searchHits.entities.length ? (
                      searchHits.entities.map((e) => (
                        <div key={e.id} className="rounded-md border px-2 py-1.5">
                          {e.name}
                          {e.summary ? (
                            <span className="text-muted-foreground"> · {e.summary}</span>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">暂无匹配结果。</p>
                    )}
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">关系</div>
                    {searchHits.edges.length ? (
                      searchHits.edges.map((e) => (
                        <div key={e.id} className="rounded-md border px-2 py-1.5">
                          <TruncatedText text={e.fact} />
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">暂无匹配结果。</p>
                    )}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="episodes" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">写入 Episode</CardTitle>
              <CardDescription>手动添加群记忆。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="新建群内旧事…"
                rows={3}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!botReady || !draft.trim() || createEpisodeM.isPending}
                  onClick={() =>
                    createEpisodeM.mutate({
                      botId: bot,
                      groupId: group,
                      content: draft.trim(),
                    })
                  }
                >
                  保存
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!botReady || extractM.isPending}
                  onClick={() => extractM.mutate({ botId: bot, groupId: group, limit: 20 })}
                >
                  批量抽取最近 Episode
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!botReady || clearM.isPending}
                  onClick={() => {
                    if (!window.confirm("确认清空当前 Bot/群范围记忆？")) return;
                    clearM.mutate({ botId: bot, groupId: group });
                  }}
                >
                  清空范围
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Episode 列表</CardTitle>
            </CardHeader>
            <CardContent>
              <StateBlock loading={episodesQ.isLoading} error={episodesQ.error}>
                <div className="max-h-[28rem] space-y-2 overflow-auto">
                  {episodes.map((item) => (
                    <div key={item.id} className="rounded-md border px-3 py-2 text-sm">
                      <p className="min-w-0">
                        <TruncatedText text={item.content} lines={2} />
                      </p>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.source || "memory"} · 群 {item.group_id ?? "—"}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={!item.content?.trim() || extractM.isPending}
                          onClick={() =>
                            extractM.mutate({
                              botId: bot,
                              groupId: group,
                              text: item.content,
                              episodeId: item.id,
                            })
                          }
                        >
                          抽取
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() =>
                            lifeM.mutate({ id: Number(item.id), action: "reinforce" })
                          }
                        >
                          强化
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => lifeM.mutate({ id: Number(item.id), action: "weaken" })}
                        >
                          削弱
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => lifeM.mutate({ id: Number(item.id), action: "freeze" })}
                        >
                          冻结
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 px-2 text-xs"
                          onClick={() =>
                            deleteEpisodeM.mutate({ id: Number(item.id), botId: bot })
                          }
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!episodes.length ? (
                    <p className="text-sm text-muted-foreground">暂无 Episode 记录。</p>
                  ) : null}
                </div>
              </StateBlock>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entities" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">新建实体</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Input
                className="min-w-[10rem] flex-1"
                placeholder="实体名称"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!botReady || !entityName.trim() || entityM.isPending}
                onClick={() =>
                  entityM.mutate({
                    botId: bot,
                    groupId: group,
                    name: entityName.trim(),
                  })
                }
              >
                添加
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">实体列表</CardTitle>
            </CardHeader>
            <CardContent>
              <StateBlock loading={entitiesQ.isLoading} error={entitiesQ.error}>
                <div className="console-panel-grid grid-cols-2 lg:grid-cols-3">
                  {entities.map((ent) => (
                    <div key={ent.id} className="rounded-md border p-3 text-sm">
                      <div className="font-medium">{ent.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {ent.kind || "concept"}
                        {ent.is_speaker ? " · speaker" : ""} · id {ent.id}
                      </div>
                      {ent.summary ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          <TruncatedText text={ent.summary} lines={2} />
                        </div>
                      ) : null}
                      <Button
                        size="sm"
                        variant="destructive"
                        className="mt-2 h-7 px-2 text-xs"
                        onClick={() => entityDelM.mutate({ id: ent.id, botId: bot })}
                      >
                        删除
                      </Button>
                    </div>
                  ))}
                </div>
                {!entities.length ? (
                  <p className="text-sm text-muted-foreground">暂无实体</p>
                ) : null}
              </StateBlock>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edges" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">新建关系</CardTitle>
              <CardDescription>连接两个实体。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="源实体 id"
                  value={edgeSource}
                  onChange={(e) => setEdgeSource(e.target.value)}
                />
                <Input
                  placeholder="目标实体 id"
                  value={edgeTarget}
                  onChange={(e) => setEdgeTarget(e.target.value)}
                />
              </div>
              <Input
                placeholder="关系事实"
                value={edgeFact}
                onChange={(e) => setEdgeFact(e.target.value)}
              />
              <Button
                size="sm"
                disabled={
                  !botReady ||
                  !edgeFact.trim() ||
                  !edgeSource.trim() ||
                  !edgeTarget.trim() ||
                  edgeM.isPending
                }
                onClick={() =>
                  edgeM.mutate({
                    botId: bot,
                    groupId: group,
                    fact: edgeFact.trim(),
                    sourceEntityId: edgeSource.trim(),
                    targetEntityId: edgeTarget.trim(),
                  })
                }
              >
                添加关系
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">关系列表</CardTitle>
                <CardDescription>实体间的关系列表。</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="include-invalid-edges"
                  checked={includeInvalidEdges}
                  onCheckedChange={setIncludeInvalidEdges}
                />
                <Label htmlFor="include-invalid-edges" className="text-xs font-normal">
                  含失效
                </Label>
              </div>
            </CardHeader>
            <CardContent>
              <StateBlock loading={edgesQ.isLoading} error={edgesQ.error}>
                <div className="max-h-[28rem] space-y-2 overflow-auto">
                  {edges.map((edge) => {
                    const src = entities.find((e) => e.id === edge.source_entity_id)?.name;
                    const tgt = entities.find((e) => e.id === edge.target_entity_id)?.name;
                    const invalid = edge.invalid_at != null;
                    return (
                      <div
                        key={edge.id}
                        className={`rounded-md border px-3 py-2 text-sm ${invalid ? "opacity-60" : ""}`}
                      >
                        <div className="text-xs text-muted-foreground">
                          {src || edge.source_entity_id} → {tgt || edge.target_entity_id}
                          {invalid ? " · 已失效" : ""}
                        </div>
                        <TruncatedText text={edge.fact} lines={2} />
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {invalid ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              disabled={edgeRestoreM.isPending}
                              onClick={() => edgeRestoreM.mutate({ id: edge.id, botId: bot })}
                            >
                              恢复
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2 text-xs"
                              onClick={() => edgeDelM.mutate({ id: edge.id, botId: bot })}
                            >
                              删除
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {!edges.length ? (
                    <p className="text-sm text-muted-foreground">暂无关系记录。</p>
                  ) : null}
                </div>
              </StateBlock>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">新建分类</CardTitle>
                <CardDescription>实体分层类目。</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!botReady || hierRebuildM.isPending}
                onClick={() => {
                  if (!window.confirm("确认重建分层？旧分类会软删后按 LLM 重新生成。")) return;
                  hierRebuildM.mutate({ botId: bot, groupId: group });
                }}
              >
                重建分层
              </Button>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Input
                className="min-w-[10rem] flex-1"
                placeholder="分类名称"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
              />
              <Input
                className="w-20"
                type="number"
                min={1}
                max={16}
                placeholder="层"
                value={categoryLayer}
                onChange={(e) => setCategoryLayer(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!botReady || !categoryName.trim() || categoryM.isPending}
                onClick={() =>
                  categoryM.mutate({
                    botId: bot,
                    groupId: group,
                    name: categoryName.trim(),
                    layer: Math.max(1, Math.min(16, num(categoryLayer, 1))),
                  })
                }
              >
                添加
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">分类列表</CardTitle>
              <CardDescription>按层分组的分类。</CardDescription>
            </CardHeader>
            <CardContent>
              <StateBlock loading={categoriesQ.isLoading} error={categoriesQ.error}>
                <div className="space-y-4">
                  {categoriesByLayer.map(({ layer, items }) => (
                    <div key={layer}>
                      <div className="mb-2 text-xs font-medium text-muted-foreground">
                        Layer {layer} · {items.length} 个
                      </div>
                      <div className="space-y-2">
                        {items.map((cat) => (
                          <div key={cat.id} className="rounded-md border px-3 py-2 text-sm">
                            <div className="font-medium">{cat.name}</div>
                            <div className="text-xs text-muted-foreground">
                              id {cat.id}
                              {cat.parent_id != null ? ` · parent ${cat.parent_id}` : ""}
                              {cat.member_entity_ids?.length
                                ? ` · 成员 ${cat.member_entity_ids.length}`
                                : ""}
                              {cat.source ? ` · ${cat.source}` : ""}
                            </div>
                            {cat.summary ? (
                              <div className="mt-1 text-xs text-muted-foreground">
                                <TruncatedText text={cat.summary} lines={2} />
                              </div>
                            ) : null}
                            <Button
                              size="sm"
                              variant="destructive"
                              className="mt-2 h-7 px-2 text-xs"
                              onClick={() => categoryDelM.mutate({ id: cat.id, botId: bot })}
                            >
                              删除
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!categories.length ? (
                    <p className="text-sm text-muted-foreground">暂无分类信息。</p>
                  ) : null}
                </div>
              </StateBlock>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trash" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">回收站</CardTitle>
              <CardDescription>已删除或失效的实体、关系与分类。</CardDescription>
            </CardHeader>
            <CardContent>
              <StateBlock loading={trashQ.isLoading} error={trashQ.error}>
                <div className="space-y-4 text-sm">
                  <div>
                    <div className="mb-2 text-xs font-medium text-muted-foreground">
                      实体 · {(trash?.entities ?? []).length}
                    </div>
                    <div className="max-h-48 space-y-2 overflow-auto">
                      {(trash?.entities ?? []).map((ent) => (
                        <div
                          key={ent.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="font-medium">{ent.name}</div>
                            <div className="text-xs text-muted-foreground">id {ent.id}</div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              disabled={trashRestoreM.isPending}
                              onClick={() =>
                                trashRestoreM.mutate({ kind: "entity", id: ent.id, botId: bot })
                              }
                            >
                              恢复
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2 text-xs"
                              disabled={trashPurgeM.isPending}
                              onClick={() => {
                                if (!window.confirm(`彻底删除实体「${ent.name}」？不可恢复。`))
                                  return;
                                trashPurgeM.mutate({ kind: "entity", id: ent.id, botId: bot });
                              }}
                            >
                              彻底删除
                            </Button>
                          </div>
                        </div>
                      ))}
                      {!(trash?.entities ?? []).length ? (
                        <p className="text-muted-foreground">暂无已删除实体。</p>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-medium text-muted-foreground">
                      关系 · {(trash?.edges ?? []).length}
                    </div>
                    <div className="max-h-48 space-y-2 overflow-auto">
                      {(trash?.edges ?? []).map((edge) => (
                        <div
                          key={edge.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                        >
                          <div className="min-w-0">
                            <TruncatedText text={edge.fact} lines={2} />
                            <div className="text-xs text-muted-foreground">id {edge.id}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            disabled={trashRestoreM.isPending}
                            onClick={() =>
                              trashRestoreM.mutate({ kind: "edge", id: edge.id, botId: bot })
                            }
                          >
                            恢复
                          </Button>
                        </div>
                      ))}
                      {!(trash?.edges ?? []).length ? (
                        <p className="text-muted-foreground">暂无已删除关系。</p>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-medium text-muted-foreground">
                      分类 · {(trash?.categories ?? []).length}
                    </div>
                    <div className="max-h-48 space-y-2 overflow-auto">
                      {(trash?.categories ?? []).map((cat) => (
                        <div
                          key={cat.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="font-medium">{cat.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Layer {num(cat.layer, 1)} · id {cat.id}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              disabled={trashRestoreM.isPending}
                              onClick={() =>
                                trashRestoreM.mutate({
                                  kind: "category",
                                  id: cat.id,
                                  botId: bot,
                                })
                              }
                            >
                              恢复
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2 text-xs"
                              disabled={trashPurgeM.isPending}
                              onClick={() => {
                                if (!window.confirm(`彻底删除分类「${cat.name}」？不可恢复。`))
                                  return;
                                trashPurgeM.mutate({
                                  kind: "category",
                                  id: cat.id,
                                  botId: bot,
                                });
                              }}
                            >
                              彻底删除
                            </Button>
                          </div>
                        </div>
                      ))}
                      {!(trash?.categories ?? []).length ? (
                        <p className="text-muted-foreground">暂无已删除分类。</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </StateBlock>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">导入 JSON</CardTitle>
              <CardDescription>导入实体、关系与分类 JSON。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder='{"entities":[],"edges":[],"categories":[]}'
                rows={8}
                className="font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!botReady || !importJson.trim() || importM.isPending}
                  onClick={() => {
                    try {
                      const payload = JSON.parse(importJson) as Record<string, unknown>;
                      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
                        setMsg("JSON 须为对象");
                        return;
                      }
                      importM.mutate({ botId: bot, groupId: group, payload });
                    } catch {
                      setMsg("JSON 解析失败");
                    }
                  }}
                >
                  导入
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!botReady || clearGraphM.isPending}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "确认软删当前 scope 的图数据（实体/关系/分类）？可在回收站恢复。",
                      )
                    )
                      return;
                    clearGraphM.mutate({ botId: bot, groupId: group, hard: false });
                  }}
                >
                  清空图数据（软删）
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">导出</CardTitle>
              <CardDescription>导出当前作用域图谱。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!botReady || exportM.isPending}
                  onClick={() => exportM.mutate({ botId: bot, groupId: group })}
                >
                  导出当前 scope
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!exportJson}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(exportJson);
                      setMsg("已复制到剪贴板");
                    } catch {
                      setMsg("复制失败");
                    }
                  }}
                >
                  复制
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!exportJson}
                  onClick={() => {
                    const blob = new Blob([exportJson], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `memory-graph-${bot}-${group ?? 0}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setMsg("已开始下载");
                  }}
                >
                  下载
                </Button>
              </div>
              {exportJson ? (
                <Textarea
                  value={exportJson}
                  readOnly
                  rows={8}
                  className="font-mono text-xs"
                />
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scopes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scope</CardTitle>
              <CardDescription>本 Bot 有记忆活动的作用域。</CardDescription>
            </CardHeader>
            <CardContent>
              <StateBlock loading={scopesQ.isLoading} error={scopesQ.error}>
                <div className="space-y-2">
                  {(scopesQ.data?.items ?? []).map((s) => (
                    <div
                      key={s.scope_key}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-xs">{s.scope_key}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Episode {s.episode_count} · 实体 {s.entity_count} · 关系 {s.edge_count}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 px-2 text-xs"
                        disabled={clearGraphM.isPending}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `确认软删 scope「${s.scope_key}」的图数据？可在回收站恢复。`,
                            )
                          )
                            return;
                          clearGraphM.mutate({
                            botId: s.bot_id,
                            groupId: s.group_id,
                            hard: false,
                          });
                        }}
                      >
                        清空该 scope 图
                      </Button>
                    </div>
                  ))}
                  {!(scopesQ.data?.items ?? []).length ? (
                    <p className="text-sm text-muted-foreground">暂无作用域记录。</p>
                  ) : null}
                </div>
              </StateBlock>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-3">
          <div className="console-panel-grid lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">偏好规则</CardTitle>
                <CardDescription>助手行为偏好。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={prefRule}
                  onChange={(e) => setPrefRule(e.target.value)}
                  placeholder="例如：少提考试"
                />
                <Button
                  size="sm"
                  disabled={!botReady || !prefRule.trim() || prefM.isPending}
                  onClick={() =>
                    prefM.mutate({
                      botId: bot,
                      groupId: group,
                      rule: prefRule.trim(),
                      polarity: "dont",
                    })
                  }
                >
                  添加偏好
                </Button>
                <div className="max-h-48 space-y-2 overflow-auto text-sm">
                  {prefs.map((item) => (
                    <div key={String(item.id)} className="rounded-md border px-2 py-1.5">
                      <span className="text-xs text-muted-foreground">{String(item.polarity)}</span>{" "}
                      {String(item.rule || "")}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">中期摘要</CardTitle>
                <CardDescription>会话过长压缩后的摘要。</CardDescription>
              </CardHeader>
              <CardContent>
                <StateBlock loading={midQ.isLoading} error={midQ.error}>
                  <div className="max-h-48 space-y-2 overflow-auto text-sm">
                    {midItems.map((item, idx) => (
                      <div
                        key={`${item.user_id}-${item.created_at}-${idx}`}
                        className="rounded-md border px-2 py-1.5"
                      >
                        <p className="text-xs text-muted-foreground">
                          用户 {String(item.user_id)} · 群 {String(item.group_id)}
                        </p>
                        <p>{String(item.summary || "")}</p>
                      </div>
                    ))}
                    {!midItems.length ? (
                      <p className="text-sm text-muted-foreground">暂无中期摘要。</p>
                    ) : null}
                  </div>
                </StateBlock>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
