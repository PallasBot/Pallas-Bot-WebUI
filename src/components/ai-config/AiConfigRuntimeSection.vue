<script setup lang="ts">
import ModelAdminPanel from "@/components/ai-config/ModelAdminPanel.vue";
import { AI_CONFIG_LAYER_LINKS } from "@/config/aiEntrySemantics";
</script>

<template>
  <div class="ai-config-section ai-config-section--runtime">
    <p class="muted ai-config-section__layer-hint">
      本页只管<strong>当前加载的本地模型</strong>；上游端点见
      <RouterLink :to="AI_CONFIG_LAYER_LINKS.provider.path">{{ AI_CONFIG_LAYER_LINKS.provider.label }}</RouterLink>，
      task / MoE 分流见
      <RouterLink :to="AI_CONFIG_LAYER_LINKS.routing.path">{{ AI_CONFIG_LAYER_LINKS.routing.label }}</RouterLink>。
    </p>
    <ModelAdminPanel />
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
</style>
