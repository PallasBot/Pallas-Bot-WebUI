<script setup lang="ts">
import AiConfigLayerLinks from "@/components/ai-config/AiConfigLayerLinks.vue";
import AiObservationLinks from "@/components/ai-config/AiObservationLinks.vue";
import LocalModelRoutingPanel from "@/components/ai-config/LocalModelRoutingPanel.vue";
import { AI_CONFIG_LAYER_LINKS, AI_TASK_CONFIG_HINTS } from "@/config/aiEntrySemantics";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import { useAiConfigExpertMode } from "@/composables/useAiConfigExpertMode";

const { isSimpleMode, setExpertMode } = useAiConfigExpertMode();
</script>

<template>
  <div class="ai-config-section ai-config-section--routing">
    <p class="muted ai-config-section__layer-hint">
      {{ AI_TASK_CONFIG_HINTS.routingSection }}
      上游登记与 task→Provider 见
      <RouterLink :to="AI_CONFIG_LAYER_LINKS.provider.path">{{ AI_CONFIG_LAYER_LINKS.provider.label }}</RouterLink>。
    </p>
    <div v-if="isSimpleMode" class="ai-config-section__simple-card">
      <strong>简单模式默认单模型跟随运行态</strong>
      <p class="muted">
        多数站点无需改 task / MoE。若需多模型分流或按 task 指定模型，请开启专家模式。
      </p>
      <button type="button" class="ai-config-section__simple-link" @click="setExpertMode(true)">
        开启专家模式编辑路由
      </button>
      <RouterLink :to="aiConfigSectionPath('runtime')" class="ai-config-section__simple-link">
        先去确认运行模型
      </RouterLink>
    </div>
    <template v-else>
      <div class="ai-config-section__link-stack">
        <AiConfigLayerLinks active="routing" />
        <AiObservationLinks />
      </div>
      <LocalModelRoutingPanel />
    </template>
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

.ai-config-section__simple-card {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border: 1px dashed var(--border);
  border-radius: 12px;
}

.ai-config-section__simple-link {
  justify-self: start;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  cursor: pointer;
  font: inherit;
  text-decoration: none;
}

.ai-config-section__simple-link:hover {
  text-decoration: underline;
}
</style>
