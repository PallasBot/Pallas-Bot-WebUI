<script setup lang="ts">
import AiConfigLayerLinks from "@/components/ai-config/AiConfigLayerLinks.vue";
import AiObservationLinks from "@/components/ai-config/AiObservationLinks.vue";
import LocalModelRoutingPanel from "@/components/ai-config/LocalModelRoutingPanel.vue";
</script>

<template>
  <div class="ai-config-section ai-config-section--routing">
    <p class="muted ai-config-section__layer-hint">
      本页配置<strong>请求如何选模型</strong>（task 路由、MoE、多模型分流）；权重加载与上游登记见下方入口。
    </p>
    <div class="ai-config-section__link-stack">
      <AiConfigLayerLinks active="routing" />
      <AiObservationLinks />
    </div>
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

.ai-config-section__link-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
