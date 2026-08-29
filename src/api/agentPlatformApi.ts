import { http } from "./http";

async function unwrapData<T>(promise: Promise<{ data: { ok?: boolean; data?: T; detail?: string } }>): Promise<T> {
  const { data: body } = await promise;
  if (!body?.ok) {
    throw new Error(String(body?.detail || "request failed"));
  }
  return body.data as T;
}

export async function fetchAgentPlatformOverview(params?: { botId?: number | null; groupId?: number | null }) {
  return unwrapData(
    http.get("/llm/agent-platform/overview", {
      params: {
        bot_id: params?.botId || undefined,
        group_id: params?.groupId ?? undefined,
      },
    }),
  );
}

export async function fetchAgentPersonFacts(params: {
  botId: number;
  groupId?: number | null;
  userId?: number | null;
  limit?: number;
}) {
  return unwrapData(
    http.get("/llm/agent-platform/person-facts", {
      params: {
        bot_id: params.botId,
        group_id: params.groupId ?? undefined,
        user_id: params.userId || undefined,
        limit: params.limit ?? 50,
      },
    }),
  ) as Promise<{ items: Array<Record<string, unknown>>; count: number }>;
}

export async function saveAgentPersonFact(body: {
  botId: number;
  groupId: number;
  userId: number;
  content: string;
  scope?: string;
}) {
  return unwrapData(
    http.post("/llm/agent-platform/person-facts", {
      bot_id: body.botId,
      group_id: body.groupId,
      user_id: body.userId,
      content: body.content,
      scope: body.scope || "group",
      source: "manual",
    }),
  );
}

export async function fetchAgentTasks(params?: { groupId?: number | null; limit?: number }) {
  return unwrapData(
    http.get("/llm/agent-platform/tasks", {
      params: {
        group_id: params?.groupId ?? undefined,
        limit: params?.limit ?? 50,
      },
    }),
  ) as Promise<{ items: Array<Record<string, unknown>>; count: number }>;
}

export async function cancelAgentTask(taskId: string) {
  return unwrapData(http.post("/llm/agent-platform/tasks/cancel", { task_id: taskId }));
}

export async function fetchAgentCatchphrases(params?: { botId?: number | null; status?: string; offset?: number; limit?: number }) {
  return unwrapData(
    http.get("/llm/agent-platform/catchphrases", {
      params: {
        bot_id: params?.botId || undefined,
        status: params?.status || undefined,
        offset: params?.offset ?? 0,
        limit: params?.limit ?? 50,
      },
    }),
  ) as Promise<{
    items: Array<Record<string, unknown>>;
    count: number;
    total: number;
    counts: { candidate: number; active: number; all: number };
  }>;
}

export async function resolveAgentCatchphrase(entryId: string, action: "approve" | "reject") {
  return unwrapData(
    http.post("/llm/agent-platform/catchphrases/resolve", {
      entry_id: entryId,
      action,
    }),
  );
}

export async function fetchAgentToolsCatalog() {
  return unwrapData(http.get("/llm/agent-platform/tools")) as Promise<{
    items: Array<Record<string, unknown>>;
    count: number;
    policy?: Record<string, unknown>;
  }>;
}
