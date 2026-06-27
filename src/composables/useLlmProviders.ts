import { computed, ref } from "vue";
import {
  fetchLlmProvidersConfig,
  fetchLlmProviderModels,
  postLlmProviderTest,
  putLlmProvidersConfig,
} from "@/api/consoleApi";
import type {
  LlmProviderConfigRow,
  LlmProvidersConfig,
  LlmProviderStatusRow,
} from "@/api/pallasTypes";
import { axiosErrorDetail } from "@/api/http";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";

/** 一个 provider 的连通性测试结果（前端态）。 */
export interface ProviderTestState {
  testing: boolean;
  reachable: boolean | null;
  latencyMs: number | null;
  error: string;
}

/** 一个 provider 的在线模型发现结果（前端态）。 */
export interface ProviderModelsState {
  loading: boolean;
  models: string[];
  error: string;
  loaded: boolean;
}

function emptyDoc(): LlmProvidersConfig {
  return {
    providers: [],
    routing: { chain_fallback: [], tasks: {} },
    providers_file: "",
    file_exists: false,
  };
}

function cloneDoc(doc: LlmProvidersConfig): LlmProvidersConfig {
  return JSON.parse(JSON.stringify(doc)) as LlmProvidersConfig;
}

/**
 * 删除某个 provider 后，从 routing 中剔除对它的悬挂引用：
 * - `routing.tasks` 中指向它的 task 整条删除
 * - `chain_fallback` 中的它移除
 * 纯函数，返回新的 routing 对象，便于单测。
 */
export function pruneRoutingForProvider(
  routing: LlmProvidersConfig["routing"],
  providerId: string,
): LlmProvidersConfig["routing"] {
  const tasks: Record<string, string> = {};
  for (const [task, pid] of Object.entries(routing.tasks)) {
    if (pid !== providerId) tasks[task] = pid;
  }
  return {
    chain_fallback: routing.chain_fallback.filter((id) => id !== providerId),
    tasks,
  };
}

/**
 * Provider 编辑器的状态核心：加载、脏值追踪、保存，以及在线模型发现与连通性测试。
 * 此前这些逻辑挤在 LlmModelAdminPanel 内、仅支持 4 个硬编码 task；这里改为
 * 完整支持任意 provider 与 routing。
 */
export function useLlmProviders() {
  const doc = ref<LlmProvidersConfig>(emptyDoc());
  const baseline = ref<string>(JSON.stringify(emptyDoc()));
  const loading = ref(false);
  const saving = ref(false);
  const err = ref("");
  const providerStatus = ref<LlmProviderStatusRow[]>([]);
  const taskRouting = ref<Record<string, string>>({});
  const testStates = ref<Record<string, ProviderTestState>>({});
  const modelsStates = ref<Record<string, ProviderModelsState>>({});

  const dirty = computed(() => JSON.stringify(doc.value) !== baseline.value);
  const providers = computed(() => doc.value.providers);
  const providerIds = computed(() => doc.value.providers.map((p) => p.id));

  function markClean() {
    baseline.value = JSON.stringify(doc.value);
  }

  async function load() {
    loading.value = true;
    err.value = "";
    try {
      const fetched = await fetchLlmProvidersConfig();
      doc.value = cloneDoc(fetched);
      markClean();
    } catch (e) {
      err.value = axiosErrorDetail(e);
    } finally {
      loading.value = false;
    }
  }

  async function save() {
    if (!dirty.value) return;
    saving.value = true;
    err.value = "";
    try {
      const result = await putLlmProvidersConfig(cloneDoc(doc.value));
      if (result.provider_status) providerStatus.value = result.provider_status;
      if (result.task_routing) taskRouting.value = result.task_routing;
      if (result.providers_file) doc.value.providers_file = result.providers_file;
      markClean();
      toastSaveSuccess("已保存提供方配置");
      await load();
    } catch (e) {
      err.value = axiosErrorDetail(e);
      toastApiError(e, "保存提供方配置失败");
    } finally {
      saving.value = false;
    }
  }

  function reset() {
    doc.value = JSON.parse(baseline.value) as LlmProvidersConfig;
  }

  function addProvider(row: LlmProviderConfigRow) {
    doc.value.providers = [...doc.value.providers, row];
  }

  function updateProvider(index: number, row: LlmProviderConfigRow) {
    const next = [...doc.value.providers];
    next[index] = row;
    doc.value.providers = next;
  }

  function removeProvider(index: number) {
    const removed = doc.value.providers[index];
    doc.value.providers = doc.value.providers.filter((_, i) => i !== index);
    if (!removed) return;
    // 清理对该 provider 的路由引用，避免悬挂引用
    doc.value.routing = pruneRoutingForProvider(doc.value.routing, removed.id);
  }

  function setTaskRoute(task: string, providerId: string) {
    const tasks = { ...doc.value.routing.tasks };
    if (providerId) tasks[task] = providerId;
    else delete tasks[task];
    doc.value.routing = { ...doc.value.routing, tasks };
  }

  function setChainFallback(ids: string[]) {
    doc.value.routing = { ...doc.value.routing, chain_fallback: ids };
  }

  function setProviderTaskModel(providerId: string, task: string, model: string) {
    const index = doc.value.providers.findIndex((row) => row.id === providerId);
    if (index < 0) return;
    const row = doc.value.providers[index];
    const task_models = { ...row.task_models };
    const trimmed = model.trim();
    if (trimmed) task_models[task] = trimmed;
    else delete task_models[task];
    updateProvider(index, { ...row, task_models });
  }

  function setTaskModelRoute(task: string, providerId: string, model: string) {
    if (providerId && !doc.value.routing.tasks[task]) {
      setTaskRoute(task, providerId);
    }
    if (providerId) setProviderTaskModel(providerId, task, model);
  }

  async function testProvider(providerId: string) {
    testStates.value = {
      ...testStates.value,
      [providerId]: { testing: true, reachable: null, latencyMs: null, error: "" },
    };
    try {
      const r = await postLlmProviderTest(providerId);
      testStates.value = {
        ...testStates.value,
        [providerId]: {
          testing: false,
          reachable: r.reachable,
          latencyMs: r.latency_ms ?? null,
          error: r.error ?? "",
        },
      };
    } catch (e) {
      testStates.value = {
        ...testStates.value,
        [providerId]: {
          testing: false,
          reachable: false,
          latencyMs: null,
          error: axiosErrorDetail(e),
        },
      };
    }
  }

  async function discoverModels(providerId: string) {
    modelsStates.value = {
      ...modelsStates.value,
      [providerId]: { loading: true, models: [], error: "", loaded: false },
    };
    try {
      const r = await fetchLlmProviderModels(providerId);
      modelsStates.value = {
        ...modelsStates.value,
        [providerId]: {
          loading: false,
          models: r.models ?? [],
          error: r.ok ? "" : (r.error ?? "拉取失败"),
          loaded: true,
        },
      };
    } catch (e) {
      modelsStates.value = {
        ...modelsStates.value,
        [providerId]: { loading: false, models: [], error: axiosErrorDetail(e), loaded: true },
      };
    }
  }

  return {
    doc,
    providers,
    providerIds,
    loading,
    saving,
    err,
    dirty,
    providerStatus,
    taskRouting,
    testStates,
    modelsStates,
    load,
    save,
    reset,
    addProvider,
    updateProvider,
    removeProvider,
    setTaskRoute,
    setChainFallback,
    setProviderTaskModel,
    setTaskModelRoute,
    testProvider,
    discoverModels,
  };
}
