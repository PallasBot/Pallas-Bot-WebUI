<script setup lang="ts">
import { computed } from "vue";
import type { LlmProviderConfigRow } from "@/api/pallasTypes";
import LlmModelSelect from "@/components/ai-config/LlmModelSelect.vue";
import { LLM_TASK_ROUTE_LABELS } from "@/config/configFieldLabels";
import { AI_TASK_CONFIG_HINTS } from "@/config/aiEntrySemantics";
import type { LlmModelSelectGroup } from "@/utils/llmModelOptionSources";
import {
  resolveTaskRouteModel,
  resolveTaskRouteProvider,
  taskModelUsesEnvFallback,
} from "@/utils/llmTaskRouteMatrix";

const props = defineProps<{
  providers: LlmProviderConfigRow[];
  tasks: Record<string, string>;
  chainFallback: string[];
  providerIds: string[];
  envTaskModels: Record<string, string>;
  modelSelectGroups: LlmModelSelectGroup[];
}>();

const emit = defineEmits<{
  "set-task": [task: string, providerId: string];
  "set-task-model": [task: string, providerId: string, model: string];
}>();

const TASK_KEYS = Object.keys(LLM_TASK_ROUTE_LABELS).filter((key) => key !== "other");

const allTasks = computed(() => {
  const set = new Set<string>(TASK_KEYS);
  for (const task of Object.keys(props.tasks)) set.add(task);
  for (const task of Object.keys(props.envTaskModels)) set.add(task);
  return [...set];
});

const rows = computed(() =>
  allTasks.value.map((task) => {
    const routedProvider = (props.tasks[task] || "").trim();
    const effectiveProvider = resolveTaskRouteProvider(task, props.tasks, props.chainFallback);
    const model = resolveTaskRouteModel(task, effectiveProvider, props.providers, props.envTaskModels);
    return {
      task,
      label: LLM_TASK_ROUTE_LABELS[task] ?? task,
      routedProvider,
      effectiveProvider,
      model,
      envFallback: taskModelUsesEnvFallback(task, effectiveProvider, props.providers, props.envTaskModels),
    };
  }),
);

function taskLabel(task: string): string {
  return LLM_TASK_ROUTE_LABELS[task] ?? task;
}

function onProviderChange(task: string, providerId: string) {
  emit("set-task", task, providerId);
}

function onModelChange(task: string, routedProvider: string, effectiveProvider: string, model: string) {
  let providerId = routedProvider || effectiveProvider;
  if (!providerId && model.trim()) {
    providerId = props.chainFallback[0] || props.providerIds[0] || "";
    if (providerId) emit("set-task", task, providerId);
  }
  if (!providerId) return;
  emit("set-task-model", task, providerId, model);
}
</script>

<template>
  <div class="task-route-matrix">
    <div class="task-route-matrix__head">
      <h4 class="task-route-matrix__title">任务路由与模型</h4>
      <p class="muted task-route-matrix__hint">
        同一任务场景在此统一指定走哪家 Provider 与用哪个模型；保存后写入 Provider 配置。
        不再在多模型分档面板与 Provider 弹窗里重复配置任务模型。
      </p>
    </div>
    <div class="task-route-matrix__table">
      <div class="task-route-matrix__row task-route-matrix__row--head">
        <span>任务</span>
        <span>Provider</span>
        <span>模型</span>
      </div>
      <div
        v-for="row in rows"
        :key="row.task"
        class="task-route-matrix__row"
      >
        <span class="task-route-matrix__task-label">{{ row.label }}</span>
        <select
          class="inp"
          :value="row.routedProvider"
          :aria-label="`${taskLabel(row.task)} Provider`"
          @change="onProviderChange(row.task, ($event.target as HTMLSelectElement).value)"
        >
          <option value="">
            自动{{ row.effectiveProvider && !row.routedProvider ? `（→ ${row.effectiveProvider}）` : "" }}
          </option>
          <option
            v-for="providerId in providerIds"
            :key="providerId"
            :value="providerId"
          >
            {{ providerId }}
          </option>
        </select>
        <div class="task-route-matrix__model-cell">
          <LlmModelSelect
            :model-value="row.model"
            :groups="modelSelectGroups"
            empty-label="（回退 Provider 默认）"
            :aria-label="`${row.label} 模型`"
            @update:model-value="(value) => onModelChange(row.task, row.routedProvider, row.effectiveProvider, value)"
          />
          <span
            v-if="row.envFallback"
            class="muted task-route-matrix__legacy"
          >
            当前读自 .env 旧项；在此选择模型并保存后将写入 Provider。
          </span>
        </div>
      </div>
    </div>
    <p class="muted task-route-matrix__footnote">
      {{ AI_TASK_CONFIG_HINTS.providerTaskRoute }}
      {{ AI_TASK_CONFIG_HINTS.providerTaskModel }}
    </p>
  </div>
</template>

<style scoped>
.task-route-matrix {
  display: grid;
  gap: 12px;
}

.task-route-matrix__title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
}

.task-route-matrix__hint,
.task-route-matrix__footnote {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
}

.task-route-matrix__table {
  display: grid;
  gap: 8px;
}

.task-route-matrix__row {
  display: grid;
  grid-template-columns: minmax(88px, 140px) minmax(120px, 180px) minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.task-route-matrix__row--head {
  font-size: 12px;
  font-weight: 650;
  color: var(--text-muted, #94a3b8);
}

.task-route-matrix__task-label {
  font-size: 13px;
  font-weight: 600;
  padding-top: 8px;
}

.task-route-matrix__model-cell {
  display: grid;
  gap: 4px;
}

.task-route-matrix__legacy {
  font-size: 11px;
  line-height: 1.45;
}

@media (max-width: 560px) {
  .task-route-matrix__row,
  .task-route-matrix__row--head {
    grid-template-columns: 1fr;
  }

  .task-route-matrix__row--head {
    display: none;
  }

  .task-route-matrix__task-label {
    padding-top: 0;
  }
}
</style>
