<script setup lang="ts">
import LocalModelRoutingPanel from "@/components/ai-config/LocalModelRoutingPanel.vue";
import { AI_CONFIG_LAYER_LINKS } from "@/config/aiEntrySemantics";
</script>

<template>
  <div class="ai-config-section ai-config-section--routing">
    <p class="muted ai-config-section__layer-hint">
      本页配置<strong>请求如何选模型</strong>（task 路由、MoE、多模型分流）；实际加载哪套权重见
      <RouterLink :to="AI_CONFIG_LAYER_LINKS.runtime.path">{{ AI_CONFIG_LAYER_LINKS.runtime.label }}</RouterLink>，
      上游登记见
      <RouterLink :to="AI_CONFIG_LAYER_LINKS.provider.path">{{ AI_CONFIG_LAYER_LINKS.provider.label }}</RouterLink>。
    </p>
    <LocalModelRoutingPanel />
  </div>
</template>

<style scoped>
.ai-config-section--routing {
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
