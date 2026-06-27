<script setup lang="ts">
import { computed, ref } from "vue";
import ProviderManager from "@/components/ai-config/providers/ProviderManager.vue";
import AiWizardChecklist from "@/components/ai-config/AiWizardChecklist.vue";
import { AI_CONFIG_LAYER_LINKS, AI_TASK_CONFIG_HINTS } from "@/config/aiEntrySemantics";
import { wizardChecksForSection } from "@/config/aiWizardGuide";
import { useAiConfigExpertMode } from "@/composables/useAiConfigExpertMode";

const { isSimpleMode } = useAiConfigExpertMode();
const providerRef = ref<InstanceType<typeof ProviderManager> | null>(null);
const sectionChecks = computed(() => wizardChecksForSection("provider"));

defineExpose({
  save: () => providerRef.value?.save?.(),
  canSave: () => providerRef.value?.canSave?.() ?? false,
  saving: () => providerRef.value?.saving ?? false,
});
</script>

<template>
  <div class="ai-config-section ai-config-section--provider">
    <AiWizardChecklist
      compact
      title="Provider 自检"
      :check-ids="sectionChecks"
    />
    <p class="muted ai-config-section__layer-hint">
      {{ AI_TASK_CONFIG_HINTS.providerSection }}
      全局 task→模型与 MoE 见
      <RouterLink :to="AI_CONFIG_LAYER_LINKS.routing.path">{{ AI_CONFIG_LAYER_LINKS.routing.label }}</RouterLink>；
      本地权重热切换见
      <RouterLink :to="AI_CONFIG_LAYER_LINKS.runtime.path">{{ AI_CONFIG_LAYER_LINKS.runtime.label }}</RouterLink>。
    </p>
    <p v-if="isSimpleMode" class="muted ai-config-section__simple-note">
      简单模式下可登记与测试 Provider；task→Provider 路由矩阵请开启专家模式。
    </p>
    <ProviderManager ref="providerRef" :simple-mode="isSimpleMode" />
  </div>
</template>

<style scoped>
.ai-config-section--provider {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-config-section__layer-hint {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.55;
}

.ai-config-section__simple-note {
  margin: 0;
  font-size: 0.78rem;
}
</style>
