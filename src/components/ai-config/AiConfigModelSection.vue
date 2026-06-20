<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import type { PluginConfigField } from "@/api/pallasTypes";
import ConfigFieldRenderer from "@/components/config/ConfigFieldRenderer.vue";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import LocalModelRoutingPanel from "@/components/ai-config/LocalModelRoutingPanel.vue";
import ModelAdminPanel from "@/components/ai-config/ModelAdminPanel.vue";
import ProviderManager from "@/components/ai-config/providers/ProviderManager.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { LLM_BOT_FIELD_GROUPS } from "@/config/configFieldLabels";
import { useCommonConfigSection } from "@/composables/useCommonConfigSection";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const panelNavIcon = usePanelNavIcon();
const { err, data, fieldValues, saving, setFieldValue, save, canSave } = useCommonConfigSection({
  sectionId: "llm",
  savedMessage: "Bot 对话配置已保存",
});

const fieldByName = computed(() => {
  const map = new Map<string, PluginConfigField>();
  for (const f of data.value?.fields ?? []) map.set(f.name, f);
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
  const rest = (data.value?.fields ?? []).filter((f) => !used.has(f.name));
  return { groups, rest };
});

defineExpose({ save, canSave, saving });
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

    <ModelAdminPanel />

    <LocalModelRoutingPanel />

    <ProviderManager />

    <UiCard
      v-if="data"
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
            :disabled="saving"
            :busy="saving"
            title="Ctrl+S"
            @click="save"
          >
            {{ saving ? "保存中…" : "保存" }}
          </UiButton>
        </div>
      </div>
      <div class="panel__bd ai-config-model-fields">
        <p class="muted ai-config-section__intro">
          Bot 侧总开关、接话模式与限流；保存后热载。Ollama 模型与 Provider 路由见上方面板。
        </p>
        <div class="ai-config-model-fields__links">
          <RouterLink to="/ai/statistics">查看 AI 统计</RouterLink>
          <RouterLink to="/ai/history">查看 AI 历史</RouterLink>
          <RouterLink to="/ai/home">返回 AI 首页</RouterLink>
        </div>
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
            :model-value="fieldValues[f.name] ?? ''"
            :show-meta="false"
            :json-title="`llm · ${f.name}（JSON）`"
            @update:model-value="(v) => setFieldValue(f.name, v)"
          />
        </section>
        <ConfigFieldRenderer
          v-for="f in groupedFieldViews.rest"
          :key="f.name"
          :field="f"
          :model-value="fieldValues[f.name] ?? ''"
          :show-meta="false"
          :json-title="`llm · ${f.name}（JSON）`"
          @update:model-value="(v) => setFieldValue(f.name, v)"
        />
      </div>
    </UiCard>
  </div>
</template>

<style scoped>
.ai-config-section--model {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

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

.ai-config-model-fields__links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 0.8125rem;
}

.ai-config-model-fields__group-title {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--text-muted, #94a3b8);
}
</style>
