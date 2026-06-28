<script setup lang="ts">
import { ref } from "vue";
import ModelAdminPanel from "@/components/ai-config/ModelAdminPanel.vue";
import LocalModelRoutingPanel from "@/components/ai-config/LocalModelRoutingPanel.vue";
import ProviderManager from "@/components/ai-config/providers/ProviderManager.vue";
import AiObservationLinks from "@/components/ai-config/AiObservationLinks.vue";
import { AI_TASK_CONFIG_HINTS } from "@/config/aiEntrySemantics";
import { useAiConfigExpertMode } from "@/composables/useAiConfigExpertMode";

const { isSimpleMode } = useAiConfigExpertMode();
const providerRef = ref<InstanceType<typeof ProviderManager> | null>(null);

defineExpose({
  save: () => providerRef.value?.save?.(),
  canSave: () => providerRef.value?.canSave?.() ?? false,
  saving: () => providerRef.value?.saving ?? false,
});
</script>

<template>
  <div class="ai-config-section ai-config-section--provider">
    <p class="muted ai-config-section__layer-hint">
      本地模型热切换与上游 Provider 登记都在本页：前者管当前进程加载哪套权重，后者管 OpenAI 兼容 / 本地端点与连通性。
      {{ AI_TASK_CONFIG_HINTS.providerIntro }}
    </p>
    <AiObservationLinks />
    <ModelAdminPanel :simple-mode="isSimpleMode" embedded />
    <ProviderManager ref="providerRef" :simple-mode="isSimpleMode" />
    <LocalModelRoutingPanel v-if="!isSimpleMode" />
    <p v-else class="muted ai-config-section__simple-note">
      简单模式下可切换本地模型并登记 / 测试 Provider；任务→Provider 矩阵与多模型分流请开启专家模式。
    </p>
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

.ai-config-section__simple-note {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.45;
  padding: 10px 12px;
  border: 1px dashed var(--border);
  border-radius: 12px;
}
</style>
