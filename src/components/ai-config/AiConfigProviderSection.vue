<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";
import AiExtensionStatusBar from "@/components/ai-config/AiExtensionStatusBar.vue";
import ModelAdminPanel from "@/components/ai-config/ModelAdminPanel.vue";
import LocalModelRoutingPanel from "@/components/ai-config/LocalModelRoutingPanel.vue";
import SimpleAccessPanel from "@/components/ai-config/SimpleAccessPanel.vue";
import ProviderManager from "@/components/ai-config/providers/ProviderManager.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import { useAiConfigExpertMode } from "@/composables/useAiConfigExpertMode";

export type ExpertProviderTab = "upstream" | "tasks" | "local";

const { isSimpleMode } = useAiConfigExpertMode();
const providerRef = ref<InstanceType<typeof ProviderManager> | null>(null);
const simpleRef = ref<InstanceType<typeof SimpleAccessPanel> | null>(null);
const expertTab = ref<ExpertProviderTab>("upstream");

function saveSimpleMode() {
  const panel = simpleRef.value;
  if (!panel) return undefined;
  return panel.activeMode?.() === "local" ? panel.saveLocal?.() : panel.saveCloud?.();
}

function canSaveSimpleMode() {
  const panel = simpleRef.value;
  if (!panel) return false;
  return panel.activeMode?.() === "local" ? panel.canSaveLocal?.() ?? false : panel.canSaveCloud?.() ?? false;
}

defineExpose({
  save: () => (isSimpleMode.value ? saveSimpleMode() : providerRef.value?.save?.()),
  canSave: () => (isSimpleMode.value ? canSaveSimpleMode() : providerRef.value?.canSave?.()) ?? false,
  saving: () => (isSimpleMode.value ? simpleRef.value?.saving : providerRef.value?.saving) ?? false,
});
</script>

<template>
  <div class="ai-config-section ai-config-section--provider">
    <SimpleAccessPanel
      v-if="isSimpleMode"
      ref="simpleRef"
    />
    <template v-else>
      <AiExtensionStatusBar />
      <p class="muted ai-config-section__layer-hint">
        上游、任务与本地运行收在同一面板；完整地址配置见
        <RouterLink :to="aiConfigSectionPath('connection')">AI 服务</RouterLink>。
      </p>

      <UiCard
        tag="section"
        glass
        class="ai-config-section__expert"
      >
        <div
          class="console-view-toggle ai-config-section__tabs"
          role="tablist"
          aria-label="专家配置分区"
        >
          <button
            type="button"
            role="tab"
            :class="{ 'is-on': expertTab === 'upstream' }"
            :aria-selected="expertTab === 'upstream'"
            @click="expertTab = 'upstream'"
          >
            上游
          </button>
          <button
            type="button"
            role="tab"
            :class="{ 'is-on': expertTab === 'tasks' }"
            :aria-selected="expertTab === 'tasks'"
            @click="expertTab = 'tasks'"
          >
            任务编排
          </button>
          <button
            type="button"
            role="tab"
            :class="{ 'is-on': expertTab === 'local' }"
            :aria-selected="expertTab === 'local'"
            @click="expertTab = 'local'"
          >
            本地运行
          </button>
        </div>

        <div class="ai-config-section__tab-body">
          <ProviderManager
            v-show="expertTab === 'upstream' || expertTab === 'tasks'"
            ref="providerRef"
            compact
            :panel="expertTab === 'tasks' ? 'tasks' : 'upstream'"
          />
          <div
            v-show="expertTab === 'local'"
            class="ai-config-section__local"
          >
            <ModelAdminPanel embedded />
            <LocalModelRoutingPanel compact />
          </div>
        </div>
      </UiCard>
    </template>
  </div>
</template>

<style scoped>
.ai-config-section--provider {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-config-section__layer-hint {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.55;
}

.ai-config-section__expert {
  overflow: hidden;
}

.ai-config-section__tabs {
  margin: 12px 12px 0;
}

.ai-config-section__tab-body {
  padding: 12px;
}

.ai-config-section__local {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

@media (max-width: 560px) {
  .ai-config-section__tabs {
    margin: 10px 10px 0;
  }

  .ai-config-section__tab-body {
    padding: 10px;
  }
}
</style>
