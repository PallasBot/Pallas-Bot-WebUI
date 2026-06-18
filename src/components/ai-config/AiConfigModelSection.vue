<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { fetchCommonConfig, putCommonConfig } from "@/api/consoleApi";
import type { PluginConfigData, PluginConfigField } from "@/api/pallasTypes";
import ConfigFieldRenderer from "@/components/config/ConfigFieldRenderer.vue";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import LlmModelAdminPanel from "@/components/LlmModelAdminPanel.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { LLM_BOT_FIELD_GROUPS } from "@/config/aiConfigFieldLabels";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";
import {
  fieldValuesFromConfig,
  parsePluginConfigField,
} from "@/utils/pluginConfigFieldModel";

const LLM_SECTION_ID = "llm";
const panelNavIcon = usePanelNavIcon();
const err = ref("");
const llmBotData = ref<PluginConfigData | null>(null);
const llmBotFieldValues = ref<Record<string, string>>({});
const llmBotSaving = ref(false);
const loaded = ref(false);

watch(llmBotData, (d) => {
  if (d) llmBotFieldValues.value = fieldValuesFromConfig(d.fields);
});

const fieldByName = computed(() => {
  const map = new Map<string, PluginConfigField>();
  for (const f of llmBotData.value?.fields ?? []) map.set(f.name, f);
  return map;
});

const groupedFieldViews = computed(() => {
  const used = new Set<string>();
  const groups = LLM_BOT_FIELD_GROUPS.map((group) => {
    const fields = group.keys
      .map((key) => fieldByName.value.get(key))
      .filter((f): f is PluginConfigField => Boolean(f));
    for (const f of fields) used.add(f.name);
    return { title: group.title, fields };
  }).filter((g) => g.fields.length > 0);
  const rest = (llmBotData.value?.fields ?? []).filter((f) => !used.has(f.name));
  return { groups, rest };
});

async function load() {
  if (loaded.value && llmBotData.value) return;
  err.value = "";
  try {
    llmBotData.value = await fetchCommonConfig(LLM_SECTION_ID);
    loaded.value = true;
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

async function save() {
  if (!llmBotData.value) return;
  llmBotSaving.value = true;
  err.value = "";
  try {
    const values: Record<string, unknown> = {};
    for (const f of llmBotData.value.fields) {
      const raw = llmBotFieldValues.value[f.name] ?? "";
      values[f.name] = parsePluginConfigField(f, raw);
    }
    llmBotData.value = await putCommonConfig(LLM_SECTION_ID, values);
    toastSaveSuccess("Bot 对话配置已保存");
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    toastApiError(e, "保存失败");
  } finally {
    llmBotSaving.value = false;
  }
}

void load();

defineExpose({ save, canSave: () => Boolean(llmBotData.value) && !llmBotSaving.value, saving: llmBotSaving });
</script>

<template>
  <div class="ai-config-section ai-config-section--model">
    <div
      v-if="err"
      class="alert alert--err"
      style="margin-bottom: 12px"
    >
      {{ err }}
    </div>

    <UiCard
      tag="div"
      glass
      class="ai-config-section__panel"
    >
      <div class="panel__hd">
        <h2 class="panel__title">
          <ConsoleNavIcon
            class="panel__title-ico"
            name="sparkles"
          />Ollama 与推理
        </h2>
      </div>
      <div class="panel__bd">
        <LlmModelAdminPanel embedded />
      </div>
    </UiCard>

    <UiCard
      v-if="llmBotData"
      tag="div"
      glass
      class="ai-config-section__panel"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <ConsoleNavIcon
            class="panel__title-ico"
            :name="panelNavIcon"
          />Bot 对话策略
        </h2>
        <div class="row-actions">
          <UiButton
            variant="primary"
            :disabled="llmBotSaving"
            :busy="llmBotSaving"
            title="Ctrl+S"
            @click="save"
          >
            {{ llmBotSaving ? "保存中…" : "保存" }}
          </UiButton>
        </div>
      </div>
      <div class="panel__bd ai-config-model-fields">
        <p class="muted ai-config-section__intro">
          Bot 侧总开关、接话模式与限流；保存后热载。Ollama 模型与提供方路由见上方面板。
        </p>
        <section
          v-for="group in groupedFieldViews.groups"
          :key="group.title"
          class="ai-config-model-fields__group"
        >
          <h3 class="ai-config-model-fields__group-title">
            {{ group.title }}
          </h3>
          <ConfigFieldRenderer
            v-for="f in group.fields"
            :key="f.name"
            :field="f"
            :model-value="llmBotFieldValues[f.name] ?? ''"
            :show-meta="false"
            :json-title="`llm · ${f.name}（JSON）`"
            @update:model-value="(v) => (llmBotFieldValues = { ...llmBotFieldValues, [f.name]: v })"
          />
        </section>
        <ConfigFieldRenderer
          v-for="f in groupedFieldViews.rest"
          :key="f.name"
          :field="f"
          :model-value="llmBotFieldValues[f.name] ?? ''"
          :show-meta="false"
          :json-title="`llm · ${f.name}（JSON）`"
          @update:model-value="(v) => (llmBotFieldValues = { ...llmBotFieldValues, [f.name]: v })"
        />
      </div>
    </UiCard>
  </div>
</template>

<style scoped>
.ai-config-model-fields {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.ai-config-model-fields__group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-config-model-fields__group-title {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--text-muted, #94a3b8);
}
</style>
