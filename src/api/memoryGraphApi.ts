import { http } from "@/api/http";

interface ApiOkEnvelope<T> {
  ok: boolean;
  data: T;
}

function unwrap<T>(body: ApiOkEnvelope<T> | null | undefined, path: string): T {
  if (!body || typeof body !== "object" || !body.ok) {
    throw new Error(`${path}: 响应异常`);
  }
  return body.data;
}

const BASE = "/llm/conversation-kernel/memory/graph";

export type MemoryGraphStats = {
  scope_key: string;
  episode_count: number;
  entity_count: number;
  speaker_entity_count: number;
  edge_count: number;
  active_edge_count: number;
  category_count: number;
  scope_keys: string[];
};

export type MemoryGraphNode = {
  id: string;
  label: string;
  kind: string;
  summary?: string;
  is_speaker?: boolean;
};

export type MemoryGraphLink = {
  id: string;
  source: string;
  target: string;
  fact: string;
  weight: number;
  source_name?: string;
  target_name?: string;
};

export type MemoryGraphPayload = {
  scope_key: string;
  nodes: MemoryGraphNode[];
  edges: MemoryGraphLink[];
  total_nodes: number;
  total_edges: number;
};

export type MemoryEpisode = {
  id: string;
  scope_key: string;
  content: string;
  keywords?: string;
  source?: string;
  group_id?: number;
  created_at?: number;
  updated_at?: number;
};

export type MemoryEntity = {
  id: string;
  name: string;
  summary?: string;
  kind?: string;
  tags?: string[];
  is_speaker?: boolean;
  source?: string;
  user_id?: number | null;
};

export type MemoryEdge = {
  id: string;
  fact: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type?: string;
  weight?: number;
  invalid_at?: number | null;
  source?: string;
};

export type MemoryScopeRow = {
  scope_key: string;
  bot_id: number;
  group_id: number;
  episode_count: number;
  entity_count: number;
  edge_count: number;
};

function scopeParams(botId: number, groupId: number | null | undefined) {
  return {
    bot_id: botId,
    ...(groupId != null && groupId >= 0 ? { group_id: groupId } : {}),
  };
}

export async function fetchMemoryGraphStats(params: {
  botId: number;
  groupId?: number | null;
}): Promise<MemoryGraphStats> {
  const { data } = await http.get<ApiOkEnvelope<MemoryGraphStats>>(`${BASE}/stats`, {
    params: scopeParams(params.botId, params.groupId),
  });
  return unwrap(data, `${BASE}/stats`);
}

export async function fetchMemoryGraph(params: {
  botId: number;
  groupId?: number | null;
}): Promise<MemoryGraphPayload> {
  const { data } = await http.get<ApiOkEnvelope<MemoryGraphPayload>>(BASE, {
    params: scopeParams(params.botId, params.groupId),
  });
  return unwrap(data, BASE);
}

export async function fetchMemoryGraphEpisodes(params: {
  botId: number;
  groupId?: number | null;
  query?: string;
  limit?: number;
}): Promise<{ items: MemoryEpisode[] }> {
  const { data } = await http.get<ApiOkEnvelope<{ items: MemoryEpisode[] }>>(`${BASE}/episodes`, {
    params: {
      ...scopeParams(params.botId, params.groupId),
      ...(params.query ? { query: params.query } : {}),
      limit: params.limit ?? 50,
    },
  });
  return unwrap(data, `${BASE}/episodes`);
}

export async function fetchMemoryGraphEntities(params: {
  botId: number;
  groupId?: number | null;
  query?: string;
  limit?: number;
}): Promise<{ items: MemoryEntity[] }> {
  const { data } = await http.get<ApiOkEnvelope<{ items: MemoryEntity[] }>>(`${BASE}/entities`, {
    params: {
      ...scopeParams(params.botId, params.groupId),
      ...(params.query ? { query: params.query } : {}),
      limit: params.limit ?? 50,
    },
  });
  return unwrap(data, `${BASE}/entities`);
}

