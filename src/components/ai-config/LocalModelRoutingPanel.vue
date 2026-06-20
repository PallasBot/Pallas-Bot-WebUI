<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchLlmModelAdminStatus, fetchLlmProvidersConfig } from "@/api/consoleApi";
import { axiosErrorDetail } from "@/api/http";
import type { LlmModelAdminStatus, LlmProviderConfigRow } from "@/api/pallasTypes";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";

const loading = ref(false);
const err = ref("");
const status = ref<LlmModelAdminStatus | null>(null);
const providers = ref<LlmProviderConfigRow[]>([]);

const localProviders = computed(() => providers.value.filter((row) => row.kind === "local"));
const localProviderDefaults = computed(() =>
  localProviders.value
    .filter((row) => (row.default_model || "").trim())
    .map((row) => ({ id: row.id, model: row.default_model.trim() })),
);
const localProviderTaskModels = computed(() =>
  localProviders.value
    .flatMap((row) =>
      Object.entries(row.task_models || {})
        .filter(([, model]) => String(model || "").trim())
        .map(([task, model]) => ({ providerId: row.id, task, model: String(model).trim() })),
    ),
);
const localTaskModels = computed(() =>
  Object.entries(status.value?.local_task_models || {}).map(([task, model]) => ({ task, model })),
);
const localMoeModels = computed(() =>
  Object.entries(status.value?.local_moe_models || {}).map(([tier, model]) => ({ tier, model })),
);
const strategyLabel = computed(() =>
  status.value?.local_model_policy === "multi" ? "多模型分流" : "单模型跟随当前运行态",
);

async function load() {
  loading.value = true;
  err.value = "";
  try {
    const [admin, doc] = await Promise.all([
      fetchLlmModelAdminStatus(),
      fetchLlmProvidersConfig(),
    ]);
    status.value = admin;
    providers.value = doc.providers || [];
  } catch (e) {
    err.value = axiosErrorDetail(e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <UiCard
    tag="section"
    glass
    class="local-routing-panel"
  >
    <div class="panel__hd panel__hd--split">
      <h2 class="panel__title">本地模型路由</h2>
      <UiButton
        variant="outline"
        size="sm"
        :disabled="loading"
        @click="load"
      >
        刷新
      </UiButton>
    </div>

    <div class="panel__bd local-routing-panel__body">
      <p class="muted local-routing-panel__intro">
        这里展示本地 Ollama 请求最终可能命中的模型来源。若上方切了当前模型，但这里还有 task / MoE / provider 默认模型覆盖，仍可能继续拉起其他本地模型。
      </p>

      <div
        v-if="err"
        class="alert alert--err"
      >
        {{ err }}
      </div>

      <div class="local-routing-panel__summary">
        <div class="local-routing-panel__summary-item">
          <span class="local-routing-panel__summary-label">当前策略</span>
          <strong class="local-routing-panel__summary-value">{{ loading ? "读取中…" : strategyLabel }}</strong>
        </div>
        <div class="local-routing-panel__summary-item">
          <span class="local-routing-panel__summary-label">当前运行模型</span>
          <strong class="local-routing-panel__summary-value">{{ loading ? "读取中…" : status?.model || "—" }}</strong>
        </div>
        <div class="local-routing-panel__summary-item">
          <span class="local-routing-panel__summary-label">多模型分流</span>
          <strong class="local-routing-panel__summary-value">
            {{ loading ? "…" : status?.local_multi_model_enabled ? "已开启" : "已关闭" }}
          </strong>
        </div>
      </div>

      <div class="local-routing-panel__grid">
        <section class="local-routing-panel__block">
          <h3>本地 task 覆盖</h3>
          <p
            v-if="!localTaskModels.length"
            class="muted"
          >
            无 AI 侧全局 task 模型覆盖。
          </p>
          <ul
            v-else
            class="local-routing-panel__list"
          >
            <li
              v-for="row in localTaskModels"
              :key="`task-${row.task}`"
            >
              <code>{{ row.task }}</code>
              <span>{{ row.model }}</span>
            </li>
          </ul>
        </section>

        <section class="local-routing-panel__block">
          <h3>本地 MoE 模型</h3>
          <p
            v-if="!localMoeModels.length"
            class="muted"
          >
            当前未配置本地 MoE simple / medium / complex / vision 模型。
          </p>
          <ul
            v-else
            class="local-routing-panel__list"
          >
            <li
              v-for="row in localMoeModels"
              :key="`moe-${row.tier}`"
            >
              <code>{{ row.tier }}</code>
              <span>{{ row.model }}</span>
            </li>
          </ul>
        </section>

        <section class="local-routing-panel__block">
          <h3>本地 Provider 默认模型</h3>
          <p
            v-if="!localProviderDefaults.length"
            class="muted"
          >
            当前没有额外的本地 provider 默认模型。
          </p>
          <ul
            v-else
            class="local-routing-panel__list"
          >
            <li
              v-for="row in localProviderDefaults"
              :key="`provider-default-${row.id}`"
            >
              <code>{{ row.id }}</code>
              <span>{{ row.model }}</span>
            </li>
          </ul>
        </section>

        <section class="local-routing-panel__block">
          <h3>Provider 内 task 覆盖</h3>
          <p
            v-if="!localProviderTaskModels.length"
            class="muted"
          >
            当前没有本地 provider 自身的 task 覆盖。
          </p>
          <ul
            v-else
            class="local-routing-panel__list"
          >
            <li
              v-for="row in localProviderTaskModels"
              :key="`provider-task-${row.providerId}-${row.task}`"
            >
              <code>{{ row.providerId }} / {{ row.task }}</code>
              <span>{{ row.model }}</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </UiCard>
</template>

<style scoped>
.local-routing-panel__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.local-routing-panel__intro {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}

.local-routing-panel__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.local-routing-panel__summary-item {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--primary, var(--accent)) 14%, var(--border));
  background: color-mix(in srgb, var(--primary, var(--accent)) 4%, var(--card, var(--bg-card)));
}

.local-routing-panel__summary-label {
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
}

.local-routing-panel__summary-value {
  font-size: 14px;
  line-height: 1.4;
}

.local-routing-panel__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.local-routing-panel__block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
  background: color-mix(in srgb, var(--bg-card) 88%, transparent);
}

.local-routing-panel__block h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
}

.local-routing-panel__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.local-routing-panel__list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--text) 4%, transparent);
  font-size: 12px;
}

.local-routing-panel__list code {
  color: var(--text-muted, #94a3b8);
  word-break: break-word;
}

.local-routing-panel__list span {
  text-align: right;
  word-break: break-word;
}

@media (max-width: 560px) {
  .local-routing-panel__grid {
    grid-template-columns: 1fr;
  }

  .local-routing-panel__list li {
    align-items: flex-start;
    flex-direction: column;
  }

  .local-routing-panel__list span {
    text-align: left;
  }
}
</style>
