import { computed, watch, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";

export const AI_HISTORY_WORKSPACES = ["sessions", "maintain", "rules", "memory"] as const;
export type AiHistoryWorkspace = (typeof AI_HISTORY_WORKSPACES)[number];

export function isAiHistoryWorkspace(raw: unknown): raw is AiHistoryWorkspace {
  return typeof raw === "string" && (AI_HISTORY_WORKSPACES as readonly string[]).includes(raw);
}

/** 历史二级工作区 ↔ `?workspace=` 双向同步 */
export function useAiHistoryWorkspaceQuery(activeWorkspace: Ref<AiHistoryWorkspace>) {
  const route = useRoute();
  const router = useRouter();

  const queryWorkspace = computed(() => {
    const raw = route.query.workspace;
    return isAiHistoryWorkspace(raw) ? raw : null;
  });

  function applyFromQuery(raw: unknown = route.query.workspace): void {
    if (isAiHistoryWorkspace(raw) && activeWorkspace.value !== raw) {
      activeWorkspace.value = raw;
    }
  }

  function writeQuery(next: AiHistoryWorkspace): void {
    if (String(route.query.workspace ?? "") === next) return;
    void router.replace({
      path: route.path,
      query: { ...route.query, workspace: next },
    });
  }

  watch(
    () => route.query.workspace,
    (raw) => applyFromQuery(raw),
  );

  watch(activeWorkspace, (next) => {
    writeQuery(next);
  }, { immediate: true });

  return {
    queryWorkspace,
    applyFromQuery,
    writeQuery,
  };
}