export async function fetchMemoryGraphEdges(params: {
  botId: number;
  groupId?: number | null;
  includeInvalid?: boolean;
  limit?: number;
}): Promise<{ items: MemoryEdge[] }> {
  const { data } = await http.get<ApiOkEnvelope<{ items: MemoryEdge[] }>>(`${BASE}/edges`, {
    params: {
      ...scopeParams(params.botId, params.groupId),
      include_invalid: params.includeInvalid ?? false,
      limit: params.limit ?? 100,
    },
  });
  return unwrap(data, `${BASE}/edges`);
}

export async function fetchMemoryGraphScopes(params: {
  botId: number;
}): Promise<{ items: MemoryScopeRow[] }> {
  const { data } = await http.get<ApiOkEnvelope<{ items: MemoryScopeRow[] }>>(`${BASE}/scopes`, {
    params: { bot_id: params.botId },
  });
  return unwrap(data, `${BASE}/scopes`);
}

export async function postMemoryGraphSearch(body: {
  botId: number;
  groupId?: number | null;
  query: string;
  limit?: number;
}): Promise<{
  query: string;
  episodes: MemoryEpisode[];
  entities: MemoryEntity[];
  edges: MemoryEdge[];
  count: number;
}> {
  const { data } = await http.post<
    ApiOkEnvelope<{
      query: string;
      episodes: MemoryEpisode[];
      entities: MemoryEntity[];
      edges: MemoryEdge[];
      count: number;
    }>
  >(`${BASE}/search`, {
    bot_id: body.botId,
    group_id: body.groupId,
    query: body.query,
    limit: body.limit ?? 30,
  });
  return unwrap(data, `${BASE}/search`);
}

export async function postMemoryGraphEntity(body: {
  botId: number;
  groupId?: number | null;
  name: string;
  summary?: string;
  kind?: string;
}): Promise<MemoryEntity> {
  const { data } = await http.post<ApiOkEnvelope<MemoryEntity>>(`${BASE}/entities`, {
    bot_id: body.botId,
    group_id: body.groupId,
    name: body.name,
    summary: body.summary ?? "",
    kind: body.kind ?? "concept",
  });
  return unwrap(data, `${BASE}/entities`);
}

export async function postMemoryGraphEntityDelete(body: {
  id: string | number;
  botId?: number;
}): Promise<void> {
  const { data } = await http.post<ApiOkEnvelope<{ deleted: boolean }>>(`${BASE}/entities/delete`, {
    id: Number(body.id),
    bot_id: body.botId,
  });
  unwrap(data, `${BASE}/entities/delete`);
}

export async function postMemoryGraphEdge(body: {
  botId: number;
  groupId?: number | null;
  fact: string;
  sourceEntityId: string | number;
  targetEntityId: string | number;
}): Promise<MemoryEdge> {
  const { data } = await http.post<ApiOkEnvelope<MemoryEdge>>(`${BASE}/edges`, {
    bot_id: body.botId,
    group_id: body.groupId,
    fact: body.fact,
    source_entity_id: Number(body.sourceEntityId),
    target_entity_id: Number(body.targetEntityId),
  });
  return unwrap(data, `${BASE}/edges`);
}

export async function postMemoryGraphEdgeDelete(body: {
  id: string | number;
  botId?: number;
}): Promise<void> {
  const { data } = await http.post<ApiOkEnvelope<{ deleted: boolean }>>(`${BASE}/edges/delete`, {
    id: Number(body.id),
    bot_id: body.botId,
  });
  unwrap(data, `${BASE}/edges/delete`);
}

export async function postMemoryGraphEdgeRestore(body: {
  id: string | number;
  botId?: number;
}): Promise<void> {
  const { data } = await http.post<ApiOkEnvelope<{ restored: boolean }>>(`${BASE}/edges/restore`, {
    id: Number(body.id),
    bot_id: body.botId,
  });
  unwrap(data, `${BASE}/edges/restore`);
}

export type MemoryCategory = {
  id: string;
  category_id?: number;
  scope_key?: string;
  bot_id?: number;
  group_id?: number;
  name: string;
  summary?: string;
  tags?: string[];
  layer?: number;
  parent_id?: number | null;
  member_entity_ids?: string[];
  source?: string;
  deleted_at?: number | null;
  created_at?: number;
  updated_at?: number;
};

