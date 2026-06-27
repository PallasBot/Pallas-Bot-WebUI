<script setup lang="ts">
import { computed } from "vue";
import ModelAdminPanel from "@/components/ai-config/ModelAdminPanel.vue";
import AiWizardChecklist from "@/components/ai-config/AiWizardChecklist.vue";
import { AI_CONFIG_LAYER_LINKS } from "@/config/aiEntrySemantics";
import { wizardChecksForSection } from "@/config/aiWizardGuide";
import { useAiConfigExpertMode } from "@/composables/useAiConfigExpertMode";

const { isSimpleMode } = useAiConfigExpertMode();
const sectionChecks = computed(() => wizardChecksForSection("runtime"));
</script>

<template>
  <div class="ai-config-section ai-config-section--runtime">
    <AiWizardChecklist
      v-if="isSimpleMode"
      compact
      title="运行模型自检"
      :check-ids="sectionChecks"
    />
    <p class="muted ai-config-section__layer-hint">
      本页只管<strong>当前加载的本地模型</strong>；上游端点见
      <RouterLink :to="AI_CONFIG_LAYER_LINKS.provider.path">{{ AI_CONFIG_LAYER_LINKS.provider.label }}</RouterLink>，
      task / MoE 分流见
      <RouterLink :to="AI_CONFIG_LAYER_LINKS.routing.path">{{ AI_CONFIG_LAYER_LINKS.routing.label }}</RouterLink>。
    </p>
    <p v-if="isSimpleMode" class="muted ai-config-section__simple-note">
      简单模式下仅保留模型切换与 GPU；重载 / 卸载等操作请开启专家模式。
    </p>
    <ModelAdminPanel :simple-mode="isSimpleMode" />
  </div>
</template>

<style scoped>
.ai-config-section--runtime {
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
