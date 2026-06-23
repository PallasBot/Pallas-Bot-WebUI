<script setup lang="ts">
import { ref } from "vue";
import ProviderManager from "@/components/ai-config/providers/ProviderManager.vue";
import { AI_CONFIG_LAYER_LINKS } from "@/config/aiEntrySemantics";

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
      本页登记<strong>上游模型端点</strong>；本地 Ollama 热切换见
      <RouterLink :to="AI_CONFIG_LAYER_LINKS.runtime.path">{{ AI_CONFIG_LAYER_LINKS.runtime.label }}</RouterLink>，
      task 选路见
      <RouterLink :to="AI_CONFIG_LAYER_LINKS.routing.path">{{ AI_CONFIG_LAYER_LINKS.routing.label }}</RouterLink>。
    </p>
    <ProviderManager ref="providerRef" />
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
</style>