export type HiergraphStatus = {
  scope_key?: string;
  bot_id?: number;
  group_id?: number;
  max_layer?: number;
  last_rebuild_at?: number;
  entity_count_at_rebuild?: number;
  group_summary?: string;
  updated_at?: number;
};

export type TrashPayload = {
  scope_key?: string;
  entities: MemoryEntity[];
  edges: MemoryEdge[];
  categories: MemoryCategory[];
  count?: number;
};

export type ImportResult = {
  ok?: boolean;
  scope_key?: string;
  entities_upserted?: number;
  edges_upserted?: number;
  categories_upserted?: number;
  error?: string;
};

export type ExtractResult = {
  entities_upserted?: number;
  edges_upserted?: number;
  episodes?: number;
  error?: string;
  raw?: string;
};

export async function fetchMemoryGraphCategories(params: {
  botId: number;
  groupId?: number | null;
  includeDeleted?: boolean;
  limit?: number;
}): Promise<{ items: MemoryCategory[]; total: number }> {
  const { data } = await http.get<ApiOkEnvelope<{ items: MemoryCategory[]; total: number }>>(
    `${BASE}/categories`,
    {
      params: {
        ...scopeParams(params.botId, params.groupId),
        include_deleted: params.includeDeleted ?? false,
        limit: params.limit ?? 100,
      },
    },
  );
  return unwrap(data, `${BASE}/categories`);
}

export async function postMemoryGraphCategory(body: {
  botId: number;
  groupId?: number | null;
  name: string;
  summary?: string;
  layer?: number;
  parentId?: number | null;
}): Promise<MemoryCategory> {
  const { data } = await http.post<ApiOkEnvelope<MemoryCategory>>(`${BASE}/categories`, {
    bot_id: body.botId,
    group_id: body.groupId,
    name: body.name,
    summary: body.summary ?? "",
    layer: body.layer ?? 1,
    parent_id: body.parentId ?? null,
    source: "manual",
  });
  return unwrap(data, `${BASE}/categories`);
}

export async function postMemoryGraphCategoryDelete(body: {
  id: string | number;
  botId?: number;
}): Promise<void> {
  const { data } = await http.post<ApiOkEnvelope<{ deleted: boolean }>>(
    `${BASE}/categories/delete`,
    {
      id: Number(body.id),
      bot_id: body.botId,
    },
  );
  unwrap(data, `${BASE}/categories/delete`);
}

export async function postMemoryGraphCategoryRestore(body: {
  id: string | number;
  botId?: number;
}): Promise<void> {
  const { data } = await http.post<ApiOkEnvelope<{ restored: boolean }>>(
    `${BASE}/categories/restore`,
    {
      id: Number(body.id),
      bot_id: body.botId,
    },
  );
  unwrap(data, `${BASE}/categories/restore`);
}

export async function postMemoryGraphCategoryPurge(body: {
  id: string | number;
  botId?: number;
}): Promise<void> {
  const { data } = await http.post<ApiOkEnvelope<{ purged: boolean }>>(
    `${BASE}/categories/purge`,
    {
      id: Number(body.id),
      bot_id: body.botId,
    },
  );
  unwrap(data, `${BASE}/categories/purge`);
}

export async function fetchMemoryGraphHierStatus(params: {
  botId: number;
  groupId?: number | null;
}): Promise<HiergraphStatus> {
  const { data } = await http.get<ApiOkEnvelope<HiergraphStatus>>(`${BASE}/hiergraph/status`, {
    params: scopeParams(params.botId, params.groupId),
  });
  return unwrap(data, `${BASE}/hiergraph/status`);
}

export async function postMemoryGraphHierRebuild(body: {
  botId: number;
  groupId?: number | null;
  maxLayers?: number;
}): Promise<Record<string, unknown>> {
  const { data } = await http.post<ApiOkEnvelope<Record<string, unknown>>>(
    `${BASE}/hiergraph/rebuild`,
    {
      bot_id: body.botId,
      group_id: body.groupId,
      ...(body.maxLayers != null ? { max_layers: body.maxLayers } : {}),
    },
  );
  return unwrap(data, `${BASE}/hiergraph/rebuild`);
}

