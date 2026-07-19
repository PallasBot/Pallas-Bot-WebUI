<script setup lang="ts">
import { computed, ref } from "vue";
import type { LlmProviderConfigRow } from "@/api/pallasTypes";
import LlmModelSelect from "@/components/ai-config/LlmModelSelect.vue";
import { LLM_TASK_ROUTE_LABELS } from "@/config/configFieldLabels";
import type { LlmModelSelectGroup } from "@/utils/llmModelOptionSources";
import {
  resolveTaskRouteModel,
  resolveTaskRouteProvider,
  taskModelUsesEnvFallback,
} from "@/utils/llmTaskRouteMatrix";
import { resolveProviderForModel } from "@/utils/resolveProviderForModel";

const props = withDefaults(
  defineProps<{
    providers: LlmProviderConfigRow[];
    tasks: Record<string, string>;
    chainFallback: string[];
    providerIds: string[];
    envTaskModels: Record<string, string>;
    modelSelectGroups: LlmModelSelectGroup[];
    discoveredByProvider?: Record<string, string[]>;
  }>(),
  { discoveredByProvider: () => ({}) },
);

const emit = defineEmits<{
  "set-task": [task: string, providerId: string];
  "set-task-model": [task: string, providerId: string, model: string];
}>();

const showUpstreamOverride = ref(false);

const TASK_KEYS = Object.keys(LLM_TASK_ROUTE_LABELS).filter((key) => key !== "other");

const allTasks = computed(() => {
  const set = new Set<string>(TASK_KEYS);
  for (const task of Object.keys(props.tasks)) set.add(task);
  for (const task of Object.keys(props.envTaskModels)) set.add(task);
  return [...set];
});

function providerKind(id: string): string {
  return props.providers.find((row) => row.id === id)?.kind || "";
}

function upstreamLabel(id: string): string {
  if (!id) return "";
  const kind = providerKind(id);
  if (kind === "local" || id === "local") return "本地";
  return id;
}

function upstreamTone(id: string): "local" | "cloud" | "muted" {
  if (!id) return "muted";
  const kind = providerKind(id);
  if (kind === "local" || id === "local") return "local";
  return "cloud";
}

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
      upstreamText: upstreamLabel(effectiveProvider),
      upstreamTone: upstreamTone(effectiveProvider),
    };
  }),
);

function onProviderChange(task: string, providerId: string) {
  emit("set-task", task, providerId);
}

function onModelChange(task: string, routedProvider: string, effectiveProvider: string, model: string) {
  const trimmed = model.trim();
  if (!trimmed) {
    if (routedProvider) emit("set-task-model", task, routedProvider, "");
    return;
  }
  const providerId = resolveProviderForModel(trimmed, props.providers, {
    preferredProviderId: routedProvider || effectiveProvider,
    chainFallback: props.chainFallback,
    discoveredByProvider: props.discoveredByProvider,
  });
  if (!providerId) return;
  if (providerId !== routedProvider) emit("set-task", task, providerId);
  emit("set-task-model", task, providerId, trimmed);
}
</script>

<template>
  <section class="task-route-rows">
    <div class="task-route-rows__head">
      <div class="task-route-rows__head-row">
        <h4 class="task-route-rows__title">任务编排</h4>
        <button
          v-if="providerIds.length > 1"
          type="button"
          class="task-route-rows__toggle"
          @click="showUpstreamOverride = !showUpstreamOverride"
        >
          {{ showUpstreamOverride ? "收起上游" : "指定上游" }}
        </button>
      </div>
      <p class="muted task-route-rows__hint">
        选模型即可；右侧徽章为自动匹配的上游。
      </p>
    </div>

    <div class="task-route-rows__list">
      <div
        v-for="row in rows"
        :key="row.task"
        class="task-route-rows__row"
        :class="{ 'has-override': showUpstreamOverride }"
      >
        <div class="task-route-rows__identity">
          <span class="task-route-rows__label">{{ row.label }}</span>
          <span
            v-if="row.upstreamText"
            class="task-route-rows__badge"
            :class="`task-route-rows__badge--${row.upstreamTone}`"
            :title="row.effectiveProvider"
          >
            {{ row.upstreamText }}
          </span>
        </div>
        <div class="task-route-rows__model-cell">
          <LlmModelSelect
            :model-value="row.model"
            :groups="modelSelectGroups"
            empty-label="跟随默认"
            :aria-label="`${row.label} 模型`"
            @update:model-value="(value) => onModelChange(row.task, row.routedProvider, row.effectiveProvider, value)"
          />
          <span
            v-if="row.envFallback"
            class="muted task-route-rows__legacy"
          >
            读自 .env；选模型并保存后写入 Provider。
          </span>
        </div>
        <select
          v-if="showUpstreamOverride"
          class="inp task-route-rows__provider"
          :value="row.routedProvider"
          :aria-label="`${row.label} 上游`"
          @change="onProviderChange(row.task, ($event.target as HTMLSelectElement).value)"
        >
          <option value="">
            跟随默认{{ row.effectiveProvider && !row.routedProvider ? `（${row.upstreamText}）` : "" }}
          </option>
          <option
            v-for="providerId in providerIds"
            :key="providerId"
            :value="providerId"
          >
            {{ upstreamLabel(providerId) }}（{{ providerId }}）
          </option>
        </select>
      </div>
    </div>
  </section>
</template>

<style scoped>
.task-route-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-route-rows__head {
  display: grid;
  gap: 4px;
}

.task-route-rows__head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.task-route-rows__title {
  margin: 0;
  font-size: 0.95rem;
}

.task-route-rows__hint {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.45;
}

.task-route-rows__toggle {
  border: 0;
  background: transparent;
  color: var(--accent, #3b82f6);
  font-size: 0.78rem;
  padding: 0;
  cursor: pointer;
  white-space: nowrap;
}

.task-route-rows__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-route-rows__row {
  display: grid;
  grid-template-columns: minmax(9.5rem, 12rem) minmax(0, 1fr);
  gap: 10px 12px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
}

.task-route-rows__row.has-override {
  grid-template-columns: minmax(9.5rem, 12rem) minmax(0, 1fr) minmax(7.5rem, 10rem);
}

.task-route-rows__identity {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  min-width: 0;
}

.task-route-rows__label {
  font-weight: 600;
  font-size: 0.86rem;
}

.task-route-rows__badge {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.01em;
  border: 1px solid transparent;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-route-rows__badge--local {
  color: color-mix(in srgb, #15803d 88%, var(--text));
  background: color-mix(in srgb, #22c55e 14%, transparent);
  border-color: color-mix(in srgb, #22c55e 28%, transparent);
}

.task-route-rows__badge--cloud {
  color: color-mix(in srgb, #1d4ed8 88%, var(--text));
  background: color-mix(in srgb, #3b82f6 12%, transparent);
  border-color: color-mix(in srgb, #3b82f6 26%, transparent);
}

.task-route-rows__badge--muted {
  color: var(--muted, #6b7280);
  background: color-mix(in srgb, var(--text) 5%, transparent);
  border-color: var(--border);
}

.task-route-rows__model-cell {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.task-route-rows__legacy {
  font-size: 0.74rem;
  line-height: 1.35;
}

@media (max-width: 560px) {
  .task-route-rows__row,
  .task-route-rows__row.has-override {
    grid-template-columns: 1fr;
  }

  .task-route-rows__head-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