export async function postMemoryGraphExtract(body: {
  botId: number;
  groupId?: number | null;
  text?: string;
  limit?: number;
  episodeId?: string;
}): Promise<ExtractResult> {
  const { data } = await http.post<ApiOkEnvelope<ExtractResult>>(`${BASE}/extract`, {
    bot_id: body.botId,
    group_id: body.groupId,
    ...(body.text ? { text: body.text } : {}),
    ...(body.limit != null ? { limit: body.limit } : {}),
    ...(body.episodeId ? { episode_id: body.episodeId } : {}),
  });
  return unwrap(data, `${BASE}/extract`);
}

export async function fetchMemoryGraphTrash(params: {
  botId: number;
  groupId?: number | null;
  limit?: number;
}): Promise<TrashPayload> {
  const { data } = await http.get<ApiOkEnvelope<TrashPayload>>(`${BASE}/trash`, {
    params: {
      ...scopeParams(params.botId, params.groupId),
      limit: params.limit ?? 100,
    },
  });
  return unwrap(data, `${BASE}/trash`);
}

export async function postMemoryGraphTrashRestore(body: {
  kind: "entity" | "edge" | "category";
  id: string | number;
  botId?: number;
}): Promise<void> {
  const { data } = await http.post<ApiOkEnvelope<{ restored: boolean }>>(`${BASE}/trash/restore`, {
    kind: body.kind,
    id: Number(body.id),
    bot_id: body.botId,
  });
  unwrap(data, `${BASE}/trash/restore`);
}

export async function postMemoryGraphTrashPurge(body: {
  kind: "entity" | "category";
  id: string | number;
  botId?: number;
}): Promise<void> {
  const { data } = await http.post<ApiOkEnvelope<{ purged: boolean }>>(`${BASE}/trash/purge`, {
    kind: body.kind,
    id: Number(body.id),
    bot_id: body.botId,
  });
  unwrap(data, `${BASE}/trash/purge`);
}

export async function fetchMemoryGraphExport(params: {
  botId: number;
  groupId?: number | null;
}): Promise<Record<string, unknown>> {
  const { data } = await http.get<ApiOkEnvelope<Record<string, unknown>>>(`${BASE}/export`, {
    params: scopeParams(params.botId, params.groupId),
  });
  return unwrap(data, `${BASE}/export`);
}

export async function postMemoryGraphImport(body: {
  botId: number;
  groupId?: number | null;
  payload: Record<string, unknown>;
}): Promise<ImportResult> {
  const { data } = await http.post<ApiOkEnvelope<ImportResult>>(`${BASE}/import`, {
    bot_id: body.botId,
    group_id: body.groupId,
    payload: body.payload,
  });
  return unwrap(data, `${BASE}/import`);
}

export async function postMemoryGraphClear(body: {
  botId: number;
  groupId?: number | null;
  hard?: boolean;
}): Promise<Record<string, number>> {
  const { data } = await http.post<ApiOkEnvelope<Record<string, number>>>(`${BASE}/clear`, {
    bot_id: body.botId,
    group_id: body.groupId,
    hard: body.hard ?? false,
  });
  return unwrap(data, `${BASE}/clear`);
}

export async function postMemoryGraphEntityRestore(body: {
  id: string | number;
  botId?: number;
}): Promise<void> {
  const { data } = await http.post<ApiOkEnvelope<{ restored: boolean }>>(
    `${BASE}/entities/restore`,
    {
      id: Number(body.id),
      bot_id: body.botId,
    },
  );
  unwrap(data, `${BASE}/entities/restore`);
}

export async function postMemoryGraphEntityPurge(body: {
  id: string | number;
  botId?: number;
}): Promise<void> {
  const { data } = await http.post<ApiOkEnvelope<{ purged: boolean }>>(`${BASE}/entities/purge`, {
    id: Number(body.id),
    bot_id: body.botId,
  });
  unwrap(data, `${BASE}/entities/purge`);
}
